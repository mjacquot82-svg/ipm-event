import React, { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSuggestionGate } from '../services/itinerarySuggestionPolicy';
import NotificationOptIn from './NotificationOptIn';
import { colors } from '../theme/colors';

// Conservatively suppress granted, denied, unsupported and unknown states.
// This reads browser state only; it never initializes the provider SDK.
const eligible = () => Platform.OS === 'web' && typeof Notification !== 'undefined'
  && Notification.permission === 'default';
const reserveSuggestion = createSuggestionGate(AsyncStorage, eligible);

export default function ItineraryNotificationSuggestion({ successfulAddition }: { successfulAddition: number }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState(false);
  useEffect(() => {
    if (!successfulAddition) return;
    let active = true;
    void reserveSuggestion().then(show => { if (active && show && eligible()) setVisible(true); });
    return () => { active = false; };
  }, [successfulAddition]);
  if (!visible) return null;
  return <>
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.copy}>Your itinerary is saved. Want important IPM announcements too? Notifications are optional.</Text>
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { if (eligible()) setOptions(true); else setVisible(false); }}><Text style={styles.link}>Notification options</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => setVisible(false)}><Text style={styles.link}>Not now</Text></TouchableOpacity>
      </View>
    </View>
    <Modal visible={options} transparent animationType="fade" onRequestClose={() => { setOptions(false); setVisible(false); }}>
      <View style={styles.overlay}><View style={styles.dialog}><ScrollView>
        {options ? <NotificationOptIn initiallyExpanded /> : null}
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { setOptions(false); setVisible(false); }}><Text style={styles.link}>Back to schedule</Text></TouchableOpacity>
      </ScrollView></View></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  card: { padding: 12, marginHorizontal: 16, marginBottom: 80, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  copy: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, padding: 16, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 16, padding: 8 },
});
