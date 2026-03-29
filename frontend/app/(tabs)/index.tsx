// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import colors from '../../src/theme/colors';

export default function HomeScreen() {
  const router = useRouter();

  const quickActions = [
    { id: 'map', label: 'Map', icon: 'map', color: '#2E7D32', route: '/map' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar', color: '#1565C0', route: '/schedule' },
    { id: 'vendors', label: 'Vendors', icon: 'shopping-bag', color: '#EF6C00', route: '/about' },
    { id: 'results', label: 'Results', icon: 'award', color: '#D32F2F', route: '/leaderboard' },
    { id: 'news', label: 'News', icon: 'file-text', color: '#00796B', route: '/about' },
    { id: 'tickets', label: 'Tickets', icon: 'tag', color: '#C2185B', route: '/about' },
    { id: 'parking', label: 'Parking', icon: 'truck', color: '#455A64', route: '/map' },
    { id: 'gallery', label: 'Photos', icon: 'image', color: '#512DA8', route: '/about' },
    { id: 'info', label: 'Info', icon: 'info', color: '#388E3C', route: '/about' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>IPM 2026</Text>
        <Text style={styles.headerSubtitle}>International Plowing Match</Text>
      </View>

      <View style={styles.grid}>
        {quickActions.map((action) => (
          <TouchableOpacity 
            key={action.id}
            style={styles.actionCard}
            onPress={() => router.push(action.route)}
          >
            <View style={[styles.iconCircle, { backgroundColor: action.color }]}>
              <Feather name={action.icon as any} size={22} color="white" />
            </View>
            <Text style={styles.actionLabel} numberOfLines={1}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Welcome to Walkerton</Text>
        <Text style={styles.statusText}>The 2026 Rural Expo is officially underway. Tap a tile above to begin.</Text>
      </View>

      <View style={styles.footerSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 12, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: colors.primary },
  headerSubtitle: { fontSize: 14, color: colors.textSecondary, textTransform: 'uppercase' },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    paddingHorizontal: 4
  },
  actionCard: {
    width: '31%',
    backgroundColor: colors.surface,
    aspectRatio: 1,
    borderRadius: 15,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 8 
  },
  actionLabel: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: colors.text,
    textAlign: 'center'
  },
  statusCard: { 
    marginVertical: 10, 
    padding: 16, 
    backgroundColor: colors.surface, 
    borderRadius: 12, 
    borderLeftWidth: 5, 
    borderLeftColor: colors.primary 
  },
  statusTitle: { fontWeight: 'bold', fontSize: 16, color: colors.text },
  statusText: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  footerSpacer: { height: 80 }
});
