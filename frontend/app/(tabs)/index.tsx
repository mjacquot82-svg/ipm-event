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
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.bannerContainer}>
        <Image
          source={require('../../assets/images/ipm-2026-banner.png')}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.bannerOverlay} />

        <View style={styles.bannerTextWrap}>
          <Text style={styles.bannerTitle}>IPM 2026</Text>
          <Text style={styles.bannerSubtitle}>International Plowing Match</Text>
        </View>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4ED',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  bannerContainer: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  bannerTextWrap: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#E5E7EB',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  gridPressable: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 20,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
});
