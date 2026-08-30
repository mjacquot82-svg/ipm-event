// © 2026 1001538341 ONTARIO INC.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import CachedDataBanner from '../../src/components/CachedDataBanner';
import { getVisibleAnnouncements } from '../../src/components/AnnouncementCard';
import ResponsiveBanner from '../../src/components/ResponsiveBanner';
import { AttendeeAttribution } from '../../src/components/AttendeeAttribution';
import NotificationOptIn from '../../src/components/NotificationOptIn';
import colors from '../../src/theme/colors';
import { attendeePageContent, useAttendeeLayout } from '../../src/theme/attendeePageLayout';
import { openTrackedLink, IpmDestinationId } from '../../src/analytics/trackedLinks';
import { queueAnalyticsEvent } from '../../src/analytics/analyticsClient';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { getFavorites } from '../../src/utils/favoritesStorage';
import { excludeDismissedAnnouncements, getUnreadAnnouncementIds, useAnnouncementReadState } from '../../src/context/AnnouncementReadContext';
import {
  CachedApiSource,
  CachedApiResult,
  Announcement,
  AnnouncementsResponse,
  ScheduleEvent,
  ScheduleResponse,
  getScheduleData,
  getAnnouncementsData,
} from '../../src/services/spreadsheetDataService';

const EVENT_START_DATE = '2026-09-22T09:00:00';

const CATEGORY_COLORS = [
  colors.primary,
  colors.accent,
  colors.vendor,
  colors.field,
  colors.utility,
  colors.info,
];

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - Date.now();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <View style={countdownStyles.container}>
      <View style={countdownStyles.unit}>
        <Text style={countdownStyles.number}>{timeLeft.days}</Text>
        <Text style={countdownStyles.label}>Days</Text>
      </View>
      <View style={countdownStyles.separator} />
      <View style={countdownStyles.unit}>
        <Text style={countdownStyles.number}>{String(timeLeft.hours).padStart(2, '0')}</Text>
        <Text style={countdownStyles.label}>Hours</Text>
      </View>
      <View style={countdownStyles.separator} />
      <View style={countdownStyles.unit}>
        <Text style={countdownStyles.number}>{String(timeLeft.minutes).padStart(2, '0')}</Text>
        <Text style={countdownStyles.label}>Minutes</Text>
      </View>
      <View style={countdownStyles.separator} />
      <View style={countdownStyles.unit}>
        <Text style={countdownStyles.number}>{String(timeLeft.seconds).padStart(2, '0')}</Text>
        <Text style={countdownStyles.label}>Seconds</Text>
      </View>
    </View>
  );
}

const countdownStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  unit: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  number: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 34,
  },
  label: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 4,
    fontWeight: '700',
  },
  separator: {
    width: 1,
    height: 34,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
});

function parseEventDateTime(event: ScheduleEvent) {
  const dateText = event.start_date || event.days_active || '';
  const timeText = event.start_time || '12:00 AM';
  const parsed = new Date(`${dateText} ${timeText}`);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const dateOnly = new Date(dateText);
  return Number.isNaN(dateOnly.getTime()) ? null : dateOnly;
}

function parseTimeToMinutes(timeText: string) {
  if (!timeText) return 0;
  const match = timeText.trim().match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM)?/i);
  if (!match) return 0;

  let hours = Number.parseInt(match[1], 10);
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function formatDisplayTime(timeText: string) {
  return timeText || 'Time TBD';
}

