// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type PageAction = {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  onPress: () => void;
};

type ContentPageProps = {
  title: string;
  subtitle: string;
  primaryAction?: PageAction;
  children: React.ReactNode;
};

export function ContentPage({ title, subtitle, primaryAction, children }: ContentPageProps) {
  return (
    <View style={styles.page}>
      <View style={styles.pageHeader}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {primaryAction && (
          <Pressable
            style={[styles.primaryButton, primaryAction.disabled && styles.buttonDisabled]}
            disabled={primaryAction.disabled}
            onPress={primaryAction.onPress}
          >
            {primaryAction.icon && <Feather name={primaryAction.icon} size={18} color="#FFFFFF" />}
            <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

type ContentToolbarProps = {
  searchValue: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  secondaryAction?: PageAction;
};

export function ContentToolbar({
  searchValue,
  searchPlaceholder = 'Search',
  onSearchChange,
  secondaryAction,
}: ContentToolbarProps) {
  return (
    <View style={styles.toolbar}>
      <View style={styles.searchBox}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>
      {secondaryAction && (
        <Pressable
          style={[styles.secondaryButton, secondaryAction.disabled && styles.buttonDisabled]}
          disabled={secondaryAction.disabled}
          onPress={secondaryAction.onPress}
        >
          {secondaryAction.icon && (
            <Feather name={secondaryAction.icon} size={17} color={colors.textSecondary} />
          )}
          <Text style={styles.secondaryButtonText}>{secondaryAction.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  message,
  action,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  action?: PageAction;
}) {
  return (
    <View style={styles.stateBox}>
      <Feather name={icon} size={36} color={colors.textMuted} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
      {action && (
        <Pressable style={styles.secondaryButton} onPress={action.onPress}>
          {action.icon && <Feather name={action.icon} size={17} color={colors.textSecondary} />}
          <Text style={styles.secondaryButtonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ErrorState({
  title = 'Unable to load data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={[styles.stateBox, styles.errorBox]}>
      <Feather name="alert-circle" size={30} color={colors.error} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.secondaryButton} onPress={onRetry}>
          <Feather name="refresh-cw" size={17} color={colors.textSecondary} />
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

export function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required ? ' *' : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 16,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  titleBlock: {
    flex: 1,
    minWidth: 260,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: 14,
    outlineStyle: 'none' as never,
  },
  stateBox: {
    minHeight: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  errorBox: {
    borderColor: colors.error,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
