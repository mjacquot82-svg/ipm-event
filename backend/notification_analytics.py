"""Observational notification reporting. No delivery/scheduler mutations or sends."""
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

METRIC_FIELDS = (
    'provider_targeted_device_count', 'provider_sent_count',
    'provider_confirmed_receipt_count', 'provider_failure_count',
    'provider_open_count', 'provider_unique_open_count',
)


def timestamp(value):
    try:
        result = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return result.astimezone(timezone.utc) if result.tzinfo else None
    except (TypeError, ValueError):
        return None


def campaign_identity(delivery_id, audience):
    # The ledger UUID, not the announcement, owns one actual provider request.
    return f'ipm-{audience}-{delivery_id}'


def has_attribution(row):
    return parse_qs(urlsplit(row.get('target_url') or '').query).get('notification_ref') == [row.get('id')]


def unattributed_history(row):
    return (row.get('status') == 'sent' and
            (not row.get('provider_campaign_id') or row['provider_campaign_id'].startswith('wonderpush:'))
            and not has_attribution(row))


def valid_uuid(value):
    try:
        return str(UUID(str(value))) == value
    except (ValueError, TypeError, AttributeError):
        return False


def refresh_due(row, now, *, diagnostic=False):
    if row.get('status') != 'sent' or not row.get('provider_campaign_id') or row['provider_campaign_id'].startswith('wonderpush:'):
        return False
    # Legacy per-announcement test IDs collide across repeated sends.
    if row.get('audience') == 'test' and row['provider_campaign_id'].startswith('ipm-announcement-test-'):
        return False
    started = timestamp(row.get('requested_at'))
    if not started or started > now:
        return False
    age = now - started
    if age < timedelta(seconds=10) or (age >= timedelta(days=7) and not diagnostic):
        return False
    interval = (60 if diagnostic or age < timedelta(hours=1) else
                900 if age < timedelta(days=1) else 21600)
    if row.get('provider_statistics_status') in ('unavailable', 'rate_limited'):
        interval = max(interval, 3600)
    if row.get('provider_statistics_status') == 'refreshing':
        interval = max(interval, 300)
    refreshed = timestamp(row.get('provider_statistics_refreshed_at'))
    return refreshed is None or now - refreshed >= timedelta(seconds=interval)


def checked_metrics(values):
    # No boolean, negative, string, or fractional counts; unknown is never 0.
    return {key: value if type(value := values.get(key)) is int and 0 <= value <= 2147483647 else None
            for key in METRIC_FIELDS}


def normalize_event_statistics(payload, campaign_id=None):
    """GET /stats/events: aggregate SENT/OPENED/FAILED events only.

    This endpoint does NOT provide confirmed receipts or exact targeted devices.
    Request @ALL dimensions explicitly and reject overlapping breakdowns.
    """
    values = {key: None for key in METRIC_FIELDS}
    names = {'@NOTIFICATION_SENT': 'provider_sent_count', '@NOTIFICATION_OPENED': 'provider_open_count',
             '@NOTIFICATION_FAILED': 'provider_failure_count'}
    if not isinstance(payload, dict) or not isinstance(payload.get('data'), list):
        raise ValueError('Malformed statistics response')
    for bucket in payload['data']:
        if not isinstance(bucket, dict):
            raise ValueError('Malformed statistics bucket')
        if campaign_id and bucket.get('campaignId') != campaign_id:
            continue
        if bucket.get('notificationId') not in (None, '@ALL'):
            continue
        for counter in bucket.get('counters', []):
            if not isinstance(counter, dict):
                raise ValueError('Malformed statistics counter')
            key = names.get(counter.get('type'))
            if not key or counter.get('platform') not in (None, '@ALL') or counter.get('buttonLabel') not in (None, '@ALL'):
                continue
            count = counter.get('count')
            if type(count) is not int or count < 0:
                raise ValueError('Malformed statistics count')
            values[key] = (values[key] or 0) + count
    return checked_metrics(values)


