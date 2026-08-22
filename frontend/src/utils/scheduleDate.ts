// Schedule date-only values are calendar dates in the event's Ontario timezone,
// not UTC instants. Noon UTC remains on the same date in America/Toronto and
// avoids the browser's YYYY-MM-DD-as-midnight-UTC rollover behavior.
export const IPM_TIMEZONE = 'America/Toronto';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnlyAnchor(value: string): Date | null {
  const match = value.match(DATE_ONLY_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    anchor.getUTCFullYear() !== year
    || anchor.getUTCMonth() !== month - 1
    || anchor.getUTCDate() !== day
  ) return null;
  return anchor;
}

export function formatScheduleDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string | null {
  const isDateOnly = DATE_ONLY_PATTERN.test(value);
  const dateOnly = parseDateOnlyAnchor(value);
  if (isDateOnly && !dateOnly) return null;
  const date = dateOnly || new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    ...options,
    ...(dateOnly ? { timeZone: IPM_TIMEZONE } : {}),
  }).format(date);
}

export function getScheduleWeekday(value: string): string | null {
  return formatScheduleDate(value, { weekday: 'long' });
}
