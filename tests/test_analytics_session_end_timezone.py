"""Exercise the real Mongo repository with BSON-decoded timestamps and fake storage."""
import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

from bson import BSON
import pytest
from fastapi.testclient import TestClient

from backend import server
from backend.analytics import ANALYTICS_EVENT_SCOPE, MongoAnalyticsRepository

START = datetime(2026, 9, 21, 18, tzinfo=UTC)
END = START + timedelta(minutes=7, milliseconds=125)


def repository_with(started_at):
    collection = SimpleNamespace(
        find_one=AsyncMock(return_value={'_id': 'session', 'startedAt': started_at}),
        update_one=AsyncMock(return_value=SimpleNamespace(modified_count=1)),
    )
    return MongoAnalyticsRepository(SimpleNamespace(analytics_sessions=collection)), collection


def finish(repository, received_at=END):
    return asyncio.run(repository.end_session(visitor_id='visitor', session_id='session', received_at=received_at, reason='explicit'))


def test_bson_naive_start_and_aware_receipt_regression():
    decoded = BSON.encode({'startedAt': START}).decode()['startedAt']
    assert decoded.tzinfo is None  # Mongo's default BSON decoding reproduces production.
    repository, collection = repository_with(decoded)
    assert finish(repository) == 420.125
    collection.find_one.assert_awaited_once_with({
        'eventScope': ANALYTICS_EVENT_SCOPE, 'sessionId': 'session', 'visitorId': 'visitor', 'status': 'active',
    })
    collection.update_one.assert_awaited_once_with(
        {'_id': 'session', 'status': 'active'},
        {'$set': {'status': 'ended', 'endedAt': END, 'lastActivityAt': END,
                  'durationSeconds': 420.125, 'endReason': 'explicit', 'updatedAt': END}},
    )


@pytest.mark.parametrize('started,received,seconds', [
    (START, END, 420.125),
    (START.replace(tzinfo=None), END.replace(tzinfo=None), 420.125),
    (START, END.replace(tzinfo=None), 420.125),
    (datetime.fromisoformat('2026-09-21T14:00:00-04:00'), END, 420.125),
    (START.replace(tzinfo=None), datetime.fromisoformat('2026-09-21T14:07:00.125-04:00'), 420.125),
    (START.replace(tzinfo=None), START - timedelta(seconds=1), 0),
])
def test_duration_preserves_instants_fractional_seconds_and_zero_clamp(started, received, seconds):
    repository, _ = repository_with(started)
    assert finish(repository, received) == seconds


@pytest.mark.parametrize('stored', [None, 'not-a-date', '2026-09-21T18:00:00Z', {}])
def test_invalid_stored_timestamp_still_rejects_before_any_update(stored):
    repository, collection = repository_with(stored)
    with pytest.raises((AttributeError, TypeError)):
        finish(repository)
    collection.update_one.assert_not_awaited()


def test_missing_timestamp_missing_session_and_concurrent_end_keep_existing_semantics():
    repository, collection = repository_with(START)
    collection.find_one.return_value = {'_id': 'session'}
    with pytest.raises(KeyError): finish(repository)
    collection.update_one.assert_not_awaited()
    collection.find_one.return_value = None
    assert finish(repository) is None
    collection.update_one.assert_not_awaited()
    collection.find_one.return_value = {'_id': 'session', 'startedAt': START.replace(tzinfo=None)}
    collection.update_one.return_value = SimpleNamespace(modified_count=0)
    assert finish(repository) is None


@pytest.mark.parametrize('occurred_at', ['not-a-date', '', {}, '2026-09-21T18:00:00'])
def test_malformed_client_timestamp_remains_422_without_repository_calls(monkeypatch, occurred_at):
    repository = AsyncMock()
    monkeypatch.setattr(server, 'analytics_repository', repository)
    response = TestClient(server.app).post('/api/activity/session/end', json={
        'visitorId': str(uuid4()), 'sessionId': str(uuid4()), 'clientEventId': str(uuid4()),
        'occurredAt': occurred_at, 'reason': 'explicit',
    })
    assert response.status_code == 422
    assert repository.mock_calls == []
