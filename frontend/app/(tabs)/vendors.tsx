// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// VENDORS SCREEN - IPM 2026 Vendor Directory

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';

// Mock vendor data for IPM 2026
const MOCK_VENDORS = [
  {
    id: '1',
    name: 'Ontario Tractor Co.',
    booth: 'A-101',
    description: 'Large Farm Equipment & Tractors',
    category: 'Equipment',
  },
  {
    id: '2',
    name: 'The Pretzel Stand',
    booth: 'B-5',
    description: 'Fresh Pretzels & Snacks',
    category: 'Food',
  },
  {
    id: '3',
    name: 'IPM Official Merch',
    booth: '300',
    description: 'Clothing, Souvenirs & Memorabilia',
    category: 'Retail',
  },
  {
    id: '4',
    name: 'Huron County Seeds',
    booth: 'A-205',
    description: 'Premium Seeds & Crop Solutions',
    category: 'Agriculture',
  },
  {
    id: '5',
    name: 'Farm Fresh Lemonade',
    booth: 'F-12',
    description: 'Ice Cold Drinks & Refreshments',
    category: 'Food',
  },
  {
    id: '6',
    name: 'John Deere Showcase',
    booth: 'A-100',
    description: 'Latest Farming Machinery Demos',
    category: 'Equipment',
  },
  {
    id: '7',
    name: 'Heritage Crafts',
    booth: 'C-45',
    description: 'Handmade Rural Arts & Crafts',
    category: 'Retail',
  },
  {
    id: '8',
    name: 'BBQ Pit Masters',
    booth: 'F-20',
    description: 'Smoked Meats & BBQ Platters',
    category: 'Food',
  },
  {
    id: '9',
    name: 'AgriTech Solutions',
    booth: 'A-310',
    description: 'Smart Farming Technology',
    category: 'Technology',
  },
  {
    id: '10',
    name: 'The Fudge Factory',
    booth: 'B-8',
    description: 'Homemade Fudge & Sweet Treats',
    category: 'Food',
  },
  {
    id: '11',
    name: 'Rural Insurance Group',
    booth: 'C-102',
    description: 'Farm & Property Insurance',
    category: 'Services',
  },
  {
    id: '12',
    name: 'Livestock Supplies Ltd.',
    booth: 'A-250',
    description: 'Animal Feed & Care Products',
    category: 'Agriculture',
  },
  {
    id: '13',
    name: 'Country Kitchen',
    booth: 'F-15',
    description: 'Home-style Meals & Pies',
    category: 'Food',
  },
  {
    id: '14',
    name: 'Solar Farm Systems',
    booth: 'A-320',
    description: 'Renewable Energy for Farms',
    category: 'Technology',
  },
  {
    id: '15',
    name: 'Boots & Saddles',
    booth: 'C-60',
    description: 'Western Wear & Riding Gear',
    category: 'Retail',
  },
];

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  'Equipment': '#2196F3',
  'Food': '#FF9800',
  'Retail': '#9C27B0',
  'Agriculture': '#4CAF50',
  'Technology': '#00BCD4',
  'Services': '#607D8B',
};

export default function VendorsScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter vendors based on search query
  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_VENDORS;
    
    const query = searchQuery.toLowerCase().trim();
    return MOCK_VENDORS.filter(vendor => 
      vendor.name.toLowerCase().includes(query) ||
      vendor.booth.toLowerCase().includes(query) ||
      vendor.description.toLowerCase().includes(query) ||
      vendor.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Vendors</Text>
        <Text style={styles.headerSubtitle}>IPM 2026 Vendor Directory</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or booth..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredVendors.length} {filteredVendors.length === 1 ? 'vendor' : 'vendors'} found
        </Text>
      </View>

      {/* Vendor List */}
      <ScrollView 
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredVendors.length > 0 ? (
          filteredVendors.map((vendor) => (
            <TouchableOpacity 
              key={vendor.id} 
              style={styles.vendorCard}
              activeOpacity={0.7}
            >
              <View style={styles.vendorHeader}>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName}>{vendor.name}</Text>
                  <View style={styles.boothContainer}>
                    <Feather name="map-pin" size={14} color={colors.primary} />
                    <Text style={styles.boothText}>Booth {vendor.booth}</Text>
                  </View>
                </View>
                <View style={[
                  styles.categoryBadge, 
                  { backgroundColor: CATEGORY_COLORS[vendor.category] || colors.primary }
                ]}>
                  <Text style={styles.categoryText}>{vendor.category}</Text>
                </View>
              </View>
              <Text style={styles.vendorDescription}>{vendor.description}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No vendors found</Text>
            <Text style={styles.emptySubtitle}>Try a different search term</Text>
          </View>
        )}
        
        {/* Bottom spacing for tab bar */}
        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: colors.textPrimary,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  resultsCount: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  vendorCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
      } as any,
    }),
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  vendorInfo: {
    flex: 1,
    marginRight: 12,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  boothContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boothText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  vendorDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
});
