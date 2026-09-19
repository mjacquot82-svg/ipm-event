import type { AnnouncementDeliveryStats } from '../services/adminAuthService';
export const metricValue = (value: number | null | undefined): string => value == null ? 'Unavailable' : String(value);
export const notificationDefinitions = {
  'Announcement sends accepted': 'Announcement notification requests accepted by the notification provider. This does not confirm delivery.',
  'Devices targeted': 'Devices targeted according to send-specific provider evidence. Counts across sends may include the same device more than once.',
  'Confirmed receipts': 'Notification receipts acknowledged by devices, where provider data is available. This does not mean the notification was read.',
  'Notification taps': 'Notification clicks reported by the provider. These are not necessarily different people or devices.',
  'Visits through notification links': 'Recorded app visits through links included in notifications, with repeat reporting deduplicated.',
  'Provider-reported delivery failures': 'Delivery attempts the notification provider explicitly reported as failed.',
  'Failed send requests': 'Requests IPM could not successfully submit.',
  'Estimated available registrations at send time': 'A snapshot of local registrations that appeared ready when the send was requested. This is not an exact provider target count.',
  'Unknown / unavailable': 'The system does not have reliable evidence for this value.',
} as const;
export const notificationDetailFields = [
  ['Confirmed receipts', 'provider_confirmed_receipt_count'],
  ['Notification taps', 'provider_open_count'],
  ['Visits through notification links', 'notification_origin_visit_count'],
  ['Provider-reported delivery failures', 'provider_failure_count'],
] as const;

// Unknown and measured zero stay distinct. Show exact targeting only with evidence.
export function notificationMetricRows(stats?: AnnouncementDeliveryStats): [string, string][] {
  if (!stats) return [];
  const targeting: [string, string][] = stats.provider_targeted_device_count != null
    ? [['Devices targeted', metricValue(stats.provider_targeted_device_count)]]
    : stats.audience_device_count != null
      ? [['Estimated available registrations at send time', metricValue(stats.audience_device_count)]] : [];
  return [...targeting, ...notificationDetailFields.map(([label, key]): [string, string] => [label, metricValue(stats[key])])];
}

export function notificationMissingDetail(stats: AnnouncementDeliveryStats): string | null {
  const known = notificationDetailFields.filter(([, key]) => stats[key] != null).length;
  return known === notificationDetailFields.length ? null : notificationDefinitions['Unknown / unavailable'];
}
