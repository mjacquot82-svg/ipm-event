from pathlib import Path
import asyncio
from datetime import datetime, timedelta, timezone

SERVER = Path('backend/server.py').read_text()
REPOSITORY = Path('backend/itinerary_reminders.py').read_text()
ITINERARY = Path('frontend/app/(tabs)/itinerary.tsx').read_text()
SYNC = Path('frontend/src/services/itineraryReminderSync.web.ts').read_text()


def test_discovery_is_authenticated_and_fail_closed():
    assert '"/itinerary-reminders/controlled-test/active"' in SERVER
    assert 'active_controlled_fixture' in SERVER
    assert 'if len(auths) != 1' in REPOSITORY
    assert 'if len(fixtures) != 1' in REPOSITORY
    assert 'if len(schedules) != 1' in REPOSITORY


def test_frontend_has_no_fixture_specific_constants():
    assert 'getActiveControlledReminder' in ITINERARY
    assert 'armControlledReminderTest()' in ITINERARY
    assert 'controlled-test/active' in SYNC
    for old_id in (
        '565f651e-c898-4dba-bc31-7832cfa684e6',
        'b1d515d0-5d41-479b-bd77-09947af33f36',
        '0fb3e1e9-5d60-464d-9af8-e57669982562',
        'eebcad0e-2d87-46da-9c66-997ac5dcfdb2',
    ):
        assert old_id not in ITINERARY
        assert old_id not in SYNC


def test_arm_payload_is_server_selected():
    assert 'fixture_id: uuid.UUID | None = None' in SERVER
    assert 'schedule_item_id: uuid.UUID | None = None' in SERVER
    assert 'No single active controlled reminder fixture is available' in SERVER
    assert 'Controlled fixture target does not match' in SERVER


def test_fixture_a_then_b_discovered_without_frontend_change():
    from backend.itinerary_reminders import SupabaseItineraryReminderRepository

    now = datetime.now(timezone.utc)
    state = {}

    class FakeClient:
        async def get_event_id(self, _slug):
            return 'event'

        async def request(self, _method, path, params=None, **_kwargs):
            if path.endswith('synthetic_authorizations'):
                return [state['auth']]
            if path.endswith('synthetic_events'):
                return [state['fixture']]
            if path.endswith('schedule_items'):
                return [state['schedule']]
            if path.endswith('itinerary_reminder_stars'):
                return [{'starred_at': now.isoformat()}]
            if path.endswith('itinerary_reminder_deliveries'):
                return []
            raise AssertionError(path)

    def select(suffix):
        starts_at = (now + timedelta(minutes=10)).isoformat()
        state.update({
            'auth': {'synthetic_event_id': f'fixture-{suffix}',
                     'expires_at': (now + timedelta(minutes=15)).isoformat()},
            'fixture': {'id': f'fixture-{suffix}', 'event_id': 'event',
                        'title': f'Fixture {suffix}', 'starts_at': starts_at,
                        'status': 'published', 'test_lead_minutes': 2},
            'schedule': {'id': f'schedule-{suffix}', 'title': f'Fixture {suffix}',
                         'starts_at': starts_at, 'location_name': 'Test Location A',
                         'status': 'published'},
        })

    async def run():
        repo = SupabaseItineraryReminderRepository(FakeClient(), 'staging')
        select('A')
        first = await repo.active_controlled_fixture('registration', now=now)
        select('B')
        second = await repo.active_controlled_fixture('registration', now=now)
        return first, second

    first, second = asyncio.run(run())
    assert first['fixture_id'] == 'fixture-A'
    assert second['fixture_id'] == 'fixture-B'
    assert first['schedule_item_id'] != second['schedule_item_id']
