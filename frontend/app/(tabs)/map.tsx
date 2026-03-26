// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapComponent from '../../src/components/MapComponent';
import InterstitialAd from '../../src/components/InterstitialAd';
import colors from '../../src/theme/colors';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';
import { useAdContext } from '../../src/context/AdContext';

export default function MapScreen() {
  // Get location parameter from navigation
  const { location, showOnly } = useLocalSearchParams<{ location?: string; showOnly?: string }>();
  
  // Ad context for session-based frequency capping
  const { hasSeenInterstitial, setHasSeenInterstitial } = useAdContext();
  
  // Local state for showing interstitial
  const [showInterstitial, setShowInterstitial] = useState(false);

  // Show interstitial on first map load (once per session)
  useEffect(() => {
    if (!hasSeenInterstitial && adCampaignsConfig.interstitial.enabled) {
      // Small delay to let the map render first
      const timer = setTimeout(() => {
        setShowInterstitial(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenInterstitial]);

  const handleCloseInterstitial = () => {
    setShowInterstitial(false);
    setHasSeenInterstitial(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <MapComponent 
        highlightedLocation={location || null} 
        showOnlyHighlighted={showOnly === 'true'}
      />
      
      {/* Interstitial Ad - Shows once per session on Map load */}
      <InterstitialAd
        adUnit={adCampaignsConfig.interstitial}
        visible={showInterstitial}
        onClose={handleCloseInterstitial}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
