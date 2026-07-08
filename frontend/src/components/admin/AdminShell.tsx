// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { OrganizerUser } from '../../services/adminAuthService';

export type AdminNavItem = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  disabled?: boolean;
};

type AdminShellProps = {
  activeKey: string;
  navItems: AdminNavItem[];
  currentUser: OrganizerUser | null;
  children: React.ReactNode;
  onNavigate: (key: string) => void;
  onLogout: () => void;
};

export function AdminShell({
  activeKey,
  navItems,
  currentUser,
  children,
  onNavigate,
  onLogout,
}: AdminShellProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 860;

  return (
    <View style={[styles.root, isCompact && styles.rootCompact]}>
      <View style={[styles.sidebar, isCompact && styles.sidebarCompact]}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Feather name="layers" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>JDS Events</Text>
            <Text style={styles.brandSubtitle} numberOfLines={1}>
              {currentUser?.event_id || 'Event Platform'}
            </Text>
          </View>
        </View>

        <View style={[styles.navList, isCompact && styles.navListCompact]}>
          {navItems.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <Pressable
                key={item.key}
                disabled={item.disabled}
                style={[
                  styles.navButton,
                  isActive && styles.navButtonActive,
                  item.disabled && styles.navButtonDisabled,
                ]}
                onPress={() => onNavigate(item.key)}
              >
                <Feather
                  name={item.icon}
                  size={18}
                  color={isActive ? '#FFFFFF' : item.disabled ? colors.textMuted : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.navText,
                    isActive && styles.navTextActive,
                    item.disabled && styles.navTextDisabled,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Feather name="log-out" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.main}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Administration</Text>
            <Text style={styles.headerSubtitle}>
              {currentUser?.display_name || currentUser?.username} · {currentUser?.role}
            </Text>
          </View>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {children}
        </ScrollView>
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
  sidebar: {
    width: 260,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: 16,
    gap: 18,
  },
  sidebarCompact: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  brandText: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  brandSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  navList: {
    gap: 8,
    flex: 1,
  },
  navListCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 0,
  },
  navButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navButtonActive: {
    backgroundColor: colors.primary,
  },
  navButtonDisabled: {
    opacity: 0.55,
  },
  navText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  navTextActive: {
    color: '#FFFFFF',
  },
  navTextDisabled: {
    color: colors.textMuted,
  },
  logoutButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceHighlight,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 24,
    gap: 16,
  },
});
