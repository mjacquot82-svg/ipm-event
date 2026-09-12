/**
 * Staging-only Show Guide schedule patch applier (pure).
 * Shared by node tests; mirrored by applyShowGuideSchedulePatch.ts for the app.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SHOW_GUIDE_SCHEDULE_PATCH = JSON.parse(
  readFileSync(join(here, 'showGuideSchedulePatch.json'), 'utf8'),
);

const LUMBERJACK_TITLE = 'Great Canadian Lumberjack Show';
const LUMBERJACK_LOCATION = '1A-35-38';
const SOUTHAMPTON_TITLE = 'Southampton Olive Oil';
const LAVENDER_TITLE = 'Essentially Lavender';

function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "'");
}

function hasSouthamptonVariant(events) {
  return events.some((event) => {
    const title = norm(event.title);
    return title === norm(SOUTHAMPTON_TITLE) || title.includes('southampton');
  });
}

/**
 * @param {{ events: any[], last_updated?: string, total_count?: number }} schedule
 * @returns {{ events: any[], last_updated?: string, total_count: number, _showGuidePatchApplied?: boolean }}
 */
export function applyShowGuideSchedulePatch(schedule) {
  if (!schedule || !Array.isArray(schedule.events)) {
    throw new Error('applyShowGuideSchedulePatch requires schedule.events[]');
  }

  const events = schedule.events.map((event) => ({ ...event }));

  for (const event of events) {
    if (event.title === LUMBERJACK_TITLE) {
      event.location_name = LUMBERJACK_LOCATION;
    }
  }

  for (const event of events) {
    if (
      event.title === LAVENDER_TITLE &&
      event.start_date === '2026-09-24' &&
      event.location_name === 'The Beyond Wireless Stage'
    ) {
      event.start_time = '3:15 PM';
      event.end_time = '3:30 PM';
    }
  }

  if (!hasSouthamptonVariant(events)) {
    const add = SHOW_GUIDE_SCHEDULE_PATCH.decisions.southampton_olive_oil.event;
    events.push({ ...add });
  }

  return {
    ...schedule,
    events,
    total_count: events.length,
    _showGuidePatchApplied: true,
  };
}

export function summarizeShowGuidePatch(schedule) {
  const patched = applyShowGuideSchedulePatch(schedule);
  const lumberjack = patched.events.filter((e) => e.title === LUMBERJACK_TITLE);
  const southampton = patched.events.filter((e) => norm(e.title).includes('southampton'));
  const lavender = patched.events.filter(
    (e) =>
      e.title === LAVENDER_TITLE &&
      e.start_date === '2026-09-24' &&
      e.location_name === 'The Beyond Wireless Stage',
  );
  const tbcLawn = patched.events.filter((e) => /lawn mower/i.test(e.title || ''));
  const tbcGreggleaTue = patched.events.filter(
    (e) => e.title === 'Gregglea Clydesdales' && e.start_date === '2026-09-22',
  );
  return {
    total_count: patched.total_count,
    lumberjack_count: lumberjack.length,
    lumberjack_locations: [...new Set(lumberjack.map((e) => e.location_name))],
    lumberjack_times: lumberjack.map((e) => `${e.start_date} ${e.start_time}`).sort(),
    southampton_count: southampton.length,
    lavender_bw: lavender.map((e) => ({ start_time: e.start_time, end_time: e.end_time })),
    tbc_lawn_mower_count: tbcLawn.length,
    tbc_gregglea_tue_count: tbcGreggleaTue.length,
  };
}
