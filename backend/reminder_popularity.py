"""Bounded, read-only popularity of exact published schedule occurrences."""
from datetime import datetime

PAGE_SIZE = 500
MAX_PAGES = 20


async def read_popular_reminder_events(repository):
    if repository.event_slug != 'ipm-2026':
        raise ValueError('Unsupported event')
    event_id = await repository._event_id()
    counts = {}
    offset = 0
    for _ in range(MAX_PAGES):
        rows = await repository.client.request('GET', '/itinerary_reminder_stars', params={
            'select': 'schedule_item_id,item:schedule_items!inner(id,title,starts_at,location_name,status,event_id)',
            'item.event_id': f'eq.{event_id}', 'item.status': 'eq.published',
            'order': 'schedule_item_id.asc,registration_id.asc',
            'offset': str(offset), 'limit': str(PAGE_SIZE),
        })
        for star in rows:
            item = star['item']
            # Defense in depth: no other event, unpublished item or title grouping.
            if item['event_id'] != event_id or item['status'] != 'published':
                continue
            item_id = star['schedule_item_id']
            if item_id != item['id']:
                raise ValueError('Invalid schedule relationship')
            if item_id not in counts:
                counts[item_id] = {
                    'schedule_item_id': item_id, 'title': item['title'],
                    'starts_at': item['starts_at'], 'location_name': item['location_name'],
                    'reminder_count': 0,
                }
            counts[item_id]['reminder_count'] += 1
        offset += len(rows)
        if not rows:
            return {'items': sorted(counts.values(), key=lambda item: (
                -item['reminder_count'], datetime.fromisoformat(item['starts_at'].replace('Z', '+00:00')),
                item['schedule_item_id'],
            ))[:10]}
    # Never misrepresent a partial scan as a top ten.
    raise ValueError('Reminder popularity exceeds bounded read limit')
