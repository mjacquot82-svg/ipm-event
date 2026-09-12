import type { ScheduleEvent, ScheduleResponse } from '../services/spreadsheetDataService';
import patchJson from './showGuideSchedulePatch.json';

export const SHOW_GUIDE_SCHEDULE_PATCH = patchJson;

const LUMBERJACK_TITLE = 'Great Canadian Lumberjack Show';
const LUMBERJACK_LOCATION = '1A-35-38';
const SOUTHAMPTON_TITLE = 'Southampton Olive Oil';
const LAVENDER_TITLE = 'Essentially Lavender';

function norm(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "'");
}

function hasSouthamptonVariant(events: ScheduleEvent[]): boolean {
  return events.some((event) => {
    const title = norm(event.title);
    return title === norm(SOUTHAMPTON_TITLE) || title.includes('southampton');
  });
}

/** Staging-only Show Guide corrections. Never call for production builds. */
export function applyShowGuideSchedulePatch(schedule: ScheduleResponse): ScheduleResponse {
  if (!schedule || !Array.isArray(schedule.events)) {
    throw new Error('applyShowGuideSchedulePatch requires schedule.events[]');
  }

  const events: ScheduleEvent[] = schedule.events.map((event) => ({ ...event }));

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
    const add = (SHOW_GUIDE_SCHEDULE_PATCH as {
      decisions: { southampton_olive_oil: { event: ScheduleEvent } };
    }).decisions.southampton_olive_oil.event;
    events.push({
      ...add,
      description: add.description ?? '',
      days_active: add.days_active ?? '',
      location_name: add.location_name ?? null,
      latitude: add.latitude ?? null,
      longitude: add.longitude ?? null,
      end_time: add.end_time ?? '',
    });
  }

  return {
    ...schedule,
    events,
    total_count: events.length,
  };
}

export function shouldApplyShowGuideSchedulePatch(): boolean {
  return process.env.EXPO_PUBLIC_IPM_APP_LABEL === 'staging';
}
