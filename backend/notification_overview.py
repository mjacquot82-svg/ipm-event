"""Read-only organizer overview. Never refresh providers or mutate delivery ledgers."""
from collections import Counter
try:
    from backend.notification_analytics import has_attribution, timestamp
except ModuleNotFoundError:
    from notification_analytics import has_attribution, timestamp

METRICS = {
    'targeted_devices': 'provider_targeted_device_count',
    'receipts': 'provider_confirmed_receipt_count',
    'opens': 'provider_open_count',
    'visits': 'notification_origin_visit_count',
    'failures': 'provider_failure_count',
}


def overview(rows, now):
    broadcasts = [row for row in rows if row.get('audience') == 'everyone']
    accepted = [row for row in broadcasts if row.get('status') == 'sent']
    campaigns = Counter(row.get('provider_campaign_id') for row in accepted if row.get('provider_campaign_id'))
    metrics = {}
    for name, field in METRICS.items():
        # Shared campaign statistics cannot be attributed once to each send.
        values = [row.get(field) for row in accepted if name == 'visits' or campaigns[row.get('provider_campaign_id')] <= 1]
        known = [value for value in values if type(value) is int and value >= 0]
        metrics[name] = {'value': sum(known) if known else None, 'covered_sends': len(known), 'total_sends': len(accepted)}
    checked = [value for row in accepted if (value := timestamp(row.get('provider_statistics_refreshed_at'))) is not None]
    recent = sorted(accepted, key=lambda row: timestamp(row.get('requested_at')) or now, reverse=True)[:5]
    return {
        'scope': 'all_time', 'snapshot_at': now.isoformat(), 'accepted_sends': len(accepted),
        'failed_requests': sum(row.get('status') == 'failed' for row in broadcasts),
        'pending_requests': sum(row.get('status') == 'requested' for row in broadcasts),
        'metrics': metrics,
        'latest_statistics_check': max(checked).isoformat() if checked else None,
        # Event counts need not represent distinct devices; no conversion percentages.
        'rates': None,
        'recent': [{'title': row.get('notification_title') or 'Announcement notification',
                    'requested_at': row.get('requested_at'), 'provider_accepted': True} for row in recent],
    }


async def read_overview(deliveries, visits, event_id, now):
    rows = await deliveries.list_overview_rows(event_id=event_id, now=now)
    attributable = [row for row in rows if row.get('status') == 'sent' and has_attribution(row)]
    # Read the authoritative visit ledger in bounded batches; never update its cache.
    if attributable:
        try:
            if visits is None:
                raise ValueError('Visit ledger unavailable')
            counts = {}
            for start in range(0, len(attributable), 500):
                counts.update(await visits.notification_visit_counts([row['id'] for row in attributable[start:start+500]]))
            for row in attributable:
                row['notification_origin_visit_count'] = counts.get(row['id'], 0)
        except Exception:
            # Do not silently present a cached count as a fresh authoritative total.
            for row in attributable:
                row['notification_origin_visit_count'] = None
    return overview(rows, now)
