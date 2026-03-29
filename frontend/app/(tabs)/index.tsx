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

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();

  // This list is pulled directly from your uploaded screenshot
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
      
      {/* Top Ad Banner */}
      <TouchableOpacity style={styles.topAdBanner}>
        <Text style={styles.adText}>SPONSOR SPOTLIGHT (320x80) - CLICK HERE</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Quick Actions</Text>

      {/* 3x3 Grid of Buttons */}
      <View style={styles.grid}>
        {quickActions.map((action) => (
          <TouchableOpacity 
            key={action.id}
            style={[
              styles.actionCard, 
              action.isOutline && { borderWidth: 1.5, borderColor: action.color, elevation: 0, shadowOpacity: 0 }
            ]}
            onPress={() => {
                if(action.id === 'map') router.push('/map');
                if(action.id === 'schedule') router.push('/schedule');
            }}
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
        <TouchableOpacity onPress={() => router.push('/schedule')}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {/* The Pill-Shaped Event Card */}
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={() => router.push('/schedule')}
      >
        <View style={styles.eventIconCircle}>
          <MaterialCommunityIcons name="truck-outline" size={22} color="white" />
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>Horse Plowing Demonstration</Text>
          <Text style={styles.eventSubTitle}>Horse Plowing Arena</Text>
          <Text style={styles.eventTime}>
            1:00 PM - 2:30 PM • <Text style={styles.timeHighlight}>in 0m</Text>
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color="#CCC" />
      </TouchableOpacity>

      {/* Bottom Ad Banner */}
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
    backgroundColor: '#F9F9F9',
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
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
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconWrapper: {
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  comingUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  seeAllText: {
    color: '#DAA520',
    fontWeight: 'bold',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 50,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  eventIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B8E23',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventSubTitle: {
    fontSize: 12,
    color: '#666',
  },
  eventTime: {
    fontSize: 11,
    color: '#999',
  },
  timeHighlight: {
    color: '#DAA520',
    fontWeight: 'bold',
  },
  bottomAdBanner: {
    backgroundColor: '#A52A2A',
    width: '100%',
    height: 55,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  adText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  footerSpacer: {
    height: 80,
  },
});
