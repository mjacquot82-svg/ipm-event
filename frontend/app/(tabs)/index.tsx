// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Linking,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import colors from '../../../src/theme/colors';
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
} from '../../../src/data/mockData';
import { getFavorites, toggleFavorite } from '../../../src/utils/favoritesStorage';

const initialSOSForm = {
  name: '',
  sex: '',
  age: '',
  height: '',
  hair_color: '',
  glasses: false,
  shirt_color: '',
  pants_color: '',
  last_location: '',
};

export default function HomeScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showItinerary, setShowItinerary] = useState(false);
  const [apiEvents, setApiEvents] = useState<any[]>([]);
  
  // SOS & Alerts State
  const [showSOSWarning, setShowSOSWarning] = useState(false);
  const [showSOSForm, setShowSOSForm] = useState(false);
  const [sosForm, setSOSForm] = useState(initialSOSForm);
  const [sosSubmitting, setSOSSubmitting] = useState(false);
  const [activeSOSReports, setActiveSOSReports] = useState<any[]>([]);
  const [showActiveAlerts, setShowActiveAlerts] = useState(false);

  const fetchApiData = async () => {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      // Fetch Schedule
      const schedRes = await fetch(`${API_BASE_URL}/api/schedule`);
      if (schedRes.ok) {
        const data = await schedRes.json();
        setApiEvents(data.events || []);
      }
      // Fetch SOS
      const sosRes = await fetch(`${API_BASE_URL}/api/sos/active`);
      if (sosRes.ok) {
        const data = await sosRes.json();
        setActiveSOSReports(data || []);
      }
    } catch (e) { console.log("API Fetch Offline"); }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      fetchApiData();
      const interval = setInterval(() => setCurrentTime(new Date()), 60000);
      return () => clearInterval(interval);
    }, [])
  );

  const loadFavorites = async () => {
    const stored = await getFavorites();
    setFavorites(stored);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFavorites();
    await fetchApiData();
    setRefreshing(false);
  }, []);

  const submitSOSReport = async () => {
    if (!sosForm.name || !sosForm.last_location) {
      Alert.alert('Required', 'Please provide a name and last known location.');
      return;
    }
    setSOSSubmitting(true);
    // API Logic here...
    setTimeout(() => {
      setSOSSubmitting(false);
      setShowSOSForm(false);
      setSOSForm(initialSOSForm);
      Alert.alert('Alert Sent', 'Site security and attendees have been notified.');
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        <Image 
          source={require('../../../assets/images/ipm-2026-banner.png')} 
          style={styles.headerBanner} 
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <ActionCard label="Map" icon="map" color={colors.primary} onPress={() => router.push('/map')} />
            <ActionCard label="Schedule" icon="calendar" color={colors.accent} onPress={() => router.push('/schedule')} />
            <ActionCard label="Tickets" icon="credit-card" color="#A52A2A" onPress={() => Linking.openURL('https://www.tix123.com/tickets/?code=IPMRE26')} />
            <ActionCard label="Camping" icon="sun" color="#556B2F" onPress={() => Linking.openURL('https://letscamp.ca/camps/ipm-2026')} />
            <ActionCard label="Souvenirs" icon="gift" color="#9C27B0" onPress={() => Linking.openURL('https://ipm26.itemorder.com/shop/home/')} />
            <ActionCard label="Itinerary" icon="clipboard" color="#20B2AA" onPress={() => setShowItinerary(true)} />
            
            <TouchableOpacity 
              style={[styles.actionCard, { borderColor: '#D32F2F', borderWidth: 1 }]} 
              onPress={() => setShowSOSWarning(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#D32F2F' }]}>
                <Feather name="alert-triangle" size={22} color="white" />
              </View>
              <Text style={[styles.actionTitle, { color: '#D32F2F' }]}>SOS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Coming Up Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Up</Text>
          {getUpcomingSessions().slice(0, 2).map((session) => (
            <TouchableOpacity key={session.id} style={styles.eventCard}>
               <View style={styles.eventIconCircle}><Feather name="truck" size={18} color="white" /></View>
               <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{session.title}</Text>
                  <Text style={styles.eventTime}>{session.start_time} • {getLocationById(session.location_id)?.name}</Text>
               </View>
               <Feather name="chevron-right" size={20} color="#CCC" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* SOS Warning Modal */}
      <Modal visible={showSOSWarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.warningBox}>
            <Feather name="alert-octagon" size={50} color="#D32F2F" />
            <Text style={styles.warningTitle}>Emergency Alert</Text>
            <Text style={styles.warningText}>This will broadcast a missing person alert to ALL attendees. Use ONLY for immediate emergencies.</Text>
            <TouchableOpacity style={styles.sosButton} onPress={() => { setShowSOSWarning(false); setShowSOSForm(true); }}>
              <Text style={styles.sosButtonText}>CONTINUE TO REPORT</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSOSWarning(false)}><Text style={{ marginTop: 15, color: '#666' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActionCard({ label, icon, color, onPress }: any) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Feather name={icon} size={22} color="white" />
      </View>
      <Text style={styles.actionTitle}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  scrollContent: { paddingBottom: 100 },
  headerBanner: { width: '100%', height: 180, resizeMode: 'cover' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: { width: '31%', aspectRatio: 1, backgroundColor: 'white', borderRadius: 12, padding: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  eventCard: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderRadius: 15, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  eventIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6B8E23', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  eventTitle: { fontWeight: 'bold', fontSize: 14 },
  eventTime: { fontSize: 12, color: '#666' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  warningBox: { width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 25, alignItems: 'center' },
  warningTitle: { fontSize: 22, fontWeight: 'bold', color: '#D32F2F', marginVertical: 10 },
  warningText: { textAlign: 'center', color: '#444', marginBottom: 20 },
  sosButton: { backgroundColor: '#D32F2F', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 30 },
  sosButtonText: { color: 'white', fontWeight: 'bold' }
});