REPORT_METRICS = (
    ('@NOTIFICATION_SENT', 'provider_sent_count'),
    ('@NOTIFICATION_RECEIVED', 'provider_confirmed_receipt_count'),
    ('@NOTIFICATION_OPENED', 'provider_open_count'),
    ('@NOTIFICATION_FAILED', 'provider_failure_count'),
)


def normalize_report_statistics(payload):
    """Undimensioned campaign.events.type reports, one response per request.

    Only explicit integer values are evidence. Empty/missing groups stay null.
    Targeted devices and approximate unique installations are not inferred.
    """
    if not isinstance(payload, dict) or payload.get('success') is not True or payload.get('hasErrors'):
        raise ValueError('Provider statistics report failed')
    reports = payload.get('bulkValues')
    if not isinstance(reports, list) or len(reports) != len(REPORT_METRICS):
        raise ValueError('Malformed provider statistics report')
    values = {}
    for (_, field), report in zip(REPORT_METRICS, reports):
        groups = report.get('groups') if isinstance(report, dict) else None
        if groups == []:
            continue
        if not isinstance(groups, list) or len(groups) != 1:
            raise ValueError('Unexpected statistics breakdown')
        group = groups[0]
        if not isinstance(group, dict) or group.get('dimensions') or group.get('date'):
            raise ValueError('Unexpected statistics dimensions')
        value = group.get('value')
        values[field] = value.get('int') if isinstance(value, dict) else None
    return checked_metrics(values)


async def refresh_statistics(rows, deliveries, provider, now, *, diagnostic=False):
    """At most five leased lookups per load, no polling loop or send dependency."""
    import asyncio
    attempted = 0
    deadline = asyncio.get_running_loop().time() + 12
    for row in rows:
        if attempted >= 5 or asyncio.get_running_loop().time() >= deadline:
            break
        if not refresh_due(row, now, diagnostic=diagnostic):
            continue
        try:
            claimed = await deliveries.claim_statistics_refresh(row, now)
        except Exception:
            continue  # Observational persistence outages must not break the page.
        if not claimed:
            continue
        attempted += 1
        values = {'provider_statistics_refreshed_at': now.isoformat()}
        try:
            result = await asyncio.wait_for(provider.get_campaign_statistics(
                row['provider_campaign_id'], requested_at=row['requested_at']),
                timeout=max(0.1, deadline - asyncio.get_running_loop().time()))
            values.update(checked_metrics(result))
            values.update(provider_statistics_status='partial', provider_statistics_error=None)
        except Exception as exc:
            code = getattr(exc, 'status_code', None)
            values.update(provider_statistics_status='rate_limited' if code == 429 else 'unavailable',
                          provider_statistics_error=f'Provider statistics unavailable (HTTP {code})' if code else 'Provider statistics unavailable')
        try:
            # Compare lease timestamp; a stale worker cannot overwrite a newer refresh.
            updated = await deliveries.update_provider_statistics(row['id'], values, lease_at=now.isoformat())
            if updated:
                row.update(updated)
        except Exception:
            row.update(provider_statistics_status='unavailable')
        if values['provider_statistics_status'] == 'rate_limited':
            break


def reminder_summary(metrics):
    """Only allowlisted aggregates. Missing ledger counters remain unknown."""
    mapping = {
        'synchronized_interests': 'synchronized_stars',
        'eligible_25_to_30_minutes': 'eligible_reminders',
        'claims_pending': 'claimed_reminders',
        'provider_accepted': 'provider_accepted', 'provider_failed': 'provider_failed',
        'delivery_unknown': 'delivery_unknown',
        'removed_interests': 'suppressed_unstarred',
        'unavailable_event_interests': 'suppressed_event_changed_or_unavailable',
        'late_starred_interests': 'suppressed_late_starred',
    }
    result = {label: metrics.get(source) for label, source in mapping.items()}
    # No durable counters exist for rejected duplicate claims or actual HTTP attempts.
    result.update(duplicates_suppressed=None, provider_attempts=None)
    return result


