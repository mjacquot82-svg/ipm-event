// © 2026 1001538341 ONTARIO INC.
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking, 
  Image 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header / Banner Area */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>IPM 2026</Text>
        <Text style={styles.subText}>International Plowing Match</Text>
      </ScrollView>

      {/* The 3x3 Quick Actions Grid */}
      <View style={styles.grid}>
        <GridItem 
          label="Map" 
          icon="map" 
          color="#2E7D32" 
          onPress={() => router.push('/map')} 
        />
        <GridItem 
          label="Schedule" 
          icon="calendar" 
          color="#1976D2" 
          onPress={() => router.push('/schedule')} 
        />
        <GridItem 
          label="Vendors" 
          icon="shopping-bag" 
          color="#EF6C00" 
          onPress={() => router.push('/vendors')} 
        />
        
        <GridItem 
          label="Tickets" 
          icon="tag" 
          color="#C62828" 
          onPress={() => Linking.openURL('https://www.plowingmatch.org/')} 
        />
        <GridItem 
          label="Camping" 
          icon="tent" 
          color="#556B2F" 
          onPress={() => Linking.openURL('https://letscamp.ca/')} 
        />
        <GridItem 
          label="News" 
          icon="rss" 
          color="#6A1B9A" 
          onPress={() => router.push('/news')} 
        />

        <GridItem 
          label="Favorites" 
          icon="star" 
          color="#FBC02D" 
          onPress={() => router.push('/favorites')} 
        />
        <GridItem 
          label="Photos" 
          icon="camera" 
          color="#00838F" 
          onPress={() => router.push('/photos')} 
        />
        <GridItem 
          label="SOS" 
          icon="alert-circle" 
          color="#D32F2F" 
          onPress={() => alert("SOS Feature Coming Soon")} 
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Lindsay, Ontario • Sept 2026</Text>
      </View
