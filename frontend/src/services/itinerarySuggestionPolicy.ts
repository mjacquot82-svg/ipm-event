/** Local anti-nag state only; no provider, permission, or enrollment calls. */
export const SUGGESTION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SUGGESTION_SHOWS = 2;
export type SuggestionHistory = { additions: number; shows: number; lastShownAt: number };
export interface SuggestionStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
const KEY = '@ipm_itinerary_notification_suggestion_v1';

export function nextSuggestion(raw: string | null, now: number, eligible: boolean) {
  let history: SuggestionHistory = { additions: 0, shows: 0, lastShownAt: 0 };
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (!['additions', 'shows', 'lastShownAt'].every(key => Number.isSafeInteger(parsed[key]) && parsed[key] >= 0)) return null;
      history = parsed;
    } catch { return null; }
  }
  history = { ...history, additions: Math.min(history.additions + 1, 1000000) };
  const show = eligible && history.additions >= 2 && history.shows < MAX_SUGGESTION_SHOWS
    && (history.shows === 0 || now - history.lastShownAt >= SUGGESTION_COOLDOWN_MS);
  return { show, history: show ? { ...history, shows: history.shows + 1, lastShownAt: now } : history };
}

export function createSuggestionGate(storage: SuggestionStorage, eligible: () => boolean, clock = Date.now) {
  let shownThisSession = false;
  let queue = Promise.resolve(false);
  return () => {
    queue = queue.catch(() => false).then(async () => {
      try {
        const next = nextSuggestion(await storage.getItem(KEY), clock(), !shownThisSession && eligible());
        if (!next) return false; // Broken/unavailable storage suppresses suggestions.
        await storage.setItem(KEY, JSON.stringify(next.history));
        if (!next.show || !eligible()) return false;
        shownThisSession = true;
        return true;
      } catch { return false; }
    });
    return queue;
  };
}
