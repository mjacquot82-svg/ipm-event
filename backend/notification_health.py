"""Read-only, event-scoped notification health. Never calls a provider or an RPC."""
from datetime import datetime, timedelta, timezone

METADATA_FIELDS = ('status,outcome,uncertain,lease_until,next_attempt_at,'
                   'provider_ready,provider_checked_at,updated_at,verification_expires_at')


def timestamp(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def build_health(rows, project, *, now=None):
    now = now or datetime.now(timezone.utc)
    counts = dict.fromkeys(('registrations', 'checked', 'verified', 'repairable_mismatch',
        'key_mismatch', 'other_ineligible', 'other_checked', 'uncertain', 'active_leases',
        'expired_leases', 'retries_due', 'retries_scheduled', 'provider_ready',
        'provider_ready_stale', 'verified_expired', 'current_check_failures'), 0)
    latest = None
    # Internal IDs deduplicate pagination results; they never leave this function.
    unique = {row['id']: row for row in rows}
    counts['registrations'] = len(unique)
    for row in unique.values():
        meta = row.get('notification_reconciliation')
        if isinstance(meta, list):
            meta = max(meta, key=lambda r: timestamp(r.get('updated_at')) or datetime.min.replace(tzinfo=timezone.utc), default=None)
        if meta:
            counts['checked'] += 1
            status, outcome = meta.get('status'), meta.get('outcome')
            category = ('verified' if status == 'VERIFIED' else
                'key_mismatch' if status == 'INELIGIBLE' and outcome == 'KEY_MISMATCH' else
                'other_ineligible' if status == 'INELIGIBLE' else
                'repairable_mismatch' if status == 'MISMATCH' and outcome in (None, 'MISMATCH') else 'other_checked')
            counts[category] += 1
            lease = timestamp(meta.get('lease_until'))
            counts['active_leases'] += bool(lease and lease > now)
            counts['expired_leases'] += bool(lease and lease <= now)
            counts['uncertain'] += bool(meta.get('uncertain') or status == 'OUTCOME_UNKNOWN')
            retry = timestamp(meta.get('next_attempt_at'))
            counts['retries_due'] += bool(retry and retry <= now)
            counts['retries_scheduled'] += bool(retry and retry > now)
            expiry = timestamp(meta.get('verification_expires_at'))
            counts['verified_expired'] += bool(status == 'VERIFIED' and (not expiry or expiry <= now))
            counts['current_check_failures'] += bool(status in ('DEFERRED', 'OUTCOME_UNKNOWN') and outcome in ('NETWORK', 'PROVIDER', 'AUTH', 'BILLING', 'POLICY', 'RATE_LIMIT', 'DATA', 'IDENTITY'))
            activity = timestamp(meta.get('updated_at'))
            if activity and (latest is None or activity > latest):
                latest = activity
        # Choose the newer evidence, including newer negative evidence. Neither
        # readiness source proves browser equality or device delivery.
        evidence = []
        checked = timestamp(row.get('provider_checked_at'))
        if checked:
            evidence.append((checked, row.get('provider_deliverable') is True))
        checked = timestamp((meta or {}).get('provider_checked_at'))
        if checked:
            evidence.append((checked, meta.get('provider_ready') is True))
        if evidence:
            checked, ready = max(reversed(evidence), key=lambda pair: pair[0])
            counts['provider_ready'] += ready
            counts['provider_ready_stale'] += bool(ready and checked < now - timedelta(hours=24))
            if latest is None or checked > latest:
                latest = checked
    counts['not_yet_checked'] = counts['registrations'] - counts['checked']
    until = timestamp((project or {}).get('open_until'))
    return {**counts, 'repairs_attempted': None, 'repairs_verified': None, 'repair_failures': None,
        'repair_history': 'NOT_RECORDED',
        'circuit': 'UNKNOWN' if project is None else 'OPEN' if until and until > now else 'CLOSED',
        'circuit_open_until': until.isoformat() if until and until > now else None,
        'latest_activity_at': latest.isoformat() if latest else None, 'snapshot_at': now.isoformat()}


async def read_pages(client, path, params):
    rows = []
    offset = 0
    while True:
        page = await client.request('GET', path, params={**params, 'limit': '500', 'offset': str(offset)})
        if not isinstance(page, list):
            raise ValueError('Health storage unavailable')
        if not page:
            return rows
        rows.extend(page)
        offset += len(page)  # Also supports a server page cap below 500.


async def health_report(repository, *, now=None):
    event_id = await repository._event_id()
    rows = await read_pages(repository.client, '/notification_installations', {
        'select': f'id,provider_deliverable,provider_checked_at,notification_reconciliation({METADATA_FIELDS})',
        'event_id': f'eq.{event_id}', 'order': 'id.asc'})
    project = await repository.client.request('GET', '/notification_reconciliation_project',
        params={'select': 'open_until', 'singleton': 'eq.true', 'limit': '1'})
    return build_health(rows, project[0] if project else None, now=now)
