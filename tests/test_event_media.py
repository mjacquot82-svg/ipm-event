import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from pydantic import ValidationError
from backend.event_media import EventDetailContent, EventImage, EventExternalLink, content_patch
from backend.platform_services import SupabaseScheduleService

IMAGE = dict(url='https://staging.theipm.ca/event-media/shared.jpg', alt='Cheryl McNair, Mary Kay Sales Director', width=360, height=640)

class EventMediaTests(unittest.IsolatedAsyncioTestCase):
    def service(self):
        return SupabaseScheduleService(supabase_url='https://staging.invalid', service_role_key='test', event_slug='ipm-staging', schedule_response_model=SimpleNamespace, schedule_event_model=SimpleNamespace, admin_schedule_response_model=SimpleNamespace, admin_schedule_event_model=SimpleNamespace)

    def test_old_payload_does_not_clear_media(self):
        self.assertEqual(content_patch(EventDetailContent()), {})
        self.assertEqual(content_patch(EventDetailContent(event_image=None, external_links=[])), {'event_image': None, 'external_links': []})

    def test_json_patch_and_shared_asset_roundtrip(self):
        payload=EventDetailContent(event_image=IMAGE, external_links=[{'label':'Visit Cheryl’s Mary Kay page','url':'https://www.marykay.ca/cmcnair'}])
        patch=content_patch(payload)
        self.assertEqual(patch['event_image'], IMAGE)
        service=self.service()
        a=service._row_to_schedule_event(dict(id='a', **patch))
        b=service._row_to_schedule_event(dict(id='b', **patch))
        self.assertEqual(a.event_image, b.event_image)
        self.assertEqual(a.external_links, patch['external_links'])

    def test_old_database_rows_remain_readable(self):
        row=self.service()._row_to_schedule_event({'id':'old'})
        self.assertIsNone(row.event_image)
        self.assertEqual(row.external_links, [])

    def test_invalid_image_alt_dimensions_and_urls_rejected(self):
        for patch in [{'alt':'  '}, {'width':0}, {'height':-1}, {'url':'javascript:alert(1)'}, {'url':'https://user:pass@example.com/a'}, {'url':'/tmp/photo.jpg'}]:
            with self.subTest(patch=patch), self.assertRaises(ValidationError): EventImage(**{**IMAGE, **patch})
        for url in ['data:text/html,a','http://example.com','file:///a','https://example.com/a b']:
            with self.assertRaises(ValidationError): EventExternalLink(label='Link',url=url)
        with self.assertRaises(ValidationError): EventExternalLink(label=' ',url='https://example.com')

    async def test_legacy_wholesale_import_cannot_erase_media(self):
        service=self.service();service._get_event_id=AsyncMock(return_value='staging');service._list_rows=AsyncMock(return_value=[{'event_image':IMAGE}]);service.client.request=AsyncMock()
        with self.assertRaisesRegex(ValueError,'Edit individual'): await service.replace_schedule([])
        service.client.request.assert_not_awaited()

if __name__=='__main__': unittest.main()
