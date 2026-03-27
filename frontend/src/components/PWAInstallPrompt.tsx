// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// PWA Install Prompt - Simple Manual Instructions for Live Demo

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../theme/colors';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DURATION = 24 * 60 * 60 * 1000;

interface PWAInstallPromptProps {
  onDismiss?: () => void;
}

export default function PWAInstallPrompt({ onDismiss }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const init = async () => {
      // Check dismiss status
      try {
        const dismissedAt = await AsyncStorage.getItem(DISMISS_KEY);
        if (dismissedAt) {
          const dismissTime = parseInt(dismissedAt, 10);
          if (Date.now() - dismissTime < DISMISS_DURATION) {
            return;
          }
        }
      } catch (e) {}

      // Check if already installed
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      
      if (standalone) return;

      // Detect iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));

      // Show prompt after delay
      setTimeout(() => {
        setVisible(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      }, 2500);
    };

    init();
  }, []);

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch (e) {}
    
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  };

  if (Platform.OS !== 'web' || !visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={handleDismiss}
        />

        <Animated.View 
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.handleBar} />
          
          <View style={styles.content}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>Install IPM 2026</Text>
            <Text style={styles.subtitle}>Add to your home screen for the best experience</Text>

            {/* Instructions */}
            <View style={styles.instructionsBox}>
              {isIOS ? (
                // iOS Instructions
                <>
                  <View style={styles.step}>
                    <View style={styles.stepIconBox}>
                      <Feather name="share" size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.stepTextBox}>
                      <Text style={styles.stepTitle}>Step 1</Text>
                      <Text style={styles.stepDesc}>
                        Tap the <Text style={styles.highlight}>Share</Text> button at the bottom of Safari
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.stepDivider} />
                  
                  <View style={styles.step}>
                    <View style={[styles.stepIconBox, { backgroundColor: colors.accent }]}>
                      <Feather name="plus-square" size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.stepTextBox}>
                      <Text style={styles.stepTitle}>Step 2</Text>
                      <Text style={styles.stepDesc}>
                        Scroll and tap <Text style={styles.highlight}>"Add to Home Screen"</Text>
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                // Android/Chrome Instructions
                <>
                  <View style={styles.step}>
                    <View style={styles.stepIconBox}>
                      <Feather name="more-vertical" size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.stepTextBox}>
                      <Text style={styles.stepTitle}>Step 1</Text>
                      <Text style={styles.stepDesc}>
                        Tap the <Text style={styles.highlight}>⋮ menu</Text> in the top-right corner
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.stepDivider} />
                  
                  <View style={styles.step}>
                    <View style={[styles.stepIconBox, { backgroundColor: colors.accent }]}>
                      <Feather name="download" size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.stepTextBox}>
                      <Text style={styles.stepTitle}>Step 2</Text>
                      <Text style={styles.stepDesc}>
                        Tap <Text style={styles.highlight}>"Install app"</Text> or <Text style={styles.highlight}>"Add to Home screen"</Text>
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Benefits */}
            <View style={styles.benefitsRow}>
              <View style={styles.benefit}>
                <Feather name="wifi-off" size={16} color={colors.primary} />
                <Text style={styles.benefitText}>Works offline</Text>
              </View>
              <View style={styles.benefit}>
                <Feather name="bell" size={16} color={colors.primary} />
                <Text style={styles.benefitText}>Live alerts</Text>
              </View>
              <View style={styles.benefit}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={styles.benefitText}>Fast access</Text>
              </View>
            </View>

            {/* Got It Button */}
            <TouchableOpacity 
              style={styles.gotItButton} 
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.gotItText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 25,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  logo: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  instructionsBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTextBox: {
    flex: 1,
    marginLeft: 14,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  stepDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 14,
    marginLeft: 58,
  },
  highlight: {
    fontWeight: '700',
    color: colors.primary,
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 20,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  gotItButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    width: '100%',
    maxWidth: 280,
  },
  gotItText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});
