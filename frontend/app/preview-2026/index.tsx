import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Stack } from 'expo-router';
import colors from '../../src/theme/colors'; // Adjust path if your theme is elsewhere

export default function IPM2026Preview() {
  return (
    <View style={styles.container}>
      {/* This ensures the top bar says IPM 2026 */}
      <Stack.Screen options={{ title: 'IPM 2026 Preview', headerShown: true }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>International Plowing Match</Text>
          <Text style={styles.subtitle}>Rural Expo 2026 - Ontario</Text>
        </View>

        {/* Interactive Map Placeholder */}
        <View style={styles.mapContainer}>
          <Text style={styles.mapText}>[ Interactive Map Loading... ]</Text>
          {/* Once you're ready, you'll drop your MapView component here */}
        </View>

        {/* Quick Actions */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Vendors</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to the Future of IPM</Text>
          <Text style={styles.cardBody}>
            This PWA is designed to help you navigate the 2026 Match with ease. 
            Check back for live updates on field locations and competitions.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 20 },
  header: { marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 16, color: '#666' },
  mapContainer: { 
    height: 300, 
    backgroundColor: '#e0e0e0', 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  mapText: { color: '#888', fontWeight: '500' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  button: { 
    backgroundColor: '#000', 
    padding: 15, 
    borderRadius: 10, 
    width: '48%', 
    alignItems: 'center' 
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  cardBody: { fontSize: 14, color: '#444', lineHeight: 20 }
});
