import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import colors from '../../src/theme/colors';
import { sessions, locations, getLocationById } from '../../src/data/mockData';

export default function HomeScreen() {
  const router = useRouter();

  // Get the next upcoming session
  const now = new Date();
  const upcomingSessions = sessions
    .filter((s) => new Date(s.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 3);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome to</Text>
          <Text style={styles.eventName}>Tech Conference 2025</Text>
          <Text style={styles.venue}>Moscone Center, San Francisco</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/map')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                <Feather name="map" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Open Map</Text>
              <Text style={styles.actionSubtitle}>Navigate the venue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/schedule')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="calendar" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Schedule</Text>
              <Text style={styles.actionSubtitle}>View all sessions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Sessions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingSessions.length > 0 ? (
            upcomingSessions.map((session) => {
              const location = getLocationById(session.location_id);
              return (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionTimeContainer}>
                    <Text style={styles.sessionTime}>
                      {formatTime(session.start_time)}
                    </Text>
                    <View style={styles.timeLine} />
                  </View>
                  <View style={styles.sessionContent}>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                    {location && (
                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={14} color={colors.textMuted} />
                        <Text style={styles.locationText}>{location.name}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No upcoming sessions</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{sessions.length}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {locations.filter((l) => l.type === 'stage').length}
              </Text>
              <Text style={styles.statLabel}>Stages</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {locations.filter((l) => l.type === 'vendor').length}
              </Text>
              <Text style={styles.statLabel}>Vendors</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  greeting: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 4,
  },
  eventName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  venue: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  sessionCard: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  sessionTimeContainer: {
    width: 70,
    alignItems: 'center',
  },
  sessionTime: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  timeLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 8,
  },
  sessionContent: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginLeft: 12,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
});
