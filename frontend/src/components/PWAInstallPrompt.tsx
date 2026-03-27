// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// PWA Install Prompt Component - Simplified for Live Demo

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
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

// Global storage for the deferred prompt
let deferredInstallPrompt: any = null;

// Capture the event as early as possible
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] beforeinstallprompt captured globally');
  });
}

export default function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTooltip, setShowIOSTooltip] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'checking' | 'fallback'>('idle');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;

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

      // Detect device
      const userAgent = window.navigator.userAgent.toLowerCase();
      const iosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(iosDevice);

      // Show prompt after delay
      setTimeout(() => {
        setVisible(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 9,
        }).start();
      }, 2500);
    };

    init();
  }, []);

  const animateOut = (callback?: () => void) => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setShowIOSTooltip(false);
      callback?.();
    });
  };

  // iOS: Show tooltip pointing to Share button
  const handleIOSInstall = () => {
    setShowIOSTooltip(true);
    Animated.sequence([
      Animated.timing(tooltipAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(tooltipAnim, {
            toValue: 0.7,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(tooltipAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 }
      ),
    ]).start();
  };

  // Android: Trigger install with fallback
  const handleAndroidInstall = async () => {
    console.log('[PWA] Install button clicked');
    console.log('[PWA] deferredInstallPrompt:', !!deferredInstallPrompt);
    
    setInstallStatus('checking');

    // Small delay to show "Checking..." state
    await new Promise(resolve => setTimeout(resolve, 500));

    if (deferredInstallPrompt) {
      try {
        // MUST call prompt() synchronously from user gesture
        console.log('[PWA] Calling prompt()');
        deferredInstallPrompt.prompt();
        
        const result = await deferredInstallPrompt.userChoice;
        console.log('[PWA] User choice:', result.outcome);
        
        deferredInstallPrompt = null;
        animateOut(onInstall);
        return;
      } catch (err) {
        console.error('[PWA] Prompt error:', err);
      }
    }

    // Fallback: Show manual instructions
    console.log('[PWA] Showing fallback instructions');
    setInstallStatus('fallback');
  };

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch (e) {}
    animateOut(onDismiss);
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
        
        {/* iOS Share Tooltip */}
        {isIOS && showIOSTooltip && (
          <Animated.View 
            style={[
              styles.iosTooltip,
              { opacity: tooltipAnim, transform: [{ scale: tooltipAnim }] }
            ]}
          >
            <View style={styles.tooltipArrow} />
            <View style={styles.tooltipContent}>
              <Feather name="share" size={24} color={colors.primary} />
              <Text style={styles.tooltipText}>
                Tap <Text style={styles.bold}>Share</Text>, then{'\n'}
                <Text style={styles.bold}>"Add to Home Screen"</Text>
              </Text>
            </View>
          </Animated.View>
        )}

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
            
            <Text style={styles.description}>
              Get offline access and live event alerts!
            </Text>

            {isIOS ? (
              // iOS Flow
              <>
                {!showIOSTooltip ? (
                  <TouchableOpacity 
                    style={styles.installButton} 
                    onPress={handleIOSInstall}
                    activeOpacity={0.8}
                  >
                    <Feather name="download" size={20} color="#FFFFFF" />
                    <Text style={styles.installButtonText}>Add to Home Screen</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.iosInstructions}>
                    <View style={styles.instructionRow}>
                      <View style={styles.stepNumber}><Text style={styles.stepText}>1</Text></View>
                      <Text style={styles.instructionText}>
                        Tap the <Text style={styles.bold}>Share</Text> button below
                      </Text>
                      <Feather name="arrow-up" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.instructionRow}>
                      <View style={styles.stepNumber}><Text style={styles.stepText}>2</Text></View>
                      <Text style={styles.instructionText}>
                        Select <Text style={styles.bold}>"Add to Home Screen"</Text>
                      </Text>
                    </View>
                    <View style={styles.instructionRow}>
                      <View style={styles.stepNumber}><Text style={styles.stepText}>3</Text></View>
                      <Text style={styles.instructionText}>
                        Tap <Text style={styles.bold}>"Add"</Text> to install
                      </Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              // Android Flow
              <>
                {installStatus === 'idle' && (
                  <TouchableOpacity 
                    style={styles.installButton} 
                    onPress={handleAndroidInstall}
                    activeOpacity={0.8}
                  >
                    <Feather name="download" size={20} color="#FFFFFF" />
                    <Text style={styles.installButtonText}>Add to Home Screen</Text>
                  </TouchableOpacity>
                )}

                {installStatus === 'checking' && (
                  <View style={styles.checkingContainer}>
                    <Text style={styles.checkingText}>Checking...</Text>
                  </View>
                )}

                {installStatus === 'fallback' && (
                  <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackTitle}>Almost there!</Text>
                    <View style={styles.fallbackInstructions}>
                      <View style={styles.instructionRow}>
                        <View style={styles.stepNumber}><Text style={styles.stepText}>1</Text></View>
                        <Text style={styles.instructionText}>
                          Tap <Text style={styles.bold}>⋮</Text> menu (top right)
                        </Text>
                      </View>
                      <View style={styles.instructionRow}>
                        <View style={styles.stepNumber}><Text style={styles.stepText}>2</Text></View>
                        <Text style={styles.instructionText}>
                          Select <Text style={styles.bold}>"Install app"</Text> or{'\n'}
                          <Text style={styles.bold}>"Add to Home screen"</Text>
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity 
              style={styles.dismissButton} 
              onPress={handleDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissButtonText}>
                {showIOSTooltip || installStatus === 'fallback' ? 'Done' : 'Not Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width, height } = Dimensions.get('window');

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
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 54,
    height: 54,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
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
    maxWidth: 300,
    marginBottom: 8,
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
  // iOS Tooltip
  iosTooltip: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  tooltipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tooltipText: {
    marginLeft: 12,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  // Instructions
  iosInstructions: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: colors.primary,
  },
  // Android Checking/Fallback
  checkingContainer: {
    paddingVertical: 20,
  },
  checkingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  fallbackContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 12,
  },
  fallbackInstructions: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
  },
});
