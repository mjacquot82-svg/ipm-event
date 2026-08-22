const DEFAULT_API_BASE_URL = 'https://ipm-backend-eoiw.onrender.com';

export type CalendarExportResult = 'shared' | 'downloaded' | 'cancelled';

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_API_BASE_URL;
}

function filenameFromResponse(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

function downloadCalendarFile(file: File): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Calendar file download is unavailable on this device.');
  }
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = file.name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function deliverCalendarResponse(response: Response, fallbackFilename: string): Promise<CalendarExportResult> {
  if (!response.ok) {
    throw new Error('The calendar file could not be created. Please try again.');
  }
  const file = new File(
    [await response.blob()],
    filenameFromResponse(response, fallbackFilename),
    { type: 'text/calendar' },
  );
  const shareNavigator = typeof navigator !== 'undefined' ? navigator : undefined;
  const shareData: ShareData = { files: [file] };
  if (
    shareNavigator?.share &&
    shareNavigator.canShare?.(shareData)
  ) {
    try {
      await shareNavigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        return 'cancelled';
      }
      downloadCalendarFile(file);
      return 'downloaded';
    }
  }
  downloadCalendarFile(file);
  return 'downloaded';
}

export async function exportScheduleEvent(scheduleId: string): Promise<CalendarExportResult> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/schedule/${encodeURIComponent(scheduleId)}/calendar`,
    { method: 'GET', headers: { Accept: 'text/calendar' }, cache: 'no-store' },
  );
  return deliverCalendarResponse(response, 'ipm-schedule-event.ics');
}

export async function exportScheduleItinerary(scheduleIds: string[]): Promise<CalendarExportResult> {
  if (scheduleIds.length === 0) {
    throw new Error('Star at least one event before creating a calendar file.');
  }
  const response = await fetch(`${getApiBaseUrl()}/api/schedule/calendar`, {
    method: 'POST',
    headers: { Accept: 'text/calendar', 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ schedule_ids: scheduleIds }),
  });
  return deliverCalendarResponse(response, 'ipm-my-itinerary.ics');
}
