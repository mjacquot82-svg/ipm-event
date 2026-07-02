// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
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
import {
  AdminScheduleEvent,
  Broadcast,
  BroadcastPriority,
  createBroadcast,
  createOrganizerUser,
  createScheduleEvent,
  deleteScheduleEvent,
  getCurrentOrganizer,
  importSchedule,
  listScheduleEvents,
  listBroadcasts,
  listOrganizerUsers,
  logoutOrganizer,
  OrganizerRole,
  OrganizerUser,
  ScheduleEventPayload,
  ScheduleImportProblem,
  ScheduleImportRow,
  updateScheduleEvent,
} from '../../src/services/adminAuthService';

const NAV_ITEMS = ['Dashboard', 'Communications', 'Schedule', 'Users', 'Settings'] as const;
const ROLES: OrganizerRole[] = ['Owner', 'Communications', 'Schedule'];
const BROADCAST_PRIORITIES: BroadcastPriority[] = ['Normal', 'Important', 'Emergency'];
const SCHEDULE_MAPPING_STORAGE_KEY = 'organizer_schedule_import_mapping_v1';
const PLATFORM_FIELDS = [
  { key: 'title', label: 'Event Title', required: true },
  { key: 'start_date', label: 'Date', required: true },
  { key: 'start_time', label: 'Start Time', required: true },
  { key: 'end_time', label: 'End Time', required: true },
  { key: 'location_name', label: 'Location', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'days_active', label: 'Days Active', required: false },
  { key: 'description', label: 'Description', required: false },
] as const;