def aggregate_reminder_ledger(stars, deliveries, batches, now):
    """Snapshot counts from existing normal tables; no claiming, pruning or sending."""
    states = ('claimed', 'provider_accepted', 'provider_failed', 'delivery_unknown')
    result = {key: 0 for key in ('active_interests', 'due_reminders', 'normal_claims',
        'provider_attempts', 'provider_accepted', 'provider_failed', 'delivery_unknown', 'stale_interests')}
    result['normal_claims'] = len(deliveries)
    result['provider_attempts'] = sum(row['attempt_count'] for row in batches)
    result['duplicate_eligible_interests'] = 0
    result['duplicates_suppressed'] = None  # Rejected-claim attempts are not durably counted.
    existing = {(r['registration_id'], r['schedule_item_id']): r for r in deliveries}
    for row in deliveries:
        if row['status'] in states[1:]:
            result[row['status']] += 1
        # Older direct sends don't have a batch. Their attempt counter was a claim
        # counter, so count only explicit provider_request_attempted_at evidence.
        if not row.get('batch_id') and row.get('provider_request_attempted_at'):
            result['provider_attempts'] += 1
    for star in stars:
        reg, item = star['registration'], star['item']
        starts, starred = timestamp(item.get('starts_at')), timestamp(star.get('starred_at'))
        if not starts or starts <= now or item.get('status') != 'published':
            result['stale_interests'] += 1
            continue
        if not reg.get('reminders_enabled'):
            continue
        result['active_interests'] += 1
        checked = timestamp(reg.get('provider_checked_at'))
        if not (starred and starred < starts-timedelta(minutes=30) and
                now+timedelta(minutes=25) < starts <= now+timedelta(minutes=30) and
                reg.get('provider_deliverable') and reg.get('provider_reachability') == 'optIn' and
                reg.get('provider_has_push_token') and checked and checked > now-timedelta(minutes=15)):
            continue
        delivery = existing.get((star['registration_id'], star['schedule_item_id']))
        retry_at = timestamp((delivery or {}).get('next_attempt_at'))
        if delivery is None or (delivery['status'] == 'provider_failed' and delivery['attempt_count'] < 3 and retry_at and retry_at <= now):
            result['due_reminders'] += 1
        else:
            result['duplicate_eligible_interests'] += 1
    return result


async def read_reminder_ledger(repository, now):
    event_id = await repository._event_id()
    async def rows(table, params, order):
        result = []
        for offset in range(0, 100000, 1000):
            page = await repository.client.request('GET', table, params={**params, 'order': order, 'limit': '1000', 'offset': str(offset)})
            result.extend(page)
            if len(page) < 1000:
                return result
        raise ValueError('Reminder analytics snapshot exceeds bounded read limit')
    stars = await rows('/itinerary_reminder_stars', {
        'select': 'registration_id,schedule_item_id,starred_at,registration:itinerary_reminder_installations!inner(event_id,reminders_enabled,provider_deliverable,provider_reachability,provider_has_push_token,provider_checked_at),item:schedule_items!inner(event_id,status,starts_at)',
        'registration.event_id': f'eq.{event_id}', 'item.event_id': f'eq.{event_id}',
    }, 'registration_id,schedule_item_id')
    deliveries = await rows('/itinerary_reminder_deliveries', {
        'select': 'id,registration_id,schedule_item_id,status,attempt_count,next_attempt_at,batch_id,provider_request_attempted_at,registration:itinerary_reminder_installations!inner(event_id)',
        'registration.event_id': f'eq.{event_id}', 'reminder_type': 'eq.itinerary_t30', 'controlled_fixture_id': 'is.null',
    }, 'id')
    batches = await rows('/itinerary_reminder_batches', {
        'select': 'id,attempt_count', 'event_id': f'eq.{event_id}', 'reminder_type': 'eq.itinerary_t30',
    }, 'id')
    return aggregate_reminder_ledger(stars, deliveries, batches, now)
