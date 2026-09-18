import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { colors } from '../../src/theme/colors';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { getFavorites, toggleFavorite } from '../../src/utils/favoritesStorage';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { queueAnalyticsEvent } from '../../src/analytics/analyticsClient';
import CachedDataBanner from '../../src/components/CachedDataBanner';
import { AttendeeAttribution } from '../../src/components/AttendeeAttribution';
import {
  ATTENDEE_HORIZONTAL_MARGIN,
  ATTENDEE_CARD_RADIUS,
  attendeePageContent,
  useAttendeeLayout,
} from '../../src/theme/attendeePageLayout';
import {
  CachedApiSource,
  CachedApiResult,
  ScheduleEvent,
  ScheduleResponse,
  getScheduleData,
} from '../../src/services/spreadsheetDataService';
import { formatScheduleDate } from '../../src/utils/scheduleDate';
import { formatScheduleTimeRange } from '../../src/utils/scheduleTime';
import { reconcileAttendeeItineraryReminders } from '../../src/services/reminderUxService';
import { ActiveControlledReminder, armControlledReminderTest, getActiveControlledReminder } from '../../src/services/itineraryReminderSync.web';
import NotificationOptIn from '../../src/components/NotificationOptIn';

export default function ItineraryScreen() {
  usePageAnalytics('itinerary', 'home_quick_action');
  const { frameStyle } = useAttendeeLayout();
  const router = useRouter();
  const [removalNotice, setRemovalNotice] = useState(false);
  const removalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (removalTimer.current) clearTimeout(removalTimer.current); }, []);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<CachedApiSource>('network');
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<string | null>(null);
  const [armState, setArmState] = useState<'hidden' | 'early' | 'waiting' | 'working' | 'armed' | 'failed' | 'expired'>('hidden');
  const [clock, setClock] = useState(() => Date.now());
  const [activeControlledReminder, setActiveControlledReminder] = useState<ActiveControlledReminder | null>(null);
  const stagingArmEnabled = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname === 'staging.theipm.ca';
  const stagingArmEventVisible = Boolean(activeControlledReminder?.has_active_test);
  const armDueAt = activeControlledReminder?.arm_available_at ? new Date(activeControlledReminder.arm_available_at).getTime() : 0;
  const armExpiry = activeControlledReminder?.arm_expires_at ? new Date(activeControlledReminder.arm_expires_at).getTime() : 0;
  const armAuthorizationExpiry = activeControlledReminder?.authorization_expires_at ? new Date(activeControlledReminder.authorization_expires_at).getTime() : 0;
  const serverClockOffset = activeControlledReminder?.server_now ? new Date(activeControlledReminder.server_now).getTime() - clock : 0;
  const effectiveServerNow = clock + serverClockOffset;

  useEffect(() => {
    if (!stagingArmEnabled) return undefined;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [stagingArmEnabled]);

  useEffect(() => {
    if (!stagingArmEnabled || !stagingArmEventVisible || !activeControlledReminder?.real_star_exists || armState === 'armed' || armState === 'working') return;
    if (activeControlledReminder.can_arm && effectiveServerNow >= armDueAt && effectiveServerNow < armExpiry && effectiveServerNow < armAuthorizationExpiry) {
      setArmState('waiting');
    } else if (effectiveServerNow < armDueAt) {
      setArmState('early');
    } else {
      setArmState('expired');
    }
  }, [activeControlledReminder, armDueAt, armExpiry, armAuthorizationExpiry, armState, effectiveServerNow, stagingArmEnabled, stagingArmEventVisible]);

  const refreshControlledReminder = useCallback(async () => {
    if (!stagingArmEnabled) return;
    try {
      setActiveControlledReminder(await getActiveControlledReminder());
    } catch {
      setActiveControlledReminder(null);
    }
  }, [stagingArmEnabled]);

  const armStagingReminder = async () => {
    setArmState('working');
    try {
      const result = await armControlledReminderTest();
      setArmState(result?.armed ? 'armed' : 'failed');
    } catch {
      setArmState('failed');
    }
  };

  const applyScheduleResult = useCallback((result: CachedApiResult<ScheduleResponse>) => {
    setEvents(result.data.events || []);
    if (result.source === 'network') {
      setDataSource('network');
    }
    setLastSuccessfulUpdate(result.lastSuccessfulUpdate);
  }, []);

  const loadFavorites = useCallback(async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
    await reconcileAttendeeItineraryReminders(storedFavorites);
    // Refresh after star synchronization so a newly eligible fixture renders
    // its arm card without a reload or second physical action.
    await refreshControlledReminder();
  }, [refreshControlledReminder]);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getScheduleData({
        onBackgroundRefresh: applyScheduleResult,
        onBackgroundRefreshError: () => setDataSource('cache'),
      });
      applyScheduleResult(result);
    } catch {
      setError('Unable to load itinerary.');
    } finally {
      setLoading(false);
    }
  }, [applyScheduleResult]);

  useEffect(() => {
    void loadFavorites();
    fetchSchedule();
  }, [fetchSchedule, loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites])
  );

  const starredEvents = events.filter((event) => favorites.includes(event.id));

  const handleRemove = async (eventId: string) => {
    const result = await toggleFavorite(eventId);
    setFavorites(result.favorites);
    await reconcileAttendeeItineraryReminders(result.favorites);
    await refreshControlledReminder();
    void queueAnalyticsEvent('favorite_changed', { schedule_item_id: eventId, action: 'removed' });
    if (!result.isFavorite && !result.favorites.includes(eventId)) {
      setRemovalNotice(true);
      if (removalTimer.current) clearTimeout(removalTimer.current);
      removalTimer.current = setTimeout(() => setRemovalNotice(false), 2800);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown date';
    return formatScheduleDate(dateStr, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }) || dateStr;
  };

  if (loading) {
    return (
      <View style={[styles.container, attendeePageContent, frameStyle]}>
        <PageHeader title="My Itinerary" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B1538" />
          <Text style={styles.helperText}>
            {'Preparing your event experience...\n\nLoading the latest IPM information.\nThis may take a few moments the first time you open the app.'}
          </Text>
        </View>
        <AttendeeAttribution source="itinerary_attribution" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, attendeePageContent, frameStyle]}>
        <PageHeader title="My Itinerary" />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.helperText}>Please try again later.</Text>
        </View>
        <AttendeeAttribution source="itinerary_attribution" />
      </View>
    );
  }

  return (
    <View style={[styles.container, frameStyle]}>
      <PageHeader title="My Itinerary" />
      {removalNotice ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ padding: 16, color: colors.primary }}>Removed from your itinerary</Text> : null}
      <View style={styles.header}>
        <Text style={styles.title}>My Itinerary</Text>
        <Text style={styles.subtitle}>
          {starredEvents.length} starred event{starredEvents.length === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.reminderHint} accessibilityLabel="Event reminders">
        <NotificationOptIn persistent containerStyle={styles.notificationOptions} />
      </View>

      {stagingArmEnabled && stagingArmEventVisible && activeControlledReminder?.real_star_exists && armState !== 'hidden' ? (
        <View style={styles.controlledArmCard} accessibilityLabel="Controlled reminder test">
          <Text style={styles.controlledArmTitle}>Controlled reminder test</Text>
          {armState === 'armed' ? (
            <Text style={styles.controlledArmStatus}>Armed for the exact Device A target. No notification has been sent.</Text>
          ) : armState === 'failed' ? (
            <Text style={styles.controlledArmStatus}>The controlled arm did not complete. Do not retry from another device.</Text>
          ) : armState === 'early' ? (
            <Text style={styles.controlledArmStatus}>Arm available at {activeControlledReminder.arm_available_at ? new Date(activeControlledReminder.arm_available_at).toLocaleTimeString() : 'the reminder target'}.</Text>
          ) : armState === 'expired' ? (
            <Text style={styles.controlledArmStatus}>Test arm window expired.</Text>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Arm reminder test"
              disabled={armState !== 'waiting' || armState === 'working'}
              onPress={armStagingReminder}
              style={[styles.controlledArmButton, armState !== 'waiting' && styles.controlledArmButtonDisabled]}
            >
              <Text style={styles.controlledArmButtonText}>{armState === 'working' ? 'Arming…' : 'Arm reminder test'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {dataSource === 'cache' && (
        <CachedDataBanner lastSuccessfulUpdate={lastSuccessfulUpdate} />
      )}

      <FlatList
        data={starredEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, attendeePageContent]}
        ListFooterComponent={<AttendeeAttribution source="itinerary_attribution" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/schedule', params: { eventId: item.id, returnTo: 'itinerary' } })}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardText}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventTime}>
                  {formatDate(item.start_date)} | {formatScheduleTimeRange(item.start_time, item.end_time)}
                </Text>
              </View>

              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from itinerary`} onPress={() => handleRemove(item.id)}>
                <Feather name="star" size={22} color="#FBC02D" />
              </TouchableOpacity>
            </View>

            {item.location_name ? (
              <Text style={styles.meta}>Location: {item.location_name}</Text>
            ) : null}

            {item.category ? (
              <Text style={styles.meta}>Category: {item.category}</Text>
            ) : null}

            {item.description ? (
              <Text style={styles.description} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Feather name="star" size={42} color="#FBC02D" />
            <Text style={styles.emptyTitle}>Build Your Personal Schedule</Text>
            <Text style={styles.helperText}>
              Save the events you don&apos;t want to miss.
            </Text>
            <Text style={styles.helperText}>
              Browse the Schedule and tap the star on any event to add it to your personal itinerary.
            </Text>
            <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/schedule')}>
              <Feather name="calendar" size={17} color="#FFFFFF" />
              <Text style={styles.browseButtonText}>Browse Schedule</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <View style={styles.pageHeader}>
      <Text style={styles.pageHeaderTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4ED',
  },
  pageHeader: {
    minHeight: 52,
    paddingHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F7F4ED',
  },
  pageHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
    paddingTop: 20,
    paddingBottom: 12,
  },
  reminderHint: {
    marginHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EEE9DD',
  },
  reminderHintTitle: { color: '#1F2937', fontSize: 15, lineHeight: 20, fontWeight: '800', marginBottom: 3 },
  reminderHintText: { color: '#4B5563', fontSize: 13, lineHeight: 18 },
  reminderHintLink: { color: '#8B1538', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 4 },
  notificationOptions: { marginTop: 10 },
  controlledArmCard: {
    marginHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF4D6',
    borderWidth: 1,
    borderColor: '#D6B656',
  },
  controlledArmTitle: { color: '#5C4310', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  controlledArmStatus: { color: '#5C4310', fontSize: 13, lineHeight: 18 },
  controlledArmButton: { alignSelf: 'flex-start', backgroundColor: '#8B1538', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  controlledArmButtonDisabled: { opacity: 0.45 },
  controlledArmButtonText: { color: '#FFFFFF', fontWeight: '700' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  list: {
    paddingHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ATTENDEE_CARD_RADIUS,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  cardText: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  meta: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 6,
    lineHeight: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  helperText: {
    marginTop: 10,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#B91C1C',
    textAlign: 'center',
  },
  browseButton: {
    marginTop: 16,
    backgroundColor: '#8B1538',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
