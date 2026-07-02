// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useCallback, useEffect, useState } from 'react';
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
  Broadcast,
  BroadcastPriority,
  createBroadcast,
  createOrganizerUser,
  getCurrentOrganizer,
  listBroadcasts,
  listOrganizerUsers,
  logoutOrganizer,
  OrganizerRole,
  OrganizerUser,
} from '../../src/services/adminAuthService';

const NAV_ITEMS = ['Dashboard', 'Communications', 'Schedule', 'Users', 'Settings'] as const;
const ROLES: OrganizerRole[] = ['Owner', 'Communications', 'Schedule'];
const BROADCAST_PRIORITIES: BroadcastPriority[] = ['Normal', 'Important', 'Emergency'];

type AdminSection = (typeof NAV_ITEMS)[number];

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
  }, [activeSection, isAuthenticated, loadBroadcasts, loadUsers]);

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
        {activeSection === 'Schedule' && <PlaceholderPanel title="Schedule" />}
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

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelText}>This area is protected and ready for the next milestone.</Text>
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
