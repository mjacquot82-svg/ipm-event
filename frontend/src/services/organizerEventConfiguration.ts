export const MISSING_ORGANIZER_EVENT_MESSAGE =
  'Organizer Portal is unavailable because EXPO_PUBLIC_EVENT_ID is not configured.';

export function getOrganizerEventConfiguration() {
  const eventId = process.env.EXPO_PUBLIC_EVENT_ID?.trim() || '';
  return {
    eventId,
    error: eventId ? null : MISSING_ORGANIZER_EVENT_MESSAGE,
  };
}
