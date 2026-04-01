// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Linking,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../../src/theme/colors';
import ResponsiveBanner from '../../src/components/ResponsiveBanner';
import PinKeypad from '../../src/components/PinKeypad';
import { 
  sessions, 
  locations, 
  getLocationById, 
  getHappeningNow,
  getUpcomingSessions,
  getNextStarredSession,
  getLocationTypeColor,
  getLocationTypeIcon,
  Session,
  eventInfo,
} from '../../src/data/mockData';
import { getFavorites, toggleFavorite } from '../../src/utils/favoritesStorage';

// SOS Form initial state
const initialSOSForm = {
  name: '',
  sex: '',
  age: '',
  height: '',
  hair_color: '',
  glasses: false,
  shirt_color: '',
  pants_color: '',
  last_location: '',
  description: '',
  reporter_name: '',
  reporter_phone: '',
};

// Phone formatting helper - formats to (519) XXX-XXXX
const formatPhoneNumber = (text: string): string => {
  // Remove all non-digits
  const digits = text.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  // Format based on length
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
};

// Validate phone number (must be 10 digits)
const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10;
};

export default function HomeScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showItinerary, setShowItinerary] = useState(false);
  const [apiEvents, setApiEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  
  // Vendors state
  const [showVendors, setShowVendors] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorTypes, setVendorTypes] = useState<string[]>([]);
  const [selectedVendorType, setSelectedVendorType] = useState<string>('All');
  const [vendorsLoading, setVendorsLoading] = useState(false);
  
  // SOS state
  const [showSOSWarning, setShowSOSWarning] = useState(false);
  const [showSOSConfirm, setShowSOSConfirm] = useState(false);
  const [showSOSForm, setShowSOSForm] = useState(false);
  const [sosForm, setSOSForm] = useState(initialSOSForm);
  const [sosSubmitting, setSOSSubmitting] = useState(false);
  const [activeSOSReports, setActiveSOSReports] = useState<any[]>([]);
  const [resolvedSOSReports, setResolvedSOSReports] = useState<any[]>([]);
  const [archivedSOSReports, setArchivedSOSReports] = useState<any[]>([]);
  const [showActiveAlerts, setShowActiveAlerts] = useState(false);
  
  // Admin mode state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPinKeypad, setShowPinKeypad] = useState(false);
  const [selectedReportForResolve, setSelectedReportForResolve] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  
  // Admin detail view state
  const [showAdminDetail, setShowAdminDetail] = useState(false);
  const [selectedAlertForAdmin, setSelectedAlertForAdmin] = useState<any | null>(null);
  const [adminPinAction, setAdminPinAction] = useState<'resolve' | 'view' | null>(null);

  // Check if backend is available
  const [backendAvailable, setBackendAvailable] = useState(true);

  // Fetch events from API
  const fetchApiEvents = async () => {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      if (!API_BASE_URL) {
        console.warn('Backend URL not configured');
        setBackendAvailable(false);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_BASE_URL}/api/schedule`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setApiEvents(data.events || []);
        setBackendAvailable(true);
      }
    } catch (error: any) {
      console.warn('Backend unavailable:', error?.message || 'Network error');
      setBackendAvailable(false);
    }
  };

  // Fetch vendors from API
  const fetchVendors = async () => {
    setVendorsLoading(true);
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      if (!API_BASE_URL) {
        setBackendAvailable(false);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_BASE_URL}/api/vendors`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const vendorList = data.vendors || [];
        setVendors(vendorList);
        
        // Extract unique types for filter
        const types = ['All', ...new Set(vendorList.map((v: any) => v.type).filter(Boolean))];
        setVendorTypes(types as string[]);
        setBackendAvailable(true);
      }
    } catch (error: any) {
      console.warn('Vendors fetch failed:', error?.message || 'Network error');
      setBackendAvailable(false);
    } finally {
      setVendorsLoading(false);
    }
  };

  // Fetch active SOS reports
  const fetchActiveSOSReports = async () => {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      if (!API_BASE_URL) {
        setBackendAvailable(false);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Fetch active alerts
      const response = await fetch(`${API_BASE_URL}/api/sos/active`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setActiveSOSReports(data || []);
        setBackendAvailable(true);
      }
      
      // Fetch resolved alerts
      const resolvedResponse = await fetch(`${API_BASE_URL}/api/sos/resolved`);
      if (resolvedResponse.ok) {
        const resolvedData = await resolvedResponse.json();
        setResolvedSOSReports(resolvedData || []);
      }
      
      // Fetch archived alerts
      const archivedResponse = await fetch(`${API_BASE_URL}/api/sos/archived`);
      if (archivedResponse.ok) {
        const archivedData = await archivedResponse.json();
        setArchivedSOSReports(archivedData || []);
      }
    } catch (error: any) {
      console.warn('SOS reports fetch failed:', error?.message || 'Network error');
      setBackendAvailable(false);
    }
  };
  
  // Check admin mode on mount
  useEffect(() => {
    const checkAdminMode = async () => {
      try {
        const adminMode = await AsyncStorage.getItem('admin_mode');
        setIsAdminMode(adminMode === 'true');
      } catch (e) {
        console.error('Error checking admin mode:', e);
      }
    };
    checkAdminMode();
  }, []);
  
  // Toggle admin mode (called by long press on Alerts title)
  const toggleAdminMode = async () => {
    try {
      const newMode = !isAdminMode;
      await AsyncStorage.setItem('admin_mode', newMode.toString());
      setIsAdminMode(newMode);
      Alert.alert(
        newMode ? '🔓 Admin Mode Enabled' : '🔒 Admin Mode Disabled',
        newMode ? 'You can now resolve alerts.' : 'Resolve button hidden.'
      );
    } catch (e) {
      console.error('Error toggling admin mode:', e);
    }
  };
  
  // Resolve alert with PIN
  const handleResolveAlert = (reportId: string) => {
    setSelectedReportForResolve(reportId);
    setAdminPinAction('resolve');
    setShowPinKeypad(true);
  };
  
  // View admin details with PIN
  const handleViewAdminDetails = (report: any) => {
    setSelectedAlertForAdmin(report);
    setAdminPinAction('view');
    setShowPinKeypad(true);
  };
  
  // Handle PIN success
  const handlePinSuccess = async () => {
    setShowPinKeypad(false);
    
    if (adminPinAction === 'resolve' && selectedReportForResolve) {
      // Resolve the alert
      try {
        const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/sos/resolve/${selectedReportForResolve}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: '2026' }),
        });
        
        if (response.ok) {
          Alert.alert('✅ Alert Resolved', 'The alert has been marked as resolved. A notification has been sent to all attendees.');
          fetchActiveSOSReports();
        } else {
          Alert.alert('Error', 'Failed to resolve alert. Please try again.');
        }
      } catch (e) {
        console.error('Error resolving alert:', e);
        Alert.alert('Error', 'Network error. Please try again.');
      }
      setSelectedReportForResolve(null);
    } else if (adminPinAction === 'view' && selectedAlertForAdmin) {
      // Fetch and show admin details
      try {
        const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/sos/admin/${selectedAlertForAdmin.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: '2026' }),
        });
        
        if (response.ok) {
          const adminData = await response.json();
          setSelectedAlertForAdmin(adminData);
          setShowAdminDetail(true);
        } else {
          Alert.alert('Error', 'Failed to fetch alert details. Please try again.');
        }
      } catch (e) {
        console.error('Error fetching admin details:', e);
        Alert.alert('Error', 'Network error. Please try again.');
      }
    }
    
    setAdminPinAction(null);
  };
  
  // Call reporter
  const callReporter = (phone: string) => {
    const phoneDigits = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${phoneDigits}`);
  };
  
  // Archive alert (called when countdown reaches 0)
  const archiveAlert = async (alertId: string) => {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      await fetch(`${API_BASE_URL}/api/sos/archive/${alertId}`, {
        method: 'POST',
      });
      fetchActiveSOSReports();
    } catch (e) {
      console.error('Error archiving alert:', e);
    }
  };
  
  // Countdown timer for resolved alerts
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          if (updated[id] > 0) {
            updated[id] -= 1;
          } else {
            archiveAlert(id);
            delete updated[id];
          }
        });
        return updated;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Initialize countdowns for resolved alerts
  useEffect(() => {
    resolvedSOSReports.forEach(alert => {
      if (!countdowns[alert.id] && alert.resolved_at) {
        const resolvedTime = new Date(alert.resolved_at).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - resolvedTime) / 1000);
        const remaining = Math.max(0, 30 * 60 - elapsed); // 30 minutes
        
        if (remaining > 0) {
          setCountdowns(prev => ({ ...prev, [alert.id]: remaining }));
        }
      }
    });
  }, [resolvedSOSReports]);
  
  // Format countdown
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Submit SOS report
  const submitSOSReport = async () => {
    // Check backend availability first
    if (!backendAvailable) {
      Alert.alert(
        'Service Unavailable',
        'The SOS service is currently offline. Please contact event staff directly for emergencies.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Validate required fields including reporter info
    if (!sosForm.name || !sosForm.sex || !sosForm.age || !sosForm.last_location) {
      Alert.alert('Missing Information', 'Please fill in Name, Sex, Age, and Last Location of the missing person.');
      return;
    }
    
    // Validate reporter info
    if (!sosForm.reporter_name || !sosForm.reporter_phone) {
      Alert.alert('Reporter Information Required', 'Please provide your name and phone number so we can contact you.');
      return;
    }
    
    // Validate phone number format
    if (!isValidPhone(sosForm.reporter_phone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit phone number.');
      return;
    }

    setSOSSubmitting(true);
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      if (!API_BASE_URL) {
        throw new Error('Backend not configured');
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/api/sos/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sosForm),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        // Close the form immediately
        setShowSOSForm(false);
        setSOSForm(initialSOSForm);
        fetchActiveSOSReports();
        
        // Then show confirmation
        Alert.alert(
          'Alert Sent',
          'Missing person alert has been sent to all event attendees. Please also notify event staff immediately.'
        );
      } else {
        Alert.alert('Error', 'Failed to send alert. Please try again or contact event staff directly.');
      }
    } catch (error: any) {
      console.warn('SOS submit failed:', error?.message || 'Network error');
      setBackendAvailable(false);
      Alert.alert(
        'Connection Error',
        'Unable to send SOS alert online. Please contact event staff directly for emergencies.\n\nFind the nearest Information Tent or Security personnel.',
        [{ text: 'OK' }]
      );
    } finally {
      setSOSSubmitting(false);
    }
  };

  // Cancel SOS report
  const cancelSOSReport = async (reportId: string) => {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      if (!API_BASE_URL) {
        throw new Error('Backend not configured');
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/api/sos/cancel/${reportId}`, {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        Alert.alert('Person Found', 'Thank you! The alert has been cancelled and all attendees notified.');
        fetchActiveSOSReports();
      }
    } catch (error: any) {
      console.warn('SOS cancel failed:', error?.message || 'Network error');
      Alert.alert('Connection Error', 'Unable to cancel alert. Please try again or contact event staff.');
    }
  };

  // Get filtered vendors
  const filteredVendors = selectedVendorType === 'All' 
    ? vendors 
    : vendors.filter(v => v.type === selectedVendorType);

  useEffect(() => {
    fetchApiEvents();
    fetchActiveSOSReports();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      setCurrentTime(new Date());
      fetchApiEvents();
      fetchActiveSOSReports();
      
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000);
      
      return () => clearInterval(interval);
    }, [])
  );

  const loadFavorites = async () => {
    const storedFavorites = await getFavorites();
    setFavorites(storedFavorites);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFavorites();
    setCurrentTime(new Date());
    setRefreshing(false);
  }, []);

  const happeningNow = getHappeningNow();
  const nextStarredSession = getNextStarredSession(favorites);
  const upcomingSessions = getUpcomingSessions().slice(0, 3);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeUntil = (dateString: string): string => {
    const target = new Date(dateString);
    const diff = target.getTime() - currentTime.getTime();
    
    if (diff <= 0) return 'Starting now';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `in ${hours}h ${minutes % 60}m`;
    }
    return `in ${minutes}m`;
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  // Get starred sessions from API events
  const getStarredSessions = () => {
    return apiEvents
      .filter(event => favorites.includes(event.id))
      .sort((a, b) => {
        // Sort by date then time
        const dateA = new Date(a.start_date);
        const dateB = new Date(b.start_date);
        return dateA.getTime() - dateB.getTime();
      });
  };

  const starredSessions = getStarredSessions();

  // Group starred sessions by date
  const groupedStarredSessions = starredSessions.reduce((acc, event) => {
    const date = event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }) : 'Unknown Date';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  const handleRemoveFromItinerary = async (sessionId: string) => {
    const result = await toggleFavorite(sessionId);
    setFavorites(result.favorites);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderSessionCard = (session: Session, showTimeUntil: boolean = false) => {
    const location = getLocationById(session.location_id);
    const typeColor = location ? getLocationTypeColor(location.type) : colors.primary;
    const iconName = location ? getLocationTypeIcon(location.type, location.utilitySubtype, location.fieldSubtype) : 'map-pin';
    
    return (
      <TouchableOpacity 
        key={session.id} 
        style={styles.sessionCardFull}
        onPress={() => router.push('/(tabs)/schedule')}
        activeOpacity={0.8}
      >
        <View style={[styles.sessionIconContainer, { backgroundColor: typeColor }]}>
          {location?.type === 'field' ? (
            <Feather name="truck" size={20} color="#FFFFFF" />
          ) : (
            <Feather name={iconName as any} size={20} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.sessionCardContent}>
          <Text style={styles.sessionCardTitle} numberOfLines={1}>{session.title}</Text>
          {location && (
            <Text style={styles.sessionCardLocation}>{location.name}</Text>
          )}
          <View style={styles.sessionCardTimeRow}>
            <Feather name="clock" size={12} color={colors.textMuted} />
            <Text style={styles.sessionCardTime}>
              {formatTime(session.start_time)} - {formatTime(session.end_time)}
            </Text>
            {showTimeUntil && (
              <Text style={styles.timeUntil}>{getTimeUntil(session.start_time)}</Text>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header Banner Image - Responsive */}
        <ResponsiveBanner />

        {/* Happening Now Section */}
        {happeningNow.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderLive}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.sectionTitleLive}>Happening Now</Text>
            </View>
            {happeningNow.map((session) => {
              const location = getLocationById(session.location_id);
              const typeColor = location ? getLocationTypeColor(location.type) : colors.primary;
              
              return (
                <TouchableOpacity 
                  key={session.id} 
                  style={[styles.liveSessionCard, { borderColor: typeColor }]}
                  onPress={() => router.push('/(tabs)/map')}
                  activeOpacity={0.8}
                >
                  <View style={styles.liveSessionContent}>
                    <Text style={styles.liveSessionTitle}>{session.title}</Text>
                    {location && (
                      <View style={styles.liveLocationRow}>
                        <Feather name="map-pin" size={14} color={typeColor} />
                        <Text style={[styles.liveLocationText, { color: typeColor }]}>
                          {location.name}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.liveTimeText}>
                      Until {formatTime(session.end_time)}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.goButton}>
                    <Feather name="navigation" size={18} color={colors.accent} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* My Next Session (Starred) */}
        {nextStarredSession && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.starredHeader}>
                <Feather name="star" size={18} color={colors.accent} />
                <Text style={styles.sectionTitleStarred}>My Next Session</Text>
              </View>
            </View>
            {renderSessionCard(nextStarredSession, true)}
          </View>
        )}

        {/* Quick Actions - 3 column grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/map')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                <Feather name="map" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Map</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/schedule')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
                <Feather name="calendar" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                fetchVendors();
                setShowVendors(true);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.vendor }]}>
                <Feather name="shopping-bag" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Vendors</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openLink('https://ipm26.itemorder.com/shop/home/')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.stage }]}>
                <Feather name="tag" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Tickets</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openLink('https://letscamp.ca/camps/ipm-2026')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.field }]}>
                <Feather name="sun" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Camping</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => openLink('https://ipm26.itemorder.com/shop/home/')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B0' }]}>
                <Feather name="gift" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Souvenirs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/itinerary')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.utility }]}>
                <Feather name="clipboard" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Personal Itinerary</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.sosCard]}
              onPress={() => {
                try {
                  setShowSOSWarning(true);
                } catch (err) {
                  console.warn('SOS click error:', err);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#D32F2F' }]}>
                <Feather name="alert-triangle" size={22} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionTitle, { color: '#D32F2F' }]}>SOS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.alertCard]}
              onPress={() => setShowActiveAlerts(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: activeSOSReports.length > 0 ? '#FF5722' : '#9E9E9E' }]}>
                <Feather name="bell" size={22} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionTitle, { color: activeSOSReports.length > 0 ? '#FF5722' : '#9E9E9E' }]}>
                Alerts ({activeSOSReports.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Sessions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Coming Up</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingSessions.length > 0 ? (
            upcomingSessions.map((session) => renderSessionCard(session, true))
          ) : (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No upcoming events</Text>
            </View>
          )}
        </View>

        {/* Bottom padding is now handled by contentContainerStyle */}
      </ScrollView>

      {/* My Itinerary Modal */}
      <Modal
        visible={showItinerary}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowItinerary(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather name="clipboard" size={24} color={colors.utility} />
                <Text style={styles.modalTitle}>My Itinerary</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowItinerary(false)}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Itinerary Content */}
            <ScrollView 
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {starredSessions.length === 0 ? (
                <View style={styles.emptyItinerary}>
                  <Feather name="star" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyItineraryTitle}>No events planned yet</Text>
                  <Text style={styles.emptyItineraryText}>
                    Star events from the Schedule to add them to your itinerary
                  </Text>
                  <TouchableOpacity 
                    style={styles.browseButton}
                    onPress={() => {
                      setShowItinerary(false);
                      router.push('/(tabs)/schedule');
                    }}
                  >
                    <Text style={styles.browseButtonText}>Browse Schedule</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.itinerarySummary}>
                    {starredSessions.length} event{starredSessions.length > 1 ? 's' : ''} planned
                  </Text>
                  {Object.entries(groupedStarredSessions).map(([date, dateEvents]) => (
                    <View key={date} style={styles.itineraryDateSection}>
                      <Text style={styles.itineraryDateHeader}>{date}</Text>
                      {dateEvents.map((event: any) => {
                        const typeColor = colors.primary;
                        
                        return (
                          <TouchableOpacity 
                            key={event.id} 
                            style={styles.itineraryCard}
                            onPress={() => {
                              setSelectedEvent(event);
                              setShowItinerary(false);
                              setTimeout(() => setShowEventDetails(true), 300);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.itineraryColorBar, { backgroundColor: typeColor }]} />
                            <View style={styles.itineraryCardContent}>
                              <View style={styles.itineraryTimeRow}>
                                <Feather name="clock" size={14} color={colors.textMuted} />
                                <Text style={styles.itineraryTime}>
                                  {event.start_time} - {event.end_time}
                                </Text>
                              </View>
                              <Text style={styles.itineraryTitle}>{event.title}</Text>
                              {event.location_name && (
                                <View style={styles.itineraryLocationRow}>
                                  <Feather name="map-pin" size={12} color={typeColor} />
                                  <Text style={[styles.itineraryLocation, { color: typeColor }]}>
                                    {event.location_name}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <TouchableOpacity 
                              style={styles.removeButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleRemoveFromItinerary(event.id);
                              }}
                            >
                              <Feather name="x-circle" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                  <View style={styles.itineraryFooter}>
                    <TouchableOpacity 
                      style={styles.addMoreButton}
                      onPress={() => {
                        setShowItinerary(false);
                        router.push('/(tabs)/schedule');
                      }}
                    >
                      <Feather name="plus" size={18} color={colors.accent} />
                      <Text style={styles.addMoreText}>Add more events</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Event Details Modal */}
      <Modal
        visible={showEventDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEventDetails(false)}
      >
        <View style={styles.eventModalOverlay}>
          <View style={styles.eventModalContent}>
            {selectedEvent && (
              <>
                {/* Modal Header */}
                <View style={styles.eventModalHeader}>
                  <View style={styles.eventModalTitleContainer}>
                    <Text style={styles.eventModalTitle}>{selectedEvent.title}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        handleRemoveFromItinerary(selectedEvent.id);
                      }}
                      style={styles.eventModalStarButton}
                    >
                      <Feather
                        name="star"
                        size={24}
                        color={favorites.includes(selectedEvent.id) ? colors.accent : colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowEventDetails(false)}
                    style={styles.eventModalCloseButton}
                  >
                    <Feather name="x" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Modal Body */}
                <ScrollView style={styles.eventModalBody} showsVerticalScrollIndicator={false}>
                  {/* Time & Date */}
                  <View style={styles.eventDetailSection}>
                    <View style={styles.eventDetailRow}>
                      <View style={styles.eventDetailIcon}>
                        <Feather name="clock" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.eventDetailTextContainer}>
                        <Text style={styles.eventDetailLabel}>Time</Text>
                        <Text style={styles.eventDetailValue}>
                          {selectedEvent.start_time} - {selectedEvent.end_time}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.eventDetailRow}>
                      <View style={styles.eventDetailIcon}>
                        <Feather name="calendar" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.eventDetailTextContainer}>
                        <Text style={styles.eventDetailLabel}>Date</Text>
                        <Text style={styles.eventDetailValue}>
                          {selectedEvent.start_date}
                        </Text>
                        {selectedEvent.days_active && (
                          <Text style={styles.eventDetailSubValue}>
                            Active: {selectedEvent.days_active}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Location - Clickable to show on map */}
                  {selectedEvent.location_name && (
                    <TouchableOpacity 
                      style={[styles.eventDetailSection, styles.locationClickable]}
                      onPress={() => {
                        console.log('Location clicked:', selectedEvent.location_name);
                        setShowEventDetails(false);
                        router.push({
                          pathname: '/(tabs)/map',
                          params: { location: selectedEvent.location_name, showOnly: 'true' }
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.eventDetailRow}>
                        <View style={styles.eventDetailIcon}>
                          <Feather name="map-pin" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.eventDetailTextContainer}>
                          <Text style={styles.eventDetailLabel}>Location</Text>
                          <Text style={[styles.eventDetailValue, { color: colors.primary }]}>
                            {selectedEvent.location_name}
                          </Text>
                          <Text style={styles.tapToViewMap}>Tap to view on map</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color={colors.primary} />
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Category */}
                  {selectedEvent.category && (
                    <View style={styles.eventDetailSection}>
                      <View style={styles.eventDetailRow}>
                        <View style={styles.eventDetailIcon}>
                          <Feather name="tag" size={20} color={colors.accent} />
                        </View>
                        <View style={styles.eventDetailTextContainer}>
                          <Text style={styles.eventDetailLabel}>Category</Text>
                          <Text style={styles.eventDetailValue}>
                            {selectedEvent.category}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Description */}
                  {selectedEvent.description && (
                    <View style={styles.eventDescriptionSection}>
                      <Text style={styles.eventDescriptionLabel}>Description</Text>
                      <Text style={styles.eventDescriptionText}>
                        {selectedEvent.description}
                      </Text>
                    </View>
                  )}

                  <View style={{ height: 40 }} />
                </ScrollView>

                {/* Footer Button */}
                <View style={styles.eventModalFooter}>
                  <TouchableOpacity
                    style={[
                      styles.eventModalButton,
                      favorites.includes(selectedEvent.id) && styles.eventModalButtonRemove
                    ]}
                    onPress={() => {
                      handleRemoveFromItinerary(selectedEvent.id);
                    }}
                  >
                    <Feather
                      name={favorites.includes(selectedEvent.id) ? 'check' : 'plus'}
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.eventModalButtonText}>
                      {favorites.includes(selectedEvent.id) ? 'In Itinerary' : 'Add to Itinerary'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Vendors Modal */}
      <Modal
        visible={showVendors}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVendors(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather name="shopping-bag" size={24} color={colors.vendor} />
                <Text style={styles.modalTitle}>Vendors</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowVendors(false)}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Filter Chips */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}
            >
              {vendorTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    selectedVendorType === type && styles.filterChipActive
                  ]}
                  onPress={() => setSelectedVendorType(type)}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedVendorType === type && styles.filterChipTextActive
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {vendorsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading vendors...</Text>
                </View>
              ) : filteredVendors.length === 0 ? (
                <View style={styles.emptyItinerary}>
                  <Feather name="shopping-bag" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyItineraryTitle}>No vendors found</Text>
                </View>
              ) : (
                filteredVendors.map((vendor) => (
                  <View key={vendor.id} style={styles.vendorCard}>
                    <View style={styles.vendorHeader}>
                      <Text style={styles.vendorName}>{vendor.name}</Text>
                      <View style={styles.vendorTypeBadge}>
                        <Text style={styles.vendorTypeText}>{vendor.type}</Text>
                      </View>
                    </View>
                    {vendor.location && (
                      <TouchableOpacity 
                        style={styles.vendorRow}
                        onPress={() => {
                          setShowVendors(false);
                          router.push({
                            pathname: '/(tabs)/map',
                            params: { location: vendor.location, showOnly: 'true' }
                          });
                        }}
                      >
                        <Feather name="map-pin" size={14} color={colors.primary} />
                        <Text style={[styles.vendorDetail, { color: colors.primary }]}>{vendor.location}</Text>
                        <Feather name="external-link" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    )}
                    {vendor.hours_of_operation && (
                      <View style={styles.vendorRow}>
                        <Feather name="clock" size={14} color={colors.textMuted} />
                        <Text style={styles.vendorDetail}>{vendor.hours_of_operation}</Text>
                      </View>
                    )}
                    {vendor.days_of_operation && (
                      <View style={styles.vendorRow}>
                        <Feather name="calendar" size={14} color={colors.textMuted} />
                        <Text style={styles.vendorDetail}>{vendor.days_of_operation}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SOS Warning Modal */}
      {showSOSWarning && (
        <Modal
          visible={true}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowSOSWarning(false)}
        >
          <View style={styles.sosModalOverlay}>
            <View style={styles.sosModalContent}>
              <View style={styles.sosWarningIcon}>
                <Feather name="alert-triangle" size={48} color="#D32F2F" />
              </View>
              <Text style={styles.sosWarningTitle}>Missing Person Alert</Text>
              <Text style={styles.sosWarningText}>
                Only press the SOS button if you are seriously missing a person. This will send an emergency alert to ALL event attendees.
              </Text>
              <TouchableOpacity
                style={styles.sosButton}
                onPress={() => {
                  setShowSOSWarning(false);
                  setTimeout(() => setShowSOSConfirm(true), 100);
                }}
              >
                <Feather name="alert-circle" size={24} color="#FFFFFF" />
                <Text style={styles.sosButtonText}>SOS - Report Missing Person</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sosCancelButton}
                onPress={() => setShowSOSWarning(false)}
              >
                <Text style={styles.sosCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* SOS Confirmation Modal */}
      {showSOSConfirm && (
        <Modal
          visible={true}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowSOSConfirm(false)}
        >
          <View style={styles.sosModalOverlay}>
            <View style={styles.sosModalContent}>
              <Feather name="alert-octagon" size={48} color="#D32F2F" />
              <Text style={styles.sosWarningTitle}>Are you sure?</Text>
              <Text style={styles.sosWarningText}>
                This will send an emergency notification to thousands of event attendees. Please confirm this is a real emergency.
              </Text>
              <TouchableOpacity
                style={styles.sosButton}
                onPress={() => {
                  setShowSOSConfirm(false);
                  setTimeout(() => setShowSOSForm(true), 100);
                }}
              >
                <Text style={styles.sosButtonText}>Yes, Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sosCancelButton}
                onPress={() => setShowSOSConfirm(false)}
              >
                <Text style={styles.sosCancelText}>No, Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* SOS Form Modal */}
      {showSOSForm && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSOSForm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '95%' }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Feather name="alert-triangle" size={24} color="#D32F2F" />
                  <Text style={[styles.modalTitle, { color: '#D32F2F' }]}>Missing Person Details</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    setShowSOSForm(false);
                    setSOSForm(initialSOSForm);
                  }}
                  style={styles.modalCloseButton}
                >
                  <Feather name="x" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.formLabel}>Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={sosForm.name}
                  onChangeText={(text) => setSOSForm({...sosForm, name: text})}
                  placeholder="Full name of missing person"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.formLabel}>Sex *</Text>
                <View style={styles.formButtonRow}>
                  {['Male', 'Female'].map((sex) => (
                    <TouchableOpacity
                      key={sex}
                    style={[
                      styles.formSelectButton,
                      sosForm.sex === sex && styles.formSelectButtonActive
                    ]}
                    onPress={() => setSOSForm({...sosForm, sex})}
                  >
                    <Text style={[
                      styles.formSelectText,
                      sosForm.sex === sex && styles.formSelectTextActive
                    ]}>{sex}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Age *</Text>
              <TextInput
                style={styles.formInput}
                value={sosForm.age}
                onChangeText={(text) => setSOSForm({...sosForm, age: text})}
                placeholder="Approximate age"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              <Text style={styles.formLabel}>Height</Text>
              <TextInput
                style={styles.formInput}
                value={sosForm.height}
                onChangeText={(text) => setSOSForm({...sosForm, height: text})}
                placeholder="e.g., 5 feet 6 inches or 170cm"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.formLabel}>Hair Color</Text>
              <TextInput
                style={styles.formInput}
                value={sosForm.hair_color}
                onChangeText={(text) => setSOSForm({...sosForm, hair_color: text})}
                placeholder="e.g., Brown, Blonde, Black"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.formLabel}>Glasses</Text>
              <View style={styles.formButtonRow}>
                {[{label: 'Yes', value: true}, {label: 'No', value: false}].map((option) => (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.formSelectButton,
                      sosForm.glasses === option.value && styles.formSelectButtonActive
                    ]}
                    onPress={() => setSOSForm({...sosForm, glasses: option.value})}
                  >
                    <Text style={[
                      styles.formSelectText,
                      sosForm.glasses === option.value && styles.formSelectTextActive
                    ]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Shirt Color</Text>
              <TextInput
                style={styles.formInput}
                value={sosForm.shirt_color}
                onChangeText={(text) => setSOSForm({...sosForm, shirt_color: text})}
                placeholder="e.g., Red t-shirt, Blue flannel"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.formLabel}>Pants/Shorts Color</Text>
              <TextInput
                style={styles.formInput}
                value={sosForm.pants_color}
                onChangeText={(text) => setSOSForm({...sosForm, pants_color: text})}
                placeholder="e.g., Blue jeans, Khaki shorts"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.formLabel}>Last Location Seen *</Text>
              <TextInput
                style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                value={sosForm.last_location}
                onChangeText={(text) => setSOSForm({...sosForm, last_location: text})}
                placeholder="Where was the person last seen?"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.formLabel}>Additional Description</Text>
              <TextInput
                style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                value={sosForm.description}
                onChangeText={(text) => setSOSForm({...sosForm, description: text})}
                placeholder="Any other details that may help identify the person"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <View style={styles.formDivider} />
              <Text style={styles.formSectionTitle}>Your Contact Information</Text>
              <Text style={styles.formSectionSubtitle}>This info is private and only visible to event staff</Text>

              <Text style={styles.formLabel}>Your Name *</Text>
              <TextInput
                style={styles.formInput}
                value={sosForm.reporter_name}
                onChangeText={(text) => setSOSForm({...sosForm, reporter_name: text})}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.formLabel}>Your Phone Number *</Text>
              <TextInput
                style={styles.formInput}
                value={sosForm.reporter_phone}
                onChangeText={(text) => setSOSForm({...sosForm, reporter_phone: formatPhoneNumber(text)})}
                placeholder="(519) XXX-XXXX"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={14}
              />

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.eventModalFooter}>
              <TouchableOpacity
                style={[
                  styles.sosButton, 
                  (sosSubmitting || !sosForm.reporter_name || !isValidPhone(sosForm.reporter_phone)) && { opacity: 0.5, backgroundColor: colors.textMuted }
                ]}
                onPress={submitSOSReport}
                disabled={sosSubmitting || !sosForm.reporter_name || !isValidPhone(sosForm.reporter_phone)}
              >
                {sosSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="send" size={20} color="#FFFFFF" />
                    <Text style={styles.sosButtonText}>Send Alert</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      )}

      {/* Active Alerts Modal - Hide when PIN keypad is showing */}
      {showActiveAlerts && !showPinKeypad && !showAdminDetail && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowActiveAlerts(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  style={styles.modalTitleRow}
                  onLongPress={toggleAdminMode}
                  delayLongPress={1000}
                >
                  <Feather name="bell" size={24} color="#FF5722" />
                  <Text style={[styles.modalTitle, { color: '#FF5722' }]}>
                    Alert Management {isAdminMode ? '🔓' : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setShowActiveAlerts(false)}
                  style={styles.modalCloseButton}
                >
                  <Feather name="x" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* ACTIVE ALERTS - RED */}
              {activeSOSReports.length > 0 && (
                <View style={styles.alertSection}>
                  <Text style={styles.alertSectionTitle}>🚨 Active Alerts</Text>
                  {activeSOSReports.map((report) => (
                    <View key={report.id} style={[styles.alertCard, styles.alertCardActive]}>
                      <View style={styles.alertHeader}>
                        <Feather name="alert-triangle" size={20} color="#FFFFFF" />
                        <Text style={[styles.alertTitle, { color: '#FFFFFF' }]}>Missing: {report.name}</Text>
                      </View>
                      
                      {/* PUBLIC INFO - Only name, description, last seen */}
                      <View style={styles.alertDetails}>
                        <Text style={[styles.alertDetail, { color: '#FFFFFF' }]}>Sex: {report.sex} | Age: {report.age}</Text>
                        {report.height && <Text style={[styles.alertDetail, { color: '#FFFFFF' }]}>Height: {report.height}</Text>}
                        {report.hair_color && <Text style={[styles.alertDetail, { color: '#FFFFFF' }]}>Hair: {report.hair_color}</Text>}
                        <Text style={[styles.alertDetail, { color: '#FFFFFF' }]}>Glasses: {report.glasses ? 'Yes' : 'No'}</Text>
                        {report.shirt_color && <Text style={[styles.alertDetail, { color: '#FFFFFF' }]}>Shirt: {report.shirt_color}</Text>}
                        {report.pants_color && <Text style={[styles.alertDetail, { color: '#FFFFFF' }]}>Pants: {report.pants_color}</Text>}
                        <Text style={[styles.alertDetail, { color: '#FFFFFF', fontWeight: '600', marginTop: 8 }]}>
                          📍 Last seen: {report.last_location}
                        </Text>
                        {report.description && (
                          <Text style={[styles.alertDetail, { color: '#FFFFFF', marginTop: 4 }]}>
                            📝 {report.description}
                          </Text>
                        )}
                      </View>
                      
                      {/* HIDDEN ADMIN BUTTON - requires PIN to view reporter info */}
                      <TouchableOpacity
                        style={styles.adminButton}
                        onPress={() => handleViewAdminDetails(report)}
                      >
                        <Feather name="shield" size={16} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.adminButtonText}>Admin</Text>
                      </TouchableOpacity>
                      
                      {/* Regular Cancel Button */}
                      <TouchableOpacity
                        style={styles.foundButton}
                        onPress={() => {
                          Alert.alert(
                            'Person Found?',
                            'Confirm that this person has been found and cancel the alert?',
                            [
                              { text: 'No', style: 'cancel' },
                              { text: 'Yes, Person Found', onPress: () => cancelSOSReport(report.id) }
                            ]
                          );
                        }}
                      >
                        <Feather name="check-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.foundButtonText}>Person Found - Cancel Alert</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              {/* RESOLVED ALERTS - GREEN */}
              {resolvedSOSReports.length > 0 && (
                <View style={styles.alertSection}>
                  <Text style={[styles.alertSectionTitle, { color: '#16A34A' }]}>✅ Resolved Alerts</Text>
                  {resolvedSOSReports.map((report) => (
                    <View key={report.id} style={[styles.alertCard, styles.alertCardResolved]}>
                      <View style={styles.alertHeader}>
                        <Feather name="check-circle" size={20} color="#FFFFFF" />
                        <Text style={[styles.alertTitle, { color: '#FFFFFF' }]}>RESOLVED: {report.name}</Text>
                      </View>
                      <Text style={[styles.alertDetail, { color: '#FFFFFF', marginTop: 8 }]}>
                        This person has been found safely.
                      </Text>
                      {countdowns[report.id] && (
                        <Text style={[styles.alertDetail, { color: 'rgba(255,255,255,0.9)', marginTop: 8, fontStyle: 'italic' }]}>
                          Moving to archive in {formatCountdown(countdowns[report.id])}
                        </Text>
                      )}
                      
                      {/* HIDDEN ADMIN BUTTON */}
                      <TouchableOpacity
                        style={[styles.adminButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
                        onPress={() => handleViewAdminDetails(report)}
                      >
                        <Feather name="shield" size={16} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.adminButtonText}>Admin</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              {/* ARCHIVED ALERTS */}
              {archivedSOSReports.length > 0 && (
                <View style={styles.alertSection}>
                  <Text style={[styles.alertSectionTitle, { color: colors.textMuted }]}>📁 Past Alerts</Text>
                  {archivedSOSReports.map((report) => (
                    <View key={report.id} style={[styles.alertCard, styles.alertCardArchived]}>
                      <View style={styles.alertHeader}>
                        <Feather name="archive" size={20} color={colors.textMuted} />
                        <Text style={[styles.alertTitle, { color: colors.textMuted }]}>{report.name}</Text>
                      </View>
                      <Text style={[styles.alertDetail, { color: colors.textMuted }]}>
                        Resolved and archived
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {/* EMPTY STATE */}
              {activeSOSReports.length === 0 && resolvedSOSReports.length === 0 && archivedSOSReports.length === 0 && (
                <View style={styles.emptyItinerary}>
                  <Feather name="check-circle" size={48} color={colors.success} />
                  <Text style={styles.emptyItineraryTitle}>No Alerts</Text>
                  <Text style={styles.emptyItineraryText}>There are currently no missing person alerts.</Text>
                </View>
              )}
              
              {/* Admin Mode Hint */}
              <Text style={styles.adminHint}>
                💡 Long press the title to toggle admin mode
              </Text>
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}
      
      {/* Admin Detail Modal - Shows reporter info after PIN verification */}
      {showAdminDetail && selectedAlertForAdmin && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowAdminDetail(false);
            setSelectedAlertForAdmin(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '70%' }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Feather name="shield" size={24} color={colors.primary} />
                  <Text style={[styles.modalTitle, { color: colors.primary }]}>Admin View</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    setShowAdminDetail(false);
                    setSelectedAlertForAdmin(null);
                  }}
                  style={styles.modalCloseButton}
                >
                  <Feather name="x" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Alert Info */}
                <View style={styles.adminDetailSection}>
                  <Text style={styles.adminDetailLabel}>Missing Person</Text>
                  <Text style={styles.adminDetailValue}>{selectedAlertForAdmin.name}</Text>
                </View>
                
                <View style={styles.adminDetailSection}>
                  <Text style={styles.adminDetailLabel}>Status</Text>
                  <Text style={[
                    styles.adminDetailValue, 
                    { color: selectedAlertForAdmin.status === 'active' ? '#D32F2F' : '#16A34A' }
                  ]}>
                    {selectedAlertForAdmin.status === 'active' ? '🔴 ACTIVE' : '✅ RESOLVED'}
                  </Text>
                </View>
                
                <View style={styles.adminDetailSection}>
                  <Text style={styles.adminDetailLabel}>Last Seen</Text>
                  <Text style={styles.adminDetailValue}>{selectedAlertForAdmin.last_location}</Text>
                </View>

                {selectedAlertForAdmin.description && (
                  <View style={styles.adminDetailSection}>
                    <Text style={styles.adminDetailLabel}>Description</Text>
                    <Text style={styles.adminDetailValue}>{selectedAlertForAdmin.description}</Text>
                  </View>
                )}

                {/* Reporter Info - Private */}
                <View style={styles.adminDivider} />
                <Text style={styles.adminPrivateLabel}>🔒 Private Reporter Information</Text>
                
                <View style={styles.adminDetailSection}>
                  <Text style={styles.adminDetailLabel}>Reporter Name</Text>
                  <Text style={styles.adminDetailValue}>{selectedAlertForAdmin.reporter_name || 'Not provided'}</Text>
                </View>
                
                <View style={styles.adminDetailSection}>
                  <Text style={styles.adminDetailLabel}>Reporter Phone</Text>
                  <Text style={styles.adminDetailValue}>{selectedAlertForAdmin.reporter_phone || 'Not provided'}</Text>
                </View>

                {/* Call Button */}
                {selectedAlertForAdmin.reporter_phone && (
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => callReporter(selectedAlertForAdmin.reporter_phone)}
                  >
                    <Feather name="phone" size={20} color="#FFFFFF" />
                    <Text style={styles.callButtonText}>Call Reporter</Text>
                  </TouchableOpacity>
                )}

                {/* Resolve Button (if active) */}
                {selectedAlertForAdmin.status === 'active' && (
                  <TouchableOpacity
                    style={styles.resolveButtonLarge}
                    onPress={() => {
                      setShowAdminDetail(false);
                      handleResolveAlert(selectedAlertForAdmin.id);
                    }}
                  >
                    <Feather name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.resolveButtonLargeText}>Resolve This Alert</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
      
      {/* PIN Keypad Modal */}
      <PinKeypad
        visible={showPinKeypad}
        onClose={() => {
          setShowPinKeypad(false);
          setSelectedReportForResolve(null);
          setAdminPinAction(null);
        }}
        onSuccess={handlePinSuccess}
        correctPin="2026"
        title={adminPinAction === 'resolve' ? 'Enter PIN to Resolve' : 'Enter Admin PIN'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4, // Small padding to ensure no overlap with top ad
    paddingBottom: 180, // Critical: allows SOS/Alerts buttons to scroll clear of floating ad
  },
  // Old banner styles removed - now using ResponsiveBanner component
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLive: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(107, 142, 35, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.5,
  },
  sectionTitleLive: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  starredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleStarred: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 8,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  liveSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 12,
  },
  liveSessionContent: {
    flex: 1,
  },
  liveSessionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  liveLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveLocationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  liveTimeText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  goButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  actionCard: {
    width: '31%',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  sosCard: {
    borderWidth: 1,
    borderColor: '#D32F2F',
  },
  alertCard: {
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sessionCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 50,
    marginBottom: 12,
  },
  sessionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  sessionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  sessionCardLocation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  sessionCardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionCardTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  timeUntil: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  starredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  starredBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starredBannerText: {
    flex: 1,
  },
  starredBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  starredBannerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  bottomPadding: {
    height: 150, // Spacer to scroll content above floating ad
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
    padding: 20,
  },
  emptyItinerary: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyItineraryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyItineraryText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  itinerarySummary: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  itineraryDateSection: {
    marginBottom: 20,
  },
  itineraryDateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itineraryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  itineraryColorBar: {
    width: 4,
  },
  itineraryCardContent: {
    flex: 1,
    padding: 14,
  },
  itineraryTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  itineraryTime: {
    fontSize: 13,
    color: colors.textMuted,
  },
  itineraryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itineraryLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itineraryLocation: {
    fontSize: 13,
    fontWeight: '500',
  },
  removeButton: {
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  itineraryFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 25,
  },
  addMoreText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  // Event Details Modal styles
  eventModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  eventModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
  },
  eventModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eventModalTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  eventModalStarButton: {
    padding: 4,
  },
  eventModalCloseButton: {
    padding: 4,
  },
  eventModalBody: {
    flex: 1,
    padding: 20,
  },
  eventDetailSection: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventDetailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventDetailTextContainer: {
    flex: 1,
  },
  eventDetailLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  eventDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  eventDetailSubValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  eventDescriptionSection: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  eventDescriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  eventDescriptionText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  locationClickable: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  tapToViewMap: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  eventModalFooter: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  eventModalButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  eventModalButtonRemove: {
    backgroundColor: colors.field,
  },
  eventModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Filter styles
  filterScroll: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  // Vendor styles
  vendorCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  vendorTypeBadge: {
    backgroundColor: colors.vendor,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vendorTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  vendorDetail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  // SOS Modal styles
  sosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sosModalContent: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  sosWarningIcon: {
    marginBottom: 16,
  },
  sosWarningTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#D32F2F',
    marginBottom: 12,
    textAlign: 'center',
  },
  sosWarningText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  sosButton: {
    backgroundColor: '#D32F2F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    width: '100%',
    gap: 10,
    marginBottom: 12,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sosCancelButton: {
    padding: 12,
  },
  sosCancelText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  // Form styles
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formSelectButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  formSelectButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  formSelectText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  formSelectTextActive: {
    color: '#FFFFFF',
  },
  // Active alerts styles
  alertCardStyle: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D32F2F',
  },
  alertDetails: {
    marginBottom: 16,
  },
  alertDetail: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  foundButton: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  foundButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Alert Management styles
  alertSection: {
    marginBottom: 24,
  },
  alertSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D32F2F',
    marginBottom: 12,
  },
  alertCardActive: {
    backgroundColor: '#D32F2F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
  },
  alertCardResolved: {
    backgroundColor: '#16A34A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
  },
  alertCardArchived: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resolveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  resolveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  adminHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 16,
  },
  // Form section styles
  formDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  formSectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  // Admin button on alert cards
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignSelf: 'flex-start',
  },
  adminButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  // Admin detail modal styles
  adminDetailSection: {
    marginBottom: 16,
  },
  adminDetailLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adminDetailValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  adminDivider: {
    height: 2,
    backgroundColor: colors.primary,
    marginVertical: 20,
    opacity: 0.3,
  },
  adminPrivateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
  },
  callButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resolveButtonLarge: {
    backgroundColor: '#D32F2F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 16,
  },
  resolveButtonLargeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
