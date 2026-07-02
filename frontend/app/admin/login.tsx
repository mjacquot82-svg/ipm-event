// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import {
  bootstrapOrganizerOwner,
  getCurrentOrganizer,
  loginOrganizer,
} from '../../src/services/adminAuthService';

export default function AdminLoginScreen() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapMode, setIsBootstrapMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [eventId, setEventId] = useState('ipm-2026');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getCurrentOrganizer()
      .then(() => {
        if (isMounted) {
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
          setCheckingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const submit = async () => {
    if (submitting) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (isBootstrapMode) {
        await bootstrapOrganizerOwner({
          username,
          password,
          display_name: displayName,
          event_id: eventId,
        });
      } else {
        await loginOrganizer({ username, password, event_id: eventId });
      }
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/admin" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <View style={styles.brandMark}>
            <Feather name="shield" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Organizer Portal</Text>
          <Text style={styles.subtitle}>
            {isBootstrapMode ? 'Create the first Owner account' : 'Sign in to manage the event'}
          </Text>

          <View style={styles.form}>
            {isBootstrapMode && (
              <View>
                <Text style={styles.label}>Display name</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Event Owner"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View>
              <Text style={styles.label}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="organizer"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
              />
            </View>

            <View>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={isBootstrapMode ? 'At least 10 characters' : 'Password'}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
                textContentType="password"
              />
            </View>

            <View>
              <Text style={styles.label}>Event ID</Text>
              <TextInput
                value={eventId}
                onChangeText={setEventId}
                placeholder="ipm-2026"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="log-in" size={18} color="#FFFFFF" />
                  <Text style={styles.submitText}>
                    {isBootstrapMode ? 'Create Owner Account' : 'Sign In'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.modeButton}
              onPress={() => {
                setError(null);
                setIsBootstrapMode((value) => !value);
              }}
            >
              <Text style={styles.modeText}>
                {isBootstrapMode ? 'Use existing organizer login' : 'Set up first organizer account'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: colors.textSecondary,
  },
  form: {
    gap: 16,
    marginTop: 24,
  },
  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
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
  submitButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