type AdminSection = (typeof NAV_ITEMS)[number];
type PlatformFieldKey = (typeof PLATFORM_FIELDS)[number]['key'];
type ImportMapping = Partial<Record<PlatformFieldKey, string>>;

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 820;
  const [loadingSession, setLoadingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<OrganizerUser | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('Dashboard');
  const [users, setUsers] = useState<OrganizerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<OrganizerRole>('Schedule');
  const [createUserBusy, setCreateUserBusy] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [broadcastsLoading, setBroadcastsLoading] = useState(false);
  const [broadcastsError, setBroadcastsError] = useState<string | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<BroadcastPriority>('Normal');
  const [sendBroadcastBusy, setSendBroadcastBusy] = useState(false);
  const [scheduleEvents, setScheduleEvents] = useState<AdminScheduleEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleDayFilter, setScheduleDayFilter] = useState('All');
  const [scheduleFormEvent, setScheduleFormEvent] = useState<AdminScheduleEvent | null>(null);
  const [scheduleFormMode, setScheduleFormMode] = useState<'closed' | 'view' | 'add' | 'edit'>('closed');
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

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const result = await listOrganizerUsers();
      setUsers(result.users);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Unable to load organizer users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadBroadcasts = useCallback(async () => {
    setBroadcastsLoading(true);
    setBroadcastsError(null);
    try {
      const result = await listBroadcasts();
      setBroadcasts(result.broadcasts);
    } catch (err) {
      setBroadcastsError(err instanceof Error ? err.message : 'Unable to load broadcast history');
    } finally {
      setBroadcastsLoading(false);
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
    if (isAuthenticated && activeSection === 'Users') {
      loadUsers();
    }
    if (isAuthenticated && activeSection === 'Communications') {
      loadBroadcasts();
    }
    if (isAuthenticated && activeSection === 'Schedule') {
      loadSchedule();
    }
  }, [activeSection, isAuthenticated, loadBroadcasts, loadSchedule, loadUsers]);

  useEffect(() => {
    AsyncStorage.getItem(SCHEDULE_MAPPING_STORAGE_KEY)
      .then((value) => {
        if (value) {
          setImportMapping(JSON.parse(value) as ImportMapping);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutOrganizer();
    } finally {
      router.replace('/admin/login');
    }
  };

  const handleCreateUser = async () => {
    if (createUserBusy) {
      return;
    }

    setCreateUserBusy(true);
    setUsersError(null);
    try {
      const user = await createOrganizerUser({
        username: newUsername,
        password: newPassword,
        display_name: newDisplayName,
        role: newRole,
      });
      setUsers((current) => [...current, user]);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewRole('Schedule');
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Unable to create organizer user');
    } finally {
      setCreateUserBusy(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (sendBroadcastBusy) {
      return;
    }

    setSendBroadcastBusy(true);
    setBroadcastsError(null);
    try {
      const broadcast = await createBroadcast({
        title: broadcastTitle,
        message: broadcastMessage,
        priority: broadcastPriority,
      });
      setBroadcasts((current) => [broadcast, ...current]);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastPriority('Normal');
    } catch (err) {
      setBroadcastsError(err instanceof Error ? err.message : 'Unable to send broadcast');
    } finally {
      setSendBroadcastBusy(false);
    }
  };

  const openScheduleForm = (mode: 'view' | 'add' | 'edit', event?: AdminScheduleEvent) => {
    setScheduleFormMode(mode);
    setScheduleFormEvent(event || null);
    setScheduleForm(event ? scheduleEventToPayload(event) : createEmptySchedulePayload());
    setScheduleError(null);
  };

  const handleSaveScheduleEvent = async () => {
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
      setScheduleFormMode('closed');
      setScheduleFormEvent(null);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Unable to save schedule event');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDeleteScheduleEvent = async (event: AdminScheduleEvent) => {
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

  const handlePrepareImport = async () => {
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

  const handleRunImport = async () => {
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
      setImportResult(`✓ ${result.imported_count} events imported`);
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
    <View style={[styles.root, isCompact && styles.rootCompact]}>
      <View style={[styles.sidebar, isCompact && styles.sidebarCompact]}>
        <View style={styles.sidebarHeader}>
          <View style={styles.brandMark}>
            <Feather name="shield" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.sidebarTitleBlock}>
            <Text style={styles.sidebarTitle}>Organizer</Text>
            <Text style={styles.sidebarSubtitle}>{currentUser?.event_id}</Text>
          </View>
        </View>

        <View style={[styles.navList, isCompact && styles.navListCompact]}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item;
            return (
              <Pressable
                key={item}
                style={[styles.navButton, isActive && styles.navButtonActive]}
                onPress={() => setActiveSection(item)}
              >
                <Feather
                  name={getSectionIcon(item)}
                  size={18}
                  color={isActive ? '#FFFFFF' : colors.textSecondary}
                />
                <Text style={[styles.navButtonText, isActive && styles.navButtonTextActive]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[styles.logoutButton, isCompact && styles.logoutButtonCompact]} onPress={handleLogout}>
          <Feather name="log-out" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.pageTitle}>{activeSection}</Text>
            <Text style={styles.pageSubtitle}>
              Signed in as {currentUser?.display_name} ({currentUser?.role})
            </Text>
          </View>
        </View>

        {activeSection === 'Dashboard' && <DashboardOverview currentUser={currentUser} />}
        {activeSection === 'Communications' && (
          <CommunicationsPanel
            broadcasts={broadcasts}
            loading={broadcastsLoading}
            error={broadcastsError}
            title={broadcastTitle}
            message={broadcastMessage}
            priority={broadcastPriority}
            canSend={currentUser?.role === 'Owner' || currentUser?.role === 'Communications'}
            sendBusy={sendBroadcastBusy}
            onRefresh={loadBroadcasts}
            onTitleChange={setBroadcastTitle}
            onMessageChange={setBroadcastMessage}
            onPriorityChange={setBroadcastPriority}
            onSend={handleSendBroadcast}
          />
        )}
        {activeSection === 'Schedule' && (
          <ScheduleManagementPanel
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
            onCloseForm={() => setScheduleFormMode('closed')}
            onFormChange={setScheduleForm}
            onSave={handleSaveScheduleEvent}
            onDelete={handleDeleteScheduleEvent}
            onImportOpenChange={setImportOpen}
            onImportTextChange={setImportText}
            onImportMappingChange={(mapping) => {
              setImportMapping(mapping);
              const prepared = prepareScheduleImport(importRows, mapping);
              setImportPreparedRows(prepared.rows);
              setImportProblems(prepared.problems);
            }}
            onPrepareImport={handlePrepareImport}
            onRunImport={handleRunImport}
          />
        )}
        {activeSection === 'Settings' && <SettingsPanel currentUser={currentUser} />}
        {activeSection === 'Users' && (
          <UsersPanel
            users={users}
            loading={usersLoading}
            error={usersError}
            newUsername={newUsername}
            newDisplayName={newDisplayName}
            newPassword={newPassword}
            newRole={newRole}
            createUserBusy={createUserBusy}
            onRefresh={loadUsers}
            onUsernameChange={setNewUsername}
            onDisplayNameChange={setNewDisplayName}
            onPasswordChange={setNewPassword}
            onRoleChange={setNewRole}
            onCreateUser={handleCreateUser}
          />
        )}
      </ScrollView>
    </View>
  );
}

function getSectionIcon(section: AdminSection): keyof typeof Feather.glyphMap {
  switch (section) {
    case 'Dashboard':
      return 'grid';
    case 'Communications':
      return 'message-square';
    case 'Schedule':
      return 'calendar';
    case 'Users':
      return 'users';
    case 'Settings':
      return 'settings';
  }
}

function formatAdminDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DashboardOverview({ currentUser }: { currentUser: OrganizerUser | null }) {
  return (
    <View style={styles.sectionGrid}>
      <InfoPanel label="Event" value={currentUser?.event_id || 'ipm-2026'} icon="map-pin" />
      <InfoPanel label="Role" value={currentUser?.role || 'Organizer'} icon="shield" />
      <InfoPanel label="Session" value="Authenticated" icon="check-circle" />
    </View>
  );
}

function InfoPanel({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  return (
    <View style={styles.infoPanel}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
      if (field.key === 'title') return ['name', 'eventname', 'eventtitle', 'title'].includes(value);
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
    if (!payload.end_time.trim()) errors.push('End Time is required');

    if (errors.length) {
      problems.push({ row_number: index + 2, errors, values: row });
      return;
    }

    preparedRows.push({ row_number: index + 2, data: payload });
  });

  return { rows: preparedRows, problems };
}

function ScheduleManagementPanel({
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
  formMode: 'closed' | 'view' | 'add' | 'edit';
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
  onOpenForm: (mode: 'view' | 'add' | 'edit', event?: AdminScheduleEvent) => void;
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
  const isReadOnly = formMode === 'view';

  return (
    <View style={styles.scheduleLayout}>
      <View style={styles.scheduleToolbar}>
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.scheduleSearchInput]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayFilterList}>
          {days.map((day) => (
            <Pressable
              key={day}
              style={[styles.dayFilterButton, dayFilter === day && styles.dayFilterButtonActive]}
              onPress={() => onDayFilterChange(day)}
            >
              <Text style={[styles.dayFilterText, dayFilter === day && styles.dayFilterTextActive]}>{day}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={styles.secondaryButton} onPress={() => onOpenForm('add')}>
          <Feather name="plus" size={17} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Add Event</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonSmall} onPress={() => onImportOpenChange(!importOpen)}>
          <Feather name="upload" size={17} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Import Schedule</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {importOpen && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Import Schedule</Text>
          <TextInput
            value={importText}
            onChangeText={onImportTextChange}
            placeholder="Paste rows from Excel, Google Sheets, or CSV"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.importTextArea]}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton} onPress={onPrepareImport}>
              <Feather name="columns" size={17} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Map Columns</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButtonSmall, importBusy && styles.primaryButtonDisabled]}
              onPress={onRunImport}
              disabled={importBusy || importPreparedRows.length === 0}
            >
              {importBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={17} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Import</Text>
                </>
              )}
            </Pressable>
          </View>

          {importHeaders.length > 0 && (
            <View style={styles.mappingGrid}>
              {PLATFORM_FIELDS.map((field) => (
                <View key={field.key} style={styles.mappingRow}>
                  <Text style={styles.mappingLabel}>
                    {field.label}{field.required ? ' *' : ''}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mappingOptions}>
                    <Pressable
                      style={[styles.mappingOption, !importMapping[field.key] && styles.mappingOptionActive]}
                      onPress={() => onImportMappingChange({ ...importMapping, [field.key]: undefined })}
                    >
                      <Text style={[styles.mappingOptionText, !importMapping[field.key] && styles.mappingOptionTextActive]}>
                        None
                      </Text>
                    </Pressable>
                    {importHeaders.map((header) => (
                      <Pressable
                        key={header}
                        style={[styles.mappingOption, importMapping[field.key] === header && styles.mappingOptionActive]}
                        onPress={() => onImportMappingChange({ ...importMapping, [field.key]: header })}
                      >
                        <Text style={[styles.mappingOptionText, importMapping[field.key] === header && styles.mappingOptionTextActive]}>
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
                <Text style={styles.importSuccess}>✓ {importPreparedRows.length} events ready</Text>
              )}
              {importProblems.length > 0 && (
                <Text style={styles.importWarning}>⚠ {importProblems.length} rows require attention</Text>
              )}
              {importProblems.slice(0, 5).map((problem) => (
                <Text key={problem.row_number} style={styles.problemText}>
                  Row {problem.row_number}: {problem.errors.join(', ')}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {formMode !== 'closed' && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>
              {formMode === 'add' ? 'Add Event' : formMode === 'edit' ? 'Edit Event' : 'Event Details'}
            </Text>
            <Pressable style={styles.iconButton} onPress={onCloseForm}>
              <Feather name="x" size={18} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.formGrid}>
            <TextInput value={form.title} onChangeText={(title) => onFormChange({ ...form, title })} placeholder="Event title" placeholderTextColor={colors.textMuted} style={styles.input} editable={!isReadOnly} />
            <TextInput value={form.start_date} onChangeText={(start_date) => onFormChange({ ...form, start_date })} placeholder="Date" placeholderTextColor={colors.textMuted} style={styles.input} editable={!isReadOnly} />
            <TextInput value={form.start_time} onChangeText={(start_time) => onFormChange({ ...form, start_time })} placeholder="Start time" placeholderTextColor={colors.textMuted} style={styles.input} editable={!isReadOnly} />
            <TextInput value={form.end_time} onChangeText={(end_time) => onFormChange({ ...form, end_time })} placeholder="End time" placeholderTextColor={colors.textMuted} style={styles.input} editable={!isReadOnly} />
            <TextInput value={form.location_name || ''} onChangeText={(location_name) => onFormChange({ ...form, location_name })} placeholder="Location" placeholderTextColor={colors.textMuted} style={styles.input} editable={!isReadOnly} />
            <TextInput value={form.category || ''} onChangeText={(category) => onFormChange({ ...form, category })} placeholder="Category" placeholderTextColor={colors.textMuted} style={styles.input} editable={!isReadOnly} />
            <TextInput value={form.days_active || ''} onChangeText={(days_active) => onFormChange({ ...form, days_active })} placeholder="Day" placeholderTextColor={colors.textMuted} style={styles.input} editable={!isReadOnly} />
            <TextInput value={form.description || ''} onChangeText={(description) => onFormChange({ ...form, description })} placeholder="Description" placeholderTextColor={colors.textMuted} style={[styles.input, styles.messageInput]} multiline editable={!isReadOnly} />
          </View>
          {formEvent && <Text style={styles.panelText}>Row {formEvent.row_number}</Text>}
          {formMode !== 'view' && (
            <Pressable style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} onPress={onSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Save Event</Text>}
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Event List</Text>
          <Pressable style={styles.iconButton} onPress={onRefresh}>
            <Feather name="refresh-cw" size={18} color={colors.primary} />
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.scheduleList}>
            {visibleEvents.map((event) => (
              <View key={event.id} style={styles.scheduleRow}>
                <View style={styles.scheduleTitleCell}>
                  <Text style={styles.scheduleEventTitle}>{event.title}</Text>
                  <Text style={styles.scheduleMeta}>{event.start_date}</Text>
                </View>
                <Text style={styles.scheduleCell}>{event.start_time}</Text>
                <Text style={styles.scheduleCell}>{event.location_name || 'No location'}</Text>
                <View style={styles.scheduleActions}>
                  <Pressable style={styles.textAction} onPress={() => onOpenForm('view', event)}>
                    <Text style={styles.textActionLabel}>View</Text>
                  </Pressable>
                  <Pressable style={styles.textAction} onPress={() => onOpenForm('edit', event)}>
                    <Text style={styles.textActionLabel}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.textAction} onPress={() => onDelete(event)}>
                    <Text style={[styles.textActionLabel, styles.deleteActionLabel]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {visibleEvents.length === 0 && <Text style={styles.panelText}>No events found.</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

function CommunicationsPanel({
  broadcasts,
  loading,
  error,
  title,
  message,
  priority,
  canSend,
  sendBusy,
  onRefresh,
  onTitleChange,
  onMessageChange,
  onPriorityChange,
  onSend,
}: {
  broadcasts: Broadcast[];
  loading: boolean;
  error: string | null;
  title: string;
  message: string;
  priority: BroadcastPriority;
  canSend: boolean;
  sendBusy: boolean;
  onRefresh: () => void;
  onTitleChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onPriorityChange: (value: BroadcastPriority) => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.communicationsLayout}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>New Broadcast</Text>
        <Text style={styles.panelText}>Audience: Everyone</Text>

        {!canSend && (
          <View style={styles.readOnlyNotice}>
            <Feather name="lock" size={16} color={colors.warning} />
            <Text style={styles.readOnlyNoticeText}>
              Schedule role has read-only access to Communications.
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <TextInput
            value={title}
            onChangeText={onTitleChange}
            placeholder="Title"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={canSend}
          />
          <TextInput
            value={message}
            onChangeText={onMessageChange}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.messageInput]}
            editable={canSend}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.prioritySelector}>
            {BROADCAST_PRIORITIES.map((option) => {
              const isSelected = option === priority;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.priorityOption,
                    isSelected && styles.priorityOptionSelected,
                    !canSend && styles.optionDisabled,
                  ]}
                  onPress={() => onPriorityChange(option)}
                  disabled={!canSend}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      isSelected && styles.priorityOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Preview</Text>
            <View style={styles.previewHeader}>
              <Text style={styles.previewPriority}>{priority}</Text>
              <Text style={styles.previewAudience}>Everyone</Text>
            </View>
            <Text style={styles.previewTitle}>{title || 'Broadcast title'}</Text>
            <Text style={styles.previewMessage}>{message || 'Broadcast message will appear here.'}</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[
              styles.primaryButton,
              (!canSend || sendBusy) && styles.primaryButtonDisabled,
            ]}
            onPress={onSend}
            disabled={!canSend || sendBusy}
          >
            {sendBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Send</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <View style={[styles.panel, styles.historyPanel]}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Broadcast History</Text>
          <Pressable style={styles.iconButton} onPress={onRefresh}>
            <Feather name="refresh-cw" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.broadcastList}>
            {broadcasts.map((broadcast) => (
              <View key={broadcast.id} style={styles.broadcastRow}>
                <View style={styles.broadcastTitleCell}>
                  <Text style={styles.broadcastTitle}>{broadcast.title}</Text>
                  <Text style={styles.broadcastMeta}>{formatAdminDateTime(broadcast.sent_at)}</Text>
                </View>
                <Text style={styles.broadcastPriorityCell}>{broadcast.priority}</Text>
                <Text style={styles.broadcastCell}>{broadcast.audience}</Text>
                <Text style={styles.broadcastCell}>
                  {broadcast.sender_username} ({broadcast.sender_role})
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{broadcast.status}</Text>
                </View>
              </View>
            ))}
            {broadcasts.length === 0 && <Text style={styles.panelText}>No broadcasts have been sent yet.</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

function SettingsPanel({ currentUser }: { currentUser: OrganizerUser | null }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Portal Settings</Text>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Event ID</Text>
        <Text style={styles.settingValue}>{currentUser?.event_id}</Text>
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Account</Text>
        <Text style={styles.settingValue}>{currentUser?.username}</Text>
      </View>
    </View>
  );
}

function UsersPanel({
  users,
  loading,
  error,
  newUsername,
  newDisplayName,
  newPassword,
  newRole,
  createUserBusy,
  onRefresh,
  onUsernameChange,
  onDisplayNameChange,
  onPasswordChange,
  onRoleChange,
  onCreateUser,
}: {
  users: OrganizerUser[];
  loading: boolean;
  error: string | null;
  newUsername: string;
  newDisplayName: string;
  newPassword: string;
  newRole: OrganizerRole;
  createUserBusy: boolean;
  onRefresh: () => void;
  onUsernameChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (value: OrganizerRole) => void;
  onCreateUser: () => void;
}) {
  return (
    <View style={styles.usersLayout}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Organizer Users</Text>
          <Pressable style={styles.iconButton} onPress={onRefresh}>
            <Feather name="refresh-cw" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.userList}>
            {users.map((user) => (
              <View key={user.id} style={styles.userRow}>
                <View>
                  <Text style={styles.userName}>{user.display_name}</Text>
                  <Text style={styles.userMeta}>{user.username}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{user.role}</Text>
                </View>
              </View>
            ))}
            {users.length === 0 && <Text style={styles.panelText}>No organizer users found.</Text>}
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Add User</Text>
        <View style={styles.form}>
          <TextInput
            value={newDisplayName}
            onChangeText={onDisplayNameChange}
            placeholder="Display name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <TextInput
            value={newUsername}
            onChangeText={onUsernameChange}
            placeholder="Username"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            value={newPassword}
            onChangeText={onPasswordChange}
            placeholder="Temporary password"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            secureTextEntry
          />
          <View style={styles.roleSelector}>
            {ROLES.map((role) => {
              const isSelected = role === newRole;
              return (
                <Pressable
                  key={role}
                  style={[styles.roleOption, isSelected && styles.roleOptionSelected]}
                  onPress={() => onRoleChange(role)}
                >
                  <Text style={[styles.roleOptionText, isSelected && styles.roleOptionTextSelected]}>
                    {role}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.primaryButton, createUserBusy && styles.primaryButtonDisabled]}
            onPress={onCreateUser}
            disabled={createUserBusy}
          >
            {createUserBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="user-plus" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Create User</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  rootCompact: {
    flexDirection: 'column',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  sidebar: {
    width: 280,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: 18,
  },
  sidebarCompact: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 12,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarTitleBlock: {
    flex: 1,
  },
  sidebarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sidebarSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  navList: {
    gap: 8,
    flex: 1,
  },
  navListCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  navButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navButtonActive: {
    backgroundColor: colors.primary,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  navButtonTextActive: {
    color: '#FFFFFF',
  },
  logoutButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceHighlight,
  },
  logoutButtonCompact: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  logoutText: {
    color: colors.error,
    fontWeight: '800',
  },
  main: {
    flex: 1,
  },
  mainContent: {
    padding: 24,
    gap: 18,
  },
  topBar: {
    minHeight: 58,
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  infoPanel: {
    width: 220,
    minHeight: 132,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHighlight,
    marginBottom: 12,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoValue: {
    marginTop: 6,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  panelText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  communicationsLayout: {
    gap: 16,
  },
  scheduleLayout: {
    gap: 16,
  },
  scheduleToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  scheduleSearchInput: {
    minWidth: 220,
    flex: 1,
  },
  dayFilterList: {
    gap: 8,
    alignItems: 'center',
  },
  dayFilterButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  dayFilterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayFilterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  dayFilterTextActive: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    minHeight: 42,
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
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButtonSmall: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  importTextArea: {
    minHeight: 150,
    marginTop: 14,
    paddingTop: 12,
  },
  mappingGrid: {
    marginTop: 14,
    gap: 10,
  },
  mappingRow: {
    gap: 6,
  },
  mappingLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  mappingOptions: {
    gap: 8,
  },
  mappingOption: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  mappingOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  mappingOptionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  mappingOptionTextActive: {
    color: '#FFFFFF',
  },
  importSummary: {
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    padding: 12,
    gap: 6,
  },
  importSuccess: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '800',
  },
  importWarning: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '800',
  },
  problemText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  formGrid: {
    gap: 10,
    marginBottom: 12,
  },
  scheduleList: {
    gap: 10,
  },
  scheduleRow: {
    minHeight: 66,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  scheduleTitleCell: {
    flex: 2,
    minWidth: 220,
  },
  scheduleEventTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  scheduleMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },
  scheduleCell: {
    minWidth: 110,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  scheduleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  textAction: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHighlight,
  },
  textActionLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  deleteActionLabel: {
    color: colors.error,
  },
  readOnlyNotice: {
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readOnlyNoticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  messageInput: {
    minHeight: 118,
    paddingTop: 12,
  },
  prioritySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityOption: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  priorityOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionDisabled: {
    opacity: 0.65,
  },
  priorityOptionText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  priorityOptionTextSelected: {
    color: '#FFFFFF',
  },
  previewBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    gap: 8,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  previewHeader: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  previewPriority: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHighlight,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewAudience: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHighlight,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  previewMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  historyPanel: {
    minHeight: 240,
  },
  broadcastList: {
    gap: 10,
  },
  broadcastRow: {
    minHeight: 64,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  broadcastTitleCell: {
    flex: 2,
    minWidth: 180,
  },
  broadcastTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  broadcastMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
  },
  broadcastPriorityCell: {
    width: 92,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  broadcastCell: {
    minWidth: 120,
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  settingRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  settingValue: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  usersLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  userList: {
    minWidth: 340,
    gap: 10,
    marginTop: 4,
  },
  userRow: {
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  userMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 13,
  },
  roleBadge: {
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHighlight,
  },
  form: {
    minWidth: 320,
    gap: 12,
    marginTop: 14,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    fontSize: 15,
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  roleOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleOptionText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  roleOptionTextSelected: {
    color: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
