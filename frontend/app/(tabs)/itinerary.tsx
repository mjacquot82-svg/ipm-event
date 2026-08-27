import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
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
  addConnectivityRefreshListener,
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

const IS_STAGING = (process.env.EXPO_PUBLIC_BACKEND_URL || '').includes('staging');

type ReminderDiagnostics = Record<string, boolean | number | string | null | undefined>;

function diagnosticResult(value: unknown) {
  if (value === true) return 'PASS';
  if (value === false) return 'FAIL';
  if (value === null || value === undefined || value === '') return 'UNKNOWN';
  return String(value);
}

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
  const [reminderState, setReminderState] = useState<'checking' | 'off' | 'on' | 'blocked' | 'install_required' | 'recovery'>('checking');
  const [reminderWorking, setReminderWorking] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [reminderDiagnostics, setReminderDiagnostics] = useState<ReminderDiagnostics | null>(null);
  const [reminderFailureStage, setReminderFailureStage] = useState<string | null>(null);
  const [showReminderDiagnostics, setShowReminderDiagnostics] = useState(false);
  const [diagnosticsCopyMessage, setDiagnosticsCopyMessage] = useState<string | null>(null);
  const reminderRefreshSequence = useRef(0);

  const refreshReminderStatus = useCallback(async () => {
    const sequence = ++reminderRefreshSequence.current;
    setReminderState('checking');
    const result = await getAttendeeReminderStatus().catch(() => null);
    if (sequence !== reminderRefreshSequence.current) return null;
    setReminderState((result?.state as typeof reminderState) || (result?.reminderReady ? 'on' : 'checking'));
    setReminderDiagnostics(result?.diagnostics || null);
    setReminderFailureStage(result?.failureStage || null);
    return result;
  }, []);

  const applyScheduleResult = useCallback((result: CachedApiResult<ScheduleResponse>) => {
    setEvents(result.data.events || []);
    setDataSource(result.source);
    setLastSuccessfulUpdate(result.lastSuccessfulUpdate);
  }, []);

  const loadFavorites = useCallback(async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
    await syncStarredEventsWithBackend(storedFavorites);
    return storedFavorites;
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
    void loadFavorites().then(() => refreshReminderStatus());
    fetchSchedule();
  }, [fetchSchedule, loadFavorites, refreshReminderStatus]);

  useEffect(() => addConnectivityRefreshListener(() => void fetchSchedule()), [fetchSchedule]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites().then(() => refreshReminderStatus());
    }, [loadFavorites, refreshReminderStatus])
  );

  const changeReminderStatus = async () => {
    setReminderWorking(true);
    setReminderMessage(null);
    try {
      if (reminderState === 'on') {
        await disableAttendeeItineraryReminders();
        await refreshReminderStatus();
      setReminderMessage('Event reminder setup is off. Your itinerary is unchanged.');
      } else {
        const result = await enableAttendeeItineraryReminders();
        const verified = await refreshReminderStatus();
        if (result.enabled && result.readiness?.reminderReady && verified?.state === 'on'
          && verified.reminderReady) {
          setReminderMessage('Event reminder setup is complete for this device.');
        } else if (verified?.state === 'install_required' || result.notificationState === 'requires_install') {
          setReminderMessage('On iPhone, install IPM to your Home Screen and open the installed app to enable reminders.');
        } else if (verified?.state === 'blocked' || result.notificationState === 'denied') {
          setReminderMessage('Notifications are blocked. Allow them in browser settings to enable reminders.');
        } else if (verified?.state === 'checking' || result.transient) {
          setReminderMessage('Verifying event reminders… Your itinerary is still saved.');
        } else if (!result.enabled) {
          setReminderMessage('Reminders could not be enabled. Your itinerary is still saved.');
        }
      }
    } catch {
      setReminderState('recovery');
      setReminderMessage('Reminders could not be updated. Your itinerary is still saved. Try again when connected.');
    } finally {
      setReminderWorking(false);
    }
  };

  const starredEvents = events.filter((event) => favorites.includes(event.id));
  const reminderReady = reminderState === 'on';
  const reminderTitle = reminderReady ? 'Event reminder setup complete'
    : reminderState === 'checking' ? 'Checking event reminders…'
    : reminderState === 'blocked' ? 'Notifications blocked'
      : reminderState === 'install_required' ? 'Install IPM for event reminders'
        : reminderState === 'recovery' ? 'Reconnect event reminders'
          : 'Set up event reminders';
  const reminderDescription = reminderReady
    ? 'This device is set up for event reminders when they become available.'
    : reminderState === 'blocked'
      ? 'Allow notifications for IPM in your browser or site settings, then try again.'
      : reminderState === 'install_required'
        ? 'On iPhone, add IPM to your Home Screen, then open the installed app to enable notifications.'
        : reminderState === 'recovery'
          ? 'This device is not currently ready for reminders. Re-enable to reconnect it safely.'
          : reminderState === 'checking'
            ? 'Verifying this device without changing your saved itinerary.'
            : 'Event reminders about 30 minutes before eligible events will be available with notifications enabled.';
  const diagnosticRows = [
    ['Supported context', reminderDiagnostics?.supported_context],
    ['Browser notification permission', reminderDiagnostics?.browser_permission_granted],
    ['WonderPush SDK ready', reminderDiagnostics?.sdk_ready],
    ['WonderPush subscribed', reminderDiagnostics?.subscribed],
    ['Current installation available', reminderDiagnostics?.current_installation_available],
    ['Backend registration exists', reminderDiagnostics?.registration_exists],
    ['Current installation match', reminderDiagnostics?.installation_match],
    ['Reminders enabled', reminderDiagnostics?.reminders_enabled],
    ['Local reminder sync enabled', reminderDiagnostics?.local_reminder_sync_enabled],
    ['Synchronized starred count', reminderDiagnostics?.synchronized_star_count],
    ['Provider reachability', reminderDiagnostics?.provider_reachability],
    ['Provider deliverable', reminderDiagnostics?.provider_deliverable],
    ['Provider readiness fresh', reminderDiagnostics?.provider_fresh],
    ['Final reminder readiness', reminderDiagnostics?.final_reminder_ready],
    ['Failure / recovery stage', reminderFailureStage || (reminderReady ? 'none' : null)],
  ] as const;

  const copyReminderDiagnostics = async () => {
    const diagnosticReport = diagnosticRows
      .map(([label, value]) => `${label}: ${diagnosticResult(value)}`)
      .join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(diagnosticReport);
      setDiagnosticsCopyMessage('Reminder diagnostics copied.');
    } catch {
      setDiagnosticsCopyMessage('Unable to copy diagnostics on this browser.');
    }
  };

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
        <View style={[styles.reminderCard, reminderReady && styles.reminderCardOn]} accessibilityLiveRegion="polite">
          <View style={styles.reminderCardHeading}>
            <Feather name="bell" size={20} color={reminderReady ? '#065F46' : '#8B1538'} />
            <View style={styles.reminderCardCopy}>
              <Text style={[styles.reminderCardTitle, reminderReady && styles.reminderButtonTextOn]}>{reminderTitle}</Text>
              <Text style={styles.reminderCardDescription}>{reminderDescription}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.reminderButton, reminderReady && styles.reminderDisableButton]}
          onPress={() => void changeReminderStatus()} disabled={reminderWorking || reminderState === 'checking'}
          accessibilityRole="button" accessibilityLabel={reminderReady ? 'Disable itinerary event reminders' : reminderTitle}
          accessibilityState={{ disabled: reminderWorking || reminderState === 'checking', busy: reminderWorking || reminderState === 'checking' }}>
          <Text style={[styles.reminderButtonText, reminderReady && styles.reminderButtonTextOn]}>
            {reminderWorking || reminderState === 'checking' ? 'Checking…' : reminderReady ? 'Disable' : reminderState === 'recovery' ? 'Reconnect' : 'Enable'}
          </Text>
          </TouchableOpacity>
        </View>
        {reminderMessage ? <Text style={styles.reminderMessage} accessibilityLiveRegion="polite">{reminderMessage}</Text> : null}
        {IS_STAGING ? (
          <View style={styles.reminderDiagnosticsSection}>
            <TouchableOpacity
              style={styles.reminderDiagnosticsButton}
              onPress={() => setShowReminderDiagnostics((visible) => !visible)}
              accessibilityRole="button"
              accessibilityLabel={showReminderDiagnostics ? 'Hide reminder diagnostics' : 'Show reminder diagnostics'}
              accessibilityState={{ expanded: showReminderDiagnostics }}
            >
              <Text style={styles.reminderDiagnosticsButtonText}>
                {showReminderDiagnostics ? 'Hide reminder diagnostics' : 'Show reminder diagnostics'}
              </Text>
            </TouchableOpacity>
            {showReminderDiagnostics ? (
              <ScrollView
                style={styles.reminderDiagnosticsPanel}
                contentContainerStyle={styles.reminderDiagnosticsPanelContent}
                nestedScrollEnabled
                persistentScrollbar
                accessibilityLabel="Redacted reminder diagnostics"
              >
                {diagnosticRows.map(([label, value]) => (
                  <View key={label} style={styles.reminderDiagnosticRow}>
                    <Text style={styles.reminderDiagnosticLabel}>{label}</Text>
                    <Text style={styles.reminderDiagnosticValue}>{diagnosticResult(value)}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.reminderDiagnosticsCopyButton}
                  onPress={() => void copyReminderDiagnostics()}
                  accessibilityRole="button"
                  accessibilityLabel="Copy reminder diagnostics"
                >
                  <Text style={styles.reminderDiagnosticsCopyButtonText}>Copy reminder diagnostics</Text>
                </TouchableOpacity>
                {diagnosticsCopyMessage ? (
                  <Text style={styles.reminderDiagnosticsCopyMessage} accessibilityLiveRegion="polite">
                    {diagnosticsCopyMessage}
                  </Text>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
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
  reminderCard: { marginTop: 14, borderWidth: 1, borderColor: '#D8C5CB', borderRadius: 14,
    padding: 14, backgroundColor: '#FFFFFF' },
  reminderCardOn: { borderColor: '#86C5AF', backgroundColor: '#ECFDF5' },
  reminderCardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reminderCardCopy: { flex: 1 },
  reminderCardTitle: { color: '#1F2937', fontSize: 16, fontWeight: '800' },
  reminderCardDescription: { color: '#4B5563', fontSize: 13, lineHeight: 18, marginTop: 4 },
  reminderButton: {
    minHeight: 44, marginTop: 12, borderWidth: 1, borderColor: '#8B1538', borderRadius: 10,
    paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  reminderDisableButton: { borderColor: '#047857', backgroundColor: '#FFFFFF' },
  reminderButtonText: { color: '#8B1538', fontSize: 14, fontWeight: '700' },
  reminderButtonTextOn: { color: '#065F46' },
  reminderMessage: { color: '#4B5563', fontSize: 13, lineHeight: 18, marginTop: 8 },
  reminderDiagnosticsSection: { marginTop: 8 },
  reminderDiagnosticsButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 2 },
  reminderDiagnosticsButtonText: { color: '#6B7280', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  reminderDiagnosticsPanel: { maxHeight: 280, marginTop: 6, borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 10, backgroundColor: '#F9FAFB' },
  reminderDiagnosticsPanelContent: { padding: 10, gap: 6 },
  reminderDiagnosticRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  reminderDiagnosticLabel: { flex: 1, color: '#374151', fontSize: 12, lineHeight: 17 },
  reminderDiagnosticValue: { maxWidth: '48%', color: '#111827', fontSize: 12, lineHeight: 17,
    fontWeight: '700', textAlign: 'right' },
  reminderDiagnosticsCopyButton: { minHeight: 44, marginTop: 6, borderWidth: 1, borderColor: '#6B7280',
    borderRadius: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  reminderDiagnosticsCopyButtonText: { color: '#374151', fontSize: 13, fontWeight: '700' },
  reminderDiagnosticsCopyMessage: { color: '#4B5563', fontSize: 12, lineHeight: 17, marginTop: 2 },
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
