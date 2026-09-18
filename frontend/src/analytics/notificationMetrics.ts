import type { AnnouncementDeliveryStats } from '../services/adminAuthService';
export const metricValue = (value: number | null | undefined): string => value == null ? 'Not available' : String(value);
export function notificationMetricRows(stats?: AnnouncementDeliveryStats): [string, string][] {
  return [
    ['Notification requested', stats ? 'Yes' : 'Not available'],
    ['Requested time', stats?.requested_at ? new Date(stats.requested_at).toLocaleString() : 'Not available'],
    ['Known deliverable devices at send', metricValue(stats?.audience_device_count)],
    ['Targeted devices', metricValue(stats?.provider_targeted_device_count)],
    ['Provider accepted', stats?.provider_accepted ? 'Yes' : stats?.status === 'failed' ? 'No' : 'Not available'],
    ['Delivery outcome', stats?.status === 'requested' ? 'Pending / unknown' : stats?.status === 'failed' ? 'Provider request failed' : stats?.provider_accepted ? 'Provider accepted; visible display unknown' : 'Not available'],
    ['Sent to push service', metricValue(stats?.provider_sent_count)],
    ['Provider-confirmed receipts', metricValue(stats?.provider_confirmed_receipt_count)],
    ['Notification opens', metricValue(stats?.provider_open_count)],
    ['Notification-origin app visits', metricValue(stats?.notification_origin_visit_count)],
    ['Provider failures', metricValue(stats?.provider_failure_count)],
    ['Statistics last checked', stats?.provider_statistics_refreshed_at ? new Date(stats.provider_statistics_refreshed_at).toLocaleString() : 'Not available'],
  ];
}
