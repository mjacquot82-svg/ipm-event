// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { AdminShell, AdminNavItem } from '../../src/components/admin/AdminShell';
import { AnalyticsDashboard } from '../../src/components/admin/AnalyticsDashboard';
import {
  ContentPage,
  ContentToolbar,
  EmptyState,
  ErrorState,
  FieldLabel,
  LoadingState,
} from '../../src/components/admin/ContentScaffold';
import {
  Announcement,
  AnnouncementDeliveryStats,
  AnnouncementPayload,
  AnnouncementStatus,
  AdminScheduleEvent,
  AdminVendor,
  ScheduleEventPayload,
  ScheduleImportProblem,
  ScheduleImportRow,
  VendorPayload,
  createAdminVendor,
  createAnnouncement,
  createScheduleEvent,
  deleteAdminVendor,
  deleteAnnouncement,
  deleteScheduleEvent,
  getCurrentOrganizer,
  importSchedule,
  listAdminVendors,
  listAnnouncements,
  listAnnouncementDeliveryStats,
  listScheduleEvents,
  logoutOrganizer,
  notifyEveryoneForAnnouncement,
  OrganizerUser,
  sendAnnouncementTestNotification,
  updateAdminVendor,
  updateAnnouncement,
  setAnnouncementStatus,
  updateScheduleEvent,
} from '../../src/services/adminAuthService';

type AdminSection = 'dashboard' | 'analytics' | 'vendors' | 'schedule' | 'communications' | 'team' | 'settings';
type VendorEditorMode = 'closed' | 'create' | 'edit';
type ScheduleEditorMode = 'closed' | 'view' | 'add' | 'edit';
type AnnouncementEditorMode = 'closed' | 'create' | 'edit';
type NotificationActionState = {
  audience: 'test' | 'everyone' | null;
  status: 'idle' | 'sending' | 'sent' | 'failed';
  message: string | null;
};
type PlatformFieldKey = (typeof PLATFORM_FIELDS)[number]['key'];
type ImportMapping = Partial<Record<PlatformFieldKey, string>>;

const NAV_ITEMS: AdminNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
  { key: 'vendors', label: 'Vendors', icon: 'shopping-bag' },
  { key: 'schedule', label: 'Schedule', icon: 'calendar' },
  { key: 'communications', label: 'Announcements', icon: 'message-square' },
  { key: 'team', label: 'Team', icon: 'users', disabled: true },
  { key: 'settings', label: 'Settings', icon: 'settings', disabled: true },
];

const SCHEDULE_MAPPING_STORAGE_KEY = 'organizer_schedule_import_mapping_v1';
const PLATFORM_FIELDS = [
  { key: 'title', label: 'Event Title', required: true },
  { key: 'start_date', label: 'Date', required: true },
  { key: 'start_time', label: 'Start Time', required: true },
  { key: 'end_time', label: 'End Time', required: false },
  { key: 'location_name', label: 'Location', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'days_active', label: 'Days Active', required: false },
  { key: 'description', label: 'Description', required: false },
] as const;
const SCHEDULE_TITLE_ALIASES = ['Name', 'Title', 'Event Title', 'Event Name', 'Activity', 'Program'];
const NORMALIZED_SCHEDULE_TITLE_ALIASES = SCHEDULE_TITLE_ALIASES.map(normalizeHeader);

const EMPTY_VENDOR_FORM: VendorPayload = {
  name: '',
  type: '',
  location: '',
  hours_of_operation: '',
  days_of_operation: '',
  priority: 99,
};

const EMPTY_ANNOUNCEMENT_FORM: AnnouncementPayload = {
  title: '',
  message: '',
  priority: 'Information',
  expires_at: null,
  status: 'published',
};

const IDLE_NOTIFICATION_STATE: NotificationActionState = {
  audience: null,
  status: 'idle',
  message: null,
};