function formatDisplayDate(dateText: string) {
  if (!dateText) return 'Date TBD';
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return dateText;

  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getCategoryColor(category: string | undefined, index = 0) {
  if (!category) return CATEGORY_COLORS[index % CATEGORY_COLORS.length];

  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes('food') || lowerCategory.includes('vendor')) return colors.vendor;
  if (lowerCategory.includes('plow') || lowerCategory.includes('field')) return colors.field;
  if (lowerCategory.includes('music') || lowerCategory.includes('stage')) return colors.stage;
  if (lowerCategory.includes('demo') || lowerCategory.includes('workshop')) return colors.utility;
  if (lowerCategory.includes('special') || lowerCategory.includes('ceremony')) return colors.accent;

  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function getTimeUntil(eventDate: Date | null) {
  if (!eventDate) return '';

  const diffMs = eventDate.getTime() - Date.now();
  if (diffMs <= 0) return 'Now';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `in ${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `in ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `in ${diffDays}d`;
}

export default function HomeScreen() {
  usePageAnalytics('home', 'launch');
  const router = useRouter();
  const { sectionStyle: attendeeSectionStyle } = useAttendeeLayout();

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<CachedApiSource>('network');
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementDataSource, setAnnouncementDataSource] = useState<CachedApiSource>('network');
  const [announcementLastUpdate, setAnnouncementLastUpdate] = useState<string | null>(null);
  const { hydrated: announcementReadStateHydrated, lastReadAnnouncementId, dismissedAnnouncementIds } = useAnnouncementReadState();

  const applyScheduleResult = useCallback((result: CachedApiResult<ScheduleResponse>) => {
    setEvents(result.data.events || []);
    if (result.source === 'network') {
      setDataSource('network');
    }
    setLastSuccessfulUpdate(result.lastSuccessfulUpdate);
  }, []);

  const fetchSchedule = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await getScheduleData({
        preferCache: !isRefresh,
        onBackgroundRefresh: applyScheduleResult,
        onBackgroundRefreshError: () => setDataSource('cache'),
      });
      applyScheduleResult(result);
    } catch (err) {
      console.error('Error loading home schedule data:', err);
      setError('Unable to load schedule updates.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyScheduleResult]);

  const applyAnnouncementsResult = useCallback((result: CachedApiResult<AnnouncementsResponse>) => {
    setAnnouncements(getVisibleAnnouncements(result.data.announcements || []));
    if (result.source === 'network') setAnnouncementDataSource('network');
    else setAnnouncementDataSource('cache');
    setAnnouncementLastUpdate(result.lastSuccessfulUpdate);
  }, []);

  const fetchAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      const result = await getAnnouncementsData({
        preferCache: !isRefresh,
        onBackgroundRefresh: applyAnnouncementsResult,
        onBackgroundRefreshError: () => setAnnouncementDataSource('cache'),
      });
      applyAnnouncementsResult(result);
    } catch (err) {
      console.warn('Unable to load announcements:', err);
    }
  }, [applyAnnouncementsResult]);

  const loadFavorites = useCallback(async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
  }, []);

  useEffect(() => {
    fetchSchedule();
    fetchAnnouncements();
    loadFavorites();
  }, [fetchAnnouncements, fetchSchedule, loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aDate = parseEventDateTime(a);
      const bDate = parseEventDateTime(b);
      return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
    });
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    const futureEvents = sortedEvents.filter((event) => {
      const eventDate = parseEventDateTime(event);
      return eventDate ? eventDate.getTime() >= now : true;
    });

    return (futureEvents.length > 0 ? futureEvents : sortedEvents).slice(0, 4);
  }, [sortedEvents]);

  const happeningNow = useMemo(() => {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return sortedEvents.filter((event) => {
      const eventDate = parseEventDateTime(event);
      if (!eventDate || eventDate.toISOString().slice(0, 10) !== todayKey) return false;

      const startMinutes = parseTimeToMinutes(event.start_time);
      const endMinutes = parseTimeToMinutes(event.end_time) || startMinutes + 60;
      return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    }).slice(0, 3);
  }, [sortedEvents]);

  const nextStarredEvent = useMemo(() => {
    return sortedEvents.find((event) => favorites.includes(event.id)) || null;
  }, [favorites, sortedEvents]);

  const onRefresh = useCallback(async () => {
    await Promise.all([fetchSchedule(true), fetchAnnouncements(true), loadFavorites()]);
  }, [fetchAnnouncements, fetchSchedule, loadFavorites]);

  const quickAction = (actionId: string, destinationType: string, action: () => void) => {
    void queueAnalyticsEvent('home_quick_action_clicked', {
      action_id: actionId, destination_type: destinationType, source: 'home',
    });
    action();
  };

  const openQuickLink = (actionId: string, destinationId: IpmDestinationId) => {
    quickAction(actionId, 'outbound_link', () => { void openTrackedLink(destinationId, 'home_quick_action'); });
  };

  const renderEventCard = (event: ScheduleEvent, index: number, showTimeUntil = false) => {
    const eventDate = parseEventDateTime(event);
    const typeColor = getCategoryColor(event.category, index);

    return (
      <TouchableOpacity
        key={event.id}
        style={styles.sessionCardFull}
        onPress={() => router.push('/schedule')}
        activeOpacity={0.8}
      >
        <View style={[styles.sessionIconContainer, { backgroundColor: typeColor }]}>
          <Feather name="calendar" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.sessionCardContent}>
          <Text style={styles.sessionCardTitle} numberOfLines={1}>
            {event.title || 'Untitled Event'}
          </Text>
          <Text style={styles.sessionCardLocation} numberOfLines={1}>
            {event.location_name || event.category || formatDisplayDate(event.start_date)}
          </Text>
          <View style={styles.sessionCardTimeRow}>
            <Feather name="clock" size={12} color={colors.textMuted} />
            <Text style={styles.sessionCardTime}>
              {formatDisplayTime(event.start_time)}
              {event.end_time ? ` - ${event.end_time}` : ''}
            </Text>
            {showTimeUntil && <Text style={styles.timeUntil}>{getTimeUntil(eventDate)}</Text>}
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const sectionStyle = [styles.section, attendeeSectionStyle];
  const isShowingCachedData = dataSource === 'cache' && !loading && events.length > 0;
  const attendeeAnnouncements = excludeDismissedAnnouncements(announcements, dismissedAnnouncementIds);
  const unreadAnnouncementIds = getUnreadAnnouncementIds(attendeeAnnouncements, lastReadAnnouncementId);
  const newestUnreadAnnouncement = announcementReadStateHydrated
    ? attendeeAnnouncements
      .filter((announcement) => unreadAnnouncementIds.has(announcement.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null
    : null;
  const impressedAnnouncementId = useRef<string | null>(null);
  useEffect(() => {
    if (newestUnreadAnnouncement && impressedAnnouncementId.current !== newestUnreadAnnouncement.id) {
      impressedAnnouncementId.current = newestUnreadAnnouncement.id;
      void queueAnalyticsEvent('announcement_impression', {
        announcement_id: newestUnreadAnnouncement.id, surface: 'home',
      });
    }
  }, [newestUnreadAnnouncement]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={attendeePageContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <ResponsiveBanner />

        <NotificationOptIn containerStyle={sectionStyle} />

        {isShowingCachedData && (
          <View style={sectionStyle}>
            <CachedDataBanner lastSuccessfulUpdate={lastSuccessfulUpdate} />
          </View>
        )}

        {newestUnreadAnnouncement && (
          <View style={sectionStyle}>
            <TouchableOpacity
              style={styles.newAnnouncementCard}
              onPress={() => {
                router.push(`/announcements/${newestUnreadAnnouncement.id}?source=home` as never);
              }}
              activeOpacity={0.82}
              accessibilityLabel={`New announcement: ${newestUnreadAnnouncement.title}`}
            >
              <View style={styles.newAnnouncementIcon}><Feather name="bell" size={21} color="#735B1B" /></View>
              <View style={styles.newAnnouncementContent}>
                <Text style={styles.newAnnouncementEyebrow}>New Announcement</Text>
                <Text style={styles.newAnnouncementTitle} numberOfLines={2}>{newestUnreadAnnouncement.title}</Text>
                <Text style={styles.newAnnouncementPreview} numberOfLines={2}>{newestUnreadAnnouncement.message}</Text>
                <Text style={styles.newAnnouncementAction}>Tap to read</Text>
              </View>
              <Feather name="chevron-right" size={21} color="#8A712E" />
            </TouchableOpacity>
          </View>
        )}

        <View style={sectionStyle}>
          <View style={styles.countdownCard}>
            <View style={styles.countdownIcon}>
              <Feather name="clock" size={22} color={colors.primary} />
            </View>
            <View style={styles.countdownContent}>
              <Text style={styles.countdownLabel}>IPM 2026 Starts In</Text>
              <CountdownTimer targetDate={EVENT_START_DATE} />
            </View>
          </View>
        </View>

        {nextStarredEvent && (
          <View style={sectionStyle}>
            <View style={styles.sectionHeader}>
              <View style={styles.starredHeader}>
                <Feather name="star" size={18} color={colors.accent} />
                <Text style={styles.sectionTitleStarred}>My Next Event</Text>
              </View>
            </View>
            {renderEventCard(nextStarredEvent, 0, true)}
          </View>
        )}

        {announcementDataSource === 'cache' && announcements.length > 0 && (
          <View style={sectionStyle}><CachedDataBanner lastSuccessfulUpdate={announcementLastUpdate} /></View>
        )}

        <View style={sectionStyle}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => quickAction('map', 'internal', () => router.push({ pathname: '/map', params: { source: 'home_quick_action' } }))} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                <Feather name="map" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Map</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => quickAction('schedule', 'internal', () => router.push({ pathname: '/schedule', params: { source: 'home_quick_action' } }))} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
                <Feather name="calendar" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => quickAction('vendors', 'internal', () => router.push('/vendors'))} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: colors.vendor }]}>
                <Feather name="shopping-bag" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Vendors</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => quickAction('camping', 'internal', () => router.push('/camping' as never))}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Camping information"
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.field }]}>
                <MaterialCommunityIcons name="tent" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Camping</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => quickAction('itinerary', 'internal', () => router.push('/itinerary'))} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: colors.utility }]}>
                <Feather name="clipboard" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Personal Itinerary</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => quickAction('queen_archive', 'internal', () => router.push('/queen-of-the-furrow' as never))}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Queen of the Furrow"
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.accentDark }]}>
                <MaterialCommunityIcons name="crown-outline" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Queen of the Furrow</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, unreadAnnouncementIds.size > 0 && announcementReadStateHydrated && styles.announcementActionUnread]}
              onPress={() => quickAction('announcements', 'internal', () => router.push('/announcements' as never))}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, styles.announcementBell, unreadAnnouncementIds.size > 0 && announcementReadStateHydrated && styles.announcementBellUnread]}>
                <Feather name="bell" size={22} color={unreadAnnouncementIds.size > 0 && announcementReadStateHydrated ? '#735B1B' : '#FFFFFF'} />
                {unreadAnnouncementIds.size > 0 && announcementReadStateHydrated && <View style={styles.bellAccent}><Feather name="star" size={9} color="#735B1B" /></View>}
              </View>
              <Text style={[styles.actionTitle, unreadAnnouncementIds.size > 0 && announcementReadStateHydrated && styles.announcementActionText]}>Announcements</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, styles.linksTitle]}>Links</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openQuickLink('sponsors', 'partners')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.info }]}>
                <Feather name="briefcase" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Sponsors</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openQuickLink('volunteer', 'volunteer')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success }]}>
                <Feather name="users" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Volunteer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openQuickLink('exhibitors', 'exhibitor')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.vendor }]}>
                <Feather name="briefcase" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Exhibitors</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openQuickLink('tickets', 'tickets')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.stage }]}>
                <Feather name="tag" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Tickets</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openQuickLink('souvenirs', 'merchandise')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B0' }]}>
                <Feather name="gift" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Souvenirs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openQuickLink('celebration_of_excellence', 'celebration_of_excellence')}
              activeOpacity={0.8}
              accessibilityRole="link"
              accessibilityLabel="Celebration of Excellence"
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.accentDark }]}>
                <Feather name="award" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Celebration of Excellence</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => quickAction('worship_service', 'internal', () => router.push('/worship-service' as never))}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Interdenominational Worship Service"
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primaryDark }]}>
                <Feather name="book-open" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Interdenominational Worship Service</Text>
            </TouchableOpacity>
          </View>
        </View>

        {happeningNow.length > 0 && (
          <View style={sectionStyle}>
            <View style={styles.sectionHeaderLive}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.sectionTitleLive}>Happening Now</Text>
            </View>
            {happeningNow.map((event, index) => {
              const typeColor = getCategoryColor(event.category, index);
              return (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.liveSessionCard, { borderColor: typeColor }]}
                  onPress={() => router.push('/schedule')}
                  activeOpacity={0.8}
                >
                  <View style={styles.liveSessionContent}>
                    <Text style={styles.liveSessionTitle} numberOfLines={2}>{event.title}</Text>
                    <View style={styles.liveLocationRow}>
                      <Feather name="map-pin" size={14} color={typeColor} />
                      <Text style={[styles.liveLocationText, { color: typeColor }]} numberOfLines={1}>
                        {event.location_name || event.category || 'Event location'}
                      </Text>
                    </View>
                    <Text style={styles.liveTimeText}>Until {formatDisplayTime(event.end_time)}</Text>
                  </View>
                  <View style={styles.goButton}>
                    <Feather name="navigation" size={18} color={colors.accent} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={sectionStyle}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Coming Up Next</Text>
            <TouchableOpacity onPress={() => router.push('/schedule')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptyText}>
                {'Preparing your event experience...\n\nLoading the latest IPM information.\nThis may take a few moments the first time you open the app.'}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.emptyState}>
              <Feather name="alert-circle" size={40} color={colors.error} />
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : upcomingEvents.length > 0 ? (
            upcomingEvents.map((event, index) => renderEventCard(event, index, true))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Coming Up Next</Text>
              <Text style={styles.emptyText}>No upcoming events are available yet.</Text>
              <Text style={styles.emptyText}>
                Event information will appear here once the schedule has been published.
              </Text>
            </View>
          )}
        </View>
        <AttendeeAttribution source="home_attribution" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLive: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(107, 142, 35, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  sectionTitleLive: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  starredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleStarred: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  linksTitle: {
    marginTop: 20,
  },
  seeAll: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  actionCard: {
    width: '31%',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  announcementActionUnread: { backgroundColor: '#FFF9E8', borderColor: '#D8B866', borderWidth: 1 },
  announcementBell: { backgroundColor: '#9E9E9E', position: 'relative' },
  announcementBellUnread: { backgroundColor: '#F3E5B9', borderColor: '#D8B866', borderWidth: 1 },
  bellAccent: { alignItems: 'center', backgroundColor: '#FFF8E2', borderColor: '#D8B866', borderRadius: 8, borderWidth: 1, height: 16, justifyContent: 'center', position: 'absolute', right: -3, top: -3, width: 16 },
  announcementActionText: { color: '#735B1B' },
  newAnnouncementCard: { alignItems: 'center', backgroundColor: '#FFF9E8', borderColor: '#D8B866', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 },
  newAnnouncementIcon: { alignItems: 'center', backgroundColor: '#F3E5B9', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  newAnnouncementContent: { flex: 1 },
  newAnnouncementEyebrow: { color: '#735B1B', fontSize: 12, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  newAnnouncementTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 4 },
  newAnnouncementPreview: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  newAnnouncementAction: { color: '#735B1B', fontSize: 12, fontWeight: '800', marginTop: 8 },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  countdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countdownIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(45, 80, 22, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  countdownContent: {
    flex: 1,
    paddingTop: 2,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sessionCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 50,
    marginBottom: 12,
  },
  sessionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  sessionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  sessionCardLocation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  sessionCardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionCardTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  timeUntil: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
    marginLeft: 8,
  },
  liveSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 12,
  },
  liveSessionContent: {
    flex: 1,
  },
  liveSessionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  liveLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveLocationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  liveTimeText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  goButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
