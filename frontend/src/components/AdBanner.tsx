// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// AD BANNER COMPONENT - FINAL VERSION WITH REAL ASSETS

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'expo-router';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { AdUnit } from '../config/AdCampaignsConfig';
import DevelopmentSponsorAd from './DevelopmentSponsorAd';

const ROTATION_INTERVAL_MS = 5000;

interface AdBannerProps {
  adUnit: AdUnit;
  position: 'top' | 'bottom';
  pointerEvents?: 'box-none' | 'none' | 'auto';
}

const AdBanner: React.FC<AdBannerProps> = ({ adUnit, position, pointerEvents = 'auto' }) => {
  const pathname = usePathname();
  const [artworkIndex, setArtworkIndex] = useState(0);
  const uploadedArtwork = useMemo(() => {
    const images = [...(adUnit.imageUrls || [])];
    if (adUnit.imageUrl && !images.includes(adUnit.imageUrl)) {
      images.unshift(adUnit.imageUrl);
    }
    return images.filter(Boolean);
  }, [adUnit.imageUrl, adUnit.imageUrls]);
  const uploadedArtworkKey = uploadedArtwork.join('|');

  useEffect(() => {
    setArtworkIndex(0);
    if (uploadedArtwork.length < 2) return;

    const timer = setInterval(() => {
      setArtworkIndex((current) => current + 1);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [uploadedArtwork.length, uploadedArtworkKey]);

  const currentArtwork = uploadedArtwork[artworkIndex % uploadedArtwork.length];

  if (!adUnit.enabled) return null;

  const handlePress = async () => {
    try {
      const canOpen = await Linking.canOpenURL(adUnit.targetUrl);
      if (canOpen) {
        await Linking.openURL(adUnit.targetUrl);
      }
    } catch (error) {
      console.error('Error opening ad URL:', error);
    }
  };

  const isTop = position === 'top';

  if (isTop) {
    // TOP AD - 92% width, borderRadius: 12, shadow
    return (
      <View style={styles.topContainer} pointerEvents={pointerEvents}>
        <TouchableOpacity
          style={styles.topBanner}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          {currentArtwork ? (
            <Image
              source={{ uri: currentArtwork }}
              style={styles.topBannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.topPlaceholder}>
              <DevelopmentSponsorAd position="top" pathname={pathname} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // BOTTOM AD - 92% width, borderRadius: 12, shadow
  return (
    <View style={styles.bottomContainer} pointerEvents={pointerEvents}>
      <TouchableOpacity
        style={styles.bottomBanner}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {currentArtwork ? (
          <Image
            source={{ uri: currentArtwork }}
            style={styles.bottomBannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.bottomPlaceholder}>
            <DevelopmentSponsorAd position="bottom" pathname={pathname} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // TOP AD CONTAINER - marginTop: 10
  topContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: '4%', // Creates 92% width effect
    marginTop: 10,
  },
  
  // TOP BANNER - borderRadius: 12, shadow matching Quick Actions
  topBanner: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#8B1538',
    // Shadow matching Quick Actions buttons
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  topBannerImage: {
    width: '100%',
    height: 80,
  },
  
  topPlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: '#8B1538',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // BOTTOM AD CONTAINER
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: '4%', // Creates 92% width effect
  },
  
  // BOTTOM BANNER - borderRadius: 12, shadow matching Quick Actions
  bottomBanner: {
    width: '100%',
    height: 50,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#8B1538',
    // Shadow matching Quick Actions buttons
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  bottomBannerImage: {
    width: '100%',
    height: 50,
  },
  
  bottomPlaceholder: {
    width: '100%',
    height: 50,
    backgroundColor: '#8B1538',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
});

export default AdBanner;
