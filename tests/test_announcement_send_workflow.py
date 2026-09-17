from pathlib import Path


SOURCE = Path(__file__).parents[1].joinpath("backend", "server.py").read_text()


def test_combined_send_route_publishes_before_entering_notification_path():
    route = SOURCE.index('"/admin/announcements/{announcement_id}/send"')
    section = SOURCE[route:SOURCE.index('def notification_device_headers', route)]
    assert "published = await service.set_status" in section
    assert 'return await notify_announcement(announcement_id, "everyone", current_user)' in section
    assert section.index("set_status") < section.index("notify_announcement")


def test_preview_has_no_backend_route():
    assert "/admin/announcements/preview" not in SOURCE
