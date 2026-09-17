import unittest
from datetime import datetime
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from pydantic import ValidationError
from backend import server
from backend.event_media import EventImage
from backend.platform_services import SupabaseScheduleService

IMAGE = dict(url='https://example.invalid/portrait.jpg', alt='Presenter', width=452, height=640)
ROW = dict(id='fixture', title='Existing event', description='Existing biography',
           starts_at='2026-09-25T16:15:00+00:00', ends_at='2026-09-25T17:15:00+00:00',
           category='Event', days_active='Friday', location_name='Existing stage')

class EventImageTests(unittest.TestCase):
    def service(self):
        return SupabaseScheduleService(supabase_url='https://example.invalid', service_role_key='local-test',
            event_slug='fixture', schedule_response_model=server.ScheduleResponse,
            schedule_event_model=server.ScheduleEvent, admin_schedule_response_model=server.AdminScheduleResponse,
            admin_schedule_event_model=server.AdminScheduleEvent)

    def test_old_row_and_explicit_null_have_identical_fields(self):
        old = self.service()._row_to_schedule_event(ROW).model_dump()
        null = self.service()._row_to_schedule_event({**ROW, 'event_image': None}).model_dump()
        self.assertEqual(old, null)
        self.assertIsNone(old.pop('event_image'))
        self.assertEqual(old['title'], ROW['title'])
        self.assertEqual(old['description'], ROW['description'])
        self.assertEqual((old['start_date'], old['start_time'], old['end_time']), ('2026-09-25', '12:15 PM', '1:15 PM'))
        self.assertEqual(old['location_name'], ROW['location_name'])

    def test_public_admin_and_cropped_image_roundtrip(self):
        for image in [IMAGE, {**IMAGE, 'crop': 'top-square'}]:
            for admin in [False, True]:
                result = self.service()._row_to_schedule_event({**ROW, 'event_image': image}, admin=admin).model_dump(mode='json')
                self.assertEqual(result['event_image'], image)

    def test_reject_unsafe_or_invalid_images(self):
        for delta in [{'url':'http://example.invalid/a'}, {'url':'https://u:p@example.invalid/a'},
                      {'url':'javascript:alert(1)'}, {'url':'https://example.invalid/a b'},
                      {'alt':' '}, {'width':0}, {'height':10001}, {'crop':'other'}]:
            with self.subTest(delta=delta), self.assertRaises(ValidationError):
                EventImage(**{**IMAGE, **delta})

    def test_existing_update_payload_cannot_clear_image(self):
        event = self.service()._row_to_schedule_event(ROW).model_dump()
        payload = server.ScheduleEventPayload(**event)
        self.assertNotIn('event_image', self.service()._payload_to_row(payload, 'fixture'))

    def test_openapi_field_optional_and_nullable(self):
        schema = server.ScheduleEvent.model_json_schema()
        self.assertNotIn('event_image', schema['required'])
        self.assertIn({'type': 'null'}, schema['properties']['event_image']['anyOf'])

    def test_real_public_route_keeps_old_fields_and_serializes_image(self):
        old = self.service()._row_to_schedule_event(ROW).model_dump(mode='json')
        for image in [None, IMAGE, {**IMAGE, 'crop': 'top-square'}]:
            event = self.service()._row_to_schedule_event({**ROW, 'event_image': image})
            response = server.ScheduleResponse(events=[event], total_count=1, last_updated=datetime(2026, 9, 16))
            with patch.object(server.schedule_service, 'list_public_schedule', AsyncMock(return_value=response)):
                result = TestClient(server.app).get('/api/schedule')
            self.assertEqual(result.status_code, 200)
            actual = result.json()['events'][0]
            self.assertEqual(actual.pop('event_image'), image)
            self.assertEqual(actual, {k:v for k,v in old.items() if k != 'event_image'})