export function shortenNotificationText(value: string, limit: number) {
  const normalized = value.trim().split(/\s+/u).join(' ');
  const characters = Array.from(normalized);
  if (characters.length <= limit) return normalized;
  return `${characters.slice(0, limit - 1).join('').trimEnd()}…`;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<OrganizerUser | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [vendors, setVendors] = useState<AdminVendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorsError, setVendorsError] = useState<string | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [editorMode, setEditorMode] = useState<VendorEditorMode>('closed');
  const [editingVendor, setEditingVendor] = useState<AdminVendor | null>(null);
  const [vendorForm, setVendorForm] = useState<VendorPayload>(EMPTY_VENDOR_FORM);
  const [vendorFormError, setVendorFormError] = useState<string | null>(null);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [scheduleEvents, setScheduleEvents] = useState<AdminScheduleEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleDayFilter, setScheduleDayFilter] = useState('All');
  const [scheduleFormEvent, setScheduleFormEvent] = useState<AdminScheduleEvent | null>(null);
  const [scheduleFormMode, setScheduleFormMode] = useState<ScheduleEditorMode>('closed');
  const [scheduleForm, setScheduleForm] = useState<ScheduleEventPayload>(createEmptySchedulePayload());
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importMapping, setImportMapping] = useState<ImportMapping>({});
  const [importProblems, setImportProblems] = useState<ScheduleImportProblem[]>([]);
  const [importPreparedRows, setImportPreparedRows] = useState<ScheduleImportRow[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [announcementDeliveryStats, setAnnouncementDeliveryStats] = useState<Record<string, AnnouncementDeliveryStats>>({});
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementEditorMode, setAnnouncementEditorMode] = useState<AnnouncementEditorMode>('closed');
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementPayload>(EMPTY_ANNOUNCEMENT_FORM);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementSaveMessage, setAnnouncementSaveMessage] = useState<string | null>(null);
  const [notificationAction, setNotificationAction] = useState<NotificationActionState>(IDLE_NOTIFICATION_STATE);
  const notificationRequestInFlight = useRef(false);

  const loadVendors = useCallback(async () => {
    setVendorsLoading(true);
    setVendorsError(null);
    try {
      const result = await listAdminVendors();
      setVendors(result.vendors);
    } catch (err) {
      setVendorsError(err instanceof Error ? err.message : 'Unable to load vendors');
    } finally {
      setVendorsLoading(false);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const result = await listScheduleEvents();
      setScheduleEvents(result.events);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Unable to load schedule');
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    setAnnouncementsError(null);
    try {
      const [result, stats] = await Promise.all([listAnnouncements(), listAnnouncementDeliveryStats()]);
      setAnnouncements(result.announcements);
      setAnnouncementDeliveryStats(Object.fromEntries(stats.deliveries.map((delivery) => [delivery.announcement_id, delivery])));
    } catch (err) {
      setAnnouncementsError(err instanceof Error ? err.message : 'Unable to load announcements');
    } finally {
      setAnnouncementsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getCurrentOrganizer()
      .then((result) => {
        if (isMounted) {
          setCurrentUser(result.user);
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && activeSection === 'vendors') {
      loadVendors();
    }
    if (isAuthenticated && activeSection === 'schedule') {
      loadSchedule();
    }
    if (isAuthenticated && activeSection === 'communications') {
      loadAnnouncements();
    }
  }, [activeSection, isAuthenticated, loadAnnouncements, loadSchedule, loadVendors]);

  useEffect(() => {
    AsyncStorage.getItem(SCHEDULE_MAPPING_STORAGE_KEY)
      .then((value) => {
        if (value) {
          setImportMapping(JSON.parse(value) as ImportMapping);
        }
      })
      .catch(() => undefined);
  }, []);

  const visibleVendors = useMemo(() => {
    const query = vendorSearch.trim().toLowerCase();
    if (!query) {
      return vendors;
    }
    return vendors.filter((vendor) =>
      [
        vendor.name,
        vendor.type,
        vendor.location,
        vendor.hours_of_operation,
        vendor.days_of_operation,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [vendorSearch, vendors]);

  const visibleAnnouncements = useMemo(() => {
    const query = announcementSearch.trim().toLowerCase();
    if (!query) return announcements;
    return announcements.filter((item) =>
      [item.title, item.message, item.priority, item.status, item.created_by]
        .join(' ').toLowerCase().includes(query)
    );
  }, [announcementSearch, announcements]);

  const openAnnouncementEditor = (announcement?: Announcement) => {
    setEditingAnnouncement(announcement || null);
    setAnnouncementEditorMode(announcement ? 'edit' : 'create');
    setAnnouncementForm(announcement ? {
      title: announcement.title,
      message: announcement.message,
      priority: announcement.priority,
      expires_at: announcement.expires_at,
      status: announcement.status,
    } : EMPTY_ANNOUNCEMENT_FORM);
    setAnnouncementsError(null);
    setAnnouncementSaveMessage(null);
    setNotificationAction(IDLE_NOTIFICATION_STATE);
  };

  const saveAnnouncement = async (status: AnnouncementStatus) => {
    if (announcementSaving || notificationAction.status === 'sending') return;
    setAnnouncementSaving(true);
    setAnnouncementsError(null);
    setAnnouncementSaveMessage(null);
    try {
      const payload = { ...announcementForm, status };
      const saved = editingAnnouncement
        ? await updateAnnouncement(editingAnnouncement.id, payload)
        : await createAnnouncement(payload);
      setAnnouncements((current) => {
        const withoutSaved = current.filter((item) => item.id !== saved.id);
        return [saved, ...withoutSaved];
      });
      setAnnouncementForm({
        title: saved.title,
        message: saved.message,
        priority: saved.priority,
        expires_at: saved.expires_at,
        status: saved.status,
      });
      setEditingAnnouncement(saved);
      setAnnouncementEditorMode('edit');
      setNotificationAction(IDLE_NOTIFICATION_STATE);
      setAnnouncementSaveMessage(status === 'published' ? 'Published. No notification was sent.' : status === 'draft' ? 'Draft saved.' : 'Changes saved.');
    } catch (err) {
      setAnnouncementsError(err instanceof Error ? err.message : 'Unable to save announcement');
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const sendAnnouncementNotification = async (audience: 'test' | 'everyone') => {
    if (!editingAnnouncement || notificationRequestInFlight.current || announcementSaving) return;
    notificationRequestInFlight.current = true;
    setNotificationAction({ audience, status: 'sending', message: null });
    setAnnouncementsError(null);
    try {
      await (audience === 'test'
        ? sendAnnouncementTestNotification(editingAnnouncement.id)
        : notifyEveryoneForAnnouncement(editingAnnouncement.id));
      setNotificationAction({
        audience,
        status: 'sent',
        message: audience === 'test'
          ? 'Test notification sent to configured test subscribers.'
          : 'Notification accepted by WonderPush.',
      });
      if (audience === 'everyone') await loadAnnouncements();
    } catch (err) {
      setNotificationAction({
        audience,
        status: 'failed',
        message: err instanceof Error ? err.message : 'Notification could not be sent.',
      });
    } finally {
      notificationRequestInFlight.current = false;
    }
  };

  const changeAnnouncementStatus = async (announcement: Announcement, status: AnnouncementStatus) => {
    setAnnouncementsError(null);
    try {
      const updated = await setAnnouncementStatus(announcement.id, status);
      setAnnouncements((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setAnnouncementsError(err instanceof Error ? err.message : 'Unable to update announcement status');
    }
  };

  const removeAnnouncement = async (announcement: Announcement) => {
    setAnnouncementsError(null);
    try {
      await deleteAnnouncement(announcement.id);
      setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
    } catch (err) {
      setAnnouncementsError(err instanceof Error ? err.message : 'Unable to delete announcement');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutOrganizer();
    } finally {
      router.replace('/admin/login');
    }
  };

  const openCreateVendor = () => {
    setEditorMode('create');
    setEditingVendor(null);
    setVendorForm(EMPTY_VENDOR_FORM);
    setVendorFormError(null);
  };

  const openEditVendor = (vendor: AdminVendor) => {
    setEditorMode('edit');
    setEditingVendor(vendor);
    setVendorForm({
      name: vendor.name,
      type: vendor.type,
      location: vendor.location,
      hours_of_operation: vendor.hours_of_operation,
      days_of_operation: vendor.days_of_operation,
      priority: vendor.priority,
    });
    setVendorFormError(null);
  };

  const closeVendorEditor = () => {
    setEditorMode('closed');
    setEditingVendor(null);
    setVendorForm(EMPTY_VENDOR_FORM);
    setVendorFormError(null);
  };

  const saveVendor = async () => {
    if (vendorSaving) {
      return;
    }
    if (!vendorForm.name?.trim()) {
      setVendorFormError('Vendor name is required');
      return;
    }

    setVendorSaving(true);
    setVendorFormError(null);
    try {
      const result =
        editorMode === 'edit' && editingVendor
          ? await updateAdminVendor(editingVendor.id, vendorForm)
          : await createAdminVendor(vendorForm);
      setVendors(result.vendors);
      closeVendorEditor();
    } catch (err) {
      setVendorFormError(err instanceof Error ? err.message : 'Unable to save vendor');
    } finally {
      setVendorSaving(false);
    }
  };

  const removeVendor = async (vendor: AdminVendor) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${vendor.name}"?`)) {
      return;
    }
    setVendorsError(null);
    try {
      const result = await deleteAdminVendor(vendor.id);
      setVendors(result.vendors);
    } catch (err) {
      setVendorsError(err instanceof Error ? err.message : 'Unable to delete vendor');
    }
  };

  const openScheduleForm = (mode: ScheduleEditorMode, event?: AdminScheduleEvent) => {
    setScheduleFormMode(mode);
    setScheduleFormEvent(event || null);
    setScheduleForm(event ? scheduleEventToPayload(event) : createEmptySchedulePayload());
    setScheduleError(null);
  };

  const closeScheduleForm = () => {
    setScheduleFormMode('closed');
    setScheduleFormEvent(null);
    setScheduleForm(createEmptySchedulePayload());
  };

  const saveScheduleEvent = async () => {
    if (scheduleSaving || scheduleFormMode === 'view') {
      return;
    }

    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const result =
        scheduleFormMode === 'edit' && scheduleFormEvent
          ? await updateScheduleEvent(scheduleFormEvent.id, scheduleForm)
          : await createScheduleEvent(scheduleForm);
      setScheduleEvents(result.events);
      closeScheduleForm();
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Unable to save schedule event');
    } finally {
      setScheduleSaving(false);
    }
  };

  const removeScheduleEvent = async (event: AdminScheduleEvent) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${event.title}"?`)) {
      return;
    }
    setScheduleError(null);
    try {
      const result = await deleteScheduleEvent(event.id);
      setScheduleEvents(result.events);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Unable to delete schedule event');
    }
  };

  const prepareImport = async () => {
    const parsed = parseScheduleImportText(importText);
    const mapping = normalizeImportMapping(importMapping, parsed.headers);
    const prepared = prepareScheduleImport(parsed.rows, mapping);
    setImportHeaders(parsed.headers);
    setImportRows(parsed.rows);
    setImportMapping(mapping);
    setImportPreparedRows(prepared.rows);
    setImportProblems(prepared.problems);
    setImportResult(null);
    await AsyncStorage.setItem(SCHEDULE_MAPPING_STORAGE_KEY, JSON.stringify(mapping));
  };

  const runImport = async () => {
    if (importBusy) {
      return;
    }
    const prepared =
      importPreparedRows.length || importProblems.length
        ? { rows: importPreparedRows, problems: importProblems }
        : prepareScheduleImport(importRows, importMapping);
    setImportBusy(true);
    setScheduleError(null);
    try {
      await AsyncStorage.setItem(SCHEDULE_MAPPING_STORAGE_KEY, JSON.stringify(importMapping));
      const result = await importSchedule({
        rows: prepared.rows,
        problems: prepared.problems,
      });
      setScheduleEvents(result.events);
      setImportProblems(result.problems);
      setImportPreparedRows(prepared.rows);
      setImportResult(`${result.imported_count} events imported`);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Unable to import schedule');
    } finally {
      setImportBusy(false);
    }
  };

  if (loadingSession) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/admin/login" />;
  }

  return (
    <AdminShell
      activeKey={activeSection}
      navItems={NAV_ITEMS}
      currentUser={currentUser}
      onNavigate={(key) => setActiveSection(key as AdminSection)}
      onLogout={handleLogout}
    >
      {activeSection === 'dashboard' && (
        <DashboardPage
          currentUser={currentUser}
          vendorsCount={vendors.length}
          scheduleCount={scheduleEvents.length}
          onOpenSchedule={() => setActiveSection('schedule')}
        />
      )}

      {activeSection === 'analytics' && (
        <AnalyticsDashboard onAuthenticationExpired={() => {
          setIsAuthenticated(false);
          setCurrentUser(null);
          router.replace('/admin/login');
        }} />
      )}

      {activeSection === 'vendors' && (
        <VendorsPage
          vendors={visibleVendors}
          totalCount={vendors.length}
          loading={vendorsLoading}
          error={vendorsError}
          search={vendorSearch}
          editorMode={editorMode}
          form={vendorForm}
          formError={vendorFormError}
          saving={vendorSaving}
          editingVendor={editingVendor}
          onSearchChange={setVendorSearch}
          onRefresh={loadVendors}
          onCreate={openCreateVendor}
          onEdit={openEditVendor}
          onDelete={removeVendor}
          onFormChange={setVendorForm}
          onCloseEditor={closeVendorEditor}
          onSave={saveVendor}
        />
      )}

      {activeSection === 'schedule' && (
        <SchedulePage
          events={scheduleEvents}
          loading={scheduleLoading}
          error={scheduleError}
          search={scheduleSearch}
          dayFilter={scheduleDayFilter}
          formMode={scheduleFormMode}
          formEvent={scheduleFormEvent}
          form={scheduleForm}
          saving={scheduleSaving}
          importOpen={importOpen}
          importText={importText}
          importHeaders={importHeaders}
          importMapping={importMapping}
          importProblems={importProblems}
          importPreparedRows={importPreparedRows}
          importBusy={importBusy}
          importResult={importResult}
          onRefresh={loadSchedule}
          onSearchChange={setScheduleSearch}
          onDayFilterChange={setScheduleDayFilter}
          onOpenForm={openScheduleForm}
          onCloseForm={closeScheduleForm}
          onFormChange={setScheduleForm}
          onSave={saveScheduleEvent}
          onDelete={removeScheduleEvent}
          onImportOpenChange={setImportOpen}
          onImportTextChange={setImportText}
          onImportMappingChange={(mapping) => {
            setImportMapping(mapping);
            const prepared = prepareScheduleImport(importRows, mapping);
            setImportPreparedRows(prepared.rows);
            setImportProblems(prepared.problems);
          }}
          onPrepareImport={prepareImport}
          onRunImport={runImport}
        />
      )}

      {activeSection === 'communications' && (
        <AnnouncementsPage
          announcements={visibleAnnouncements}
          totalCount={announcements.length}
          loading={announcementsLoading}
          error={announcementsError}
          search={announcementSearch}
          editorMode={announcementEditorMode}
          form={announcementForm}
          saving={announcementSaving}
          saveMessage={announcementSaveMessage}
          notificationAction={notificationAction}
          deliveryStats={announcementDeliveryStats}
          editingAnnouncement={editingAnnouncement}
          showTestAction={currentUser?.role === 'Owner'}
          onSearchChange={setAnnouncementSearch}
          onRefresh={loadAnnouncements}
          onCreate={() => openAnnouncementEditor()}
          onEdit={openAnnouncementEditor}
          onStatusChange={changeAnnouncementStatus}
          onDelete={removeAnnouncement}
          onFormChange={setAnnouncementForm}
          onCloseEditor={() => {
            if (notificationAction.status !== 'sending' && !announcementSaving) setAnnouncementEditorMode('closed');
          }}
          onSave={saveAnnouncement}
          onSendTest={() => sendAnnouncementNotification('test')}
          onNotifyEveryone={() => sendAnnouncementNotification('everyone')}
        />
      )}
    </AdminShell>
  );
}

function DashboardPage({
  currentUser,
  vendorsCount,
  scheduleCount,
  onOpenSchedule,
}: {
  currentUser: OrganizerUser | null;
  vendorsCount: number;
  scheduleCount: number;
  onOpenSchedule: () => void;
}) {
  return (
    <ContentPage
      title="Dashboard"
      subtitle="Event operations overview"
      primaryAction={{ label: 'Manage schedule', icon: 'calendar', onPress: onOpenSchedule }}
    >
      <View style={styles.metricGrid}>
        <MetricCard label="Event" value={currentUser?.event_id || 'Current event'} icon="map-pin" />
        <MetricCard label="Role" value={currentUser?.role || 'Organizer'} icon="shield" />
        <MetricCard label="Vendors" value={String(vendorsCount)} icon="shopping-bag" />
        <MetricCard label="Schedule" value={String(scheduleCount)} icon="calendar" />
      </View>
    </ContentPage>
  );
}

function createEmptySchedulePayload(): ScheduleEventPayload {
  return {
    title: '',
    description: '',
    start_date: '',
    start_time: '',
    end_time: '',
    category: 'Event',
    latitude: null,
    longitude: null,
    days_active: '',
    location_name: '',
  };
}

function scheduleEventToPayload(event: AdminScheduleEvent): ScheduleEventPayload {
  return {
    title: event.title,
    description: event.description,
    start_date: event.start_date,
    start_time: event.start_time,
    end_time: event.end_time,
    category: event.category,
    latitude: event.latitude,
    longitude: event.longitude,
    days_active: event.days_active,
    location_name: event.location_name || '',
  };
}

function getScheduleDay(event: AdminScheduleEvent) {
  return event.days_active || event.start_date || 'Unscheduled';
}

function parseScheduleImportText(value: string) {
  const lines = value
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] as Record<string, string>[] };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitImportLine(lines[0], delimiter).map((header) => header.trim()).filter(Boolean);
  const rows = lines.slice(1).map((line) => {
    const cells = splitImportLine(line, delimiter);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = (cells[index] || '').trim();
      return row;
    }, {});
  });

  return { headers, rows };
}

