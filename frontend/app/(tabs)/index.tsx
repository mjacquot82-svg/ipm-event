// © 2026 1001538341 ONTARIO INC.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type GridItemProps = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress: () => void;
};

function GridItem({ label, icon, color, onPress }: GridItemProps) {
  return (
    <TouchableOpacity style={styles.gridItem} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.iconWrap, { backgroundColor: color }]}>
        <Feather name={icon} size={24} color="#fff" />
      </View>
      <Text style={styles.gridLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header / Banner Area */}
      <View style={styles.titleContainer}>
  <Text style={styles.welcomeText}>IPM 2026</Text>
  <Text style={styles.subText}>International Plowing Match</Text>
</View>>

      <View style={styles.bannerContainer}>
        <Image
          source={require('../../assets/images/ipm-2026-banner.png')}
          style={styles.bannerImage}
          resizeMode="cover"
        />
      </View>

      {/* 3x3 Quick Actions Grid */}
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
          icon="compass"
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
          onPress={() => router.push('/sos')}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Lindsay, Ontario • Sept 2026</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4ED',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#234F2E',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subText: {
    marginTop: 6,
    fontSize: 16,
    color: '#E8F1E8',
    textAlign: 'center',
  },
  bannerContainer: {
    width: '100%',
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: 140,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  footer: {
    marginTop: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
