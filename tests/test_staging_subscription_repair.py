import asyncio
import base64
import hashlib
import json
import os
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import Mock
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import HTTPException
from backend import staging_subscription_repair as repair
from backend.staging_provider_diagnostic import STAGING_HOST, STAGING_APP, STAGING_DATABASE

CONFIG = dict(render_hostname=STAGING_HOST, public_app_url=STAGING_APP, supabase_url=STAGING_DATABASE)
CAPABILITY = 'a' * 43
TARGET = 'b' * 40
SECRET = 'secret-test-credential'
ENCODE = lambda b: base64.urlsafe_b64encode(b).decode().rstrip('=')
KEY = b'\x04' + bytes(range(64))
TOKEN = dict(data='https://push.example.invalid/current', p256dh=ENCODE(KEY), auth=ENCODE(bytes(range(16))), applicationServerKey=ENCODE(KEY))
OLD = dict(TOKEN, data='https://push.example.invalid/stale', p256dh=ENCODE(b'\x04' + b'z' * 64), auth=ENCODE(b'z' * 16))


def payload():
    c = repair.comparison
    challenge = '01' * 32
    vals = dict(endpoint=TOKEN['data'].encode(), p256dh=KEY, auth=bytes(range(16)), application_server_key=KEY)
    return {'subscription': dict(TOKEN), 'comparison': {'challenge': challenge,
        'digests': {f: c.field_digest(challenge, f, v) for f, v in vals.items()}}}


class DB:
    def __init__(self, rows=None):
        self.rows = rows if rows is not None else [{'wonderpush_installation_id': TARGET, 'capability_hash': hashlib.sha256(CAPABILITY.encode()).hexdigest()}]
        self.reads = 0
    async def request(self, method, path, **kwargs):
        assert method == 'GET' and path == '/notification_installations'
        assert kwargs == {'params': {'select': 'wonderpush_installation_id,capability_hash', 'limit': '2'}}
        self.reads += 1
        return self.rows


@pytest.fixture(autouse=True)
def reset(monkeypatch):
    monkeypatch.setattr(repair, '_attempted', False)
    monkeypatch.setattr(repair, '_lock', asyncio.Lock())


def run(db=None, data=None, capability=CAPABILITY, **config):
    return asyncio.run(repair.repair_current(**{**CONFIG, **config}, repository=SimpleNamespace(client=db or DB()),
        credential=SECRET, capability=capability, payload=payload() if data is None else data))


def test_stale_same_key_updates_existing_and_verifies_without_database_mutation(monkeypatch, caplog):
    reads = Mock(side_effect=[{'pushToken': OLD}, {'pushToken': TOKEN}])
    patch = Mock()
    monkeypatch.setattr(repair, 'read_token', reads)
    monkeypatch.setattr(repair, 'patch_token', patch)
    db = DB()
    output = run(db)
    assert output['repair_status'] == 'MATCH_VERIFIED'
    assert output[repair.comparison.RESULT] is True
    assert reads.call_count == 2 and db.reads == 1
    patch.assert_called_once_with(TARGET, SECRET, TOKEN)
    for value in [TARGET, CAPABILITY, SECRET, *TOKEN.values(), *payload()['comparison']['digests'].values()]:
        assert value not in json.dumps(output) + caplog.text


@pytest.mark.parametrize('token,status', [(TOKEN, 'ALREADY_MATCHED'), ({}, 'PRECONDITION_NOT_MET'),
    ({**OLD, 'applicationServerKey': OLD['p256dh']}, 'PRECONDITION_NOT_MET'),
    ({**OLD, 'auth': TOKEN['auth']}, 'PRECONDITION_NOT_MET')])
def test_no_patch_without_exact_observed_precondition(token, status, monkeypatch):
    monkeypatch.setattr(repair, 'read_token', Mock(return_value={'pushToken': token}))
    patch = Mock(); monkeypatch.setattr(repair, 'patch_token', patch)
    assert run()['repair_status'] == status
    patch.assert_not_called()


@pytest.mark.parametrize('config', [{'render_hostname':'production.onrender.com'}, {'public_app_url':'https://theipm.ca'}, {'supabase_url':'https://production.supabase.co'}])
def test_production_refused_before_any_io(config, monkeypatch):
    read = Mock(); monkeypatch.setattr(repair, 'read_token', read)
    db = DB()
    with pytest.raises(HTTPException) as error: run(db, **config)
    assert error.value.status_code == 404 and db.reads == 0
    read.assert_not_called()


