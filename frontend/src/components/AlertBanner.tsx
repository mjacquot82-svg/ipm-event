// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// ALERT BANNER COMPONENT - Pinned alert at top of app with resolve functionality

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import PinKeypad from './PinKeypad';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                process.env.EXPO_PUBLIC_BACKEND_URL || 
                '';

interface SOSReport {
  id: string;
  name: string;
  sex: string;
  age: string;
  height: string;
  hair_color: string;
  glasses: boolean;
  shirt_color: string;
  pants_color: string;
  last_location: string;
  status: string;
  created_at: string;
  resolved_at?: string;
}

interface AlertBannerProps {
  onRefresh?: () => void;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ onRefresh }) => {
  const [activeAlerts, setActiveAlerts] = useState<SOSReport[]>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<SOSReport[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinKeypad, setShowPinKeypad] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Check admin mode
  useEffect(() => {
    checkAdminMode();
  }, []);

  // Fetch alerts
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Pulse animation for active alerts
  useEffect(() => {
    if (activeAlerts.length > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.9, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [activeAlerts.length]);

  // Countdown timers for resolved alerts
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          if (updated[id] > 0) {
            updated[id] -= 1;
          } else {
            // Archive the alert
            archiveAlert(id);
            delete updated[id];
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Initialize countdowns for newly resolved alerts
  useEffect(() => {
    resolvedAlerts.forEach(alert => {
      if (!countdowns[alert.id] && alert.resolved_at) {
        const resolvedTime = new Date(alert.resolved_at).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - resolvedTime) / 1000);
        const remaining = Math.max(0, 30 * 60 - elapsed); // 30 minutes countdown
        
        if (remaining > 0) {
          setCountdowns(prev => ({ ...prev, [alert.id]: remaining }));
        }
      }
    });
  }, [resolvedAlerts]);

  const checkAdminMode = async () => {
    try {
      const adminMode = await AsyncStorage.getItem('admin_mode');
      setIsAdmin(adminMode === 'true');
    } catch (e) {
      console.error('Error checking admin mode:', e);
    }
  };

  const toggleAdminMode = async () => {
    try {
      const newMode = !isAdmin;
      await AsyncStorage.setItem('admin_mode', newMode.toString());
      setIsAdmin(newMode);
    } catch (e) {
      console.error('Error toggling admin mode:', e);
    }
  };

  const fetchAlerts = async () => {
    try {
      // Fetch active alerts
      const activeResponse = await fetch(`${API_URL}/api/sos/active`);
      if (activeResponse.ok) {
        const active = await activeResponse.json();
        setActiveAlerts(active);
      }

      // Fetch resolved alerts
      const resolvedResponse = await fetch(`${API_URL}/api/sos/resolved`);
      if (resolvedResponse.ok) {
        const resolved = await resolvedResponse.json();
        setResolvedAlerts(resolved);
      }
    } catch (e) {
      console.error('Error fetching alerts:', e);
    }
  };

  const handleResolvePress = (alertId: string) => {
    setSelectedAlertId(alertId);
    setShowPinKeypad(true);
  };

  const handlePinSuccess = async () => {
    setShowPinKeypad(false);
    
    if (!selectedAlertId) return;

    try {
      const response = await fetch(`${API_URL}/api/sos/resolve/${selectedAlertId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '2026' }),
      });

      if (response.ok) {
        // Refresh alerts
        fetchAlerts();
        onRefresh?.();
      }
    } catch (e) {
      console.error('Error resolving alert:', e);
    }

    setSelectedAlertId(null);
  };

  const archiveAlert = async (alertId: string) => {
    try {
      await fetch(`${API_URL}/api/sos/archive/${alertId}`, {
        method: 'POST',
      });
      fetchAlerts();
    } catch (e) {
      console.error('Error archiving alert:', e);
    }
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (activeAlerts.length === 0 && resolvedAlerts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Active Alerts - Red */}
      {activeAlerts.map(alert => (
        <Animated.View 
          key={alert.id}
          style={[
            styles.banner,
            styles.activeBanner,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <View style={styles.bannerContent}>
            <Feather name="alert-triangle" size={20} color="#FFFFFF" />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>🚨 MISSING PERSON ALERT</Text>
              <Text style={styles.bannerText}>
                {alert.name} - {alert.sex}, {alert.age}, {alert.height}
              </Text>
              <Text style={styles.bannerSubtext}>
                Last seen: {alert.last_location}
              </Text>
            </View>
          </View>
          
          {isAdmin && (
            <TouchableOpacity
              style={styles.resolveButton}
              onPress={() => handleResolvePress(alert.id)}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <Text style={styles.resolveButtonText}>Resolve</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      ))}

      {/* Resolved Alerts - Green */}
      {resolvedAlerts.map(alert => (
        <View 
          key={alert.id}
          style={[styles.banner, styles.resolvedBanner]}
        >
          <View style={styles.bannerContent}>
            <Feather name="check-circle" size={20} color="#FFFFFF" />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>✅ RESOLVED</Text>
              <Text style={styles.bannerText}>
                {alert.name} has been found safely
              </Text>
              {countdowns[alert.id] && (
                <Text style={styles.countdownText}>
                  Moving to archive in {formatCountdown(countdowns[alert.id])}
                </Text>
              )}
            </View>
          </View>
        </View>
      ))}

      {/* Admin Toggle (hidden - triple tap on alert to toggle) */}
      <TouchableOpacity
        style={styles.adminToggle}
        onPress={toggleAdminMode}
        activeOpacity={1}
      >
        <Text style={[styles.adminText, isAdmin && styles.adminActiveText]}>
          {isAdmin ? '🔓 Admin' : ''}
        </Text>
      </TouchableOpacity>

      {/* PIN Keypad Modal */}
      <PinKeypad
        visible={showPinKeypad}
        onClose={() => {
          setShowPinKeypad(false);
          setSelectedAlertId(null);
        }}
        onSuccess={handlePinSuccess}
        correctPin="2026"
        title="Enter Admin PIN"
      />
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: '4%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeBanner: {
    backgroundColor: '#DC2626', // Red
  },
  resolvedBanner: {
    backgroundColor: '#16A34A', // Green
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  bannerTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  bannerSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  countdownText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  resolveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  adminToggle: {
    position: 'absolute',
    top: 0,
    right: 8,
    padding: 4,
  },
  adminText: {
    fontSize: 10,
    color: 'transparent',
  },
  adminActiveText: {
    color: '#FFFFFF',
  },
});

export default AlertBanner;
