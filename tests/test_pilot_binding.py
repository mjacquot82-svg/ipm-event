import hashlib
import json
from unittest.mock import AsyncMock
import pytest
from tests.test_production_reconciliation import config, request, CAP, PRIVATE

INV = 'PRIVATE-INVITATION-CANARY'.ljust(43, 'x')
PATH = '/notification-registrations/bind-pilot'
SUCCESS = dict(bound=True,pilot_restriction_count=1,observation_enabled=False,repair_enabled=False)
def call(client, **kw):
 return request(config(client),PATH,headers={'Origin':'https://theipm.ca','X-Notification-Device-Capability':CAP},content=json.dumps({'invitation':INV}),**kw)

def test_binding_only_hashes_identity_and_invitation_sanitizes_response(caplog):
 client=AsyncMock();client.request.return_value={**SUCCESS,'private':PRIVATE}
 r=call(client)
 assert r.json()==SUCCESS and r.headers['cache-control']=='no-store'
 client.request.assert_awaited_once_with('POST','/rpc/ipm_bind_reconciliation_pilot',json={'p':{'event_slug':'ipm-2026','capability_hash':hashlib.sha256(CAP.encode()).hexdigest(),'invitation_hash':hashlib.sha256(INV.encode()).hexdigest()}})
 for secret in (CAP,INV,PRIVATE,hashlib.sha256(INV.encode()).hexdigest(),hashlib.sha256(CAP.encode()).hexdigest()):
  assert secret not in r.text+caplog.text

@pytest.mark.parametrize('body',[{},[],{'invitation':INV,'registration_id':PRIVATE},{'invitation':None},{'invitation':'bad'}])
def test_binding_rejects_arbitrary_selection_and_invalid_invitation(body):
 client=AsyncMock()
 r=request(config(client),PATH,headers={'Origin':'https://theipm.ca','X-Notification-Device-Capability':CAP},content=json.dumps(body))
 assert r.status_code==404 and r.json()=={'bound':False};client.request.assert_not_called()

@pytest.mark.parametrize('field',['host','app','database','event'])
def test_binding_production_isolation(field):
 client=AsyncMock();c=config(client);c[field]='wrong'
 r=request(c,PATH,headers={'Origin':'https://theipm.ca','X-Notification-Device-Capability':CAP},content=json.dumps({'invitation':INV}))
 assert r.status_code==404;client.request.assert_not_called()

@pytest.mark.parametrize('headers',[{}, {'Origin':'https://wrong.example','X-Notification-Device-Capability':CAP},{'Origin':'https://theipm.ca','X-Notification-Device-Capability':'bad'}])
def test_binding_origin_and_capability_required(headers):
 client=AsyncMock();assert request(config(client),PATH,headers=headers,content=json.dumps({'invitation':INV})).status_code==404
 client.request.assert_not_called()

@pytest.mark.parametrize('result',[{'bound':False},{**SUCCESS,'observation_enabled':True},{**SUCCESS,'repair_enabled':True},{**SUCCESS,'pilot_restriction_count':True}])
def test_binding_failed_or_consumed_unavailable(result):
 client=AsyncMock();client.request.return_value=result
 assert call(client).status_code==404

def test_binding_ambiguous_outcome_no_retry_no_secret(caplog):
 client=AsyncMock();client.request.side_effect=Exception(INV+CAP+PRIVATE)
 r=call(client);assert r.status_code==503 and r.json()=={'bound':False}
 client.request.assert_awaited_once()
 assert all(v not in r.text+caplog.text for v in (INV,CAP,PRIVATE))

def test_binding_oversize_no_database_call():
 client=AsyncMock()
 assert request(config(client),PATH,headers={'Origin':'https://theipm.ca','X-Notification-Device-Capability':CAP},content='x'*129).status_code==404
 client.request.assert_not_called()
