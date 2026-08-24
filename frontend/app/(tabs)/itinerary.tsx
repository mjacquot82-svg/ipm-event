import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
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
import { exportScheduleItinerary } from '../../src/services/calendarService';
import { syncStarredEventsWithBackend } from '../../src/utils/notificationService';
import {
  disableAttendeeItineraryReminders,
  enableAttendeeItineraryReminders,
  getAttendeeReminderStatus,
} from '../../src/services/reminderUxService';

export default function ItineraryScreen() {
  usePageAnalytics('itinerary', 'home_quick_action');
  const { frameStyle } = useAttendeeLayout();
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<CachedApiSource>('network');
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<string | null>(null);
  const [showCalendarConfirmation, setShowCalendarConfirmation] = useState(false);
  const [calendarExporting, setCalendarExporting] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [reminderReady, setReminderReady] = useState(false);
  const [reminderWorking, setReminderWorking] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const refreshReminderStatus = useCallback(async () => {
    const result = await getAttendeeReminderStatus().catch(() => null);
    setReminderReady(Boolean(result?.reminderReady));
  }, []);

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
    void syncStarredEventsWithBackend(storedFavorites);
  }, []);

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
    loadFavorites();
    fetchSchedule();
    refreshReminderStatus();
  }, [fetchSchedule, loadFavorites, refreshReminderStatus]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      refreshReminderStatus();
    }, [loadFavorites, refreshReminderStatus])
  );

  const changeReminderStatus = async () => {
    setReminderWorking(true);
    setReminderMessage(null);
    try {
      if (reminderReady) {
        const result = await disableAttendeeItineraryReminders();
        setReminderReady(Boolean(result?.reminderReady));
        setReminderMessage('Event reminders are off. Your itinerary is unchanged.');
      } else {
        const result = await enableAttendeeItineraryReminders();
        setReminderReady(Boolean(result.readiness?.reminderReady));
        if (result.notificationState === 'unsupported') {
          setReminderMessage('On iPhone, install IPM to your Home Screen and open the installed app to enable reminders.');
        } else if (result.notificationState === 'denied') {
          setReminderMessage('Notifications are blocked. Allow them in browser settings to enable reminders.');
        } else if (!result.enabled) {
          setReminderMessage('Reminders could not be enabled. Your itinerary is still saved.');
        }
      }
    } finally {
      setReminderWorking(false);
    }
  };

  const starredEvents = events.filter((event) => favorites.includes(event.id));

  const handleRemove = async (eventId: string) => {
    const result = await toggleFavorite(eventId);
    setFavorites(result.favorites);
    void syncStarredEventsWithBackend(result.favorites);
    void queueAnalyticsEvent('favorite_changed', { schedule_item_id: eventId, action: 'removed' });
  };

  const handleItineraryCalendarExport = async () => {
    setShowCalendarConfirmation(false);
    setCalendarExporting(true);
    setCalendarMessage(null);
    try {
      const result = await exportScheduleItinerary(starredEvents.map((event) => event.id));
      if (result !== 'cancelled') {
        setCalendarMessage('Calendar file created. Complete the import in your calendar app.');
      }
    } catch (exportError) {
      setCalendarMessage(exportError instanceof Error ? exportError.message : 'Calendar export failed. Please try again.');
    } finally {
      setCalendarExporting(false);
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
      <View style={styles.header}>
        <Text style={styles.title}>My Itinerary</Text>
        <Text style={styles.subtitle}>
          {starredEvents.length} starred event{starredEvents.length === 1 ? '' : 's'}
        </Text>
        <TouchableOpacity style={[styles.reminderButton, reminderReady && styles.reminderButtonOn]}
          onPress={() => void changeReminderStatus()} disabled={reminderWorking}
          accessibilityRole="button" accessibilityLabel={reminderReady ? 'Event reminders on. Tap to disable.' : 'Get 30-minute event reminders'}
          accessibilityState={{ disabled: reminderWorking, busy: reminderWorking }}>
          <Feather name="bell" size={18} color={reminderReady ? '#065F46' : '#8B1538'} />
          <Text style={[styles.reminderButtonText, reminderReady && styles.reminderButtonTextOn]}>
            {reminderWorking ? 'Checking reminders…' : reminderReady ? 'Event reminders on' : 'Get 30-minute event reminders'}
          </Text>
        </TouchableOpacity>
        {reminderMessage ? <Text style={styles.reminderMessage} accessibilityLiveRegion="polite">{reminderMessage}</Text> : null}
        {starredEvents.length > 0 ? (
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => setShowCalendarConfirmation(true)}
            disabled={calendarExporting}
            accessibilityRole="button"
            accessibilityLabel={`Add ${starredEvents.length} starred events to calendar`}
            accessibilityState={{ disabled: calendarExporting, busy: calendarExporting }}
          >
            <Feather name="calendar" size={18} color="#FFFFFF" />
            <Text style={styles.calendarButtonText}>
              {calendarExporting ? 'Creating Calendar File…' : 'Add My Itinerary to Calendar'}
            </Text>
          </TouchableOpacity>
        ) : null}
        {calendarMessage ? (
          <Text style={styles.calendarMessage} accessibilityLiveRegion="polite">
            {calendarMessage}
          </Text>
        ) : null}
      </View>

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
            onPress={() => router.push('/schedule')}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardText}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventTime}>
                  {formatDate(item.start_date)} | {formatScheduleTimeRange(item.start_time, item.end_time)}
                </Text>
              </View>

              <TouchableOpacity onPress={() => handleRemove(item.id)}>
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
      <Modal
        visible={showCalendarConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendarConfirmation(false)}
      >
        <View style={styles.modalOverlay} accessibilityViewIsModal>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>
              Export {starredEvents.length} starred event{starredEvents.length === 1 ? '' : 's'} to your calendar?
            </Text>
            <Text style={styles.confirmationText}>
              This creates a snapshot. Changes to your IPM itinerary won&apos;t automatically update your calendar.
            </Text>
            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCalendarConfirmation(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel calendar export"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => void handleItineraryCalendarExport()}
                accessibilityRole="button"
                accessibilityLabel="Create itinerary calendar file"
              >
                <Text style={styles.exportButtonText}>Create Calendar File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  calendarButton: {
    minHeight: 48,
    marginTop: 14,
    backgroundColor: '#8B1538',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reminderButton: {
    minHeight: 48, marginTop: 14, borderWidth: 1, borderColor: '#8B1538', borderRadius: 12,
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF',
  },
  reminderButtonOn: { borderColor: '#047857', backgroundColor: '#ECFDF5' },
  reminderButtonText: { color: '#8B1538', fontSize: 14, fontWeight: '700' },
  reminderButtonTextOn: { color: '#065F46' },
  reminderMessage: { color: '#4B5563', fontSize: 13, lineHeight: 18, marginTop: 8 },
  calendarButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  calendarMessage: {
    marginTop: 10,
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
  },
  confirmationTitle: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
  },
  confirmationText: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  exportButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#8B1538',
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
