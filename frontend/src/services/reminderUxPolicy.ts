export const MAX_REMINDER_PROMPT_SHOWS = 2;

function parseClockMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function isReminderPromotionEligible(event: { start_date: string; start_time: string }, now = new Date()) {
  if (!event.start_date || !event.start_time) return false;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const eventDate = event.start_date.slice(0, 10);
  if (eventDate > today) return true;
  if (eventDate < today) return false;
  const startMinutes = parseClockMinutes(event.start_time);
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  return startMinutes !== null && startMinutes - currentMinutes > 30;
}

export function mayShowReminderPromotion(input: {
  starSucceeded: boolean; becameFavorite: boolean; reminderReady: boolean;
  promptShows: number; eventEligible: boolean;
}) {
  return input.starSucceeded && input.becameFavorite && !input.reminderReady
    && input.promptShows < MAX_REMINDER_PROMPT_SHOWS && input.eventEligible;
}
