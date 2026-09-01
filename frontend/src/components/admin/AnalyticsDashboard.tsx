import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AdminRequestError } from '../../services/adminAuthService';
import {
  AnalyticsContentResponse, AnalyticsLiveResponse, AnalyticsRange,
  AnalyticsSummaryResponse, AnalyticsTrafficResponse, RankedMetric,
  NotificationAdoptionResponse, getAnalyticsContent, getAnalyticsLive, getAnalyticsSummary,
  getAnalyticsTraffic, getNotificationAdoption,
} from '../../services/adminAnalyticsService';
import { ContentPage, EmptyState, ErrorState, LoadingState } from './ContentScaffold';

const LIVE_REFRESH_MS = 30_000;
const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: 'today', label: 'Today' }, { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' }, { value: 'all', label: 'All Time' },
];
const PAGE_LABELS: Record<string, string> = {
  home: 'Home', schedule: 'Schedule', map: 'Map', vendors: 'Vendor Directory',
  itinerary: 'My Itinerary', announcements: 'Announcements', about: 'About',
  queen_archive: 'Queen of the Furrow', announcement_detail: 'Announcement Detail',
};
const ACTION_LABELS: Record<string, string> = {
  map: 'Map', schedule: 'Schedule', vendors: 'Vendor Directory', sponsors: 'Sponsors',
  volunteer: 'Volunteer', exhibitors: 'Exhibitors', tickets: 'Tickets', camping: 'Camping',
  souvenirs: 'Souvenirs', itinerary: 'My Itinerary', queen_archive: 'Queen of the Furrow',
  announcements: 'Announcements', sos: 'SOS',
};
const DESTINATION_LABELS: Record<string, string> = {
  partners: 'Partners & Sponsors', volunteer: 'Volunteer Registration', exhibitor: 'Exhibitor Registration',
  tickets: 'Tickets', camping: 'Camping', merchandise: 'Souvenirs', past_ipm_photos: 'Past IPM Photos',
  faq: 'Frequently Asked Questions', accessibility: 'Accessibility', jds_studio: 'JDS Studio',
};

type Props = { onAuthenticationExpired: () => void };
type SectionProps = { title: string; subtitle: string; children: React.ReactNode; initiallyOpen?: boolean };
type MetricProps = { label: string; value: number | string; help?: string; icon: keyof typeof Feather.glyphMap };
type RankRow = { label: string; value: number; detail?: string };

function friendly(value: string, labels: Record<string, string> = {}) {
  return labels[value] || value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return 'Not enough data';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60); const remainder = Math.round(seconds % 60);
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function formatTime(value: string | null) {
  if (!value) return 'No recent activity';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
  }).format(new Date(value));
}

function formatCollectionStart(value: string | null | undefined) {
  if (value === undefined) return 'Checking production start…';
  if (!value) return 'Not started in production';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(value));
}

function MetricCard({ label, value, help, icon }: MetricProps) {
  return <View style={styles.metricCard}>
    <View style={styles.metricIcon}><Feather name={icon} size={18} color={colors.primary} /></View>
    <Text style={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
    {help ? <Text style={styles.metricHelp}>{help}</Text> : null}
  </View>;
}

function Section({ title, subtitle, children, initiallyOpen = false }: SectionProps) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={styles.section}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.sectionHeader} onPress={() => setOpen((value) => !value)}>
      <View style={styles.sectionTitleBlock}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View>
      <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
    </Pressable>
    {open ? <View style={styles.sectionBody}>{children}</View> : null}
  </View>;
}

function MetricGrid({ children }: { children: React.ReactNode }) { return <View style={styles.metricGrid}>{children}</View>; }

