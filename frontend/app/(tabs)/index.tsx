// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../../src/theme/colors';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();

  // The Exact 9-Button Grid from your screenshot
  const quickActions = [
    { id: 'map', label: 'Map', icon: 'map', color: '#A52A2A', type: 'feather' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar', color: '#DAA520', type: 'feather' },
    { id: 'vendors', label: 'Vendors', icon: 'shopping-bag', color: '#B8860B', type: 'feather' },
    { id: 'tickets', label: 'Tickets', icon: 'credit-card', color: '#A52A2A', type: 'feather' },
    { id: 'camping', label: 'Camping', icon: 'weather-sunny', color: '#556B2F', type: 'material' },
    { id: 'souvenirs', label: 'Souvenirs', icon: 'gift', color: '#8B008B', type: 'feather' },
    { id: 'itinerary', label: 'Itinerary', icon: 'clipboard', color: '#20B2AA', type: 'feather' },
    { id: 'sos', label: 'SOS', icon: 'alert-triangle', color: '#D32F2F', type: 'feather', isOutline: true },
    { id: 'alerts', label: 'Alerts (2)', icon: 'bell', color: '#FF4500', type: 'feather', isOutline: true },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Sponsor Spotlight Ad */}
      <TouchableOpacity style={styles.topAdBanner}>
        <Text style={styles.adText}>SPONSOR SPOTLIGHT (320x80) - CLICK HERE</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Quick Actions</Text>

      {/* 3x3 Grid */}
      <View style={styles.grid}>
        {quickActions.map((action) => (
          <TouchableOpacity 
            key={action.id}
            style={[
              styles.actionCard, 
              action.isOutline && { borderWidth: 1.5, borderColor: action.color, elevation: 0 }
            ]}
            onPress={() => {}}
          >
            <View style={styles.iconWrapper}>
              {action.type === 'feather' ? (
                <Feather name={action.icon as any} size={24} color={action.color} />
              ) : (
                <MaterialCommunityIcons name={action.icon as any} size={26} color={action.color} />
              )}
            </View>
            <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Coming Up Section */}
      <View style={styles.comingUpHeader}>
        <Text style={styles.sectionTitle}>Coming Up</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      {/* Horse Plowing Demonstration Pill-Card */}
      <TouchableOpacity style={styles.eventCard}>
        <View style={styles.eventIconCircle}>
          <MaterialCommunityIcons name="truck-outline" size={22} color="white" />
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitleText}>Horse Plowing Demonstration</Text>
          <Text style={styles.eventSubText}>Horse Plowing Arena</Text>
          <Text style={styles.eventTimeText}>
            1:00 PM - 2:30 PM • <Text style={styles.timeHighlight}>in 0m</Text>
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color="#CCC" />
      </TouchableOpacity>

      {/* Official Souvenirs Ad */}
      <TouchableOpacity style={styles.bottomAdBanner}>
        <Text style={styles.adText}>OFFICIAL SOUVENIRS (320x50) - CLICK HERE</Text>
      </TouchableOpacity>

      <View style={styles.footerSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFDFD',
  },
  content: {
    padding: 16,
    paddingTop: 50,
  },
  topAdBanner: {
    backgroundColor: '#A52A2A',
    width: '100%',
    height: 85,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#444',
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: 'white',
    borderRadius: 15,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for standard cards
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  iconWrapper: {
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  comingUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  seeAll: {
    color: '#DAA520',
    fontWeight: 'bold
