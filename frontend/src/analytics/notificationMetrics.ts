import type { AnnouncementDeliveryStats } from '../services/adminAuthService';
export const metricValue = (value: number | null | undefined): string => value == null ? 'Not available' : String(value);
const countFields = [
  ['Targeted devices', 'provider_targeted_device_count'],
  ['Provider-confirmed receipts', 'provider_confirmed_receipt_count'],
  ['Notification opens', 'provider_open_count'],
  ['Notification-origin app visits', 'notification_origin_visit_count'],
  ['Provider failures', 'provider_failure_count'],
  ['Sent to push service', 'provider_sent_count'],
  ['Known deliverable devices at send', 'audience_device_count'],
] as const;

// Presentation only: retain measured zero; never substitute a value for missing telemetry.
export function notificationMetricRows(stats?: AnnouncementDeliveryStats): [string, string][] {
  if (!stats) return [];
  return countFields.flatMap(([label, key]) => stats[key] == null ? [] : [[label, metricValue(stats[key])] as [string, string]]);
}

export function notificationMissingDetail(stats: AnnouncementDeliveryStats): string | null {
  const fields = countFields.slice(0, 6);
  if (fields.every(([, key]) => stats[key] != null)) return null;
  return fields.some(([, key]) => stats[key] != null)
    ? 'Additional delivery analytics are not available.'
    : 'Detailed delivery analytics are not available for this send.';
}
