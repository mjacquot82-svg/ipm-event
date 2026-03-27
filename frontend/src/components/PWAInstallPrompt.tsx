// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// PWA Install Prompt Component

import React, { useState, useEffect } from 'react';
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
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

export default function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const slideAnim = useState(new Animated.Value(300))[0];

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const checkInstallability = async () => {
      // Check if already dismissed within 24 hours
      try {
        const dismissedAt = await AsyncStorage.getItem(DISMISS_KEY);
        if (dismissedAt) {
          const dismissTime = parseInt(dismissedAt, 10);
          if (Date.now() - dismissTime < DISMISS_DURATION) {
            return; // Don't show, still within 24-hour window
          }
        }
      } catch (e) {
        console.log('Error checking dismiss status:', e);
      }

      // Check if running as standalone (already installed)
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      
      setIsStandalone(standalone);
      
      if (standalone) {
        return; // Already installed, don't show prompt
      }

      // Detect iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);

      // For iOS, show the manual install instructions
      if (isIOSDevice) {
        // Small delay to let the page load
        setTimeout(() => {
          setVisible(true);
          animateIn();
        }, 2000);
        return;
      }

      // For Android/Chrome, listen for beforeinstallprompt
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => {
          setVisible(true);
          animateIn();
        }, 2000);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      // Check if we already have a deferred prompt (for browsers that fire it early)
      // If not on iOS and no prompt after 3 seconds, show anyway for PWA awareness
      setTimeout(() => {
        if (!isIOSDevice && !standalone) {
          setVisible(true);
          animateIn();
        }
      }, 3000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    };

    checkInstallability();
  }, []);

  const animateIn = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
    }).start();
  };

  const animateOut = (callback?: () => void) => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      callback?.();
    });
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Trigger the native install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setDeferredPrompt(null);
    }
    animateOut(onInstall);
  };

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch (e) {
      console.log('Error saving dismiss time:', e);
    }
    animateOut(onDismiss);
  };

  if (Platform.OS !== 'web' || !visible || isStandalone) {
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
          {/* Handle bar */}
          <View style={styles.handleBar} />
          
          {/* Content */}
          <View style={styles.content}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.title}>Install IPM 2026</Text>
            
            {/* Description */}
            <Text style={styles.description}>
              Install the IPM 2026 Official App for offline access and live alerts!
            </Text>

            {isIOS ? (
              // iOS Instructions
              <View style={styles.iosInstructions}>
                <View style={styles.instructionStep}>
                  <View style={styles.stepIcon}>
                    <Feather name="share" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.instructionText}>
                    Tap the <Text style={styles.bold}>Share</Text> button in Safari
                  </Text>
                </View>
                <View style={styles.instructionStep}>
                  <View style={styles.stepIcon}>
                    <Feather name="plus-square" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.instructionText}>
                    Select <Text style={styles.bold}>"Add to Home Screen"</Text>
                  </Text>
                </View>
                <View style={styles.instructionStep}>
                  <View style={styles.stepIcon}>
                    <Feather name="check-circle" size={20} color={colors.accent} />
                  </View>
                  <Text style={styles.instructionText}>
                    Tap <Text style={styles.bold}>"Add"</Text> to install
                  </Text>
                </View>
              </View>
            ) : (
              // Android/Chrome Install Button
              <TouchableOpacity 
                style={styles.installButton} 
                onPress={handleInstall}
                activeOpacity={0.8}
              >
                <Feather name="download" size={20} color="#FFFFFF" />
                <Text style={styles.installButtonText}>Add to Home Screen</Text>
              </TouchableOpacity>
            )}

            {/* Dismiss Button */}
            <TouchableOpacity 
              style={styles.dismissButton} 
              onPress={handleDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissButtonText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34, // Safe area for iPhone
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    marginBottom: 12,
  },
  installButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 10,
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dismissButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  iosInstructions: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: colors.primary,
  },
});
