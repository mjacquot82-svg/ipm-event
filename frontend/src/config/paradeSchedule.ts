import type { ParadeRouteId } from './tentedCityParadeRoutes';

export const PARADE_ROUTE_LOCATIONS: Record<ParadeRouteId, string> = {
  tuesday: 'Tuesday Parade Route',
  'wed-sat': 'Wednesday–Saturday Parade Route',
};

const PARADE_ROUTE_BY_TITLE: Record<string, ParadeRouteId> = {
  'Bruce Power Opening Day Parade': 'tuesday',
  'Trucks and Tractors Parade': 'wed-sat',
  'Children’s Parade': 'wed-sat',
  'Combines Parade': 'wed-sat',
  'Bruce County Farming Through the Ages': 'wed-sat',
};

export function paradeRouteForScheduleEvent(event: { title?: string | null; location_name?: string | null }): ParadeRouteId | null {
  const byTitle = event.title ? PARADE_ROUTE_BY_TITLE[event.title] : undefined;
  if (byTitle) return byTitle;
  return Object.entries(PARADE_ROUTE_LOCATIONS).find(([, location]) => location === event.location_name)?.[0] as ParadeRouteId | undefined || null;
}
