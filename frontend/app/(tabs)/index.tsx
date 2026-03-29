// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../../src/theme/colors';

export default function HomeScreen() {
  const router = useRouter();

  const quickActions = [
    { id: 'map', label: 'Map', icon: 'map', color: '#A52A2A', type: 'feather' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar', color: '#DAA520', type: 'feather' },
    { id: 'vendors', label: 'Vendors', icon: 'shopping-bag', color: '#B8860B', type: 'feather' },
    { id: 'tickets', label: 'Tickets', icon: 'credit-card', color: '#A52A2A', type: 'feather' },
    { id: 'camping', label: 'Camping', icon: 'weather-sunny', color: '#556B2F', type: 'material' },
    { id: 'souvenirs', label: 'Souvenirs', icon: 'gift', color: '#8B008B', type: 'feather' },
    { id: 'itinerary', label: 'Itinerary', icon: 'clipboard', color: '#20B2AA', type: 'feather' },
    { id: 'sos', label: 'SOS', icon: 'alert-triangle', color: '#D32F2F', type: 'feather', outline: true },
    { id: 'alerts', label: 'Alerts (2)', icon: 'bell', color: '#FF4500', type: 'feather', outline: true },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Sponsor Ad */}
      <View style={styles.sponsorBanner}>
        <Text style={styles.adText}>SPONSOR SPOTLIGHT (320x80) - CLICK HERE</Text>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <View style={styles.grid}>
        {quickActions.map((action) => (
          <TouchableOpacity 
            key={action.id}
            style={[styles.actionCard, action.outline && { borderColor: action.color, borderWidth: 1 }]}
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

      <View style={styles.comingUpHeader}>
        <Text style={styles.sectionTitle}>Coming Up</Text>
        <Text style={styles.seeAll}>See All</Text>
      </View>

      {/* Horse Plowing Demo Card */}
      <View style={styles.eventCard}>
        <View style={[styles.eventIcon, { backgroundColor: '#6B8E23' }]}>
          <Feather name="truck" size={20} color="white" />
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>Horse Plowing Demonstration</Text>
          <Text style={styles.eventLocation}>Horse Plowing Arena</Text>
          <Text style={styles.eventTime}>1:00 PM - 2:30 PM • <Text style={{color: '#DAA520'}}>in 0m</Text></Text>
        </View>
        <Feather name="chevron-right" size={20} color="#CCC" />
      </View>

      {/* Bottom Ad */}
      <View style={[styles.sponsorBanner, styles.bottomAd]}>
        <Text style={styles.adText}>OFFICIAL SOUVENIRS (320x50) - CLICK HERE</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  content: { padding: 16, paddingTop: 40 },
  sponsorBanner: {
    backgroundColor: '#A52A2A',
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  bottomAd: { height: 50, marginTop: 20 },
  adText: { color: 'white', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#444', marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: {
    width: '31%',
    backgroundColor: 'white',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  iconWrapper: { marginBottom: 8 },
  actionLabel: { fontSize: 10, fontWeight: '600' },
  comingUpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  seeAll: { color: '#DAA520', fontWeight: 'bold' },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 50, // pill shape from image
    alignItems: 'center',
    elevation: 2,
  },
  eventIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  eventLocation: { fontSize: 12, color: '#666' },
  eventTime: { fontSize: 11, color: '#999' },
});
