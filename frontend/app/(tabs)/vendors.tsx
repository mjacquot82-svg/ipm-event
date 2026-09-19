import { findTentedCityPlaceByIdentity } from '../../src/config/tentedCitySearch';
import { tentedCityVendors } from '../../src/data/tentedCityVendors';
import { VendorTutorialTarget, VendorTutorialUnavailable } from '../../src/components/VendorTutorial';
import { ContextualHelpButton, useWalkthroughPreview } from '../../src/components/MapEducation';
import { vendorMapTipEligible } from '../../src/services/mapEducationEligibility';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EDUCATION_KEYS } from '../../src/services/mapEducationState';
import CachedDataBanner from '../../src/components/CachedDataBanner';
import { AttendeeAttribution } from '../../src/components/AttendeeAttribution';
import {
  ATTENDEE_HORIZONTAL_MARGIN,
  ATTENDEE_CARD_RADIUS,
  attendeePageContent,
  useAttendeeLayout,
} from '../../src/theme/attendeePageLayout';
import {
  CachedApiSource,
  CachedApiResult,
  Vendor,
  VendorsResponse,
  getVendorsData,
} from '../../src/services/spreadsheetDataService';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { queueAnalyticsEvent } from '../../src/analytics/analyticsClient';
import { buildSearchAnalyticsProperties } from '../../src/analytics/analyticsCore';
import { resolveVendorMapQuery, vendorMatchesSearch } from '../../src/config/vendorMapCrosswalk';
import { EXACT_MAP_UNAVAILABLE, vendorHasTrustedMapGeometry, vendorHasTrustedMapGeometryAt } from '../../src/config/mapAvailability';
import { groupVendorsForAttendees, vendorGroupMatchesSearch, type AttendeeVendorGroup } from '../../src/config/vendorPresentation';

