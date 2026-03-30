// © 2026 1001538341 ONTARIO INC.
import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Image,
  Pressable,
  Animated,
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
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.gridItem, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.gridPressable}
      >
        <View style={[styles.iconWrap, { backgroundColor: color }]}>
          <Feather name={icon} size={22} color="#fff" />
        </View>
        <Text style={styles.gridLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      
      {/* FULL WIDTH BANNER */}
      <View style={styles.bannerContainer}>
        <Image
          source={require('../../assets/images/ipm-2026-banner.png')}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.bannerOverlay} />
      </View>

      {/* GRID WRAPPER (controls width) */}
      <View style={styles.gridWrapper}>
        <View style={styles.grid}>
          <GridItem label="Map" icon="map" color="#2E7D32" onPress={() => router.push('/map')} />
          <GridItem label="Schedule" icon="calendar" color="#1976D2" onPress={() => router.push('/schedule')} />
          <GridItem label="Vendors" icon="shopping-bag" color="#EF6C00" onPress={() => router.push('/vendors')} />

          <GridItem label="Tickets" icon="tag" color="#C62828" onPress={() => Linking.openURL('https://www.plowingmatch.org/')} />
          <GridItem label="Camping" icon="compass" color="#556B2F" onPress={() => Linking.openURL('https://letscamp.ca/')} />
          <GridItem label="News" icon="rss" color="#6A1B9A" onPress={() => router.push('/news')} />

          <GridItem label="Itinerary" icon="clipboard" color="#FBC02D" onPress={() => router.push('/itinerary')} />
          <GridItem label="Photos" icon="camera" color="#00838F" onPress={() => router.push('/photos')} />
          <GridItem label="SOS" icon="alert-circle" color="#D32F2F" onPress={() => router.push('/sos')} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: '#ECE8E1', // slightly warmer than current
},

  // 🔥 Banner (edge to edge)
  bannerContainer: {
  marginHorizontal: 16,   // 👈 matches grid + ads
  marginTop: 10,
  marginBottom: 16,
  borderRadius: 16,
  overflow: 'hidden',
  height: 180,
},
bannerImage: {
  width: '100%',
  height: '100%',
},
bannerOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.15)',
},

  // 🔹 Grid wrapper controls alignment
  gridWrapper: {
  paddingHorizontal: 16,
},

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  gridItem: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  gridPressable: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 18,
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  gridLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
});
