// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import colors from '../../src/theme/colors';
import {
  sessions,
  getLocationById,
  getLocationTypeColor,
  getLocationTypeIcon,
  Session,
} from '../../src/data/mockData';
import { getFavorites, toggleFavorite } from '../../src/utils/favoritesStorage';

export default function ScheduleScreen() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
  };

  const handleToggleFavorite = async (sessionId: string) => {
    const result = await toggleFavorite(sessionId);
    setFavorites(result.favorites);
  };

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

  const groupedSessions = sessions.reduce((acc, session) => {
    const date = formatDate(session.start_time);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, typeof sessions>);

  Object.keys(groupedSessions).forEach((date) => {
    groupedSessions[date].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  });

  const filterOptions = [
    { label: 'All', value: null, icon: 'list' },
    { label: 'Starred', value: 'starred', icon: 'star' },
    { label: 'Fields', value: 'field', icon: 'grid' },
    { label: 'Stages', value: 'stage', icon: 'mic' },
  ];

  const filteredGroupedSessions = Object.keys(groupedSessions).reduce(
    (acc, date) => {
      const filtered = groupedSessions[date].filter((session) => {
        if (showFavoritesOnly && !favorites.includes(session.id)) {
          return false;
        }
        if (selectedType && selectedType !== 'starred') {
          const location = getLocationById(session.location_id);
          return location?.type === selectedType;
        }
        return true;
      });
      if (filtered.length > 0) {
        acc[date] = filtered;
      }
      return acc;
    },
    {} as Record<string, typeof sessions>
  );

  const handleFilterPress = (value: string | null) => {
    if (value === 'starred') {
      setShowFavoritesOnly(true);
      setSelectedType(null);
    } else {
      setShowFavoritesOnly(false);
      setSelectedType(value);
    }
  };

  const isSessionHappeningNow = (session: Session): boolean => {
    const now = new Date();
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    return now >= start && now <= end;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <View style={styles.headerSubtitle}>
          <Text style={styles.subtitle}>{sessions.length} events</Text>
          {favorites.length > 0 && (
            <View style={styles.starredBadge}>
              <Feather name="star" size={12} color={colors.accent} />
              <Text style={styles.starredCount}>{favorites.length} starred</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filterOptions.map((option) => {
            const isActive = 
              (option.value === 'starred' && showFavoritesOnly) ||
              (option.value !== 'starred' && !showFavoritesOnly && selectedType === option.value);
            
            return (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                ]}
                onPress={() => handleFilterPress(option.value)}
                activeOpacity={0.8}
              >
                <Feather 
                  name={option.icon as any} 
                  size={14} 
                  color={isActive ? '#FFFFFF' : colors.textSecondary} 
                />
                <Text
                  style={[
                    styles.filterText,
                    isActive && styles.filterTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Sessions List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {Object.keys(filteredGroupedSessions).map((date) => (
          <View key={date} style={styles.dateSection}>
            <Text style={styles.dateHeader}>{date}</Text>

            {filteredGroupedSessions[date].map((session) => {
              const location = getLocationById(session.location_id);
              const typeColor = location
                ? getLocationTypeColor(location.type)
                : colors.primary;
              const iconName = location
                ? getLocationTypeIcon(location.type, location.utilitySubtype, location.fieldSubtype)
                : 'map-pin';
              const isFavorite = favorites.includes(session.id);
              const isNow = isSessionHappeningNow(session);
              const isField = location?.type === 'field';

              return (
                <View key={session.id} style={styles.sessionCard}>
                  <View
                    style={[styles.sessionIndicator, { backgroundColor: typeColor }]}
                  />
                  <View style={styles.sessionInfo}>
                    {isNow && (
                      <View style={styles.liveTag}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>HAPPENING NOW</Text>
                      </View>
                    )}
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
                        {isField ? (
                          <Feather name="truck" size={14} color={typeColor} />
                        ) : (
                          <Feather name={iconName as any} size={14} color={typeColor} />
                        )}
                        <Text style={[styles.sessionLocation, { color: typeColor }]}>
                          {location.name}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={styles.starButton}
                    onPress={() => handleToggleFavorite(session.id)}
                    activeOpacity={0.7}
                  >
                    <Feather 
                      name="star" 
                      size={22} 
                      color={isFavorite ? colors.accent : colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}

        {Object.keys(filteredGroupedSessions).length === 0 && (
          <View style={styles.emptyState}>
            <Feather 
              name={showFavoritesOnly ? 'star' : 'calendar'} 
              size={48} 
              color={colors.textMuted} 
            />
            <Text style={styles.emptyText}>
              {showFavoritesOnly ? 'No starred events' : 'No events found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {showFavoritesOnly 
                ? 'Tap the star icon to save events' 
                : 'Try adjusting your filters'}
            </Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
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
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
  },
  starredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  starredCount: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
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
    borderRadius: 20,
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
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.5,
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
  starButton: {
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
  bottomPadding: {
    height: 20,
  },
});