function splitImportLine(line: string, delimiter: string) {
  if (delimiter === '\t') {
    return line.split('\t');
  }

  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function normalizeImportMapping(mapping: ImportMapping, headers: string[]): ImportMapping {
  const nextMapping: ImportMapping = { ...mapping };
  const normalizedHeaders = headers.map((header) => ({ header, value: normalizeHeader(header) }));

  PLATFORM_FIELDS.forEach((field) => {
    if (nextMapping[field.key] && headers.includes(nextMapping[field.key] || '')) {
      return;
    }
    const match = normalizedHeaders.find(({ value }) => {
      if (field.key === 'title') return NORMALIZED_SCHEDULE_TITLE_ALIASES.includes(value);
      if (field.key === 'start_date') return ['date', 'startdate', 'eventdate'].includes(value);
      if (field.key === 'start_time') return ['start', 'starttime', 'eventstart'].includes(value);
      if (field.key === 'end_time') return ['end', 'endtime', 'eventend'].includes(value);
      if (field.key === 'location_name') return ['venue', 'location', 'locationname'].includes(value);
      if (field.key === 'category') return ['category', 'type'].includes(value);
      if (field.key === 'days_active') return ['daysactive', 'day', 'days'].includes(value);
      if (field.key === 'description') return ['description', 'details', 'notes'].includes(value);
      return false;
    });
    if (match) {
      nextMapping[field.key] = match.header;
    }
  });

  return nextMapping;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function prepareScheduleImport(rows: Record<string, string>[], mapping: ImportMapping) {
  const preparedRows: ScheduleImportRow[] = [];
  const problems: ScheduleImportProblem[] = [];
  const hasRowsWithContent = rows.some((row) => Object.values(row).some((value) => value.trim()));

  if (hasRowsWithContent && !mapping.title) {
    return {
      rows: preparedRows,
      problems: [
        {
          row_number: 1,
          errors: [`Title column is required. Accepted columns: ${SCHEDULE_TITLE_ALIASES.join(', ')}`],
          values: {},
        },
      ],
    };
  }

  rows.forEach((row, index) => {
    if (Object.values(row).every((value) => !value.trim())) {
      return;
    }

    const payload = createEmptySchedulePayload();
    PLATFORM_FIELDS.forEach((field) => {
      const column = mapping[field.key];
      const value = column ? row[column] || '' : '';
      if (field.key === 'title') payload.title = value;
      if (field.key === 'start_date') payload.start_date = value;
      if (field.key === 'start_time') payload.start_time = value;
      if (field.key === 'end_time') payload.end_time = value;
      if (field.key === 'location_name') payload.location_name = value;
      if (field.key === 'category') payload.category = value || 'Event';
      if (field.key === 'days_active') payload.days_active = value;
      if (field.key === 'description') payload.description = value;
    });

    const errors = [];
    if (!payload.title.trim()) errors.push('Event Title is required');
    if (!payload.start_date.trim()) errors.push('Date is required');
    if (!payload.start_time.trim()) errors.push('Start Time is required');

    if (errors.length) {
      problems.push({ row_number: index + 2, errors, values: row });
      return;
    }

    preparedRows.push({ row_number: index + 2, data: payload });
  });

  return { rows: preparedRows, problems };
}

function SchedulePage({
  events,
  loading,
  error,
  search,
  dayFilter,
  formMode,
  formEvent,
  form,
  saving,
  importOpen,
  importText,
  importHeaders,
  importMapping,
  importProblems,
  importPreparedRows,
  importBusy,
  importResult,
  onRefresh,
  onSearchChange,
  onDayFilterChange,
  onOpenForm,
  onCloseForm,
  onFormChange,
  onSave,
  onDelete,
  onImportOpenChange,
  onImportTextChange,
  onImportMappingChange,
  onPrepareImport,
  onRunImport,
}: {
  events: AdminScheduleEvent[];
  loading: boolean;
  error: string | null;
  search: string;
  dayFilter: string;
  formMode: ScheduleEditorMode;
  formEvent: AdminScheduleEvent | null;
  form: ScheduleEventPayload;
  saving: boolean;
  importOpen: boolean;
  importText: string;
  importHeaders: string[];
  importMapping: ImportMapping;
  importProblems: ScheduleImportProblem[];
  importPreparedRows: ScheduleImportRow[];
  importBusy: boolean;
  importResult: string | null;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onDayFilterChange: (value: string) => void;
  onOpenForm: (mode: ScheduleEditorMode, event?: AdminScheduleEvent) => void;
  onCloseForm: () => void;
  onFormChange: (value: ScheduleEventPayload) => void;
  onSave: () => void;
  onDelete: (event: AdminScheduleEvent) => void;
  onImportOpenChange: (value: boolean) => void;
  onImportTextChange: (value: string) => void;
  onImportMappingChange: (value: ImportMapping) => void;
  onPrepareImport: () => void;
  onRunImport: () => void;
}) {
  const isMobile = useWindowDimensions().width < 600;
  const days = ['All', ...Array.from(new Set(events.map(getScheduleDay))).filter(Boolean)];
  const normalizedSearch = search.trim().toLowerCase();
  const visibleEvents = events.filter((event) => {
    const matchesSearch =
      !normalizedSearch ||
      [event.title, event.location_name || '', event.category, event.start_date]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    const matchesDay = dayFilter === 'All' || getScheduleDay(event) === dayFilter;
    return matchesSearch && matchesDay;
  });

  return (
    <ContentPage
      title="Schedule"
      subtitle={`${events.length} schedule item${events.length === 1 ? '' : 's'} in this event`}
      primaryAction={{ label: 'Add event', icon: 'plus', onPress: () => onOpenForm('add') }}
    >
      <ContentToolbar
        searchValue={search}
        searchPlaceholder="Search schedule by title, location, category, or date"
        onSearchChange={onSearchChange}
        secondaryAction={{ label: 'Refresh', icon: 'refresh-cw', onPress: onRefresh, disabled: loading }}
      />

      <View style={[styles.scheduleToolbarExtras, isMobile && styles.scheduleToolbarExtrasMobile]}>
        <ScrollView style={isMobile && styles.dayFilterScrollMobile} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayFilterList}>
          {days.map((day) => (
            <Pressable
              key={day}
              style={[styles.filterPill, dayFilter === day && styles.filterPillActive]}
              onPress={() => onDayFilterChange(day)}
            >
              <Text style={[styles.filterPillText, dayFilter === day && styles.filterPillTextActive]}>
                {day}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={[styles.importButton, isMobile && styles.importButtonMobile]} onPress={() => onImportOpenChange(!importOpen)}>
          <Feather name="upload" size={17} color={colors.textSecondary} />
          <Text style={styles.importButtonText}>{importOpen ? 'Close import' : 'Import schedule'}</Text>
        </Pressable>
      </View>

      {error && <ErrorState message={error} onRetry={onRefresh} />}

      {importOpen && (
        <ScheduleImportPanel
          importText={importText}
          importHeaders={importHeaders}
          importMapping={importMapping}
          importProblems={importProblems}
          importPreparedRows={importPreparedRows}
          importBusy={importBusy}
          importResult={importResult}
          onImportTextChange={onImportTextChange}
          onImportMappingChange={onImportMappingChange}
          onPrepareImport={onPrepareImport}
          onRunImport={onRunImport}
        />
      )}

      {formMode !== 'closed' && (
        <ScheduleEditor
          mode={formMode}
          event={formEvent}
          form={form}
          saving={saving}
          onChange={onFormChange}
          onClose={onCloseForm}
          onSave={onSave}
        />
      )}

      {loading ? (
        <LoadingState label="Loading schedule..." />
      ) : visibleEvents.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={search || dayFilter !== 'All' ? 'No schedule items match your filters' : 'No schedule items yet'}
          message={
            search || dayFilter !== 'All'
              ? 'Clear the search or day filter to see more items.'
              : 'Create or import the first schedule item for this event.'
          }
          action={search || dayFilter !== 'All' ? undefined : { label: 'Add event', icon: 'plus', onPress: () => onOpenForm('add') }}
        />
      ) : (
        <ScheduleList events={visibleEvents} onOpenForm={onOpenForm} onDelete={onDelete} />
      )}
    </ContentPage>
  );
}

function ScheduleImportPanel({
  importText,
  importHeaders,
  importMapping,
  importProblems,
  importPreparedRows,
  importBusy,
  importResult,
  onImportTextChange,
  onImportMappingChange,
  onPrepareImport,
  onRunImport,
}: {
  importText: string;
  importHeaders: string[];
  importMapping: ImportMapping;
  importProblems: ScheduleImportProblem[];
  importPreparedRows: ScheduleImportRow[];
  importBusy: boolean;
  importResult: string | null;
  onImportTextChange: (value: string) => void;
  onImportMappingChange: (value: ImportMapping) => void;
  onPrepareImport: () => void;
  onRunImport: () => void;
}) {
  return (
    <View style={styles.editorPanel}>
      <View style={styles.editorHeader}>
        <View>
          <Text style={styles.editorTitle}>Import schedule</Text>
          <Text style={styles.editorSubtitle}>Paste rows from Excel, Google Sheets, or CSV</Text>
        </View>
      </View>
      <TextInput
        value={importText}
        onChangeText={onImportTextChange}
        placeholder="Paste schedule rows here"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.textArea]}
        multiline
        textAlignVertical="top"
      />
      <View style={styles.editorActions}>
        <Pressable style={styles.cancelButton} onPress={onPrepareImport}>
          <Feather name="columns" size={17} color={colors.textSecondary} />
          <Text style={styles.cancelButtonText}>Map columns</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, (importBusy || importPreparedRows.length === 0) && styles.buttonDisabled]}
          onPress={onRunImport}
          disabled={importBusy || importPreparedRows.length === 0}
        >
          {importBusy ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="check" size={17} color="#FFFFFF" />}
          <Text style={styles.saveButtonText}>{importBusy ? 'Importing...' : 'Import'}</Text>
        </Pressable>
      </View>

      {importHeaders.length > 0 && (
        <View style={styles.mappingGrid}>
          {PLATFORM_FIELDS.map((field) => (
            <View key={field.key} style={styles.mappingRow}>
              <FieldLabel label={field.label} required={field.required} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mappingOptions}>
                <Pressable
                  style={[styles.filterPill, !importMapping[field.key] && styles.filterPillActive]}
                  onPress={() => onImportMappingChange({ ...importMapping, [field.key]: undefined })}
                >
                  <Text style={[styles.filterPillText, !importMapping[field.key] && styles.filterPillTextActive]}>
                    None
                  </Text>
                </Pressable>
                {importHeaders.map((header) => (
                  <Pressable
                    key={header}
                    style={[styles.filterPill, importMapping[field.key] === header && styles.filterPillActive]}
                    onPress={() => onImportMappingChange({ ...importMapping, [field.key]: header })}
                  >
                    <Text style={[styles.filterPillText, importMapping[field.key] === header && styles.filterPillTextActive]}>
                      {header}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      )}

      {(importResult || importPreparedRows.length > 0 || importProblems.length > 0) && (
        <View style={styles.importSummary}>
          {importResult && <Text style={styles.importSuccess}>{importResult}</Text>}
          {importPreparedRows.length > 0 && !importResult && (
            <Text style={styles.importSuccess}>{importPreparedRows.length} events ready</Text>
          )}
          {importProblems.length > 0 && (
            <Text style={styles.importWarning}>{importProblems.length} rows require attention</Text>
          )}
          {importProblems.slice(0, 5).map((problem) => (
            <Text key={problem.row_number} style={styles.problemText}>
              Row {problem.row_number}: {problem.errors.join(', ')}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function ScheduleEditor({
  mode,
  event,
  form,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  mode: Exclude<ScheduleEditorMode, 'closed'>;
  event: AdminScheduleEvent | null;
  form: ScheduleEventPayload;
  saving: boolean;
  onChange: (value: ScheduleEventPayload) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isReadOnly = mode === 'view';
  const updateField = (key: keyof ScheduleEventPayload, value: string) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <View style={styles.editorPanel}>
      <View style={styles.editorHeader}>
        <View>
          <Text style={styles.editorTitle}>
            {mode === 'add' ? 'Add event' : mode === 'edit' ? 'Edit event' : 'Event details'}
          </Text>
          <Text style={styles.editorSubtitle}>
            {event ? `Row ${event.row_number}` : 'Schedule item for the current event'}
          </Text>
        </View>
        <Pressable style={styles.iconButton} onPress={onClose}>
          <Feather name="x" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.formGrid}>
        <FormTextField label="Event title" value={form.title} required placeholder="Event title" editable={!isReadOnly} onChangeText={(value) => updateField('title', value)} />
        <FormTextField label="Date" value={form.start_date} required placeholder="Date" editable={!isReadOnly} onChangeText={(value) => updateField('start_date', value)} />
        <FormTextField label="Start time" value={form.start_time} required placeholder="Start time" editable={!isReadOnly} onChangeText={(value) => updateField('start_time', value)} />
        <FormTextField label="End time" value={form.end_time} placeholder="End time (optional)" editable={!isReadOnly} onChangeText={(value) => updateField('end_time', value)} />
        <FormTextField label="Location" value={form.location_name || ''} placeholder="Location" editable={!isReadOnly} onChangeText={(value) => updateField('location_name', value)} />
        <FormTextField label="Category" value={form.category || ''} placeholder="Category" editable={!isReadOnly} onChangeText={(value) => updateField('category', value)} />
        <FormTextField label="Day" value={form.days_active || ''} placeholder="Day" editable={!isReadOnly} onChangeText={(value) => updateField('days_active', value)} />
        <FormTextField label="Description" value={form.description || ''} placeholder="Description" editable={!isReadOnly} multiline onChangeText={(value) => updateField('description', value)} />
      </View>

      {mode !== 'view' && (
        <View style={styles.editorActions}>
          <Pressable style={styles.cancelButton} onPress={onClose} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="save" size={17} color="#FFFFFF" />}
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save event'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ScheduleList({
  events,
  onOpenForm,
  onDelete,
}: {
  events: AdminScheduleEvent[];
  onOpenForm: (mode: ScheduleEditorMode, event?: AdminScheduleEvent) => void;
  onDelete: (event: AdminScheduleEvent) => void;
}) {
  const isMobile = useWindowDimensions().width < 600;

  if (isMobile) {
    return (
      <View style={styles.mobileCardList}>
        {events.map((event) => (
          <View key={event.id} style={styles.mobileDataCard}>
            <Text style={styles.vendorName}>{event.title}</Text>
            <Text style={styles.vendorMeta}>{[event.start_date, event.category].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.mobileCardDetail}>{[event.start_time, event.end_time].filter(Boolean).join(' - ') || 'No time'}</Text>
            <Text style={styles.mobileCardDetail}>{event.location_name || 'No location'}</Text>
            <View style={styles.mobileCardActions}>
              <Pressable style={styles.iconButton} onPress={() => onOpenForm('view', event)}><Feather name="eye" size={16} color={colors.textSecondary} /></Pressable>
              <Pressable style={styles.iconButton} onPress={() => onOpenForm('edit', event)}><Feather name="edit-2" size={16} color={colors.textSecondary} /></Pressable>
              <Pressable style={styles.iconButton} onPress={() => onDelete(event)}><Feather name="trash-2" size={16} color={colors.error} /></Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableHeaderText, styles.scheduleNameColumn]}>Event</Text>
        <Text style={[styles.tableHeaderText, styles.scheduleTimeColumn]}>Time</Text>
        <Text style={[styles.tableHeaderText, styles.scheduleLocationColumn]}>Location</Text>
        <Text style={[styles.tableHeaderText, styles.scheduleActionsColumn]}>Actions</Text>
      </View>
      {events.map((event) => (
        <View key={event.id} style={styles.tableRow}>
          <View style={styles.scheduleNameColumn}>
            <Text style={styles.vendorName}>{event.title}</Text>
            <Text style={styles.vendorMeta} numberOfLines={1}>
              {[event.start_date, event.category].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Text style={[styles.tableText, styles.scheduleTimeColumn]}>
            {[event.start_time, event.end_time].filter(Boolean).join(' - ') || 'No time'}
          </Text>
          <Text style={[styles.tableText, styles.scheduleLocationColumn]}>{event.location_name || 'No location'}</Text>
          <View style={styles.scheduleActionsColumn}>
            <Pressable style={styles.iconButton} onPress={() => onOpenForm('view', event)}>
              <Feather name="eye" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => onOpenForm('edit', event)}>
              <Feather name="edit-2" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => onDelete(event)}>
              <Feather name="trash-2" size={16} color={colors.error} />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function VendorsPage({
  vendors,
  totalCount,
  loading,
  error,
  search,
  editorMode,
  form,
  formError,
  saving,
  editingVendor,
  onSearchChange,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  onFormChange,
  onCloseEditor,
  onSave,
}: {
  vendors: AdminVendor[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  search: string;
  editorMode: VendorEditorMode;
  form: VendorPayload;
  formError: string | null;
  saving: boolean;
  editingVendor: AdminVendor | null;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (vendor: AdminVendor) => void;
  onDelete: (vendor: AdminVendor) => void;
  onFormChange: (value: VendorPayload) => void;
  onCloseEditor: () => void;
  onSave: () => void;
}) {
  return (
    <ContentPage
      title="Vendors"
      subtitle={`${totalCount} vendor${totalCount === 1 ? '' : 's'} in this event`}
      primaryAction={{ label: 'Add vendor', icon: 'plus', onPress: onCreate }}
    >
      <ContentToolbar
        searchValue={search}
        searchPlaceholder="Search vendors by name, type, location, or hours"
        onSearchChange={onSearchChange}
        secondaryAction={{ label: 'Refresh', icon: 'refresh-cw', onPress: onRefresh, disabled: loading }}
      />

      {error ? (
        <ErrorState message={error} onRetry={onRefresh} />
      ) : loading ? (
        <LoadingState label="Loading vendors..." />
      ) : vendors.length === 0 ? (
        <EmptyState
          icon="shopping-bag"
          title={search ? 'No vendors match your search' : 'No vendors yet'}
          message={search ? 'Clear the search or try different terms.' : 'Create the first vendor for this event.'}
          action={search ? undefined : { label: 'Add vendor', icon: 'plus', onPress: onCreate }}
        />
      ) : (
        <VendorList vendors={vendors} onEdit={onEdit} onDelete={onDelete} />
      )}

      {editorMode !== 'closed' && (
        <VendorEditor
          mode={editorMode}
          form={form}
          error={formError}
          saving={saving}
          editingVendor={editingVendor}
          onChange={onFormChange}
          onClose={onCloseEditor}
          onSave={onSave}
        />
      )}
    </ContentPage>
  );
}

function VendorList({
  vendors,
  onEdit,
  onDelete,
}: {
  vendors: AdminVendor[];
  onEdit: (vendor: AdminVendor) => void;
  onDelete: (vendor: AdminVendor) => void;
}) {
  const isMobile = useWindowDimensions().width < 600;

  if (isMobile) {
    return (
      <View style={styles.mobileCardList}>
        {vendors.map((vendor) => (
          <View key={vendor.id} style={styles.mobileDataCard}>
            <Text style={styles.vendorName}>{vendor.name}</Text>
            <Text style={styles.vendorMeta}>{[vendor.days_of_operation, vendor.hours_of_operation].filter(Boolean).join(' · ') || 'No hours set'}</Text>
            <Text style={styles.mobileCardDetail}>{vendor.type || 'Uncategorized'}</Text>
            <Text style={styles.mobileCardDetail}>{vendor.location || 'No location'} · Priority {vendor.priority}</Text>
            <View style={styles.mobileCardActions}>
              <Pressable style={styles.iconButton} onPress={() => onEdit(vendor)}><Feather name="edit-2" size={16} color={colors.textSecondary} /></Pressable>
              <Pressable style={styles.iconButton} onPress={() => onDelete(vendor)}><Feather name="trash-2" size={16} color={colors.error} /></Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableHeaderText, styles.nameColumn]}>Name</Text>
        <Text style={[styles.tableHeaderText, styles.typeColumn]}>Type</Text>
        <Text style={[styles.tableHeaderText, styles.locationColumn]}>Location</Text>
        <Text style={[styles.tableHeaderText, styles.priorityColumn]}>Priority</Text>
        <Text style={[styles.tableHeaderText, styles.actionsColumn]}>Actions</Text>
      </View>

      {vendors.map((vendor) => (
        <View key={vendor.id} style={styles.tableRow}>
          <View style={styles.nameColumn}>
            <Text style={styles.vendorName}>{vendor.name}</Text>
            <Text style={styles.vendorMeta} numberOfLines={1}>
              {[vendor.days_of_operation, vendor.hours_of_operation].filter(Boolean).join(' · ') || 'No hours set'}
            </Text>
          </View>
          <Text style={[styles.tableText, styles.typeColumn]}>{vendor.type || 'Uncategorized'}</Text>
          <Text style={[styles.tableText, styles.locationColumn]}>{vendor.location || 'No location'}</Text>
          <Text style={[styles.tableText, styles.priorityColumn]}>{vendor.priority}</Text>
          <View style={styles.actionsColumn}>
            <Pressable style={styles.iconButton} onPress={() => onEdit(vendor)}>
              <Feather name="edit-2" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => onDelete(vendor)}>
              <Feather name="trash-2" size={16} color={colors.error} />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function VendorEditor({
  mode,
  form,
  error,
  saving,
  editingVendor,
  onChange,
  onClose,
  onSave,
}: {
  mode: Exclude<VendorEditorMode, 'closed'>;
  form: VendorPayload;
  error: string | null;
  saving: boolean;
  editingVendor: AdminVendor | null;
  onChange: (value: VendorPayload) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const updateField = (key: keyof VendorPayload, value: string) => {
    onChange({
      ...form,
      [key]: key === 'priority' ? Number(value) || 0 : value,
    });
  };

  return (
    <View style={styles.editorPanel}>
      <View style={styles.editorHeader}>
        <View>
          <Text style={styles.editorTitle}>{mode === 'edit' ? 'Edit vendor' : 'Add vendor'}</Text>
          <Text style={styles.editorSubtitle}>
            {editingVendor?.name || 'Vendor details for the current event'}
          </Text>
        </View>
        <Pressable style={styles.iconButton} onPress={onClose}>
          <Feather name="x" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.formGrid}>
        <FormTextField
          label="Name"
          value={form.name}
          required
          placeholder="Vendor name"
          onChangeText={(value) => updateField('name', value)}
        />
        <FormTextField
          label="Type"
          value={form.type || ''}
          placeholder="Food, exhibitor, service"
          onChangeText={(value) => updateField('type', value)}
        />
        <FormTextField
          label="Location"
          value={form.location || ''}
          placeholder="Booth, row, building, or zone"
          onChangeText={(value) => updateField('location', value)}
        />
        <FormTextField
          label="Priority"
          value={String(form.priority ?? 99)}
          placeholder="99"
          keyboardType="numeric"
          onChangeText={(value) => updateField('priority', value)}
        />
        <FormTextField
          label="Hours of operation"
          value={form.hours_of_operation || ''}
          placeholder="9 AM - 5 PM"
          onChangeText={(value) => updateField('hours_of_operation', value)}
        />
        <FormTextField
          label="Days of operation"
          value={form.days_of_operation || ''}
          placeholder="Tuesday - Saturday"
          onChangeText={(value) => updateField('days_of_operation', value)}
        />
      </View>

      {error && (
        <View style={styles.formError}>
          <Feather name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.formErrorText}>{error}</Text>
        </View>
      )}

      <View style={styles.editorActions}>
        <Pressable style={styles.cancelButton} onPress={onClose} disabled={saving}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="save" size={17} color="#FFFFFF" />}
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save vendor'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AnnouncementsPage({
  announcements, totalCount, loading, error, search, editorMode, form, saving,
  saveMessage, notificationAction, deliveryStats,
  editingAnnouncement, showTestAction, onSearchChange, onRefresh, onCreate, onEdit, onStatusChange,
  onDelete, onFormChange, onCloseEditor, onSave, onSendTest, onNotifyEveryone,
}: {
  announcements: Announcement[]; totalCount: number; loading: boolean; error: string | null;
  search: string; editorMode: AnnouncementEditorMode; form: AnnouncementPayload; saving: boolean;
  saveMessage: string | null; notificationAction: NotificationActionState;
  deliveryStats: Record<string, AnnouncementDeliveryStats>;
  editingAnnouncement: Announcement | null; showTestAction: boolean; onSearchChange: (value: string) => void;
  onRefresh: () => void; onCreate: () => void; onEdit: (item: Announcement) => void;
  onStatusChange: (item: Announcement, status: AnnouncementStatus) => void;
  onDelete: (item: Announcement) => void; onFormChange: (value: AnnouncementPayload) => void;
  onCloseEditor: () => void; onSave: (status: AnnouncementStatus) => void;
  onSendTest: () => void; onNotifyEveryone: () => void;
}) {
  const isMobile = useWindowDimensions().width < 600;
  const statusLabel = (status: AnnouncementStatus) => status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <ContentPage
      title="Announcements"
      subtitle={`${totalCount} announcement${totalCount === 1 ? '' : 's'} in this event`}
      primaryAction={{ label: 'Create announcement', icon: 'plus', onPress: onCreate }}
    >
      <ContentToolbar
        searchValue={search}
        searchPlaceholder="Search announcements by title, message, priority, or status"
        onSearchChange={onSearchChange}
        secondaryAction={{ label: 'Refresh', icon: 'refresh-cw', onPress: onRefresh, disabled: loading }}
      />
      {error && <ErrorState message={error} onRetry={onRefresh} />}
      {editorMode !== 'closed' && (
        <AnnouncementEditor
          mode={editorMode} form={form} saving={saving} editingAnnouncement={editingAnnouncement}
          saveMessage={saveMessage} notificationAction={notificationAction}
          showTestAction={showTestAction}
          onChange={onFormChange} onClose={onCloseEditor} onSave={onSave}
          onSendTest={onSendTest} onNotifyEveryone={onNotifyEveryone}
        />
      )}
      {loading ? <LoadingState label="Loading announcements..." /> : announcements.length === 0 ? (
        <EmptyState
          icon="message-square"
          title={search ? 'No announcements match your search' : 'No announcements yet'}
          message={search ? 'Clear the search or try different terms.' : 'Create the first announcement for this event.'}
          action={search ? undefined : { label: 'Create announcement', icon: 'plus', onPress: onCreate }}
        />
      ) : (
        <View style={styles.table}>
          {announcements.map((item) => (
            <View key={item.id} style={[styles.announcementRow, isMobile && styles.announcementRowMobile]}>
              <View style={styles.announcementBody}>
                <View style={styles.announcementHeading}>
                  <Text style={styles.vendorName}>{item.title}</Text>
                  <Text style={[styles.statusBadge, item.priority === 'Emergency' && styles.emergencyBadge]}>{item.priority}</Text>
                  <Text style={styles.statusBadge}>{statusLabel(item.status)}</Text>
                </View>
                <Text style={styles.tableText} numberOfLines={2}>{item.message}</Text>
                <Text style={styles.vendorMeta}>
                  {`Created by ${item.created_by} · ${new Date(item.created_at).toLocaleString()}`}
                  {item.expires_at ? ` · Expires ${new Date(item.expires_at).toLocaleString()}` : ''}
                </Text>
                {deliveryStats[item.id] ? <Text style={styles.deliveryMeta}>
                  {deliveryStats[item.id].sent_at
                    ? `Notification sent ${new Date(deliveryStats[item.id].sent_at as string).toLocaleString()}`
                    : `Notification ${deliveryStats[item.id].status}`}
                  {deliveryStats[item.id].audience_device_count === null
                    ? ' · Audience at send: Not available'
                    : ` · Known deliverable devices at send: ${deliveryStats[item.id].audience_device_count}`}
                  {deliveryStats[item.id].provider_accepted ? ' · Provider accepted: Yes' : ''}
                </Text> : null}
              </View>
              <View style={[styles.announcementActions, isMobile && styles.announcementActionsMobile]}>
                <Pressable style={styles.iconButton} onPress={() => onEdit(item)}><Feather name="edit-2" size={16} color={colors.textSecondary} /></Pressable>
                <Pressable style={styles.iconButton} onPress={() => onStatusChange(item, item.status === 'published' ? 'draft' : 'published')}>
                  <Feather name={item.status === 'published' ? 'pause' : 'play'} size={16} color={colors.textSecondary} />
                </Pressable>
                <Pressable style={styles.iconButton} onPress={() => onStatusChange(item, 'archived')}><Feather name="archive" size={16} color={colors.textSecondary} /></Pressable>
                <Pressable style={styles.iconButton} onPress={() => onDelete(item)}><Feather name="trash-2" size={16} color={colors.error} /></Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ContentPage>
  );
}

function AnnouncementEditor({
  mode, form, saving, saveMessage, notificationAction, editingAnnouncement, showTestAction,
  onChange, onClose, onSave, onSendTest, onNotifyEveryone,
}: {
  mode: Exclude<AnnouncementEditorMode, 'closed'>; form: AnnouncementPayload; saving: boolean;
  saveMessage: string | null; notificationAction: NotificationActionState;
  editingAnnouncement: Announcement | null; showTestAction: boolean; onChange: (value: AnnouncementPayload) => void;
  onClose: () => void; onSave: (status: AnnouncementStatus) => void;
  onSendTest: () => void; onNotifyEveryone: () => void;
}) {
  const [confirmEveryone, setConfirmEveryone] = useState(false);
  const isSending = notificationAction.status === 'sending';
  const isPublished = editingAnnouncement?.status === 'published';
  const isArchived = editingAnnouncement?.status === 'archived';
  const isDraft = editingAnnouncement?.status === 'draft';
  const isExpired = Boolean(
    editingAnnouncement?.expires_at
    && new Date(editingAnnouncement.expires_at).getTime() <= Date.now()
  );
  const hasUnsavedChanges = Boolean(editingAnnouncement && (
    form.title !== editingAnnouncement.title
    || form.message !== editingAnnouncement.message
    || form.priority !== editingAnnouncement.priority
    || (form.expires_at || null) !== (editingAnnouncement.expires_at || null)
  ));
  const notificationDisabled = saving || isSending || isExpired || hasUnsavedChanges;
  const everyoneSentThisSession = notificationAction.audience === 'everyone' && notificationAction.status === 'sent';
  const notificationTitle = shortenNotificationText(form.title, 100);
  const notificationMessage = shortenNotificationText(form.message, 255);

  useEffect(() => {
    if (
      confirmEveryone
      && notificationAction.audience === 'everyone'
      && (notificationAction.status === 'sent' || notificationAction.status === 'failed')
    ) {
      setConfirmEveryone(false);
    }
  }, [confirmEveryone, notificationAction.audience, notificationAction.status]);

  let safetyMessage: string | null = null;
  if (isArchived) safetyMessage = 'Archived announcements cannot be notified. Publish the announcement again before sending a notification.';
  else if (isDraft) safetyMessage = 'Draft announcements cannot be notified. Publish this announcement first.';
  else if (isExpired) safetyMessage = 'Expired announcements cannot be notified. Set a future expiry and save the announcement first.';
  else if (isPublished && hasUnsavedChanges) safetyMessage = 'Save your changes before sending a notification so the notification matches the published announcement.';

  return (
    <View style={styles.editorPanel}>
      <View style={styles.editorHeader}>
        <View><Text style={styles.editorTitle}>{mode === 'edit' ? 'Edit announcement' : 'Create announcement'}</Text>
          <Text style={styles.editorSubtitle}>{editingAnnouncement ? 'Changes appear in the attendee app immediately when published.' : 'Published announcements appear in the attendee app immediately.'}</Text></View>
        <Pressable style={[styles.iconButton, (saving || isSending) && styles.buttonDisabled]} onPress={onClose} disabled={saving || isSending}><Feather name="x" size={18} color={colors.textSecondary} /></Pressable>
      </View>
      <View style={styles.formGrid}>
        <FormTextField label="Title" value={form.title} required placeholder="Announcement title" onChangeText={(title) => onChange({ ...form, title })} />
        <FormTextField label="Expiry date/time (optional)" value={form.expires_at || ''} placeholder="2026-07-20T17:00:00Z" onChangeText={(expires_at) => onChange({ ...form, expires_at: expires_at || null })} />
        <View style={styles.formField}><FieldLabel label="Priority" required /><View style={styles.choiceRow}>
          {(['Information', 'Important', 'Emergency'] as const).map((priority) => <Pressable key={priority} style={[styles.filterPill, form.priority === priority && styles.filterPillActive]} onPress={() => onChange({ ...form, priority })}><Text style={[styles.filterPillText, form.priority === priority && styles.filterPillTextActive]}>{priority}</Text></Pressable>)}
        </View></View>
        <FormTextField label="Message" value={form.message} required multiline placeholder="Message shown to attendees" onChangeText={(message) => onChange({ ...form, message })} />
      </View>

      {saveMessage && <View style={styles.successNotice}><Feather name="check-circle" size={16} color={colors.success} /><Text style={styles.successNoticeText}>{saveMessage}</Text></View>}
      {safetyMessage && <View style={styles.safetyNotice}><Feather name="info" size={16} color={colors.textSecondary} /><Text style={styles.safetyNoticeText}>{safetyMessage}</Text></View>}
      {notificationAction.message && (
        <View style={notificationAction.status === 'failed' ? styles.failureNotice : styles.successNotice}>
          <Feather name={notificationAction.status === 'failed' ? 'alert-circle' : 'check-circle'} size={16} color={notificationAction.status === 'failed' ? colors.error : colors.success} />
          <Text style={notificationAction.status === 'failed' ? styles.failureNoticeText : styles.successNoticeText}>
            {notificationAction.status === 'failed' ? 'Failed: ' : 'Sent: '}{notificationAction.message}
          </Text>
        </View>
      )}

      <View style={styles.editorActions}>
        <Pressable style={[styles.cancelButton, (saving || isSending) && styles.buttonDisabled]} onPress={onClose} disabled={saving || isSending}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>

        {(!editingAnnouncement || isDraft) && <>
          <Pressable style={[styles.secondaryButton, (saving || isSending) && styles.buttonDisabled]} onPress={() => onSave('draft')} disabled={saving || isSending}>
            <Feather name="save" size={17} color={colors.textPrimary} /><Text style={styles.secondaryButtonText}>{saving ? 'Saving...' : 'Save Draft'}</Text>
          </Pressable>
          <Pressable style={[styles.saveButton, (saving || isSending) && styles.buttonDisabled]} onPress={() => onSave('published')} disabled={saving || isSending}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="upload" size={17} color="#FFFFFF" />}<Text style={styles.saveButtonText}>{saving ? 'Publishing...' : 'Publish'}</Text>
          </Pressable>
        </>}

        {editingAnnouncement && !isDraft && <Pressable style={[styles.secondaryButton, (saving || isSending) && styles.buttonDisabled]} onPress={() => onSave(editingAnnouncement.status)} disabled={saving || isSending}>
          <Feather name="save" size={17} color={colors.textPrimary} /><Text style={styles.secondaryButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </Pressable>}

        {isPublished && <>
          {showTestAction && <Pressable style={[styles.secondaryButton, notificationDisabled && styles.buttonDisabled]} onPress={onSendTest} disabled={notificationDisabled}>
            {isSending && notificationAction.audience === 'test' ? <ActivityIndicator color={colors.textPrimary} /> : <Feather name="send" size={17} color={colors.textPrimary} />}
            <Text style={styles.secondaryButtonText}>{isSending && notificationAction.audience === 'test' ? 'Sending...' : notificationAction.status === 'sent' && notificationAction.audience === 'test' ? 'Sent' : notificationAction.status === 'failed' && notificationAction.audience === 'test' ? 'Failed — Try Again' : 'Send Test Notification'}</Text>
          </Pressable>}
          <Pressable style={[styles.dangerButton, (notificationDisabled || everyoneSentThisSession) && styles.buttonDisabled]} onPress={() => setConfirmEveryone(true)} disabled={notificationDisabled || everyoneSentThisSession}>
            {isSending && notificationAction.audience === 'everyone' ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="bell" size={17} color="#FFFFFF" />}
            <Text style={styles.saveButtonText}>{isSending && notificationAction.audience === 'everyone' ? 'Sending...' : notificationAction.status === 'sent' && notificationAction.audience === 'everyone' ? 'Sent' : notificationAction.status === 'failed' && notificationAction.audience === 'everyone' ? 'Failed — Try Again' : 'Notify Everyone'}</Text>
          </Pressable>
        </>}
      </View>

      <Modal visible={confirmEveryone} transparent animationType="fade" onRequestClose={() => { if (!isSending) setConfirmEveryone(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmDialog} accessibilityRole="alert">
            <View style={styles.confirmHeader}><View><Text style={styles.confirmTitle}>Notify everyone?</Text><Text style={styles.confirmSubtitle}>This action sends a notification immediately.</Text></View><Pressable style={styles.iconButton} onPress={() => setConfirmEveryone(false)} disabled={isSending}><Feather name="x" size={18} color={colors.textSecondary} /></Pressable></View>
            <View style={styles.confirmDetails}>
              <ConfirmationRow label="Announcement title" value={form.title} />
              <ConfirmationRow label="Notification title" value={notificationTitle} />
              <ConfirmationRow label="Notification preview" value={notificationMessage} />
              <ConfirmationRow label="Audience" value="Everyone subscribed to this event" />
              <ConfirmationRow label="Target" value="Opens this announcement when tapped" />
            </View>
            <View style={styles.editorActions}>
              <Pressable style={[styles.cancelButton, isSending && styles.buttonDisabled]} onPress={() => setConfirmEveryone(false)} disabled={isSending}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>
              <Pressable style={[styles.dangerButton, isSending && styles.buttonDisabled]} disabled={isSending} onPress={() => { onNotifyEveryone(); }}>
                {isSending ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="bell" size={17} color="#FFFFFF" />}<Text style={styles.saveButtonText}>{isSending ? 'Sending...' : 'Confirm & Notify Everyone'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ConfirmationRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.confirmRow}><Text style={styles.confirmLabel}>{label}</Text><Text style={styles.confirmValue}>{value}</Text></View>;
}

function FormTextField({
  label,
  value,
  placeholder,
  required,
  keyboardType,
  editable = true,
  multiline,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  keyboardType?: 'default' | 'numeric';
  editable?: boolean;
  multiline?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.formField}>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        editable={editable}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
        style={[styles.input, multiline && styles.textArea, !editable && styles.inputReadOnly]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 210,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHighlight,
    marginBottom: 14,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 5,
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  table: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tableRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tableHeader: {
    minHeight: 44,
    backgroundColor: colors.surfaceElevated,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  tableText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  nameColumn: {
    flex: 2,
    minWidth: 160,
  },
  typeColumn: {
    flex: 1,
    minWidth: 110,
  },
  locationColumn: {
    flex: 1.2,
    minWidth: 130,
  },
  priorityColumn: {
    width: 76,
  },
  actionsColumn: {
    width: 92,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  scheduleNameColumn: {
    flex: 2,
    minWidth: 190,
  },
  scheduleTimeColumn: {
    flex: 1,
    minWidth: 130,
  },
  scheduleLocationColumn: {
    flex: 1.2,
    minWidth: 150,
  },
  scheduleActionsColumn: {
    width: 140,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  announcementRow: {
    minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  announcementBody: { flex: 1, gap: 5 },
  announcementHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  announcementActions: { flexDirection: 'row', gap: 8 },
  statusBadge: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.surfaceHighlight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, textTransform: 'capitalize' },
  emergencyBadge: { color: colors.error },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vendorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  vendorMeta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textMuted,
  },
  deliveryMeta: { fontSize: 12, lineHeight: 18, color: colors.textSecondary, fontWeight: '600' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editorPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 16,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  editorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editorSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  formField: {
    flex: 1,
    minWidth: 230,
  },
  input: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: 14,
    outlineStyle: 'none' as never,
  },
  inputReadOnly: {
    opacity: 0.7,
  },
  textArea: {
    minHeight: 126,
    paddingTop: 12,
  },
  scheduleToolbarExtras: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  scheduleToolbarExtrasMobile: { flexDirection: 'column', alignItems: 'stretch' },
  dayFilterScrollMobile: { width: '100%' },
  dayFilterList: {
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  filterPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  importButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
  },
  importButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  importButtonMobile: { width: '100%', minHeight: 44 },
  mobileCardList: { gap: 10 },
  mobileDataCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
  },
  mobileCardDetail: { fontSize: 14, color: colors.textSecondary },
  mobileCardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  announcementRowMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  announcementActionsMobile: { justifyContent: 'flex-end', flexWrap: 'wrap' },
  mappingGrid: {
    gap: 12,
  },
  mappingRow: {
    gap: 8,
  },
  mappingOptions: {
    gap: 8,
  },
  importSummary: {
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    padding: 12,
    gap: 6,
  },
  importSuccess: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  importWarning: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  problemText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  formError: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8F8',
  },
  formErrorText: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  cancelButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700' },
  dangerButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.error,
  },
  successNotice: { borderRadius: 8, borderWidth: 1, borderColor: colors.success, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F2FBF5' },
  successNoticeText: { color: colors.success, fontSize: 13, flex: 1 },
  failureNotice: { borderRadius: 8, borderWidth: 1, borderColor: colors.error, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF8F8' },
  failureNoticeText: { color: colors.error, fontSize: 13, flex: 1 },
  safetyNotice: { borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceHighlight },
  safetyNoticeText: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 20 },
  confirmDialog: { width: '100%', maxWidth: 620, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 20, gap: 18 },
  confirmHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  confirmTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  confirmSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  confirmDetails: { borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  confirmRow: { padding: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  confirmLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  confirmValue: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