function RankedList({ rows, empty }: { rows: RankRow[]; empty: string }) {
  if (!rows.length) return <Text style={styles.inlineEmpty}>{empty}</Text>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <View style={styles.rankList}>{rows.map((row, index) => <View key={`${row.label}-${index}`} style={styles.rankRow}>
    <View style={styles.rankHeading}><Text style={styles.rankLabel}>{index + 1}. {row.label}</Text><Text style={styles.rankValue}>{row.value.toLocaleString()}</Text></View>
    {row.detail ? <Text style={styles.rankDetail}>{row.detail}</Text> : null}
    <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(3, row.value / max * 100)}%` }]} /></View>
  </View>)}</View>;
}

function TrafficChart({ rows, labelKey, valueKey, empty }: { rows: (Record<string, string | number> | object)[]; labelKey: string; valueKey: string; empty: string }) {
  const values = rows as Record<string, string | number>[];
  const populated = values.filter((row) => Number(row[valueKey]) > 0);
  if (!populated.length) return <Text style={styles.inlineEmpty}>{empty}</Text>;
  const max = Math.max(...values.map((row) => Number(row[valueKey])), 1);
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart}>
    {values.map((row, index) => {
      const value = Number(row[valueKey]);
      return <View key={`${row[labelKey]}-${index}`} style={styles.chartColumn}>
        <Text style={styles.chartValue}>{value || ''}</Text>
        <View style={styles.chartBarSlot}><View style={[styles.chartBar, { height: `${value ? Math.max(5, value / max * 100) : 0}%` }]} /></View>
        <Text style={styles.chartLabel} numberOfLines={1}>{String(row[labelKey]).replace(/^\d{4}-/, '')}</Text>
      </View>;
    })}
  </ScrollView>;
}

function MiniPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.miniPanel}><Text style={styles.miniTitle}>{title}</Text>{children}</View>;
}

function ranked<T extends RankedMetric>(items: T[], key: keyof T, labels: Record<string, string> = {}): RankRow[] {
  return items.map((item) => ({ label: friendly(String(item[key]), labels), value: item.count, detail: `${item.share.toFixed(1)}% share` }));
}

export function AnalyticsDashboard({ onAuthenticationExpired }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [traffic, setTraffic] = useState<AnalyticsTrafficResponse | null>(null);
  const [content, setContent] = useState<AnalyticsContentResponse | null>(null);
  const [live, setLive] = useState<AnalyticsLiveResponse | null>(null);
  const [notifications, setNotifications] = useState<NotificationAdoptionResponse | null>(null);
  const [aggregateLoading, setAggregateLoading] = useState(true);
  const [aggregateErrors, setAggregateErrors] = useState<string[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const aggregateRequest = useRef(0);
  const liveInFlight = useRef(false);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof AdminRequestError && error.status === 401) onAuthenticationExpired();
    return error instanceof Error ? error.message : 'Unable to load analytics';
  }, [onAuthenticationExpired]);

  const loadAggregates = useCallback(async (selectedRange: AnalyticsRange, manual = false) => {
    const request = ++aggregateRequest.current;
    if (manual) setRefreshing(true); else setAggregateLoading(true);
    const results = await Promise.allSettled([
      getAnalyticsSummary(selectedRange), getAnalyticsTraffic(selectedRange), getAnalyticsContent(selectedRange),
      getNotificationAdoption(),
    ]);
    if (request !== aggregateRequest.current) return;
    const errors: string[] = [];
    if (results[0].status === 'fulfilled') setSummary(results[0].value); else { setSummary(null); errors.push(`Overview: ${handleError(results[0].reason)}`); }
    if (results[1].status === 'fulfilled') setTraffic(results[1].value); else { setTraffic(null); errors.push(`Traffic: ${handleError(results[1].reason)}`); }
    if (results[2].status === 'fulfilled') setContent(results[2].value); else { setContent(null); errors.push(`Engagement: ${handleError(results[2].reason)}`); }
    if (results[3].status === 'fulfilled') setNotifications(results[3].value);
    else {
      setNotifications(null);
      if (!(results[3].reason instanceof AdminRequestError && results[3].reason.status === 404)) {
        errors.push(`Notifications: ${handleError(results[3].reason)}`);
      }
    }
    setAggregateErrors(errors); setAggregateLoading(false); setRefreshing(false);
  }, [handleError]);

  const loadLive = useCallback(async () => {
    if (liveInFlight.current) return;
    liveInFlight.current = true;
    try { setLive(await getAnalyticsLive()); setLiveError(null); }
    catch (error) { setLiveError(handleError(error)); }
    finally { liveInFlight.current = false; }
  }, [handleError]);

  useEffect(() => { void loadAggregates(range); }, [range, loadAggregates]);
  useEffect(() => {
    void loadLive();
    const timer = setInterval(() => void loadLive(), LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadLive]);

  const manualRefresh = () => { void loadAggregates(range, true); void loadLive(); };
  const overview = summary?.overview;
  const report = content?.content;
  const noData = Boolean(overview && overview.uniqueVisitors === 0 && overview.sessions === 0 && overview.pageViews === 0);
  const vendorFilters = useMemo(() => Object.fromEntries((report?.vendors.filters || []).map((item) => [item.filterValue, item.count])), [report]);
  const mapSources = useMemo(() => Object.fromEntries((report?.map.sources || []).map((item) => [item.source, item.count])), [report]);

  return <ContentPage title="Analytics" subtitle="Aggregate attendee engagement · America/Toronto">
    <Text style={styles.collectionStart}>Analytics collecting since: {formatCollectionStart(summary?.collectionStartedAt)} · “All Time” includes all analytics collected since this date.</Text>
    <View style={styles.toolbar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeRow}>
        {RANGE_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: range === option.value }} style={[styles.rangeButton, range === option.value && styles.rangeButtonActive]} onPress={() => setRange(option.value)}>
          <Text style={[styles.rangeText, range === option.value && styles.rangeTextActive]}>{option.label}</Text>
        </Pressable>)}
      </ScrollView>
      <Pressable style={styles.refreshButton} onPress={manualRefresh} disabled={refreshing}>
        {refreshing ? <ActivityIndicator size="small" color={colors.textSecondary} /> : <Feather name="refresh-cw" size={16} color={colors.textSecondary} />}
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </View>

    {aggregateLoading && !overview && !report ? <LoadingState label="Loading attendee analytics..." /> : null}
    {aggregateErrors.length ? <ErrorState title="Some analytics could not be loaded" message={aggregateErrors.join(' · ')} onRetry={manualRefresh} /> : null}
    {noData ? <EmptyState icon="bar-chart-2" title="No attendee analytics have been recorded yet" message="Metrics and charts will appear after attendees begin using the IPM app." action={{ label: 'Try again', icon: 'refresh-cw', onPress: manualRefresh }} /> : null}

    {overview ? <Section title="Overview" subtitle="Visitors, sessions, launches, and page activity are separate measures." initiallyOpen>
      <MetricGrid>
        <MetricCard label="Unique Visitors" value={overview.uniqueVisitors} icon="users" help="Anonymous visitors with a session in this range." />
        <MetricCard label="New Visitors" value={overview.newVisitors} icon="user-plus" help="First observed during this range." />
        <MetricCard label="Returning Visitors" value={overview.returningVisitors} icon="repeat" help="Observed before this range and active again." />
        <MetricCard label="Sessions" value={overview.sessions} icon="clock" help="Distinct visits; one visitor can have several sessions." />
        <MetricCard label="App Launches" value={overview.launches} icon="play-circle" help="App starts, distinct from sessions and people." />
        <MetricCard label="Page Views" value={overview.pageViews} icon="file-text" />
        <MetricCard label="Installed PWA Visitors" value={overview.installedPwaVisitors} icon="smartphone" />
        <MetricCard label="Browser Visitors" value={overview.browserOnlyVisitors} icon="globe" />
        <MetricCard label="Average Session" value={formatDuration(overview.averageSessionDurationSeconds)} icon="activity" help={overview.sessionDurationSampleSize ? `Based on ${overview.sessionDurationSampleSize.toLocaleString()} completed sessions.` : 'Shown when reliable completed-session data exists.'} />
      </MetricGrid>
    </Section> : null}

    {notifications ? <Section title="Notification Adoption" subtitle="Aggregate device readiness; no installation identifiers are exposed." initiallyOpen>
      <MetricGrid>
        <MetricCard label="Notifications Enabled" value={notifications.deliverable_devices} icon="bell" help="Registered devices last verified as WonderPush opt-in with a push token." />
      </MetricGrid>
      <Text style={styles.collectionStart}>
        {notifications.stale_deliverable_devices > 0
          ? `${notifications.stale_deliverable_devices.toLocaleString()} enabled device check${notifications.stale_deliverable_devices === 1 ? ' is' : 's are'} older than 24 hours; this is a readiness mirror, not a real-time provider count.`
          : `All enabled device checks are within 24 hours. Readiness mirror updated ${formatTime(notifications.newest_provider_check_at)}.`}
      </Text>
    </Section> : null}

    <Section title="Live Activity" subtitle="Aggregate recent activity; refreshes every 30 seconds." initiallyOpen>
      {liveError ? <ErrorState title="Live activity unavailable" message={liveError} onRetry={loadLive} /> : live ? <>
        <MetricGrid>
          <MetricCard label="Active Now" value={live.live.activeSessions} icon="radio" help={`Active within the last ${live.live.activityWindowMinutes} minutes.`} />
          <MetricCard label="Last Minute" value={live.live.activityLastMinute} icon="zap" />
          <MetricCard label="Last 5 Minutes" value={live.live.activityLastFiveMinutes} icon="activity" />
          <MetricCard label="Most Recent" value={formatTime(live.live.mostRecentActivityAt)} icon="clock" />
        </MetricGrid>
        <RankedList rows={ranked(live.live.topActivePages, 'pageId', PAGE_LABELS)} empty="No active attendee pages in the recent window." />
      </> : <LoadingState label="Loading live activity..." />}
    </Section>

    {traffic ? <Section title="Traffic" subtitle="Toronto-local session traffic with DST-safe hourly buckets." initiallyOpen>
      <MiniPanel title="Today by Hour"><TrafficChart rows={traffic.traffic.todayByHour} labelKey="hour" valueKey="sessions" empty="No sessions have been recorded today." /></MiniPanel>
      <MiniPanel title="Traffic by Day"><TrafficChart rows={traffic.traffic.byDay} labelKey="date" valueKey="sessions" empty="No daily traffic is available for this range." /></MiniPanel>
    </Section> : null}

    {report ? <>
      <Section title="Page Popularity" subtitle="Attendee pages ranked by views, visitors, and share.">
        <RankedList rows={report.pages.map((item) => ({ label: friendly(item.pageId, PAGE_LABELS), value: item.count, detail: `${item.uniqueVisitors.toLocaleString()} unique visitors · ${item.share.toFixed(1)}% share` }))} empty="No page views have been recorded for this range." />
      </Section>

      <Section title="Schedule" subtitle="Schedule discovery, event interest, searches, filters, favorites, and map hand-offs.">
        <MetricGrid>
          <MetricCard label="Schedule Opens" value={report.schedule.opens} icon="calendar" /><MetricCard label="Event Opens" value={report.schedule.eventOpens} icon="external-link" />
          <MetricCard label="Searches" value={report.schedule.searches} icon="search" /><MetricCard label="Zero-result Searches" value={report.schedule.zeroResultSearches} icon="slash" />
          <MetricCard label="Favorites Added" value={report.schedule.favoritesAdded} icon="star" /><MetricCard label="Favorites Removed" value={report.schedule.favoritesRemoved} icon="x-circle" />
          <MetricCard label="Schedule to Map" value={report.schedule.mapActions} icon="map-pin" />
        </MetricGrid>
        <View style={[styles.split, compact && styles.splitCompact]}><MiniPanel title="Most-opened Events"><RankedList rows={report.schedule.mostOpenedEvents.map((item) => ({ label: item.scheduleItemId, value: item.count, detail: item.category || undefined }))} empty="No schedule events have been opened." /></MiniPanel><MiniPanel title="Filter Usage"><RankedList rows={ranked(report.schedule.filters, 'filterValue')} empty="No schedule filters have been used." /></MiniPanel></View>
      </Section>

      <Section title="Vendors" subtitle="Directory discovery and normalized search/filter activity.">
        <MetricGrid><MetricCard label="Directory Opens" value={report.vendors.directoryOpens} icon="shopping-bag" /><MetricCard label="Searches" value={report.vendors.searches} icon="search" /><MetricCard label="Zero-result Searches" value={report.vendors.zeroResultSearches} icon="slash" /><MetricCard label="Food Filter" value={vendorFilters.food || 0} icon="coffee" /><MetricCard label="Indoor Filter" value={vendorFilters.indoor || 0} icon="home" /><MetricCard label="Outdoor Filter" value={vendorFilters.outdoor || 0} icon="sun" /></MetricGrid>
        <RankedList rows={ranked(report.vendors.filters.filter((item) => !['food', 'indoor', 'outdoor'].includes(item.filterValue)), 'filterValue')} empty="No other normalized vendor filters were used." />
      </Section>

      <Section title="Map" subtitle="Map opens by controlled source and highlighted location.">
        <MetricGrid><MetricCard label="Total Opens" value={report.map.opens} icon="map" /><MetricCard label="Bottom Navigation" value={mapSources.bottom_navigation || 0} icon="menu" /><MetricCard label="Home Quick Action" value={mapSources.home_quick_action || 0} icon="home" /><MetricCard label="From Schedule" value={mapSources.schedule || 0} icon="calendar" /><MetricCard label="Other" value={mapSources.other || 0} icon="more-horizontal" /></MetricGrid>
        <RankedList rows={ranked(report.map.locations, 'locationId')} empty="No controlled highlighted-location interactions were recorded." />
      </Section>

      <Section title="Queen of the Furrow" subtitle="Archive engagement only; individual entries are not tracked.">
        <MetricGrid><MetricCard label="Archive Opens" value={report.queenOfTheFurrow.archiveOpens} icon="award" /><MetricCard label="Unique Archive Visitors" value={report.queenOfTheFurrow.uniqueArchiveVisitors} icon="users" /></MetricGrid>
      </Section>

      <Section title="Announcements" subtitle="Aggregate views, impressions, opens, and sources; not notification conversion.">
        <MetricGrid><MetricCard label="List Views" value={report.announcements.listViews} icon="list" /><MetricCard label="Impressions" value={report.announcements.impressions} icon="eye" /><MetricCard label="Opens" value={report.announcements.opens} icon="mail" /><MetricCard label="Open / Impression Rate" value={report.announcements.impressions ? `${(report.announcements.opens / report.announcements.impressions * 100).toFixed(1)}%` : 'Not enough data'} icon="percent" /></MetricGrid>
        <View style={[styles.split, compact && styles.splitCompact]}><MiniPanel title="Open Sources"><RankedList rows={ranked(report.announcements.openSources, 'source')} empty="No announcement opens were recorded." /></MiniPanel><MiniPanel title="Most-opened Announcements"><RankedList rows={report.announcements.ranking.map((item) => ({ label: item.announcementId, value: item.opens, detail: `${item.impressions} impressions · ${item.openImpressionRate === null ? 'No rate' : `${item.openImpressionRate.toFixed(1)}% open/impression`}` }))} empty="No announcement engagement was recorded." /></MiniPanel></View>
      </Section>

      <Section title="Quick Actions" subtitle="Home Quick Action usage by action, destination type, and source.">
        <MetricGrid><MetricCard label="Total Clicks" value={report.quickActions.clicks} icon="zap" /></MetricGrid>
        <View style={[styles.split, compact && styles.splitCompact]}><MiniPanel title="Actions"><RankedList rows={ranked(report.quickActions.actions, 'actionId', ACTION_LABELS)} empty="No Quick Actions were used." /></MiniPanel><MiniPanel title="Destination Types"><RankedList rows={ranked(report.quickActions.destinationTypes, 'destinationType')} empty="No destination types were recorded." /></MiniPanel><MiniPanel title="Sources"><RankedList rows={ranked(report.quickActions.sources, 'source')} empty="No Quick Action sources were recorded." /></MiniPanel></View>
      </Section>

      <Section title="Outbound Links" subtitle="Only controlled destination IDs and types are shown; arbitrary URLs are never displayed.">
        <MetricGrid><MetricCard label="Total Clicks" value={report.outboundLinks.clicks} icon="external-link" /></MetricGrid>
        <View style={[styles.split, compact && styles.splitCompact]}><MiniPanel title="Destinations"><RankedList rows={ranked(report.outboundLinks.destinations, 'destinationId', DESTINATION_LABELS)} empty="No outbound links were opened." /></MiniPanel><MiniPanel title="Destination Types"><RankedList rows={ranked(report.outboundLinks.destinationTypes, 'destinationType')} empty="No outbound destination types were recorded." /></MiniPanel></View>
      </Section>

      <Section title="Feature Adoption" subtitle="Share of visitors who used each major attendee feature." initiallyOpen>
        <View style={styles.adoptionGrid}>{report.featureAdoption.map((item) => <View key={item.feature} style={styles.adoptionCard}><Text style={styles.adoptionPercent}>{item.percentage.toFixed(1)}%</Text><Text style={styles.adoptionLabel}>{friendly(item.feature, { queen_of_the_furrow: 'Queen of the Furrow', vendors: 'Vendor Directory' })}</Text><Text style={styles.adoptionHelp}>{item.visitors.toLocaleString()} visitors used this feature.</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.min(100, item.percentage)}%` }]} /></View></View>)}</View>
      </Section>

      <Section title="Event Day Comparison" subtitle="Compare core activity across individual IPM event days." initiallyOpen>
        {report.eventDayComparisons.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.comparisonTable}>
          <View style={[styles.comparisonRow, styles.comparisonHeader]}>{['Date', 'Visitors', 'Sessions', 'Page Views', 'Schedule', 'Vendors', 'Map'].map((label) => <Text key={label} style={[styles.comparisonCell, styles.comparisonHeaderText]}>{label}</Text>)}</View>
          {report.eventDayComparisons.map((day) => <View key={day.date} style={styles.comparisonRow}>{[day.date, day.visitors, day.sessions, day.pageViews, day.scheduleUsage, day.vendorUsage, day.mapUsage].map((value, index) => <Text key={`${day.date}-${index}`} style={styles.comparisonCell}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>)}</View>)}
        </View></ScrollView> : <Text style={styles.inlineEmpty}>No event-day analytics are available for this range.</Text>}
      </Section>
    </> : null}
  </ContentPage>;
}

