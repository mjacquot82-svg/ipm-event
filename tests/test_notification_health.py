import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from backend.notification_health import build_health, health_report
from backend import server
from fastapi.testclient import TestClient

NOW = datetime(2026, 9, 8, tzinfo=timezone.utc)
PAST = (NOW - timedelta(days=2)).isoformat()
FUTURE = (NOW + timedelta(hours=1)).isoformat()


def row(status=None, **meta):
    return {'id': str(uuid.uuid4()), 'notification_reconciliation': {'status': status, **meta} if status else None}


def test_zero_and_unchecked():
    for rows in ([], [row(), row()]):
        result = build_health(rows, {}, now=NOW)
        assert result['registrations'] == len(rows)
        assert result['checked'] == 0
        assert result['not_yet_checked'] == len(rows)
        assert result['latest_activity_at'] is None


@pytest.mark.parametrize('status,outcome,field', [
    ('VERIFIED', None, 'verified'), ('MISMATCH', 'MISMATCH', 'repairable_mismatch'),
    ('INELIGIBLE', 'KEY_MISMATCH', 'key_mismatch'), ('INELIGIBLE', 'OPT_OUT', 'other_ineligible'),
    ('DEFERRED', 'READINESS_UNKNOWN', 'other_checked'),
])
def test_current_classes(status, outcome, field):
    result = build_health([row(status, outcome=outcome)], {}, now=NOW)
    assert result[field] == result['checked'] == 1
    assert result['not_yet_checked'] == 0


def test_mixed_arithmetic_duplicates_and_no_negative_counts():
    rows = [row('VERIFIED'), row('MISMATCH'), row('INELIGIBLE', outcome='KEY_MISMATCH'), row('INELIGIBLE', outcome='OS_HIDDEN'), row()]
    # Duplicate metadata must never multiply registrations, even if returned as a list.
    rows[0]['notification_reconciliation'] = [rows[0]['notification_reconciliation']] * 2
    result = build_health(rows + [rows[0]], {}, now=NOW)
    assert result['registrations'] == 5 and result['checked'] == 4
    assert result['not_yet_checked'] == 1
    assert sum(result[k] for k in ('verified', 'repairable_mismatch', 'key_mismatch', 'other_ineligible', 'other_checked')) == result['checked']
    assert all(v >= 0 for v in result.values() if isinstance(v, int))


def test_uncertainty_leases_retry_circuit_and_activity():
    rows = [row('OUTCOME_UNKNOWN', uncertain=True, next_attempt_at=PAST, updated_at=PAST),
            row('PATCH_PENDING', uncertain=True, lease_until=FUTURE, next_attempt_at=FUTURE),
            row('VERIFYING', lease_until=PAST)]
    result = build_health(rows, {'open_until': FUTURE}, now=NOW)
    assert result['uncertain'] == 2
    assert result['active_leases'] == result['expired_leases'] == 1
    assert result['retries_due'] == result['retries_scheduled'] == 1
    assert result['circuit'] == 'OPEN' and result['circuit_open_until'] == FUTURE
    assert result['latest_activity_at'] == PAST
    assert build_health([], {'open_until': PAST}, now=NOW)['circuit'] == 'CLOSED'
    assert build_health([], None, now=NOW)['circuit'] == 'UNKNOWN'


@pytest.mark.parametrize('status,outcome', [('VERIFIED', None), ('DEFERRED', 'PROVIDER'), ('OUTCOME_UNKNOWN', 'NETWORK')])
def test_repair_success_or_failure_cannot_be_inferred(status, outcome):
    result = build_health([row(status, outcome=outcome, failures=29)], {}, now=NOW)
    assert result['repairs_attempted'] is result['repairs_verified'] is result['repair_failures'] is None
    assert result['current_check_failures'] == (status != 'VERIFIED')


def test_latest_provider_evidence_not_equality_and_newer_negative_wins():
    old_ready = {**row(), 'provider_deliverable': True, 'provider_checked_at': PAST}
    newer_negative = {**row('INELIGIBLE', provider_ready=False, provider_checked_at=NOW.isoformat()), 'provider_deliverable': True, 'provider_checked_at': PAST}
    key_mismatch = row('INELIGIBLE', outcome='KEY_MISMATCH', provider_ready=True, provider_checked_at=NOW.isoformat())
    no_evidence = {**row('VERIFIED'), 'provider_deliverable': True}
    result = build_health([old_ready, newer_negative, key_mismatch, no_evidence], {}, now=NOW)
    assert result['provider_ready'] == 2 and result['provider_ready_stale'] == 1
    assert result['verified'] == 1


class Client:
    async def get_event_id(self, slug):
        return 'event-test'

    async def request(self, method, path, params):
        assert method == 'GET'
        assert '*' not in params['select']
        assert not any(x in params['select'] for x in ('fingerprint', 'capability', 'installation_id', 'operation_id', 'p256dh'))
        if path.endswith('_project'):
            return [{'open_until': None}]
        assert params['event_id'] == 'eq.event-test'
        # Deliberately cap below requested page size to test complete pagination.
        offset = int(params['offset'])
        return [{'id': str(i), 'notification_reconciliation': None} for i in range(offset, min(offset + 2, 5))]


def test_readonly_paginated_repository_and_privacy():
    from backend.notification_registrations import SupabaseNotificationRegistrationRepository
    result = asyncio.run(health_report(SupabaseNotificationRegistrationRepository(Client(), 'test'), now=NOW))
    assert result['registrations'] == 5
    canary = row('VERIFIED', endpoint='PRIVATE_ENDPOINT', p256dh='PRIVATE_KEY', auth='PRIVATE_AUTH', fingerprint='PRIVATE_HASH')
    canary['id'] = 'PRIVATE_UUID'
    payload = json.dumps(build_health([canary], {}, now=NOW))
    assert 'PRIVATE_' not in payload
    assert not any(x in payload for x in ('registration_id', 'installation_id', 'capability', 'p256dh', 'fingerprint', 'endpoint'))


def test_admin_authorization_event_scope_and_no_store(monkeypatch):
    import backend.notification_health as module
    async def report(repository):
        return build_health([], {})
    monkeypatch.setattr(module, 'health_report', report)
    monkeypatch.setattr(server, 'analytics_reporting_repository', object())
    monkeypatch.setattr(server, 'notification_registration_repository', object())
    monkeypatch.setattr(server, 'db', object())
    client = TestClient(server.app)
    path = '/api/admin/analytics/notification-health'
    assert client.get(path).status_code == 401
    try:
        server.app.dependency_overrides[server.get_current_organizer_user] = lambda: {'event_id': 'wrong', 'role': 'Owner'}
        assert client.get(path).status_code == 403
        server.app.dependency_overrides[server.get_current_organizer_user] = lambda: {'event_id': 'ipm-2026', 'role': 'Owner'}
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers['cache-control'] == 'no-store'
        async def broken(repository):
            raise RuntimeError('PRIVATE_PROVIDER_CREDENTIAL')
        monkeypatch.setattr(module, 'health_report', broken)
        response = client.get(path)
        assert response.status_code == 503 and 'PRIVATE' not in response.text
    finally:
        server.app.dependency_overrides.clear()
