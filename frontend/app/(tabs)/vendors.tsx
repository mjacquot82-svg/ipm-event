import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import CachedDataBanner from '../../src/components/CachedDataBanner';
import {
  CachedApiSource,
  Vendor,
  getVendorsData,
} from '../../src/services/spreadsheetDataService';

export default function VendorsScreen() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<CachedApiSource>('network');
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getVendorsData();
      if (!Array.isArray(result.data.vendors)) {
        throw new Error('Invalid vendors response');
      }
      setVendors(result.data.vendors);
      setDataSource(result.source);
      setLastSuccessfulUpdate(result.lastSuccessfulUpdate);
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError("We couldn't load vendor information. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const vendorTypes = useMemo(() => {
    return Array.from(
      new Set(vendors.map((vendor) => vendor.type).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return vendors.filter((vendor) => {
      if (selectedType && vendor.type !== selectedType) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        vendor.name,
        vendor.type,
        vendor.location,
        vendor.hours_of_operation,
        vendor.days_of_operation,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [searchQuery, selectedType, vendors]);

  const hasActiveFilters = Boolean(searchQuery.trim() || selectedType);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="Vendors" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B1538" />
          <Text style={styles.helperText}>Loading vendors...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="Vendors" />
        <View style={styles.center}>
          <Feather name="wifi-off" size={42} color="#B91C1C" />
          <Text style={styles.emptyTitle}>Vendors could not be loaded</Text>
          <Text style={styles.helperText}>
            Check your connection and try again. If the problem continues, vendor listings may be temporarily unavailable.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={fetchVendors} activeOpacity={0.8}>
            <Feather name="refresh-cw" size={17} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Vendors" />
      <View style={styles.header}>
        <Text style={styles.title}>Vendors</Text>
        <Text style={styles.subtitle}>
          {hasActiveFilters
            ? `${filteredVendors.length} of ${vendors.length} vendors`
            : `${vendors.length} vendors`}
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
            onPress={() => setSelectedType(null)}
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
                onPress={() => setSelectedType(isActive ? null : type)}
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

      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>

            {item.type ? <Text style={styles.meta}>Type: {item.type}</Text> : null}
            {item.location ? <Text style={styles.meta}>Location: {item.location}</Text> : null}
            {item.hours_of_operation ? (
              <Text style={styles.meta}>Hours: {item.hours_of_operation}</Text>
            ) : null}
            {item.days_of_operation ? (
              <Text style={styles.meta}>Days: {item.days_of_operation}</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
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
  filterPanel: {
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
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
