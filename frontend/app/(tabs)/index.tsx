// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Image,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import colors from '../../src/theme/colors';
import { 
  sessions, 
  locations, 
  getLocationById, 
  getHappeningNow,
  getUpcomingSessions,
  getNextStarredSession,
  getLocationTypeColor,
  getLocationTypeIcon,
  Session,
  eventInfo,
} from '../../src/data/mockData';
import { getFavorites, toggleFavorite } from '../../src/utils/favoritesStorage';

export default function HomeScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showItinerary, setShowItinerary] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      setCurrentTime(new Date());
      
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000);
      
      return () => clearInterval(interval);
    }, [])
  );

  const loadFavorites = async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFavorites();
    setCurrentTime(new Date());
    setRefreshing(false);
  }, []);

  const happeningNow = getHappeningNow();
  const nextStarredSession = getNextStarredSession(favorites);
  const upcomingSessions = getUpcomingSessions().slice(0, 3);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeUntil = (dateString: string): string => {
    const target = new Date(dateString);
    const diff = target.getTime() - currentTime.getTime();
    
    if (diff <= 0) return 'Starting now';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `in ${hours}h ${minutes % 60}m`;
    }
    return `in ${minutes}m`;
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  // Get starred sessions sorted by date
  const getStarredSessions = () => {
    return sessions
      .filter(session => favorites.includes(session.id))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const starredSessions = getStarredSessions();

  // Group starred sessions by date
  const groupedStarredSessions = starredSessions.reduce((acc, session) => {
    const date = new Date(session.start_time).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  const handleRemoveFromItinerary = async (sessionId: string) => {
    const result = await toggleFavorite(sessionId);
    setFavorites(result.favorites);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderSessionCard = (session: Session, showTimeUntil: boolean = false) => {
    const location = getLocationById(session.location_id);
    const typeColor = location ? getLocationTypeColor(location.type) : colors.primary;
    const iconName = location ? getLocationTypeIcon(location.type, location.utilitySubtype, location.fieldSubtype) : 'map-pin';
    
    return (
      <TouchableOpacity 
        key={session.id} 
        style={styles.sessionCardFull}
        onPress={() => router.push('/(tabs)/schedule')}
        activeOpacity={0.8}
      >
        <View style={[styles.sessionIconContainer, { backgroundColor: typeColor }]}>
          {location?.type === 'field' ? (
            <Feather name="truck" size={20} color="#FFFFFF" />
          ) : (
            <Feather name={iconName as any} size={20} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.sessionCardContent}>
          <Text style={styles.sessionCardTitle} numberOfLines={1}>{session.title}</Text>
          {location && (
            <Text style={styles.sessionCardLocation}>{location.name}</Text>
          )}
          <View style={styles.sessionCardTimeRow}>
            <Feather name="clock" size={12} color={colors.textMuted} />
            <Text style={styles.sessionCardTime}>
              {formatTime(session.start_time)} - {formatTime(session.end_time)}
            </Text>
            {showTimeUntil && (
              <Text style={styles.timeUntil}>{getTimeUntil(session.start_time)}</Text>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header Banner Image */}
        <View style={styles.headerBanner}>
          <Image
            source={require('../../assets/images/ipm-2026-banner.png')}
            style={styles.bannerImage}
          />
        </View>

        {/* Happening Now Section */}
        {happeningNow.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderLive}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.sectionTitleLive}>Happening Now</Text>
            </View>
            {happeningNow.map((session) => {
              const location = getLocationById(session.location_id);
              const typeColor = location ? getLocationTypeColor(location.type) : colors.primary;
              
              return (
                <TouchableOpacity 
                  key={session.id} 
                  style={[styles.liveSessionCard, { borderColor: typeColor }]}
                  onPress={() => router.push('/(tabs)/map')}
                  activeOpacity={0.8}
                >
                  <View style={styles.liveSessionContent}>
                    <Text style={styles.liveSessionTitle}>{session.title}</Text>
                    {location && (
                      <View style={styles.liveLocationRow}>
                        <Feather name="map-pin" size={14} color={typeColor} />
                        <Text style={[styles.liveLocationText, { color: typeColor }]}>
                          {location.name}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.liveTimeText}>
                      Until {formatTime(session.end_time)}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.goButton}>
                    <Feather name="navigation" size={18} color={colors.accent} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* My Next Session (Starred) */}
        {nextStarredSession && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.starredHeader}>
                <Feather name="star" size={18} color={colors.accent} />
                <Text style={styles.sectionTitleStarred}>My Next Session</Text>
              </View>
            </View>
            {renderSessionCard(nextStarredSession, true)}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/map')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                <Feather name="map" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Event Map</Text>
              <Text style={styles.actionSubtitle}>Navigate the grounds</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/schedule')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
                <Feather name="calendar" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Schedule</Text>
              <Text style={styles.actionSubtitle}>View all events</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openLink('https://www.tix123.com/tickets/?code=IPMRE26')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.stage }]}>
                <Feather name="credit-card" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Buy Tickets</Text>
              <Text style={styles.actionSubtitle}>Get your passes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openLink('https://letscamp.ca/camps/ipm-2026')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.field }]}>
                <Feather name="sun" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Let's Camp</Text>
              <Text style={styles.actionSubtitle}>Book camping</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openLink('https://ipm26.itemorder.com/shop/home/?fbclid=IwY2xjawQuGmhleHRuA2FlbQIxMABicmlkETE3aUxCemtNREIzNGE4WGh5c3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHrdITwGKjyFPU7v_T2U8wtz5YWVsIsHECguU33ZzpdUAUnr25lMzuUThqcX0_aem_ca4nGCbppwbVWXaXs1BNHg')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.vendor }]}>
                <Feather name="gift" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Souvenirs</Text>
              <Text style={styles.actionSubtitle}>Shop merchandise</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => setShowItinerary(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.utility }]}>
                <Feather name="clipboard" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>My Itinerary</Text>
              <Text style={styles.actionSubtitle}>Your starred events</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Sessions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Coming Up</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingSessions.length > 0 ? (
            upcomingSessions.map((session) => renderSessionCard(session, true))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No upcoming events</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{sessions.length}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {locations.filter((l) => l.type === 'field').length}
              </Text>
              <Text style={styles.statLabel}>Fields</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {locations.filter((l) => l.type === 'vendor').length}
              </Text>
              <Text style={styles.statLabel}>Exhibitors</Text>
            </View>
          </View>
        </View>

        {/* Starred Sessions Banner */}
        {favorites.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.starredBanner}
              onPress={() => router.push('/(tabs)/schedule')}
              activeOpacity={0.8}
            >
              <View style={styles.starredBannerContent}>
                <Feather name="star" size={24} color={colors.accent} />
                <View style={styles.starredBannerText}>
                  <Text style={styles.starredBannerTitle}>
                    {favorites.length} Starred Event{favorites.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.starredBannerSubtitle}>View your personal schedule</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* My Itinerary Modal */}
      <Modal
        visible={showItinerary}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowItinerary(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather name="clipboard" size={24} color={colors.utility} />
                <Text style={styles.modalTitle}>My Itinerary</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowItinerary(false)}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Itinerary Content */}
            <ScrollView 
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {starredSessions.length === 0 ? (
                <View style={styles.emptyItinerary}>
                  <Feather name="star" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyItineraryTitle}>No events planned yet</Text>
                  <Text style={styles.emptyItineraryText}>
                    Star events from the Schedule to add them to your itinerary
                  </Text>
                  <TouchableOpacity 
                    style={styles.browseButton}
                    onPress={() => {
                      setShowItinerary(false);
                      router.push('/(tabs)/schedule');
                    }}
                  >
                    <Text style={styles.browseButtonText}>Browse Schedule</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.itinerarySummary}>
                    {starredSessions.length} event{starredSessions.length > 1 ? 's' : ''} planned
                  </Text>
                  {Object.entries(groupedStarredSessions).map(([date, dateSessions]) => (
                    <View key={date} style={styles.itineraryDateSection}>
                      <Text style={styles.itineraryDateHeader}>{date}</Text>
                      {dateSessions.map((session) => {
                        const location = getLocationById(session.location_id);
                        const typeColor = location ? getLocationTypeColor(location.type) : colors.primary;
                        
                        return (
                          <View key={session.id} style={styles.itineraryCard}>
                            <View style={[styles.itineraryColorBar, { backgroundColor: typeColor }]} />
                            <View style={styles.itineraryCardContent}>
                              <View style={styles.itineraryTimeRow}>
                                <Feather name="clock" size={14} color={colors.textMuted} />
                                <Text style={styles.itineraryTime}>
                                  {formatTime(session.start_time)} - {formatTime(session.end_time)}
                                </Text>
                              </View>
                              <Text style={styles.itineraryTitle}>{session.title}</Text>
                              {location && (
                                <View style={styles.itineraryLocationRow}>
                                  <Feather name="map-pin" size={12} color={typeColor} />
                                  <Text style={[styles.itineraryLocation, { color: typeColor }]}>
                                    {location.name}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <TouchableOpacity 
                              style={styles.removeButton}
                              onPress={() => handleRemoveFromItinerary(session.id)}
                            >
                              <Feather name="x-circle" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                  <View style={styles.itineraryFooter}>
                    <TouchableOpacity 
                      style={styles.addMoreButton}
                      onPress={() => {
                        setShowItinerary(false);
                        router.push('/(tabs)/schedule');
                      }}
                    >
                      <Feather name="plus" size={18} color={colors.accent} />
                      <Text style={styles.addMoreText}>Add more events</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
  scrollContent: {
    paddingTop: 0,
  },
  headerBanner: {
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: 240,
    resizeMode: 'contain',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLive: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(107, 142, 35, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
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
  sectionTitleLive: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  starredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleStarred: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  liveSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 12,
  },
  liveSessionContent: {
    flex: 1,
  },
  liveSessionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  liveLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveLocationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  liveTimeText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  goButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 4,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  sessionCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 50,
    marginBottom: 12,
  },
  sessionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  sessionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  sessionCardLocation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  sessionCardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionCardTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  timeUntil: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
    marginLeft: 8,
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
    borderRadius: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  starredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  starredBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starredBannerText: {
    flex: 1,
  },
  starredBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  starredBannerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  bottomPadding: {
    height: 20,
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
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
    padding: 20,
  },
  emptyItinerary: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyItineraryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyItineraryText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  itinerarySummary: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  itineraryDateSection: {
    marginBottom: 20,
  },
  itineraryDateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itineraryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  itineraryColorBar: {
    width: 4,
  },
  itineraryCardContent: {
    flex: 1,
    padding: 14,
  },
  itineraryTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  itineraryTime: {
    fontSize: 13,
    color: colors.textMuted,
  },
  itineraryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itineraryLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itineraryLocation: {
    fontSize: 13,
    fontWeight: '500',
  },
  removeButton: {
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  itineraryFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 25,
  },
  addMoreText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