@pytest.mark.parametrize('rows,cap', [([], CAPABILITY), ([{}]*2, CAPABILITY), ([{'wonderpush_installation_id': TARGET, 'capability_hash': 'bad'}], CAPABILITY), (None, 'c'*43), (None, '')])
def test_no_patch_without_single_owned_registration(rows, cap, monkeypatch):
    read = Mock(); monkeypatch.setattr(repair, 'read_token', read)
    assert run(DB(rows), capability=cap)['repair_status'] == 'NOT_AUTHORIZED'
    read.assert_not_called()


def test_invalid_material_and_digests_refused_before_io(monkeypatch):
    read = Mock(); monkeypatch.setattr(repair, 'read_token', read)
    for field in TOKEN:
        data = payload(); data['subscription'][field] = SECRET
        assert run(data=data)['repair_status'] == 'UNVERIFIABLE'
    data = payload(); data['comparison']['digests']['auth'] = '00' * 32
    assert run(data=data)['repair_status'] == 'UNVERIFIABLE'
    read.assert_not_called()


@pytest.mark.parametrize('after,expected', [({'pushToken': TOKEN}, 'MATCH_VERIFIED'), ({'pushToken': OLD}, 'OUTCOME_UNCONFIRMED')])
def test_ambiguous_patch_never_retried_and_can_be_verified(after, expected, monkeypatch, caplog):
    monkeypatch.setattr(repair, 'read_token', Mock(side_effect=[{'pushToken': OLD}, after, {'pushToken': OLD}]))
    patch = Mock(side_effect=TimeoutError(SECRET)); monkeypatch.setattr(repair, 'patch_token', patch)
    output = run()
    assert output['repair_status'] == expected
    assert run()['repair_status'] == 'ATTEMPT_ALREADY_USED'
    assert patch.call_count == 1 and SECRET not in caplog.text


def test_get_fields_and_patch_are_restricted_and_response_not_read(monkeypatch):
    calls = []
    class Response:
        status = 200
        def __init__(self, request): self.request = request
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, limit):
            assert self.request.method == 'GET'
            return json.dumps({'pushToken': OLD}).encode()
    def opening(request, timeout):
        calls.append(request)
        assert timeout == 25
        return Response(request)
    monkeypatch.setattr(repair, 'build_opener', lambda handler: SimpleNamespace(open=opening))
    repair.read_token(TARGET, SECRET); repair.patch_token(TARGET, SECRET, TOKEN)
    assert [r.method for r in calls] == ['GET', 'PATCH']
    query = parse_qs(urlsplit(calls[0].full_url).query)
    assert query['fields'] == [','.join(repair.comparison.PROVIDER_FIELDS)]
    assert json.loads(calls[1].data) == {'accessToken': SECRET, 'userId':'', 'body': {'pushToken': TOKEN}}
    assert not urlsplit(calls[1].full_url).query


@pytest.mark.parametrize('staging', [True, False])
def test_actual_route_gate_and_no_input_echo(staging):
    env = {**os.environ, 'CONTENT_SOURCE':'google_sheets', 'MONGO_URL':'', 'MONGODB_URL':'',
        'RENDER_EXTERNAL_HOSTNAME': STAGING_HOST if staging else 'production.onrender.com',
        'PUBLIC_APP_URL': STAGING_APP if staging else 'https://theipm.ca', 'SUPABASE_URL':STAGING_DATABASE}
    script = '''
import asyncio,json,httpx
from backend import server
async def check():
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='https://ipm-staging-backend.onrender.com') as c:
  path='/api/staging-diagnostics/reconcile-subscription'
  headers={'Origin':'https://staging.theipm.ca','X-IPM-Staging-Diagnostic':'reconcile-existing-subscription'}
  denied=await c.post(path,json={})
  invalid=await c.post(path,headers=headers,json={'secret':'never-echo'})
  huge=await c.post(path,headers=headers,content='never-echo'*2000)
  print(json.dumps({'denied':denied.status_code,'invalid':invalid.status_code,'body':invalid.json(),'huge':huge.json()}))
asyncio.run(check())
'''
    response = subprocess.run([sys.executable, '-c', script], env=env, text=True, capture_output=True, check=True)
    output = json.loads(response.stdout)
    assert output['denied'] == 404
    assert output['invalid'] == (200 if staging else 404)
    assert 'never-echo' not in response.stdout + response.stderr
    if staging: assert output['body'] == output['huge'] == repair.result('UNVERIFIABLE')
