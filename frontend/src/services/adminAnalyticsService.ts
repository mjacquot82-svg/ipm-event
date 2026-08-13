import { adminRequest } from './adminAuthService';

export type AnalyticsRange = 'today' | '7d' | '30d' | 'all';
export type RankedMetric = { count: number; share: number; [key: string]: string | number | null };

export type AnalyticsSummaryResponse = {
  range: AnalyticsRange;
  timezone: 'America/Toronto';
  overview: {
    uniqueVisitors: number;
    newVisitors: number;
    returningVisitors: number;
    sessions: number;
    launches: number;
    pageViews: number;
    installedPwaVisitors: number;
    browserOnlyVisitors: number;
    averageSessionDurationSeconds: number | null;
    sessionDurationSampleSize: number;
  };
};

export type AnalyticsLiveResponse = {
  timezone: 'America/Toronto';
  live: {
    activeSessions: number;
    activityLastMinute: number;
    activityLastFiveMinutes: number;
    mostRecentActivityAt: string | null;
    topActivePages: (RankedMetric & { pageId: string })[];
    activityWindowMinutes: number;
  };
};

export type AnalyticsTrafficResponse = {
  range: AnalyticsRange;
  timezone: 'America/Toronto';
  traffic: {
    byDay: { date: string; visitors: number; sessions: number; launches: number; pageViews: number }[];
    todayByHour: { hour: string; sessions: number }[];
    selectedRange: { firstLocalDate: string | null; lastLocalDate: string; timezone: string };
  };
};

export type AnalyticsContentResponse = {
  range: AnalyticsRange;
  timezone: 'America/Toronto';
  content: {
    pages: (RankedMetric & { pageId: string; uniqueVisitors: number })[];
    schedule: {
      opens: number; eventOpens: number;
      mostOpenedEvents: (RankedMetric & { scheduleItemId: string; category?: string | null })[];
      filters: (RankedMetric & { filterValue: string })[];
      searches: number; zeroResultSearches: number; favoritesAdded: number; favoritesRemoved: number; mapActions: number;
    };
    vendors: { directoryOpens: number; searches: number; zeroResultSearches: number; filters: (RankedMetric & { filterValue: string })[] };
    map: { opens: number; sources: { source: string; count: number }[]; locations: (RankedMetric & { locationId: string })[] };
    queenOfTheFurrow: { archiveOpens: number; uniqueArchiveVisitors: number };
    announcements: {
      listViews: number; impressions: number; opens: number;
      openSources: (RankedMetric & { source: string })[];
      ranking: { announcementId: string; impressions: number; opens: number; openImpressionRate: number | null }[];
    };
    quickActions: {
      clicks: number;
      actions: (RankedMetric & { actionId: string })[];
      sources: (RankedMetric & { source: string })[];
      destinationTypes: (RankedMetric & { destinationType: string })[];
    };
    outboundLinks: {
      clicks: number;
      destinations: (RankedMetric & { destinationId: string; destinationType?: string })[];
      destinationTypes: (RankedMetric & { destinationType: string })[];
    };
    featureAdoption: { feature: string; visitors: number; percentage: number }[];
    eventDayComparisons: {
      date: string; visitors: number; sessions: number; pageViews: number;
      scheduleUsage: number; vendorUsage: number; mapUsage: number;
    }[];
  };
};

const rangedPath = (path: string, range: AnalyticsRange) => `${path}?range=${encodeURIComponent(range)}`;

export function getAnalyticsSummary(range: AnalyticsRange) {
  return adminRequest<AnalyticsSummaryResponse>(rangedPath('/api/admin/analytics/summary', range));
}

export function getAnalyticsLive() {
  return adminRequest<AnalyticsLiveResponse>('/api/admin/analytics/live');
}

export function getAnalyticsTraffic(range: AnalyticsRange) {
  return adminRequest<AnalyticsTrafficResponse>(rangedPath('/api/admin/analytics/traffic', range));
}

export function getAnalyticsContent(range: AnalyticsRange) {
  return adminRequest<AnalyticsContentResponse>(rangedPath('/api/admin/analytics/content', range));
}
