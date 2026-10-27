// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import colors from '../src/theme/colors';
import { attendeePageContent, useAttendeeLayout } from '../src/theme/attendeePageLayout';
import {
  formatDollars, getVolunteerGlassesStatus, orderTotalCents, PRICE_PER_SET_CENTS,
  submitVolunteerGlassesOrder, unlockVolunteerGlasses, VolunteerGlassesInfo,
} from '../src/services/volunteerGlassesService';

export const CLOSING_LABEL = 'Deadline to order nov 15';

const GLASS_IMAGES: Record<string, number> = {
  colored_logo: require('../assets/images/volunteer-glasses/colored-logo.jpg'),
  large_etched: require('../assets/images/volunteer-glasses/large-etched.jpg'),
  short_etched: require('../assets/images/volunteer-glasses/short-etched.jpg'),
};

const FALLBACK_STYLES = [
  { id: 'colored_logo', name: 'Colored Logo', description: 'Pint glass with the full-colour IPM logo' },
  { id: 'large_etched', name: 'Large Etched', description: 'Tall glass with the etched IPM logo' },
  { id: 'short_etched', name: 'Short Etched', description: 'Short rocks glass with the etched IPM logo' },
];

export default function VolunteerGlassesScreen() {
  const router = useRouter();
  const { sectionStyle } = useAttendeeLayout();
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<VolunteerGlassesInfo | null>(null);
  const [closed, setClosed] = useState(false);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({ colored_logo: 0, large_etched: 0, short_etched: 0 });
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    getVolunteerGlassesStatus().then((s) => {
      setClosed(!s.open); setClosesAt(s.closes_at);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!closesAt || closed) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkDeadline = () => {
      const remaining = Date.parse(closesAt) - Date.now();
      if (!Number.isFinite(remaining)) return;
      if (remaining <= 0) setClosed(true);
      else timer = setTimeout(checkDeadline, Math.min(remaining, 60_000));
    };
    checkDeadline();
    return () => clearTimeout(timer);
  }, [closesAt, closed]);

  const total = useMemo(() => orderTotalCents(quantities, info?.price_per_set_cents ?? PRICE_PER_SET_CENTS), [quantities, info]);
  const totalSets = Object.values(quantities).reduce((a, b) => a + b, 0);
  const styles_ = info?.styles ?? FALLBACK_STYLES;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const unlock = async () => {
    setBusy(true); setError(null);
    try {
      const result = await unlockVolunteerGlasses(password);
      setInfo(result); setClosed(!result.open); setClosesAt(result.closes_at);
    } catch (e) {
      setError((e as Error).message === 'Incorrect password' ? 'That password is not correct.' : (e as Error).message);
    } finally { setBusy(false); }
  };

  const change = (id: string, delta: number) =>
    setQuantities((q) => ({ ...q, [id]: Math.max(0, Math.min(50, (q[id] || 0) + delta)) }));

  const submit = async () => {
    setError(null);
    if (!name.trim() || contact.trim().length < 3) { setError('Please enter your name and a phone number or email.'); return; }
    if (totalSets === 0) { setError('Choose at least one set.'); return; }
    setBusy(true);
    try {
      const result = await submitVolunteerGlassesOrder(password, { name, contact, quantities });
      setConfirmation(`Thanks ${name.trim()}! Your order for ${result.total_sets} set${result.total_sets === 1 ? '' : 's'} (${formatDollars(result.total_cents)}) is in. Cash payment at pickup.`);
    } catch (e) {
      if ((e as { status?: number }).status === 403) setClosed(true);
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[attendeePageContent, styles.scrollContent]}>
        <View style={sectionStyle}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="arrow-left" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle} accessibilityRole="header">Volunteer Glasses Pre-Order</Text>
          <Text style={styles.body}>Glassware is available as a set of two.</Text>
          <Text style={styles.body}>No mix and matching.</Text>
          <Text style={styles.body}>3 styles to choose from</Text>
          <View style={styles.notice}>
            <Feather name="dollar-sign" size={18} color={colors.primaryDark} />
            <Text style={styles.noticeText}>Cash payment at pickup $16 per set of 2 glasses</Text>
          </View>
          <Text style={styles.body}>Pickup December 17th at the Chepstow Lions Park from 5-8pm. If you cannot be there send someone on your behalf with payment</Text>
          <Text style={styles.closing}>{CLOSING_LABEL}</Text>

          {closed ? (
            <View style={styles.card}><Text style={styles.sectionTitle}>Pre-order closed</Text>
              <Text style={styles.body}>The volunteer glasses pre-order has closed. Thank you!</Text></View>
          ) : !info ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Volunteers only</Text>
              <Text style={styles.body}>Enter the volunteer password to order.</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry
                placeholder="Password" accessibilityLabel="Volunteer password" onSubmitEditing={unlock} />
              <TouchableOpacity style={styles.primaryButton} onPress={unlock} disabled={busy || !password}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Unlock</Text>}
              </TouchableOpacity>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          ) : confirmation ? (
            <View style={styles.card}><Text style={styles.sectionTitle}>Order received</Text><Text style={styles.body}>{confirmation}</Text></View>
          ) : (
            <>
              {styles_.map((s) => (
                <View key={s.id} style={styles.productCard}>
                  <Image source={GLASS_IMAGES[s.id]} style={styles.productImage} resizeMode="contain" accessibilityLabel={s.description} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{s.name}</Text>
                    <Text style={styles.productDesc}>{s.description}</Text>
                    <Text style={styles.productPrice}>$16 / set of 2</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => change(s.id, -1)} accessibilityLabel={`Fewer ${s.name} sets`}><Feather name="minus" size={18} color={colors.primary} /></TouchableOpacity>
                      <Text style={styles.qty} accessibilityLabel={`${s.name} sets`}>{quantities[s.id] || 0}</Text>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => change(s.id, 1)} accessibilityLabel={`More ${s.name} sets`}><Feather name="plus" size={18} color={colors.primary} /></TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
              <View style={styles.card}>
                <Text style={styles.label}>Your name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />
                <Text style={styles.label}>Phone or email</Text>
                <TextInput style={styles.input} value={contact} onChangeText={setContact} placeholder="So we can reach you at pickup" />
                <Text style={styles.total}>Total: {totalSets} set{totalSets === 1 ? '' : 's'} · {formatDollars(total)}</Text>
                <Text style={styles.body}>Cash payment at pickup.</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Place pre-order</Text>}
                </TouchableOpacity>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  pageTitle: { color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '800', marginBottom: 6 },
  closing: { color: colors.primaryDark, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  sectionTitle: { color: colors.textPrimary, fontSize: 21, fontWeight: '800', marginBottom: 10 },
  body: { color: colors.textPrimary, fontSize: 16, lineHeight: 24, marginBottom: 10 },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#fff', marginBottom: 10 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF4F1', borderLeftWidth: 4, borderLeftColor: colors.primary, borderRadius: 10, padding: 14, marginBottom: 14 },
  noticeText: { flex: 1, color: colors.primaryDark, fontSize: 16, fontWeight: '800' },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 14, marginTop: 6 },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  error: { color: '#B00020', fontSize: 15, fontWeight: '700', marginTop: 10 },
  productCard: { flexDirection: 'row', gap: 14, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 },
  productImage: { width: 96, height: 130, backgroundColor: '#fff', borderRadius: 10 },
  productName: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' },
  productDesc: { color: colors.textSecondary, fontSize: 14, marginVertical: 4 },
  productPrice: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  qty: { minWidth: 28, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  total: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 8, marginBottom: 4 },
});
