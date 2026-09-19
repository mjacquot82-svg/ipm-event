export function formatScheduleTimeRange(startTime: string, endTime?: string | null): string {
  return [startTime, endTime].filter(Boolean).join(' - ');
}
