import ast
from pathlib import Path


SERVER = Path(__file__).parents[1].joinpath("backend/server.py")
SOURCE = SERVER.read_text()


def _scheduler_config_expression():
    tree = ast.parse(SOURCE)
    assignment = next(
        node
        for node in tree.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "LEGACY_EVENT_CHANGE_SCHEDULER_ENABLED"
                for target in node.targets)
    )
    return assignment.value


def test_switch_false_is_explicitly_supported_and_scheduler_is_not_created():
    expression = ast.unparse(_scheduler_config_expression())
    assert 'LEGACY_EVENT_CHANGE_SCHEDULER_ENABLED' in SOURCE
    assert "os.environ.get('LEGACY_EVENT_CHANGE_SCHEDULER_ENABLED', 'true')" in expression
    startup = SOURCE[SOURCE.index('async def startup_event'):]
    assert 'if not LEGACY_EVENT_CHANGE_SCHEDULER_ENABLED:' in startup
    disabled_branch = startup[startup.index('if not LEGACY_EVENT_CHANGE_SCHEDULER_ENABLED:'):]
    disabled_branch = disabled_branch[:disabled_branch.index('logger.info("Starting cron scheduler')]
    assert 'asyncio.create_task(cron_scheduler())' not in disabled_branch
    assert 'Legacy event-change scheduler disabled by configuration' in disabled_branch


def test_switch_true_keeps_existing_scheduler_startup_and_legacy_routes():
    startup = SOURCE[SOURCE.index('async def startup_event'):]
    assert 'logger.info("Starting cron scheduler for event change detection...")' in startup
    assert 'asyncio.create_task(cron_scheduler())' in startup
    assert '@api_router.post("/register-push-token")' in SOURCE
    assert '@api_router.post("/update-starred-events")' in SOURCE


def test_unrelated_notification_paths_and_t30_gate_remain_present():
    assert 'ITINERARY_REMINDER_DELIVERY_ENABLED = ' in SOURCE
    assert 'ITINERARY_REMINDER_SCHEDULER_ENABLED = ' in SOURCE
    assert 'WonderPushClient' in SOURCE
    assert '@api_router.get("/notification-registrations/operations")' in SOURCE
    assert 'delivery_kill_switch' in SOURCE
