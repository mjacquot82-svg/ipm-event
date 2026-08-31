import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnnouncementCard, { getVisibleAnnouncements } from '../../src/components/AnnouncementCard';
import CachedDataBanner from '../../src/components/CachedDataBanner';
import { AttendeeAttribution } from '../../src/components/AttendeeAttribution';
import colors from '../../src/theme/colors';
import { attendeePageContent, useAttendeeLayout } from '../../src/theme/attendeePageLayout';
import { Announcement, AnnouncementsResponse, CachedApiResult, CachedApiSource, getAnnouncementsData } from '../../src/services/spreadsheetDataService';
import { excludeDismissedAnnouncements, getUnreadAnnouncementIds, useAnnouncementReadState } from '../../src/context/AnnouncementReadContext';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { frameStyle, sectionStyle } = useAttendeeLayout();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<CachedApiSource>('network');
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<string | null>(null);
  const { hydrated, lastReadAnnouncementId, readAnnouncementIds, dismissedAnnouncementIds, dismissAnnouncement, markAnnouncementsRead } = useAnnouncementReadState();
  const visibleAnnouncements = hydrated
    ? excludeDismissedAnnouncements(announcements, dismissedAnnouncementIds)
    : [];
  const unreadIds = getUnreadAnnouncementIds(visibleAnnouncements, readAnnouncementIds, lastReadAnnouncementId);
  usePageAnalytics('announcements', 'home_quick_action', 'announcement_list_viewed', { unread_count: unreadIds.size });

  const applyResult = useCallback((result: CachedApiResult<AnnouncementsResponse>) => {
    setAnnouncements(getVisibleAnnouncements(result.data.announcements || []));
    setDataSource(result.source);
    setLastSuccessfulUpdate(result.lastSuccessfulUpdate);
    setError(null);
  }, []);

  const loadAnnouncements = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      if (!isRefresh) setError(null);
      const result = await getAnnouncementsData({
        preferCache: !isRefresh,
        onBackgroundRefresh: applyResult,
        onBackgroundRefreshError: () => setDataSource('cache'),
      });
      applyResult(result);
    } catch (err) {
      console.error('Unable to load announcements:', err);
      if (!isRefresh) setError("We couldn't load announcements. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyResult]);

  useEffect(() => { void loadAnnouncements(); }, [loadAnnouncements]);

  const visibleAnnouncementIds = visibleAnnouncements.map((announcement) => announcement.id).join('|');
  useEffect(() => {
    if (!loading && hydrated && visibleAnnouncementIds) {
      void markAnnouncementsRead(visibleAnnouncementIds.split('|'));
    }
  }, [hydrated, loading, markAnnouncementsRead, visibleAnnouncementIds]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={attendeePageContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAnnouncements(true)} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        <View style={[styles.content, frameStyle]}>
          <View style={[styles.pageHeader, sectionStyle]}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back">
              <Feather name="arrow-left" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View><Text style={styles.title}>Announcements</Text><Text style={styles.subtitle}>Latest event updates</Text></View>
          </View>

          {dataSource === 'cache' && visibleAnnouncements.length > 0 && <CachedDataBanner lastSuccessfulUpdate={lastSuccessfulUpdate} />}

          {loading ? (
            <View style={styles.state}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.stateText}>Loading announcements...</Text></View>
          ) : error ? (
            <View style={styles.state}>
              <Feather name="wifi-off" size={42} color={colors.error} />
              <Text style={styles.stateTitle}>Announcements could not be loaded</Text>
              <Text style={styles.stateText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadAnnouncements()}><Feather name="refresh-cw" size={16} color="#FFFFFF" /><Text style={styles.retryText}>Try Again</Text></TouchableOpacity>
            </View>
          ) : visibleAnnouncements.length === 0 ? (
            <View style={styles.state}><Feather name="message-square" size={42} color={colors.textMuted} /><Text style={styles.stateTitle}>No published announcements</Text><Text style={styles.stateText}>Event updates will appear here when available.</Text></View>
          ) : (
            <View style={[styles.list, sectionStyle]}>
              {visibleAnnouncements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  unread={hydrated && unreadIds.has(announcement.id)}
                  onPress={() => {
                    router.push(`/announcements/${announcement.id}?source=list` as never);
                  }}
                  onDismiss={() => { void dismissAnnouncement(announcement.id); }}
                />
              ))}
            </View>
          )}
        </View>
        <AttendeeAttribution source="announcements_attribution" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flex: 1 },
  pageHeader: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 18, paddingTop: 14 },
  backButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  list: { gap: 14, paddingBottom: 28 },
  state: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 300, paddingHorizontal: 28 },
  stateTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  stateText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 9, flexDirection: 'row', gap: 8, marginTop: 6, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
