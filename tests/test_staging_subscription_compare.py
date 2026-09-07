import asyncio
import base64
import io
import json
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from backend import staging_subscription_compare as diagnostic
from backend.staging_provider_diagnostic import STAGING_HOST, STAGING_APP, STAGING_DATABASE

CONFIG = dict(render_hostname=STAGING_HOST, public_app_url=STAGING_APP, supabase_url=STAGING_DATABASE)
TARGET = 'A' * 40
SECRET = 'never-expose-test-credential'
KEY = b'\x04' + bytes(range(64))
AUTH = bytes(range(16))
ENDPOINT = 'https://push.example.invalid/test-only-endpoint'
ENCODE = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
TOKEN = {'data': ENDPOINT, 'p256dh': ENCODE(KEY), 'auth': ENCODE(AUTH), 'applicationServerKey': ENCODE(KEY)}


def payload():
    challenge = '01' * 32
    values = dict(endpoint=ENDPOINT.encode(), p256dh=KEY, auth=AUTH, application_server_key=KEY)
    return {'challenge': challenge, 'digests': {field: diagnostic.field_digest(challenge, field, value) for field, value in values.items()}}


class Database:
    def __init__(self, rows=None):
        self.rows = rows if rows is not None else [{'wonderpush_installation_id': TARGET}]
        self.reads = 0
    async def request(self, method, path, **kwargs):
        assert method == 'GET' and path == '/notification_installations'
        assert kwargs == {'params': {'select': 'wonderpush_installation_id', 'limit': '2'}}
        self.reads += 1
        return self.rows


def run(database, data=None, **config):
    return asyncio.run(diagnostic.compare_current(**{**CONFIG, **config}, repository=SimpleNamespace(client=database), credential=SECRET, payload=payload() if data is None else data))


def test_all_four_fields_match_and_no_sensitive_output(caplog):
    result = diagnostic.compare_body({'pushToken': TOKEN, 'id': TARGET, 'accessToken': SECRET}, payload())
    assert result == {diagnostic.RESULT: True, **{field + '_match': True for field in diagnostic.FIELDS}}
    for sensitive in [ENDPOINT, TOKEN['auth'], TOKEN['p256dh'], TARGET, SECRET, payload()['challenge'], *payload()['digests'].values()]:
        assert sensitive not in json.dumps(result) + caplog.text


@pytest.mark.parametrize('field', diagnostic.FIELDS)
def test_partial_equality_never_matches(field):
    request = payload()
    request['digests'][field] = '00' * 32
    result = diagnostic.compare_body({'pushToken': TOKEN}, request)
    assert result[diagnostic.RESULT] is False
    assert result[field + '_match'] is False
    assert sum(result[field + '_match'] for field in diagnostic.FIELDS) == 3


@pytest.mark.parametrize('field', TOKEN)
def test_missing_material_is_unverifiable_not_false(field):
    token = dict(TOKEN); del token[field]
    assert diagnostic.compare_body({'pushToken': token}, payload()) == diagnostic.unverifiable()


@pytest.mark.parametrize('value', [None, '', 'unencodable+/material', 'A', 'AB', SECRET, 'AAAA===='])
def test_unreliable_binary_representation_is_unverifiable(value):
    token = {**TOKEN, 'auth': value}
    assert diagnostic.compare_body({'pushToken': token}, payload()) == diagnostic.unverifiable()


def test_equivalent_padded_and_unpadded_binary_keys_match():
    token = {key: (value + '=' * (-len(value) % 4) if key != 'data' else value) for key, value in TOKEN.items()}
    assert diagnostic.compare_body({'pushToken': token}, payload())[diagnostic.RESULT] is True


def test_challenge_binds_each_comparison():
    request = payload(); request['challenge'] = '02' * 32
    result = diagnostic.compare_body({'pushToken': TOKEN}, request)
    assert result[diagnostic.RESULT] is False
    assert not any(result[field + '_match'] for field in diagnostic.FIELDS)


def test_one_get_exact_field_projection_no_provider_or_database_mutations(monkeypatch, caplog):
    class Response(io.BytesIO):
        status = 200
    calls = []
    def provider(request, timeout):
        calls.append(request)
        assert request.method == 'GET' and timeout == 25
        query = parse_qs(urlsplit(request.full_url).query, keep_blank_values=True)
        assert query == {'accessToken': [SECRET], 'userId': [''], 'fields': ['pushToken.data,pushToken.p256dh,pushToken.auth,pushToken.applicationServerKey']}
        return Response(json.dumps({'pushToken': TOKEN, 'id': TARGET, 'accessToken': SECRET}).encode())
    monkeypatch.setattr(diagnostic, 'build_opener', lambda handler: SimpleNamespace(open=provider))
    database = Database()
    result = run(database)
    assert len(calls) == database.reads == 1
    assert result[diagnostic.RESULT] is True
    assert SECRET not in json.dumps(result) + caplog.text
    assert ENDPOINT not in json.dumps(result) + caplog.text


