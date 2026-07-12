import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { getFavorites, toggleFavorite } from '../../src/utils/favoritesStorage';
import CachedDataBanner from '../../src/components/CachedDataBanner';
import { attendeePageContent } from '../../src/theme/attendeePageLayout';
import {
  CachedApiSource,
  CachedApiResult,
  ScheduleEvent,
  ScheduleResponse,
  getScheduleData,
} from '../../src/services/spreadsheetDataService';

export default function ItineraryScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<CachedApiSource>('network');
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<string | null>(null);

  const applyScheduleResult = useCallback((result: CachedApiResult<ScheduleResponse>) => {
    setEvents(result.data.events || []);
    setDataSource(result.source);
    setLastSuccessfulUpdate(result.lastSuccessfulUpdate);
  }, []);

  const loadFavorites = useCallback(async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getScheduleData({ onBackgroundRefresh: applyScheduleResult });
      applyScheduleResult(result);
    } catch {
      setError('Unable to load itinerary.');
    } finally {
      setLoading(false);
    }
  }, [applyScheduleResult]);

  useEffect(() => {
    loadFavorites();
    fetchSchedule();
  }, [fetchSchedule, loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const starredEvents = events.filter((event) => favorites.includes(event.id));

  const handleRemove = async (eventId: string) => {
    const result = await toggleFavorite(eventId);
    setFavorites(result.favorites);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, attendeePageContent]}>
        <PageHeader title="My Itinerary" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B1538" />
          <Text style={styles.helperText}>
            {'Preparing your event experience...\n\nLoading the latest IPM information.\nThis may take a few moments the first time you open the app.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, attendeePageContent]}>
        <PageHeader title="My Itinerary" />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.helperText}>Please try again later.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, attendeePageContent]}>
      <PageHeader title="My Itinerary" />
      <View style={styles.header}>
        <Text style={styles.title}>My Itinerary</Text>
        <Text style={styles.subtitle}>
          {starredEvents.length} starred event{starredEvents.length === 1 ? '' : 's'}
        </Text>
      </View>

      {dataSource === 'cache' && (
        <CachedDataBanner lastSuccessfulUpdate={lastSuccessfulUpdate} />
      )}

      <FlatList
        data={starredEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push('/schedule')}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardText}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventTime}>
                  {formatDate(item.start_date)} | {item.start_time} - {item.end_time}
                </Text>
              </View>

              <TouchableOpacity onPress={() => handleRemove(item.id)}>
                <Feather name="star" size={22} color="#FBC02D" />
              </TouchableOpacity>
            </View>

            {item.location_name ? (
              <Text style={styles.meta}>Location: {item.location_name}</Text>
            ) : null}

            {item.category ? (
              <Text style={styles.meta}>Category: {item.category}</Text>
            ) : null}

            {item.description ? (
              <Text style={styles.description} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Feather name="star" size={42} color="#FBC02D" />
            <Text style={styles.emptyTitle}>Build Your Personal Schedule</Text>
            <Text style={styles.helperText}>
              Save the events you don't want to miss.
            </Text>
            <Text style={styles.helperText}>
              Browse the Schedule and tap the star on any event to add it to your personal itinerary.
            </Text>
            <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/schedule')}>
              <Feather name="calendar" size={17} color="#FFFFFF" />
              <Text style={styles.browseButtonText}>Browse Schedule</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <View style={styles.pageHeader}>
      <Text style={styles.pageHeaderTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4ED',
  },
  pageHeader: {
    minHeight: 52,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F7F4ED',
  },
  pageHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  cardText: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  meta: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 6,
    lineHeight: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  helperText: {
    marginTop: 10,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#B91C1C',
    textAlign: 'center',
  },
  browseButton: {
    marginTop: 16,
    backgroundColor: '#8B1538',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
