// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import colors from '../../src/theme/colors';
import { getFavorites, toggleFavorite } from '../../src/utils/favoritesStorage';

interface Event {
  id: string;
  title: string;
  start_date: string;
  start_time: string;
  end_time: string;
  location_name?: string;
  category?: string;
  description?: string;
  days_active?: string;
}

interface GroupedEvents {
  [date: string]: Event[];
}

export default function ItineraryScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [apiEvents, setApiEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(true);

  // Fetch events from API
  const fetchApiEvents = async () => {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      if (!API_BASE_URL) {
        setBackendAvailable(false);
        return;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_BASE_URL}/api/schedule`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setApiEvents(data.events || []);
        setBackendAvailable(true);
      }
    } catch (error: any) {
      console.warn('Events fetch failed:', error?.message || 'Network error');
      setBackendAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
  };

  useEffect(() => {
    fetchApiEvents();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      fetchApiEvents();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFavorites(), fetchApiEvents()]);
    setRefreshing(false);
  }, []);

  // Parse time string to minutes for sorting (e.g., "9:00 AM" -> 540)
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    
    const cleanTime = timeStr.trim().toUpperCase();
    const match = cleanTime.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
    
    if (!match) return 0;
    
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3];
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return hours * 60 + minutes;
  };

  // Parse date string to Date object for sorting
  const parseDateToTimestamp = (dateStr: string): number => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  };

  // Get starred events sorted by date and time
  const starredEvents = useMemo(() => {
    return apiEvents
      .filter(event => favorites.includes(event.id))
      .sort((a, b) => {
        // First sort by date
        const dateA = parseDateToTimestamp(a.start_date);
        const dateB = parseDateToTimestamp(b.start_date);
        if (dateA !== dateB) return dateA - dateB;
        
        // Then sort by time
        const timeA = parseTimeToMinutes(a.start_time);
        const timeB = parseTimeToMinutes(b.start_time);
        return timeA - timeB;
      });
  }, [apiEvents, favorites]);

  // Group events by date
  const groupedEvents = useMemo((): GroupedEvents => {
    const groups: GroupedEvents = {};
    
    starredEvents.forEach(event => {
      if (!event.start_date) return;
      
      const dateObj = new Date(event.start_date);
      const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD for sorting
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });
    
    // Sort events within each day by time
    Object.keys(groups).forEach(dateKey => {
      groups[dateKey].sort((a, b) => {
        return parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time);
      });
    });
    
    return groups;
  }, [starredEvents]);

  // Get sorted date keys
  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedEvents).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
  }, [groupedEvents]);

  // Format date for section header (e.g., "Tuesday, September 22")
  const formatDateHeader = (dateKey: string): string => {
    const date = new Date(dateKey);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // Handle removing event from itinerary
  const handleRemoveFromItinerary = async (eventId: string) => {
    const result = await toggleFavorite(eventId);
    setFavorites(result.favorites);
  };

  // Get category color
  const getCategoryColor = (category?: string): string => {
    if (!category) return colors.primary;
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('music') || lowerCategory.includes('concert')) return colors.stage;
    if (lowerCategory.includes('food') || lowerCategory.includes('vendor')) return colors.vendor;
    if (lowerCategory.includes('sport') || lowerCategory.includes('competition')) return colors.field;
    if (lowerCategory.includes('workshop') || lowerCategory.includes('demo')) return colors.utility;
    if (lowerCategory.includes('ceremony') || lowerCategory.includes('special')) return colors.accent;
    
    return colors.primary;
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Feather name="star" size={48} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No events planned yet</Text>
      <Text style={styles.emptyText}>
        Star events from the Schedule to build your personal itinerary
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => router.push('/(tabs)/schedule')}
        activeOpacity={0.8}
      >
        <Feather name="calendar" size={18} color="#FFFFFF" />
        <Text style={styles.browseButtonText}>Browse Schedule</Text>
      </TouchableOpacity>
    </View>
  );

  // Render event card
  const renderEventCard = (event: Event) => {
    const categoryColor = getCategoryColor(event.category);
    
    return (
      <View key={event.id} style={styles.eventCard}>
        {/* Color indicator bar */}
        <View style={[styles.colorBar, { backgroundColor: categoryColor }]} />
        
        {/* Event content */}
        <View style={styles.eventContent}>
          {/* Time row */}
          <View style={styles.timeRow}>
            <Feather name="clock" size={14} color={colors.textMuted} />
            <Text style={styles.timeText}>
              {event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}
            </Text>
          </View>
          
          {/* Title */}
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          
          {/* Location */}
          {event.location_name && (
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={12} color={categoryColor} />
              <Text style={[styles.detailText, { color: categoryColor }]} numberOfLines={1}>
                {event.location_name}
              </Text>
            </View>
          )}
          
          {/* Category */}
          {event.category && (
            <View style={styles.categoryBadge}>
              <Text style={[styles.categoryText, { color: categoryColor }]}>
                {event.category}
              </Text>
            </View>
          )}
        </View>
        
        {/* Remove button */}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFromItinerary(event.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="star" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>
    );
  };

  // Render day section
  const renderDaySection = (dateKey: string) => {
    const events = groupedEvents[dateKey];
    const formattedDate = formatDateHeader(dateKey);
    
    return (
      <View key={dateKey} style={styles.daySection}>
        {/* Day header */}
        <View style={styles.dayHeader}>
          <View style={styles.dayHeaderIcon}>
            <Feather name="calendar" size={16} color={colors.primary} />
          </View>
          <Text style={styles.dayHeaderText}>{formattedDate}</Text>
          <View style={styles.eventCountBadge}>
            <Text style={styles.eventCountText}>{events.length}</Text>
          </View>
        </View>
        
        {/* Events list */}
        <View style={styles.eventsContainer}>
          {events.map(event => renderEventCard(event))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Feather name="clipboard" size={22} color={colors.utility} />
          <Text style={styles.headerTitle}>My Itinerary</Text>
        </View>
        <View style={styles.headerRight}>
          {starredEvents.length > 0 && (
            <Text style={styles.eventsSummary}>
              {starredEvents.length} event{starredEvents.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingState}>
            <Text style={styles.loadingText}>Loading your itinerary...</Text>
          </View>
        ) : starredEvents.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {/* Summary banner */}
            <View style={styles.summaryBanner}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={styles.summaryText}>
                {sortedDateKeys.length} day{sortedDateKeys.length !== 1 ? 's' : ''} with planned activities
              </Text>
            </View>
            
            {/* Day sections */}
            {sortedDateKeys.map(dateKey => renderDaySection(dateKey))}
            
            {/* Add more button */}
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => router.push('/(tabs)/schedule')}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={18} color={colors.accent} />
              <Text style={styles.addMoreText}>Add more events</Text>
            </TouchableOpacity>
          </>
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
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  eventsSummary: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  
  // Summary banner
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceHighlight,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  summaryText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  // Day section
  daySection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  dayHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dayHeaderText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  eventCountBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Events container
  eventsContainer: {
    gap: 10,
  },
  
  // Event card
  eventCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
    }),
  },
  colorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 14,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  timeText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  categoryBadge: {
    marginTop: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  removeButton: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Loading state
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  
  // Add more button
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 25,
    borderStyle: 'dashed',
  },
  addMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
});