const styles = StyleSheet.create({
  collectionStart: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  toolbar: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  rangeRow: { gap: 8 }, rangeButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  rangeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary }, rangeText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary }, rangeTextActive: { color: '#FFFFFF' },
  refreshButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 }, refreshText: { fontWeight: '700', color: colors.textSecondary },
  section: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }, sectionHeader: { minHeight: 72, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitleBlock: { flex: 1 }, sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary }, sectionSubtitle: { fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 4 }, sectionBody: { padding: 16, paddingTop: 0, gap: 16 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metricCard: { flexGrow: 1, flexBasis: 190, minWidth: 170, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, padding: 14 }, metricIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, metricValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary }, metricLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 3 }, metricHelp: { fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 7 },
  inlineEmpty: { color: colors.textMuted, fontSize: 13, paddingVertical: 16, textAlign: 'center' }, rankList: { gap: 12 }, rankRow: { gap: 6 }, rankHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, rankLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary }, rankValue: { fontSize: 13, fontWeight: '800', color: colors.primary }, rankDetail: { fontSize: 11, color: colors.textMuted }, barTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surfaceHighlight, overflow: 'hidden' }, barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  miniPanel: { flex: 1, minWidth: 260, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12, backgroundColor: colors.surfaceElevated }, miniTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary }, split: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }, splitCompact: { flexDirection: 'column' },
  chart: { minWidth: '100%', height: 190, alignItems: 'flex-end', gap: 6, paddingTop: 20 }, chartColumn: { width: 42, height: 165, alignItems: 'center' }, chartValue: { height: 18, fontSize: 10, color: colors.textSecondary }, chartBarSlot: { flex: 1, width: 22, justifyContent: 'flex-end', backgroundColor: colors.surfaceHighlight, borderRadius: 4, overflow: 'hidden' }, chartBar: { width: '100%', minHeight: 0, backgroundColor: colors.primary, borderRadius: 4 }, chartLabel: { marginTop: 5, width: 44, textAlign: 'center', fontSize: 9, color: colors.textMuted },
  adoptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, adoptionCard: { flex: 1, flexBasis: 190, minWidth: 170, padding: 14, borderRadius: 8, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 5 }, adoptionPercent: { fontSize: 26, fontWeight: '800', color: colors.primary }, adoptionLabel: { fontSize: 14, fontWeight: '800', color: colors.textPrimary }, adoptionHelp: { fontSize: 11, color: colors.textMuted, marginBottom: 5 },
  comparisonTable: { minWidth: 850, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' }, comparisonRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.divider }, comparisonHeader: { backgroundColor: colors.surfaceHighlight }, comparisonCell: { width: 120, padding: 12, fontSize: 12, color: colors.textSecondary }, comparisonHeaderText: { fontWeight: '800', color: colors.textPrimary },
});