@pytest.mark.parametrize('config', [dict(render_hostname='production.onrender.com'), dict(public_app_url='https://theipm.ca'), dict(supabase_url='https://production.supabase.co')])
def test_production_gating_precedes_every_read(config, monkeypatch):
    provider = Mock(side_effect=AssertionError('provider called'))
    monkeypatch.setattr(diagnostic, 'provider_compare', provider)
    database = Database()
    with pytest.raises(HTTPException) as error:
        run(database, **config)
    assert error.value.status_code == 404
    assert database.reads == 0
    provider.assert_not_called()


@pytest.mark.parametrize('data', [{}, {'challenge': SECRET}, {**payload(), 'endpoint': ENDPOINT}, {'challenge': '01' * 32, 'digests': {'endpoint': SECRET}}])
def test_invalid_input_is_not_echoed_and_never_fetches(data, monkeypatch):
    provider = Mock(side_effect=AssertionError('provider called'))
    monkeypatch.setattr(diagnostic, 'provider_compare', provider)
    database = Database()
    assert run(database, data) == diagnostic.unverifiable()
    assert database.reads == 0
    provider.assert_not_called()


@pytest.mark.parametrize('rows', [[], [{'wonderpush_installation_id': TARGET}] * 2])
def test_no_guessing_which_registration(rows, monkeypatch):
    provider = Mock(side_effect=AssertionError('provider called'))
    monkeypatch.setattr(diagnostic, 'provider_compare', provider)
    assert run(Database(rows)) == diagnostic.unverifiable()
    provider.assert_not_called()


def test_no_retry_and_no_exception_disclosure(monkeypatch, caplog):
    provider = Mock(side_effect=TimeoutError(SECRET + ENDPOINT))
    monkeypatch.setattr(diagnostic, 'build_opener', lambda handler: SimpleNamespace(open=provider))
    assert run(Database()) == diagnostic.unverifiable()
    assert provider.call_count == 1
    assert SECRET not in caplog.text and ENDPOINT not in caplog.text


def test_actual_browser_encoding_matches_python_provider_encoding():
    script = '''
import { webcrypto } from 'node:crypto';
import { digestSubscription } from './diagnostics/staging-subscription-compare/compare.mjs';
let input=''; for await (const chunk of process.stdin) input+=chunk;
const token=JSON.parse(input);
const bytes = value => Uint8Array.from(Buffer.from(value, 'base64url')).buffer;
const subscription={endpoint:token.data,getKey:name=>bytes(token[name]),options:{applicationServerKey:bytes(token.applicationServerKey)}};
const result=await digestSubscription(subscription,new Uint8Array(32).fill(1),webcrypto);
process.stdout.write(JSON.stringify(result));
'''
    response = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps(TOKEN), text=True, capture_output=True, check=True)
    browser_payload = json.loads(response.stdout)
    assert diagnostic.compare_body({'pushToken': TOKEN}, browser_payload)[diagnostic.RESULT] is True


@pytest.mark.parametrize('staging', [True, False])
def test_actual_endpoint_production_is_absent_and_input_cannot_echo(staging):
    env = {**os.environ, 'CONTENT_SOURCE': 'google_sheets', 'MONGO_URL': '', 'MONGODB_URL': '',
        'RENDER_EXTERNAL_HOSTNAME': STAGING_HOST if staging else 'production.onrender.com',
        'PUBLIC_APP_URL': STAGING_APP if staging else 'https://theipm.ca', 'SUPABASE_URL': STAGING_DATABASE}
    script = '''
import asyncio,json,httpx
from backend import server
async def check():
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='https://ipm-staging-backend.onrender.com') as client:
  p='/api/staging-diagnostics/compare-subscription'
  headers={'Origin':'https://staging.theipm.ca','X-IPM-Staging-Diagnostic':'compare-current-subscription'}
  denied=await client.post(p,json={})
  invalid=await client.post(p,headers=headers,json={'secret':'do-not-echo'})
  huge=await client.post(p,headers=headers,content='S'*3000)
  get=await client.get(p)
  print(json.dumps({'denied':denied.status_code,'invalid':invalid.status_code,'body':invalid.json(),'huge':huge.json(),'get':get.status_code}))
asyncio.run(check())
'''
    response = subprocess.run([sys.executable, '-c', script], env=env, text=True, capture_output=True, check=True)
    data = json.loads(response.stdout)
    assert data['denied'] == 404
    assert data['invalid'] == (200 if staging else 404)
    assert data['get'] == (405 if staging else 404)
    if staging:
        assert data['body'] == data['huge'] == diagnostic.unverifiable()
