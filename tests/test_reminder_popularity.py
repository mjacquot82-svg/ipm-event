import asyncio
import json
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from backend import reminder_popularity as module, server


def star(item_id='s1', title='Tractor Show', starts='2026-09-22T14:00:00Z', **changes):
    return {'schedule_item_id': item_id, 'item': {'id': item_id, 'title': title,
        'starts_at': starts, 'location_name': 'Main Ring', 'status': 'published', 'event_id': 'event-uuid', **changes}}


class Repository:
    event_slug = 'ipm-2026'
    def __init__(self, rows, cap=500):
        self.rows, self.cap, self.calls = rows, cap, []
        self.client = self
    async def _event_id(self): return 'event-uuid'
    async def request(self, method, path, params):
        self.calls.append((method, path, params))
        assert method == 'GET' and path == '/itinerary_reminder_stars'
        assert params['item.event_id'] == 'eq.event-uuid'
        assert params['item.status'] == 'eq.published'
        assert 'item:schedule_items!inner(' in params['select']
        assert 'registration_id' not in params['select']
        start = int(params['offset'])
        return self.rows[start:start + min(self.cap, int(params['limit']))]


def test_counts_exact_timeslots_published_event_scope_and_ties():
    repo = Repository([star()] * 3 + [star('s2', starts='2026-09-22T18:00:00Z')] * 3
        + [star('s3', 'Livestock Parade')] * 5 + [star('draft', status='draft')] * 9
        + [star('archived', status='archived')] * 8 + [star('wrong-event', event_id='other')] * 10, cap=2)
    # Raise the page bound here to exercise a deliberately tiny REST page cap.
    original = module.MAX_PAGES
    module.MAX_PAGES = 30
    try: result = asyncio.run(module.read_popular_reminder_events(repo))
    finally: module.MAX_PAGES = original
    assert [(r['schedule_item_id'], r['reminder_count']) for r in result['items']] == [('s3', 5), ('s1', 3), ('s2', 3)]
    assert result['items'][1]['title'] == result['items'][2]['title']
    assert set(result['items'][0]) == {'schedule_item_id','title','starts_at','location_name','reminder_count'}
    assert all('installation' not in str(call) and '/rpc/' not in str(call) for call in repo.calls)


def test_top_ten_sorted_by_actual_instant_not_timestamp_text():
    rows = [star(f's{i:02}', starts=f'2026-09-22T{10+i//2:02}:{30*(i%2):02}:00Z') for i in range(12)]
    rows += [star('early', starts='2026-09-22T06:00:00-04:00')]
    result = asyncio.run(module.read_popular_reminder_events(Repository(rows)))['items']
    assert len(result) == 10
    assert [r['schedule_item_id'] for r in result] == ['early'] + [f's{i:02}' for i in range(9)]


def test_empty_and_partial_page_failure_and_read_bound(monkeypatch):
    assert asyncio.run(module.read_popular_reminder_events(Repository([]))) == {'items': []}
    monkeypatch.setattr(module, 'MAX_PAGES', 2)
    with pytest.raises(ValueError, match='bounded'):
        asyncio.run(module.read_popular_reminder_events(Repository([star()] * 3, cap=1)))
    class Failed(Repository):
        async def request(self, method, path, params):
            if int(params['offset']): raise RuntimeError('PRIVATE upstream failure')
            return [star()]
    with pytest.raises(RuntimeError): asyncio.run(module.read_popular_reminder_events(Failed([])))


def test_wrong_event_repository_refused():
    repo = Repository([]); repo.event_slug = 'another-event'
    with pytest.raises(ValueError): asyncio.run(module.read_popular_reminder_events(repo))
    assert not repo.calls


def test_admin_auth_scope_no_writes_or_provider_calls_and_safe_failure(monkeypatch):
    repo = Repository([star()] * 3)
    provider = Mock()
    monkeypatch.setattr(server, 'itinerary_reminder_repository', repo)
    monkeypatch.setattr(server, 'wonderpush_client', provider)
    monkeypatch.setattr(server, 'db', object())
    client = TestClient(server.app)
    path = '/api/admin/analytics/reminders/popular-events'
    assert client.get(path).status_code == 401
    try:
        server.app.dependency_overrides[server.get_current_organizer_user] = lambda: {'role':'Owner','event_id':'other'}
        assert client.get(path).status_code == 403
        assert not repo.calls
        server.app.dependency_overrides[server.get_current_organizer_user] = lambda: {'role':'Schedule','event_id':'ipm-2026'}
        response = client.get(path)
        assert response.status_code == 200 and response.json()['items'][0]['reminder_count'] == 3
        assert response.headers['cache-control'] == 'no-store'
        assert provider.mock_calls == []
        async def broken(repository): raise RuntimeError('PRIVATE credential')
        monkeypatch.setattr(module, 'read_popular_reminder_events', broken)
        response = client.get(path)
        assert response.status_code == 503 and 'PRIVATE' not in response.text
    finally:
        server.app.dependency_overrides.pop(server.get_current_organizer_user, None)
