// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import colors from '../../src/theme/colors';
import { getFavorites, toggleFavorite } from '../../src/utils/favoritesStorage';
import { syncStarredEventsWithBackend } from '../../src/utils/notificationService';

// API Event type from Google Sheets
interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_time: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  days_active: string;
  location_name: string | null;
}

interface ScheduleResponse {
  events: ScheduleEvent[];
  last_updated: string;
  total_count: number;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function ScheduleScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  // Fetch schedule from API
  const fetchSchedule = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/schedule`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch schedule');
      }

      const data: ScheduleResponse = await response.json();
      setEvents(data.events);
      setLastUpdated(data.last_updated);
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Unable to load schedule. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load on mount
  useEffect(() => {
    fetchSchedule();
  }, []);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      // Optionally refresh schedule on focus
      // fetchSchedule(true);
    }, [])
  );

  const loadFavorites = async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
    // Sync with backend for notifications
    syncStarredEventsWithBackend(storedFavorites);
  };

  const handleToggleFavorite = async (eventId: string) => {
    const result = await toggleFavorite(eventId);
    setFavorites(result.favorites);
    // Sync with backend for notifications
    syncStarredEventsWithBackend(result.favorites);
  };

  const onRefresh = () => {
    fetchSchedule(true);
  };

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = formatDisplayDate(event.start_date);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, ScheduleEvent[]>);

  // Sort events within each date by start time
  Object.keys(groupedEvents).forEach((date) => {
    groupedEvents[date].sort((a, b) => {
      return parseTime(a.start_time) - parseTime(b.start_time);
    });
  });

  // Parse time string to minutes for sorting
  function parseTime(timeStr: string): number {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):?(\d*)\s*(AM|PM)?/i);
    if (!match) return 0;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2] || '0', 10);
    const period = match[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  }

  // Format date for display
  function formatDisplayDate(dateStr: string): string {
    if (!dateStr) return 'Unknown Date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  const filterOptions = [
    { label: 'All', value: null, icon: 'list' },
    { label: 'Starred', value: 'starred', icon: 'star' },
  ];

  const filteredGroupedEvents = Object.keys(groupedEvents).reduce(
    (acc, date) => {
      const filtered = groupedEvents[date].filter((event) => {
        if (showFavoritesOnly && !favorites.includes(event.id)) {
          return false;
        }
        return true;
      });
      if (filtered.length > 0) {
        acc[date] = filtered;
      }
      return acc;
    },
    {} as Record<string, ScheduleEvent[]>
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

  // Loading state
  if (loading && events.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Schedule</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <View style={styles.headerSubtitle}>
          <Text style={styles.subtitle}>{events.length} events</Text>
          {favorites.length > 0 && (
            <View style={styles.starBadge}>
              <Feather name="star" size={12} color={colors.accent} />
              <Text style={styles.starCount}>{favorites.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterOptions.map((option) => {
            const isActive =
              (option.value === null && !showFavoritesOnly) ||
              (option.value === 'starred' && showFavoritesOnly) ||
              selectedType === option.value;

            return (
              <TouchableOpacity
                key={option.label}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => handleFilterPress(option.value)}
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

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={24} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Schedule List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Last Updated Indicator */}
        {lastUpdated && (
          <View style={styles.lastUpdatedContainer}>
            <Feather name="refresh-cw" size={12} color={colors.textMuted} />
            <Text style={styles.lastUpdatedText}>
              Pull down to refresh
            </Text>
          </View>
        )}

        {Object.keys(filteredGroupedEvents).length === 0 ? (
          <View style={styles.emptyState}>
            <Feather
              name={showFavoritesOnly ? 'star' : 'calendar'}
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {showFavoritesOnly ? 'No Starred Events' : 'No Events'}
            </Text>
            <Text style={styles.emptyText}>
              {showFavoritesOnly
                ? 'Tap the star icon on events to add them here'
                : 'Events will appear here when scheduled'}
            </Text>
          </View>
        ) : (
          Object.entries(filteredGroupedEvents).map(([date, dateEvents]) => (
            <View key={date} style={styles.dateSection}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>{date}</Text>
                <Text style={styles.eventCount}>
                  {dateEvents.length} event{dateEvents.length > 1 ? 's' : ''}
                </Text>
              </View>

              {dateEvents.map((event) => {
                const isFavorite = favorites.includes(event.id);

                return (
                  <TouchableOpacity 
                    key={event.id} 
                    style={styles.eventCard}
                    onPress={() => {
                      setSelectedEvent(event);
                      setShowEventModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.eventColorBar,
                        { backgroundColor: colors.primary },
                      ]}
                    />

                    <View style={styles.eventContent}>
                      <View style={styles.eventHeader}>
                        <View style={styles.eventTimeContainer}>
                          <Feather
                            name="clock"
                            size={14}
                            color={colors.textMuted}
                          />
                          <Text style={styles.eventTime}>
                            {event.start_time} - {event.end_time}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(event.id);
                          }}
                          style={styles.favoriteButton}
                        >
                          <Feather
                            name={isFavorite ? 'star' : 'star'}
                            size={20}
                            color={isFavorite ? colors.accent : colors.textMuted}
                          />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.eventTitle}>{event.title}</Text>

                      {event.location_name ? (
                        <View style={styles.locationBadge}>
                          <Feather name="map-pin" size={12} color={colors.primary} />
                          <Text style={styles.locationBadgeText}>{event.location_name}</Text>
                        </View>
                      ) : null}

                      {event.description ? (
                        <Text style={styles.eventDescription} numberOfLines={2}>
                          {event.description}
                        </Text>
                      ) : null}

                      <View style={styles.eventMeta}>
                        {event.days_active && (
                          <View style={styles.metaItem}>
                            <Feather
                              name="calendar"
                              size={12}
                              color={colors.textMuted}
                            />
                            <Text style={styles.metaText}>
                              {event.days_active}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Event Details Modal */}
      <Modal
        visible={showEventModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedEvent && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        handleToggleFavorite(selectedEvent.id);
                      }}
                      style={styles.modalStarButton}
                    >
                      <Feather
                        name="star"
                        size={24}
                        color={favorites.includes(selectedEvent.id) ? colors.accent : colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowEventModal(false)}
                    style={styles.modalCloseButton}
                  >
                    <Feather name="x" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Modal Body */}
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Time & Date */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Feather name="clock" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>Time</Text>
                        <Text style={styles.detailValue}>
                          {selectedEvent.start_time} - {selectedEvent.end_time}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Feather name="calendar" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>Date</Text>
                        <Text style={styles.detailValue}>
                          {selectedEvent.start_date}
                        </Text>
                        {selectedEvent.days_active && (
                          <Text style={styles.detailSubValue}>
                            Active: {selectedEvent.days_active}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Location */}
                  {selectedEvent.location_name && (
                    <TouchableOpacity 
                      style={styles.detailSection}
                      onPress={() => {
                        setShowEventModal(false);
                        router.push({
                          pathname: '/(tabs)/map',
                          params: { location: selectedEvent.location_name, showOnly: 'true' }
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Feather name="map-pin" size={20} color={colors.field} />
                        </View>
                        <View style={styles.detailTextContainer}>
                          <Text style={styles.detailLabel}>Location</Text>
                          <Text style={styles.detailValue}>
                            {selectedEvent.location_name}
                          </Text>
                        </View>
                        <Feather name="external-link" size={16} color={colors.primary} />
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Category */}
                  {selectedEvent.category && (
                    <View style={styles.detailSection}>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Feather name="tag" size={20} color={colors.accent} />
                        </View>
                        <View style={styles.detailTextContainer}>
                          <Text style={styles.detailLabel}>Category</Text>
                          <Text style={styles.detailValue}>
                            {selectedEvent.category}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Description */}
                  {selectedEvent.description && (
                    <View style={styles.descriptionSection}>
                      <Text style={styles.descriptionLabel}>Description</Text>
                      <Text style={styles.descriptionText}>
                        {selectedEvent.description}
                      </Text>
                    </View>
                  )}

                  <View style={{ height: 40 }} />
                </ScrollView>

                {/* Add to Itinerary Button */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[
                      styles.addToItineraryButton,
                      favorites.includes(selectedEvent.id) && styles.removeFromItineraryButton
                    ]}
                    onPress={() => {
                      handleToggleFavorite(selectedEvent.id);
                    }}
                  >
                    <Feather
                      name={favorites.includes(selectedEvent.id) ? 'check' : 'plus'}
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.addToItineraryText}>
                      {favorites.includes(selectedEvent.id) ? 'Added to Itinerary' : 'Add to Itinerary'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontSize: 14,
    color: colors.textSecondary,
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  starCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  filterContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighlight,
    gap: 6,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: colors.surfaceHighlight,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dateSection: {
    marginBottom: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  eventCount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 14,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTime: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  favoriteButton: {
    padding: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  bottomPadding: {
    height: 120,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  locationBadgeText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  modalStarButton: {
    padding: 4,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailSubValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  descriptionSection: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  modalFooter: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addToItineraryButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  removeFromItineraryButton: {
    backgroundColor: colors.field,
  },
  addToItineraryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
