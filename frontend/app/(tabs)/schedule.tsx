// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import colors from '../../src/theme/colors';
import {
  ATTENDEE_HORIZONTAL_MARGIN,
  attendeePageContent,
  useAttendeeLayout,
} from '../../src/theme/attendeePageLayout';
import { getFavorites, toggleFavorite } from '../../src/utils/favoritesStorage';
import { syncStarredEventsWithBackend } from '../../src/utils/notificationService';
import CachedDataBanner from '../../src/components/CachedDataBanner';
import {
  CachedApiSource,
  CachedApiResult,
  ScheduleEvent,
  ScheduleResponse,
  getScheduleData,
} from '../../src/services/spreadsheetDataService';

export default function ScheduleScreen() {
  const { frameStyle, sectionStyle } = useAttendeeLayout();
  const router = useRouter();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<CachedApiSource>('network');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const isFetchingScheduleRef = useRef(false);
  const hasFocusedScheduleRef = useRef(false);

  const applyScheduleResult = useCallback((result: CachedApiResult<ScheduleResponse>) => {
    if (!Array.isArray(result.data.events)) {
      throw new Error('Invalid schedule response');
    }
    setEvents(result.data.events);
    setLastUpdated(result.lastSuccessfulUpdate);
    if (result.source === 'network') {
      setDataSource('network');
    }
  }, []);

  // Fetch schedule from API
  const fetchSchedule = useCallback(async (isRefresh = false) => {
    if (isFetchingScheduleRef.current) {
      return;
    }

    isFetchingScheduleRef.current = true;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await getScheduleData({
        preferCache: !isRefresh,
        onBackgroundRefresh: applyScheduleResult,
        onBackgroundRefreshError: () => setDataSource('cache'),
      });
      console.log('[ScheduleScreen] schedule result:', {
        source: result.source,
        eventsReturned: result.data.events?.length,
        eventsPassedToSetEvents: result.data.events?.length,
      });
      applyScheduleResult(result);
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError("We couldn't load the schedule. Please check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingScheduleRef.current = false;
    }
  }, [applyScheduleResult]);

  // Load on mount
  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const loadFavorites = useCallback(async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
    // Sync with backend for notifications
    syncStarredEventsWithBackend(storedFavorites);
  }, []);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      if (hasFocusedScheduleRef.current) {
        fetchSchedule(true);
      } else {
        hasFocusedScheduleRef.current = true;
      }
    }, [fetchSchedule, loadFavorites])
  );

  const handleToggleFavorite = async (eventId: string) => {
    const result = await toggleFavorite(eventId);
    setFavorites(result.favorites);
    // Sync with backend for notifications
    syncStarredEventsWithBackend(result.favorites);
  };

  const onRefresh = useCallback(() => {
    fetchSchedule(true);
  }, [fetchSchedule]);

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

  const getDateDayName = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }, []);

  const normalizeDayName = useCallback((day: string): string => {
    const normalized = day.trim().toLowerCase().replace(/\.$/, '');
    const dayMap: Record<string, string> = {
      mon: 'Monday',
      monday: 'Monday',
      tue: 'Tuesday',
      tues: 'Tuesday',
      tuesday: 'Tuesday',
      wed: 'Wednesday',
      weds: 'Wednesday',
      wednesday: 'Wednesday',
      thu: 'Thursday',
      thur: 'Thursday',
      thurs: 'Thursday',
      thursday: 'Thursday',
      fri: 'Friday',
      friday: 'Friday',
      sat: 'Saturday',
      saturday: 'Saturday',
      sun: 'Sunday',
      sunday: 'Sunday',
    };
    return dayMap[normalized] || day.trim();
  }, []);

  const getEventDayLabels = useCallback((event: ScheduleEvent): string[] => {
    const labels = new Set<string>();
    const dateDay = getDateDayName(event.start_date);
    if (dateDay) {
      labels.add(dateDay);
    }

    (event.days_active || '')
      .split(/[,/&]+/)
      .map((day) => normalizeDayName(day))
      .filter(Boolean)
      .forEach((day) => labels.add(day));

    return Array.from(labels);
  }, [getDateDayName, normalizeDayName]);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(events.map((event) => event.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const dayOptions = useMemo(() => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const days = new Set<string>();
    events.forEach((event) => {
      getEventDayLabels(event).forEach((day) => days.add(day));
    });
    return Array.from(days).sort((a, b) => {
      const aIndex = dayOrder.indexOf(a);
      const bIndex = dayOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [events, getEventDayLabels]);

  const filterOptions = [
    { label: 'All', value: null, icon: 'list' },
    { label: 'Starred', value: 'starred', icon: 'star' },
  ];

  const hasActiveFilters = Boolean(
    showFavoritesOnly || selectedCategory || selectedDay || searchQuery.trim()
  );

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      if (showFavoritesOnly && !favorites.includes(event.id)) {
        return false;
      }

      if (selectedCategory && event.category !== selectedCategory) {
        return false;
      }

      if (selectedDay && !getEventDayLabels(event).includes(selectedDay)) {
        return false;
      }

      if (normalizedSearch) {
        const searchableText = [
          event.title,
          event.description,
          event.category,
          event.location_name || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!searchableText.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [events, favorites, getEventDayLabels, searchQuery, selectedCategory, selectedDay, showFavoritesOnly]);

  const filteredGroupedEvents = useMemo(() => {
    const grouped = filteredEvents.reduce((acc, event) => {
      const date = formatDisplayDate(event.start_date);
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    }, {} as Record<string, ScheduleEvent[]>);

    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));
    });

    return grouped;
  }, [filteredEvents]);

  const scheduleSections = useMemo(
    () => Object.entries(filteredGroupedEvents).map(([title, data]) => ({ title, data })),
    [filteredGroupedEvents],
  );

  const handleFilterPress = (value: string | null) => {
    if (value === 'starred') {
      setShowFavoritesOnly((current) => !current);
    } else {
      setShowFavoritesOnly(false);
      setSelectedCategory(null);
      setSelectedDay(null);
      setSearchQuery('');
    }
  };

  const clearFilters = () => {
    setShowFavoritesOnly(false);
    setSelectedCategory(null);
    setSelectedDay(null);
    setSearchQuery('');
  };

  // Loading state
  if (loading && events.length === 0) {
    return (
      <SafeAreaView style={[styles.container, attendeePageContent]} edges={['top']}>
        <View style={[styles.stateContent, frameStyle]}>
          <View style={styles.header}>
            <Text style={styles.title}>Schedule</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {'Preparing your event experience...\n\nLoading the latest IPM information.\nThis may take a few moments the first time you open the app.'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error && events.length === 0) {
    return (
      <SafeAreaView style={[styles.container, attendeePageContent]} edges={['top']}>
        <View style={[styles.stateContent, frameStyle]}>
          <View style={styles.header}>
            <Text style={styles.title}>Schedule</Text>
          </View>
          <View style={styles.stateContainer}>
            <Feather name="wifi-off" size={44} color={colors.error} />
            <Text style={styles.emptyTitle}>{"We couldn't load the schedule."}</Text>
            <Text style={styles.emptyText}>Please check your connection and try again.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchSchedule()} activeOpacity={0.8}>
              <Feather name="refresh-cw" size={17} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SectionList
        style={styles.content}
        contentContainerStyle={styles.listContent}
        sections={scheduleSections}
        keyExtractor={(event) => event.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={(
          <>
            <View style={frameStyle}>
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

              {dataSource === 'cache' && (
                <CachedDataBanner lastSuccessfulUpdate={lastUpdated} />
              )}

              <View style={styles.filterPanel}>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search schedule"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        {/* Filter Pills */}
        <View style={styles.filterRows}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterOptions.map((option) => {
            const isActive =
              (option.value === null && !hasActiveFilters) ||
              (option.value === 'starred' && showFavoritesOnly);

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
        {categoryOptions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {categoryOptions.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setSelectedCategory(isActive ? null : category)}
                >
                  <Feather
                    name="tag"
                    size={14}
                    color={isActive ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        {dayOptions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {dayOptions.map((day) => {
              const isActive = selectedDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setSelectedDay(isActive ? null : day)}
                >
                  <Feather
                    name="calendar"
                    size={14}
                    color={isActive ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Feather name="x-circle" size={16} color={colors.primary} />
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        )}
        </View>
              </View>

              {/* Error State */}
              {error && events.length > 0 && (
                <View style={styles.errorContainer}>
                  <Feather name="alert-circle" size={24} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>

            {/* Last Updated Indicator */}
            {lastUpdated && (
              <View style={[styles.lastUpdatedContainer, sectionStyle]}>
                <Feather name="refresh-cw" size={12} color={colors.textMuted} />
                <Text style={styles.lastUpdatedText}>Pull down to refresh</Text>
              </View>
            )}
          </>
        )}
        ListEmptyComponent={(
          <View style={sectionStyle}>
          <View style={styles.emptyState}>
            <Feather
              name={showFavoritesOnly ? 'star' : 'calendar'}
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {showFavoritesOnly ? 'No Starred Events Yet' : hasActiveFilters ? 'No Matching Events' : 'Schedule'}
            </Text>
            <Text style={styles.emptyText}>
              {showFavoritesOnly
                ? 'Tap the star on any event to add it to your personal itinerary.'
                : hasActiveFilters
                  ? 'Clear filters or try a different search.'
                  : 'No schedule information is available yet.'}
            </Text>
            {!showFavoritesOnly && !hasActiveFilters && (
              <Text style={styles.emptyText}>
                Event information will appear here once the schedule has been published.
              </Text>
            )}
          </View>
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={sectionStyle}>
            <View style={styles.dateSection}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateText}>{section.title}</Text>
                <Text style={styles.eventCount}>
                  {section.data.length} event{section.data.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        )}
        renderSectionFooter={() => <View style={styles.sectionFooter} />}
        renderItem={({ item: event }) => {
          const isFavorite = favorites.includes(event.id);

          return (
            <View style={sectionStyle}>
                  <TouchableOpacity 
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
            </View>
          );
        }}
      />

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
                      style={[styles.detailSection, styles.locationClickable]}
                      onPress={() => {
                        console.log('Location clicked:', selectedEvent.location_name);
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
                          <Feather name="map-pin" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.detailTextContainer}>
                          <Text style={styles.detailLabel}>Location</Text>
                          <Text style={[styles.detailValue, { color: colors.primary }]}>
                            {selectedEvent.location_name}
                          </Text>
                          <Text style={styles.tapToViewMap}>Tap to view on map</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color={colors.primary} />
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
    paddingHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
    paddingTop: 20,
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
  filterPanel: {
    paddingHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
    paddingBottom: 12,
    gap: 10,
  },
  searchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  clearSearchButton: {
    padding: 4,
  },
  filterRows: {
    gap: 10,
  },
  filterScroll: {
    gap: 8,
    paddingRight: 16,
  },
  filterPill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  content: {
    flex: 1,
    alignSelf: 'stretch',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 180,
  },
  stateContent: {
    flex: 1,
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
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: colors.surfaceHighlight,
    marginHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
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
    marginBottom: 0,
  },
  sectionFooter: {
    height: 20,
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
  retryButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  locationClickable: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  tapToViewMap: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
    fontStyle: 'italic',
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
