import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import colors from '../../src/theme/colors';
import {
  sessions,
  getLocationById,
  getLocationTypeColor,
} from '../../src/data/mockData';

export default function ScheduleScreen() {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // Group sessions by date
  const groupedSessions = sessions.reduce((acc, session) => {
    const date = formatDate(session.start_time);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, typeof sessions>);

  // Sort sessions within each date by start time
  Object.keys(groupedSessions).forEach((date) => {
    groupedSessions[date].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  });

  const filterOptions = [
    { label: 'All', value: null },
    { label: 'Stages', value: 'stage' },
    { label: 'Vendors', value: 'vendor' },
  ];

  const filteredGroupedSessions = Object.keys(groupedSessions).reduce(
    (acc, date) => {
      const filtered = groupedSessions[date].filter((session) => {
        if (!selectedType) return true;
        const location = getLocationById(session.location_id);
        return location?.type === selectedType;
      });
      if (filtered.length > 0) {
        acc[date] = filtered;
      }
      return acc;
    },
    {} as Record<string, typeof sessions>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>{sessions.length} sessions</Text>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.label}
              style={[
                styles.filterButton,
                selectedType === option.value && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedType(option.value)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedType === option.value && styles.filterTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sessions List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {Object.keys(filteredGroupedSessions).map((date) => (
          <View key={date} style={styles.dateSection}>
            <Text style={styles.dateHeader}>{date}</Text>

            {filteredGroupedSessions[date].map((session, index) => {
              const location = getLocationById(session.location_id);
              const typeColor = location
                ? getLocationTypeColor(location.type)
                : colors.primary;

              return (
                <View key={session.id} style={styles.sessionCard}>
                  <View
                    style={[styles.sessionIndicator, { backgroundColor: typeColor }]}
                  />
                  <View style={styles.sessionInfo}>
                    <View style={styles.sessionTimeRow}>
                      <Feather name="clock" size={14} color={colors.textMuted} />
                      <Text style={styles.sessionTime}>
                        {formatTime(session.start_time)} -{' '}
                        {formatTime(session.end_time)}
                      </Text>
                    </View>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                    {location && (
                      <View style={styles.sessionLocationRow}>
                        <Feather name="map-pin" size={14} color={typeColor} />
                        <Text style={[styles.sessionLocation, { color: typeColor }]}>
                          {location.name}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.sessionAction}>
                    <Feather name="chevron-right" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}

        {Object.keys(filteredGroupedSessions).length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No sessions found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  dateSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 12,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sessionIndicator: {
    width: 4,
    alignSelf: 'stretch',
  },
  sessionInfo: {
    flex: 1,
    padding: 14,
  },
  sessionTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sessionTime: {
    fontSize: 13,
    color: colors.textMuted,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  sessionLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionLocation: {
    fontSize: 13,
    fontWeight: '500',
  },
  sessionAction: {
    padding: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
});
