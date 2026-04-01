// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// PWA Install Prompt - Native Browser Install Trigger

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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../theme/colors';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DURATION = 24 * 60 * 60 * 1000;

// CRITICAL: Store the install prompt event globally
// This MUST be outside the component to persist across renders
declare global {
  interface Window {
    deferredPWAPrompt: any;
    pwaPromptCaptured: boolean;
  }
}

// Initialize global tracking
if (typeof window !== 'undefined') {
  window.pwaPromptCaptured = false;
  
  // Capture the beforeinstallprompt event IMMEDIATELY
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    console.log('🎯 [PWA] beforeinstallprompt event CAPTURED!');
    e.preventDefault(); // Prevent the mini-infobar from appearing
    window.deferredPWAPrompt = e;
    window.pwaPromptCaptured = true;
  });

  // Listen for successful install
  window.addEventListener('appinstalled', () => {
    console.log('✅ [PWA] App was installed!');
    window.deferredPWAPrompt = null;
    window.pwaPromptCaptured = false;
  });
}

interface PWAInstallPromptProps {
  onDismiss?: () => void;
}

export default function PWAInstallPrompt({ onDismiss }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [installing, setInstalling] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Detect if device is mobile (not desktop)
  const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined') return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
    const isMobile = mobileKeywords.test(userAgent);
    // Also check screen width as a fallback
    const isSmallScreen = window.innerWidth < 768;
    return isMobile || isSmallScreen;
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    // Don't show on desktop
    if (!isMobileDevice()) {
      console.log('[PWA] Desktop detected, not showing install prompt');
      return;
    }

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

      // Check if already installed (standalone mode)
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      
      if (standalone) {
        console.log('[PWA] Already installed, not showing prompt');
        return;
      }

      // Detect iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const iosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(iosDevice);

      // Check if we captured the native prompt
      setHasNativePrompt(!!window.deferredPWAPrompt);
      console.log('[PWA] Native prompt available:', !!window.deferredPWAPrompt);

      // Show our UI after a delay
      setTimeout(() => {
        // Re-check if prompt is available (might have been captured after init)
        setHasNativePrompt(!!window.deferredPWAPrompt);
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

    // Also check periodically if the prompt becomes available
    const checkInterval = setInterval(() => {
      if (window.deferredPWAPrompt && !hasNativePrompt) {
        console.log('[PWA] Native prompt became available');
        setHasNativePrompt(true);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  const triggerNativeInstall = async () => {
    console.log('[PWA] Install button clicked');
    console.log('[PWA] deferredPWAPrompt exists:', !!window.deferredPWAPrompt);
    
    if (!window.deferredPWAPrompt) {
      console.log('[PWA] No native prompt available');
      // Fallback - show instructions
      setHasNativePrompt(false);
      return;
    }

    setInstalling(true);

    try {
      // IMPORTANT: prompt() must be called directly from a user gesture
      const promptEvent = window.deferredPWAPrompt;
      console.log('[PWA] Calling prompt()...');
      
      // Show the native install prompt
      promptEvent.prompt();
      
      // Wait for the user to respond
      const { outcome } = await promptEvent.userChoice;
      console.log('[PWA] User choice:', outcome);
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted installation');
        handleDismiss();
      } else {
        console.log('[PWA] User dismissed installation');
        setInstalling(false);
      }
      
      // Clear the prompt - it can only be used once
      window.deferredPWAPrompt = null;
      setHasNativePrompt(false);
      
    } catch (error) {
      console.error('[PWA] Error triggering install:', error);
      setInstalling(false);
      setHasNativePrompt(false);
    }
  };

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

            {/* Show native install button OR manual instructions */}
            {(hasNativePrompt && !isIOS) ? (
              // Native install available - show install button
              <TouchableOpacity 
                style={[styles.installButton, installing && styles.installButtonDisabled]} 
                onPress={triggerNativeInstall}
                activeOpacity={0.8}
                disabled={installing}
              >
                {installing ? (
                  <Text style={styles.installButtonText}>Installing...</Text>
                ) : (
                  <>
                    <Feather name="download" size={20} color="#FFFFFF" />
                    <Text style={styles.installButtonText}>Install Now</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              // Manual instructions for iOS or when native prompt not available
              <View style={styles.instructionsBox}>
                {isIOS ? (
                  <>
                    <View style={styles.step}>
                      <View style={styles.stepIconBox}>
                        <Feather name="share" size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.stepTextBox}>
                        <Text style={styles.stepDesc}>
                          Tap <Text style={styles.highlight}>Share</Text> at the bottom
                        </Text>
                      </View>
                    </View>
                    <View style={styles.step}>
                      <View style={[styles.stepIconBox, { backgroundColor: colors.accent }]}>
                        <Feather name="plus-square" size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.stepTextBox}>
                        <Text style={styles.stepDesc}>
                          Then <Text style={styles.highlight}>"Add to Home Screen"</Text>
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.step}>
                      <View style={styles.stepIconBox}>
                        <Feather name="more-vertical" size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.stepTextBox}>
                        <Text style={styles.stepDesc}>
                          Tap <Text style={styles.highlight}>⋮ menu</Text> (top-right)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.step}>
                      <View style={[styles.stepIconBox, { backgroundColor: colors.accent }]}>
                        <Feather name="download" size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.stepTextBox}>
                        <Text style={styles.stepDesc}>
                          Then <Text style={styles.highlight}>"Install app"</Text>
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
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
    marginBottom: 16,
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 16,
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
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    maxWidth: 280,
    marginBottom: 8,
    gap: 10,
  },
  installButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  installButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  instructionsBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepTextBox: {
    flex: 1,
  },
  stepDesc: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  highlight: {
    fontWeight: '700',
    color: colors.primary,
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
});
