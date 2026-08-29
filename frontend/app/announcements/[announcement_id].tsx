import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnnouncementCard from '../../src/components/AnnouncementCard';
import { AttendeeAttribution } from '../../src/components/AttendeeAttribution';
import { Announcement, getAnnouncementById } from '../../src/services/spreadsheetDataService';
import { attendeePageContent, useAttendeeLayout } from '../../src/theme/attendeePageLayout';
import colors from '../../src/theme/colors';
import { useAnnouncementReadState } from '../../src/context/AnnouncementReadContext';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { queueAnalyticsEvent } from '../../src/analytics/analyticsClient';

export default function AnnouncementDetailScreen() {
  const router = useRouter();
  const { announcement_id: rawAnnouncementId, source } = useLocalSearchParams<{ announcement_id?: string | string[]; source?: string }>();
  const announcementId = Array.isArray(rawAnnouncementId) ? rawAnnouncementId[0] : rawAnnouncementId;
  const { frameStyle, sectionStyle } = useAttendeeLayout();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const { markAnnouncementRead } = useAnnouncementReadState();
  usePageAnalytics('announcement_detail', source || 'other');
  const trackedOpenId = React.useRef<string | null>(null);

  const goBack = () => {
    if (source && router.canGoBack()) router.back();
    else router.replace('/announcements' as never);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    if (!announcementId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const result = await getAnnouncementById(announcementId);
      setAnnouncement(result);
      setNotFound(result === null);
      if (result) {
        await markAnnouncementRead(result.id);
        if (trackedOpenId.current !== result.id) {
          trackedOpenId.current = result.id;
          void queueAnalyticsEvent('announcement_opened', {
            announcement_id: result.id, source: source || 'other', load_status: 'success',
          });
        }
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [announcementId, markAnnouncementRead, source]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={attendeePageContent}>
        <View style={[styles.content, frameStyle]}>
          <View style={[styles.header, sectionStyle]}>
            <TouchableOpacity style={styles.backButton} onPress={goBack}
              accessibilityRole="button" accessibilityLabel="Back to announcements">
              <Feather name="arrow-left" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerText}><Text style={styles.heading} accessibilityRole="header">Announcement</Text><Text style={styles.subtitle}>Event update</Text></View>
          </View>

          {loading ? (
            <State icon={null} title="Loading announcement…" loading />
          ) : notFound ? (
            <State icon="file-text" title="Announcement not found" message="This announcement is no longer available or may not have been published." />
          ) : error ? (
            <State icon="wifi-off" title="Announcement could not be loaded" message="Check your connection and try again." action={{ label: 'Try Again', onPress: load }} />
          ) : announcement ? (
            <View style={sectionStyle}><AnnouncementCard announcement={announcement} /></View>
          ) : null}
        </View>
        <AttendeeAttribution source="announcement_detail_attribution" />
      </ScrollView>
    </SafeAreaView>
  );
}

function State({ icon, title, message, loading, action }: {
  icon: keyof typeof Feather.glyphMap | null;
  title: string;
  message?: string;
  loading?: boolean;
  action?: { label: string; onPress: () => void };
}) {
  return <View style={styles.state}>
    {loading ? <ActivityIndicator size="large" color={colors.primary} /> : icon ? <Feather name={icon} size={42} color={colors.textMuted} /> : null}
    <Text style={styles.stateTitle}>{title}</Text>
    {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
    {action ? <TouchableOpacity style={styles.retryButton} onPress={action.onPress}><Text style={styles.retryText}>{action.label}</Text></TouchableOpacity> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 18, paddingTop: 14 },
  backButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexShrink: 0, minHeight: 44, minWidth: 44, justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  heading: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  state: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 320, paddingHorizontal: 28 },
  stateTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  stateMessage: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retryButton: { backgroundColor: colors.primary, borderRadius: 9, marginTop: 6, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