export default function VendorsScreen() {
  const [showVendorHelp, setShowVendorHelp] = useState(false);
  const [tutorialVendorId, setTutorialVendorId] = useState<string | null>(null);
  const [tutorialNotice, setTutorialNotice] = useState('');
  const list = useRef<FlatList<AttendeeVendorGroup>>(null);
  const visibleVendors = useRef<string[]>([]);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: AttendeeVendorGroup; isViewable: boolean }> }) => {
    visibleVendors.current = viewableItems.filter(entry => entry.isViewable).flatMap(entry => entry.item.locations.map(({ record }) => record.id));
  }).current;
  const startVendorTutorial = () => {
    setTutorialVendorId(null);
    setTutorialNotice('');
    setShowVendorHelp(true);
  };
  const walkthroughPreview = useWalkthroughPreview();
  const previewStarted = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void AsyncStorage.getItem(EDUCATION_KEYS.vendorFindOnMapTipSeen).then(seen => {
      if (active && (seen !== 'true' || (walkthroughPreview && !previewStarted.current))) {
        previewStarted.current = true;
        startVendorTutorial();
      }
    }).catch(() => {});
    return () => { active = false; setShowVendorHelp(false); setTutorialVendorId(null); };
  }, [walkthroughPreview]));
  const finishVendorTutorial = () => {
    void AsyncStorage.setItem(EDUCATION_KEYS.vendorFindOnMapTipSeen, 'true').catch(() => {});
    setShowVendorHelp(false);
    setTutorialVendorId(null);
  };
  usePageAnalytics('vendors', 'home_quick_action', 'vendor_directory_opened');
  const router = useRouter();
  const { frameStyle, sectionStyle } = useAttendeeLayout();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<CachedApiSource>('network');
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const applyVendorsResult = useCallback((result: CachedApiResult<VendorsResponse>) => {
    if (!Array.isArray(result.data.vendors)) {
      throw new Error('Invalid vendors response');
    }
    setVendors(result.data.vendors);
    setDataSource(result.source);
    setLastSuccessfulUpdate(result.lastSuccessfulUpdate);
  }, []);

  const fetchVendors = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await getVendorsData({
        onBackgroundRefresh: applyVendorsResult,
        onBackgroundRefreshError: () => setDataSource('cache'),
      });
      applyVendorsResult(result);
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError("We couldn't load vendor information. Please check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyVendorsResult]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const vendorTypes = useMemo(() => {
    return Array.from(
      new Set(vendors.map((vendor) => vendor.type).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const attendeeGroups = useMemo(() => groupVendorsForAttendees(vendors), [vendors]);

  const filteredVendors = useMemo(() => {
    return attendeeGroups.filter((group) => {
      if (selectedType && !group.locations.some(({ record }) => record.type === selectedType)) {
        return false;
      }
      return vendorGroupMatchesSearch(group, searchQuery, vendorMatchesSearch);
    });
  }, [attendeeGroups, searchQuery, selectedType]);

  const hasActiveFilters = Boolean(searchQuery.trim() || selectedType);
  const mappedVendors = useMemo(() => vendors.filter(vendor => vendorMapTipEligible(vendor.name, vendor.location)), [vendors]);
  useEffect(() => {
    if (!showVendorHelp || loading) return;
    const candidates = filteredVendors.flatMap(group => group.locations.map(({ record }) => record)).filter(vendor => mappedVendors.some(mapped => mapped.id === vendor.id));
    if (candidates.some(vendor => vendor.id === tutorialVendorId)) return;
    if (candidates.length) {
      setTutorialVendorId((candidates.find(vendor => visibleVendors.current.includes(vendor.id)) || candidates[0]).id);
    } else if (mappedVendors.length) {
      setSearchQuery('');
      setSelectedType(null);
      setTutorialNotice('Showing a mapped vendor from all vendors.');
      setTutorialVendorId(mappedVendors[0].id);
    } else setTutorialVendorId(null);
  }, [showVendorHelp, loading, filteredVendors, mappedVendors, tutorialVendorId]);

  const revealTutorialVendor = () => {
    if (!showVendorHelp || !tutorialVendorId) return;
    const index = filteredVendors.findIndex(group => group.locations.some(({ record }) => record.id === tutorialVendorId));
    if (index >= 0) list.current?.scrollToIndex({ index, viewPosition: 0.3, animated: false });
  };
  useEffect(() => {
    if (!showVendorHelp || !tutorialVendorId || loading) return;
    const timer = setTimeout(revealTutorialVendor, 150);
    return () => clearTimeout(timer);
  }, [showVendorHelp, tutorialVendorId, loading, filteredVendors]);

  const openVendorOnMap = (vendor: Vendor, walkthrough = false) => {
    if (walkthrough) finishVendorTutorial();
    const exact = findTentedCityPlaceByIdentity(vendor.name, vendor.location, tentedCityVendors, vendor.type);
    const resolved = resolveVendorMapQuery(vendor.name, vendor.location);
    router.push({ pathname: '/(tabs)/map', params: {
      location: exact ? vendor.location : resolved.status === 'mapped' ? resolved.query : vendor.location,
      ...(exact ? { vendorName: vendor.name, vendorLocation: vendor.location, vendorType: vendor.type } : {}),
      showOnly: 'true', source: 'vendors', mapType: 'tented',
      ...(walkthrough ? { vendorWalkthrough: String(Date.now()), vendorTutorialName: exact ? vendor.name : resolved.status === 'mapped' ? resolved.query : vendor.name } : {}),
    }});
  };

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) return undefined;
    const timer = setTimeout(() => {
      void queueAnalyticsEvent('vendor_search_used', buildSearchAnalyticsProperties(query, filteredVendors.length));
    }, 700);
    return () => clearTimeout(timer);
  }, [filteredVendors.length, searchQuery]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, attendeePageContent, frameStyle]}>
        <PageHeader title="Vendors" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B1538" />
          <Text style={styles.helperText}>
            Loading vendors…
          </Text>
        </View>
        <AttendeeAttribution source="vendors_attribution" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, attendeePageContent, frameStyle]}>
        <PageHeader title="Vendors" />
        <View style={styles.center}>
          <Feather name="wifi-off" size={42} color="#B91C1C" />
          <Text style={styles.emptyTitle}>Vendors could not be loaded</Text>
          <Text style={styles.helperText}>
            Check your connection and try again. If the problem continues, vendor listings may be temporarily unavailable.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => fetchVendors()} activeOpacity={0.8}>
            <Feather name="refresh-cw" size={17} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
        <AttendeeAttribution source="vendors_attribution" />
      </View>
    );
  }

  const listHeader = (
    <View style={frameStyle}>
      <PageHeader title="Vendors" />
      <View style={styles.header}>
        <Text style={styles.title}>Vendors</Text>
        <ContextualHelpButton label="Vendors Help" onPress={startVendorTutorial} />
        <Text style={styles.subtitle}>
          {hasActiveFilters
            ? `${filteredVendors.length} of ${attendeeGroups.length} exhibitors`
            : `${attendeeGroups.length} exhibitors`}
        </Text>
      </View>

      {dataSource === 'cache' && (
        <CachedDataBanner lastSuccessfulUpdate={lastSuccessfulUpdate} />
      )}

      <View style={styles.filterPanel}>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color="#6B7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search vendors"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Feather name="x" size={18} color="#6B7280" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeFilterScroll}
        >
          <TouchableOpacity
            style={[styles.typeChip, !selectedType && styles.typeChipActive]}
            onPress={() => { setSelectedType(null); void queueAnalyticsEvent('vendor_filter_used', { filter_value: 'all' }); }}
          >
            <Feather name="list" size={14} color={!selectedType ? '#FFFFFF' : '#4B5563'} />
            <Text style={[styles.typeChipText, !selectedType && styles.typeChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {vendorTypes.map((type) => {
            const isActive = selectedType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, isActive && styles.typeChipActive]}
                onPress={() => {
                  setSelectedType(isActive ? null : type);
                  const normalized = type.toLowerCase();
                  const filterValue = normalized.includes('food') ? 'food' : normalized.includes('indoor') ? 'indoor' : normalized.includes('outdoor') ? 'outdoor' : 'all';
                  void queueAnalyticsEvent('vendor_filter_used', { filter_value: filterValue });
                }}
              >
                <Feather name="tag" size={14} color={isActive ? '#FFFFFF' : '#4B5563'} />
                <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Feather name="x-circle" size={16} color="#8B1538" />
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {showVendorHelp && mappedVendors.length === 0 ? <VendorTutorialUnavailable onSkip={finishVendorTutorial} /> : null}
      <FlatList
        ref={list}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={({ averageItemLength, index }) => {
          list.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
          setTimeout(revealTutorialVendor, 300);
        }}
        style={styles.content}
        data={filteredVendors}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchVendors(true)} />
        }
        ListFooterComponent={<AttendeeAttribution source="vendors_attribution" />}
        renderItem={({ item }: { item: AttendeeVendorGroup }) => (
          <View style={sectionStyle}>
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              {item.locations.length > 1 ? <Text style={styles.meta}>{item.locations.length} locations</Text> : null}
              {item.locations.map(({ record, displayLocation, mapLocation }) => {
                const resolved = resolveVendorMapQuery(record.name, mapLocation);
                const hasMap = Boolean(mapLocation?.trim() && (vendorHasTrustedMapGeometryAt(record.name, mapLocation) || (item.locations.length === 1 && (vendorHasTrustedMapGeometry(record.name) || resolved.status === 'mapped'))));
                return (
                  <View key={record.id} style={item.locations.length > 1 ? styles.locationBlock : undefined}>
                    {item.locations.length > 1 ? <Text style={styles.locationHeading}>{record.type}</Text> : null}
                    {item.locations.length === 1 && record.type ? <Text style={styles.meta}>Type: {record.type}</Text> : null}
                    {displayLocation ? <Text style={styles.meta}>{item.locations.length > 1 ? displayLocation : `Location: ${displayLocation}`}</Text> : null}
                    {record.hours_of_operation ? <Text style={styles.meta}>Hours: {record.hours_of_operation}</Text> : null}
                    {record.days_of_operation ? <Text style={styles.meta}>Days: {record.days_of_operation}</Text> : null}
                    {mapLocation?.trim() && !hasMap ? (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(tabs)/map', params: { mapStatus: 'unavailable', source: 'vendors', mapType: 'tented' } })}
                      >
                        <Text style={styles.meta}>{EXACT_MAP_UNAVAILABLE}</Text>
                      </TouchableOpacity>
                    ) : <VendorTutorialTarget active={showVendorHelp && tutorialVendorId === record.id}
                      style={styles.mapLink} notice={tutorialNotice} onSkip={finishVendorTutorial}
                      onOpen={() => openVendorOnMap(record, showVendorHelp && tutorialVendorId === record.id)}>
                      <Feather name="map-pin" size={16} color="#8B1538" />
                      <Text style={styles.mapLinkText}>Find on Map</Text>
                    </VendorTutorialTarget>}
                  </View>
                );
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={sectionStyle}>
            <View style={styles.center}>
              <Feather name="shopping-bag" size={42} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>
                {hasActiveFilters ? 'No Matching Vendors' : 'Vendors'}
              </Text>
              <Text style={styles.helperText}>
                {hasActiveFilters
                  ? 'Clear filters or try a different search.'
                  : "Vendor information hasn't been published yet."}
              </Text>
              {!hasActiveFilters && (
                <Text style={styles.helperText}>
                  Please check back closer to the event.
                </Text>
              )}
            </View>
          </View>
        }
      />
    </View>
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
    paddingHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
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
    paddingHorizontal: ATTENDEE_HORIZONTAL_MARGIN,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 10,
  },
  clearSearchButton: {
    padding: 4,
  },
  typeFilterScroll: {
    gap: 8,
    paddingRight: 16,
  },
  typeChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  typeChipActive: {
    backgroundColor: '#8B1538',
    borderColor: '#8B1538',
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  typeChipTextActive: {
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
    color: '#8B1538',
  },
  list: {
    paddingTop: 4,
    paddingBottom: 88,
  },
  content: {
    flex: 1,
    alignSelf: 'stretch',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ATTENDEE_CARD_RADIUS,
    padding: 16,
    marginBottom: 12,
  },
  mapLink: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B1538',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  locationBlock: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 10,
    paddingTop: 10,
  },
  locationHeading: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
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
  primaryButton: {
    marginTop: 18,
    backgroundColor: '#8B1538',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#8B1538',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#8B1538',
    fontWeight: '700',
  },
});
