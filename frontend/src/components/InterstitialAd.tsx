// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AdUnit } from '../config/AdCampaignsConfig';
import colors from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InterstitialAdProps {
  adUnit: AdUnit;
  visible: boolean;
  onClose: () => void;
}

const InterstitialAd: React.FC<InterstitialAdProps> = ({ adUnit, visible, onClose }) => {
  const [showCloseButton, setShowCloseButton] = useState(false);
  const closeButtonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShowCloseButton(false);
      closeButtonOpacity.setValue(0);
      
      // Show close button after 2 seconds
      const timer = setTimeout(() => {
        setShowCloseButton(true);
        Animated.timing(closeButtonOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [visible, closeButtonOpacity]);

  const handleAdPress = async () => {
    try {
      const canOpen = await Linking.canOpenURL(adUnit.targetUrl);
      if (canOpen) {
        await Linking.openURL(adUnit.targetUrl);
      }
      onClose();
    } catch (error) {
      console.error('Error opening ad URL:', error);
    }
  };

  if (!adUnit.enabled || !visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={() => showCloseButton && onClose()}
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.touchArea}
          onPress={handleAdPress}
          activeOpacity={0.95}
        >
          {adUnit.imageUrl ? (
            <Image
              source={{ uri: adUnit.imageUrl }}
              style={styles.adImage}
              resizeMode="cover"
            />
          ) : null}
        </TouchableOpacity>
        
        {/* Text overlay - positioned absolutely to ensure it renders */}
        {!adUnit.imageUrl && (
          <View style={styles.textOverlay} pointerEvents="none">
            <Feather name="star" size={64} color="#FFFFFF" />
            <Text style={styles.titleText}>SPOTLIGHT AD</Text>
            <Text style={styles.subtitleText}>FULL-SCREEN SPONSOR MESSAGE</Text>
            <Text style={styles.ctaText}>(TAP TO LEARN MORE)</Text>
          </View>
        )}

        {/* Close Button - fades in after 2 seconds */}
        {showCloseButton && (
          <Animated.View style={[styles.closeButtonContainer, { opacity: closeButtonOpacity }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Feather name="x" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Timer indicator before close button appears */}
        {!showCloseButton && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>Skip in 2s...</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: colors.primary,
  },
  touchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  adImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  titleText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1,
    marginBottom: 32,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  timerContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default InterstitialAd;
