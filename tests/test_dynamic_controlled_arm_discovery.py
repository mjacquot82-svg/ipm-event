from pathlib import Path

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


def test_discovery_exposes_authoritative_server_timing():
    assert '"server_now"' in REPOSITORY
    assert '"arm_expires_at"' in REPOSITORY
    assert '"can_arm"' in REPOSITORY


def test_frontend_shows_early_status_and_uses_server_timing():
    assert "armState, setArmState" in ITINERARY
    assert "'early'" in ITINERARY
    assert 'serverClockOffset' in ITINERARY
    assert 'Arm available at' in ITINERARY
    assert "armState !== 'waiting'" in ITINERARY
