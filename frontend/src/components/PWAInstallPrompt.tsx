// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// PWA Install Prompt Component

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
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

// Store the deferred prompt globally so it persists across re-renders
let globalDeferredPrompt: any = null;

export default function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const checkInstallability = async () => {
      console.log('[PWA Install] Checking installability...');
      
      // Check if already dismissed within 24 hours
      try {
        const dismissedAt = await AsyncStorage.getItem(DISMISS_KEY);
        if (dismissedAt) {
          const dismissTime = parseInt(dismissedAt, 10);
          if (Date.now() - dismissTime < DISMISS_DURATION) {
            console.log('[PWA Install] Dismissed within 24 hours, not showing');
            return;
          }
        }
      } catch (e) {
        console.log('[PWA Install] Error checking dismiss status:', e);
      }

      // Check if running as standalone (already installed)
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      
      setIsStandalone(standalone);
      console.log('[PWA Install] Is standalone (installed):', standalone);
      
      if (standalone) {
        console.log('[PWA Install] Already installed, not showing prompt');
        return;
      }

      // Detect iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);
      console.log('[PWA Install] Is iOS device:', isIOSDevice);

      // For iOS, show the manual install instructions after delay
      if (isIOSDevice) {
        setTimeout(() => {
          console.log('[PWA Install] Showing iOS instructions');
          setVisible(true);
          animateIn();
        }, 2000);
        return;
      }
    };

    // Set up beforeinstallprompt listener FIRST
    const handleBeforeInstall = (e: Event) => {
      console.log('[PWA Install] beforeinstallprompt event fired!');
      e.preventDefault();
      globalDeferredPrompt = e;
      setCanInstall(true);
      console.log('[PWA Install] Deferred prompt saved:', !!globalDeferredPrompt);
      
      // Show our custom prompt
      setTimeout(() => {
        console.log('[PWA Install] Showing custom install prompt');
        setVisible(true);
        animateIn();
      }, 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    console.log('[PWA Install] beforeinstallprompt listener added');

    // Check if the event was already fired before we added listener
    // This can happen if the component mounts after page load
    if (globalDeferredPrompt) {
      console.log('[PWA Install] Found existing deferred prompt');
      setCanInstall(true);
    }

    // Run the installability check
    checkInstallability();

    // For non-iOS browsers without beforeinstallprompt support, 
    // show the prompt anyway after a delay (for awareness)
    const fallbackTimer = setTimeout(() => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      
      if (!isIOSDevice && !standalone && !visible) {
        console.log('[PWA Install] Fallback: Showing prompt without beforeinstallprompt');
        setVisible(true);
        animateIn();
      }
    }, 4000);

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('[PWA Install] App was installed!');
      globalDeferredPrompt = null;
      setCanInstall(false);
      setVisible(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(fallbackTimer);
    };
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
    console.log('[PWA Install] Install button clicked');
    console.log('[PWA Install] globalDeferredPrompt exists:', !!globalDeferredPrompt);
    console.log('[PWA Install] canInstall state:', canInstall);
    
    if (globalDeferredPrompt) {
      try {
        console.log('[PWA Install] Calling prompt()...');
        // Show the native install prompt
        globalDeferredPrompt.prompt();
        
        console.log('[PWA Install] Waiting for user choice...');
        // Wait for the user's response
        const { outcome } = await globalDeferredPrompt.userChoice;
        console.log('[PWA Install] User choice:', outcome);
        
        if (outcome === 'accepted') {
          console.log('[PWA Install] User ACCEPTED the install prompt');
        } else {
          console.log('[PWA Install] User DISMISSED the install prompt');
        }
        
        // Clear the deferred prompt - it can only be used once
        globalDeferredPrompt = null;
        setCanInstall(false);
      } catch (error) {
        console.error('[PWA Install] Error during prompt:', error);
      }
    } else {
      console.log('[PWA Install] No deferred prompt available - showing browser instructions');
      // If no deferred prompt, guide user to use browser menu
      if (typeof window !== 'undefined') {
        alert('To install this app:\n\n1. Open browser menu (⋮ or ⋯)\n2. Select "Install app" or "Add to Home Screen"');
      }
    }
    
    animateOut(onInstall);
  };

  const handleDismiss = async () => {
    console.log('[PWA Install] Dismiss button clicked');
    try {
      await AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
      console.log('[PWA Install] Dismiss time saved');
    } catch (e) {
      console.log('[PWA Install] Error saving dismiss time:', e);
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
                style={[
                  styles.installButton,
                  !canInstall && styles.installButtonAlt
                ]} 
                onPress={handleInstall}
                activeOpacity={0.8}
              >
                <Feather name="download" size={20} color="#FFFFFF" />
                <Text style={styles.installButtonText}>
                  {canInstall ? 'Add to Home Screen' : 'Install via Browser Menu'}
                </Text>
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
    paddingBottom: 34,
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
  installButtonAlt: {
    backgroundColor: colors.textSecondary,
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
