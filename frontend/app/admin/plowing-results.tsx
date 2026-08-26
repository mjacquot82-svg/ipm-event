// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import {
  DemoPlowingResults,
  DemoResultCompetitor,
  DemoResultGroup,
  DemoResultStatus,
  getAdminPlowingResults,
  getCurrentOrganizer,
  publishAdminPlowingResults,
  resetAdminPlowingResults,
} from '../../src/services/adminAuthService';

const IS_STAGING = (process.env.EXPO_PUBLIC_BACKEND_URL || '').toLowerCase().includes('staging');
const DAYS = ['Tue', 'Wed', 'Thu', 'Fri'] as const;
const STATUSES: DemoResultStatus[] = ['In Progress', 'Provisional', 'Final'];

function rank(competitors: DemoResultCompetitor[]) {
  return [...competitors].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

function confirmReset(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm('Reset all demonstration results to the original synthetic dataset?'));
  }
  return new Promise((resolve) => {
    Alert.alert('Reset demo results?', 'This restores the original synthetic demonstration standings.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Reset', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function PlowingResultsManager() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [results, setResults] = useState<DemoPlowingResults | null>(null);
  const [classId, setClassId] = useState('class-5');
  const [groupId, setGroupId] = useState('group-1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!IS_STAGING) return;
    getCurrentOrganizer()
      .then(({ user }) => {
        const allowed = user.role === 'Owner' || user.role === 'Schedule';
        setAuthorized(allowed);
        if (allowed) return getAdminPlowingResults();
        return null;
      })
      .then((data) => data && setResults(data))
      .catch(() => setAuthorized(false));
  }, []);

  const selectedClass = results?.classes.find((item) => item.id === classId) || results?.classes[0];
  const selectedGroup = selectedClass?.groups.find((item) => item.id === groupId) || selectedClass?.groups[0];
  const ranked = useMemo(() => rank(selectedGroup?.competitors || []), [selectedGroup]);

  useEffect(() => {
    if (selectedClass && selectedClass.id !== classId) setClassId(selectedClass.id);
    if (selectedGroup && selectedGroup.id !== groupId) setGroupId(selectedGroup.id);
  }, [classId, groupId, selectedClass, selectedGroup]);

  if (!IS_STAGING) return <Redirect href="/admin" />;
  if (authorized === false) return <Redirect href="/admin/login" />;
  if (authorized === null || !results || !selectedClass || !selectedGroup) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text>Loading demo results…</Text></View>;
  }

  const updateGroup = (transform: (group: DemoResultGroup) => DemoResultGroup) => {
    setMessage('');
    setError('');
    setResults((current) => current && ({
      ...current,
      classes: current.classes.map((competitionClass) => competitionClass.id !== selectedClass.id ? competitionClass : ({
        ...competitionClass,
        groups: competitionClass.groups.map((group) => group.id === selectedGroup.id ? transform(group) : group),
      })),
    }));
  };

  const updateCompetitor = (competitorId: string, patch: Partial<DemoResultCompetitor>) => {
    updateGroup((group) => ({
      ...group,
      competitors: group.competitors.map((competitor) => competitor.id === competitorId ? { ...competitor, ...patch } : competitor),
    }));
  };

  const validate = () => {
    for (const competitionClass of results.classes) {
      for (const group of competitionClass.groups) {
        if (!group.competitors.length) return `${competitionClass.name} ${group.name} cannot be empty.`;
        const names = new Set<string>();
        for (const competitor of group.competitors) {
          const normalized = competitor.name.trim().toLowerCase();
          if (!normalized) return 'Every competitor needs a name.';
          if (!competitor.town.trim()) return `${competitor.name} needs a town or location.`;
          if (!Number.isFinite(competitor.points) || competitor.points < 0 || competitor.points > 1000) return `${competitor.name} needs points between 0 and 1,000.`;
          if (names.has(normalized)) return `${group.name} contains the competitor ${competitor.name} more than once.`;
          names.add(normalized);
        }
      }
    }
    return '';
  };

  const publish = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await publishAdminPlowingResults(results);
      setResults(saved);
      setMessage(`Results published successfully · Updated ${new Date(saved.last_updated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Results could not be published.');
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!(await confirmReset())) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const clean = await resetAdminPlowingResults();
      setResults(clean); setClassId('class-5'); setGroupId('group-1');
      setMessage('Demo results restored to the original synthetic dataset.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Demo results could not be reset.');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.replace('/admin')} style={styles.back}><Feather name="arrow-left" size={18} /><Text style={styles.backText}>Organizer dashboard</Text></Pressable>
      <View style={styles.header}>
        <View><Text style={styles.title}>Plowing Results Manager</Text><Text style={styles.subtitle}>Simple, shared results publishing for the attendee demonstration.</Text></View>
        <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>DEMO DATA</Text></View>
      </View>
      <View style={styles.notice}><Text style={styles.noticeTitle}>Synthetic demonstration results only</Text><Text style={styles.noticeText}>These names and scores are fictional. Publishing updates staging attendees within about 15 seconds.</Text></View>

      <Text style={styles.label}>Class</Text>
      <View style={styles.choices}>{results.classes.map((item) => <Pressable key={item.id} onPress={() => { setClassId(item.id); setGroupId(item.groups[0].id); }} style={[styles.choice, item.id === selectedClass.id && styles.choiceActive]}><Text style={[styles.choiceText, item.id === selectedClass.id && styles.choiceTextActive]}>{item.name}</Text></Pressable>)}</View>
      <Text style={styles.label}>Group</Text>
      <View style={styles.choices}>{selectedClass.groups.map((item) => <Pressable key={item.id} onPress={() => setGroupId(item.id)} style={[styles.choice, item.id === selectedGroup.id && styles.choiceActive]}><Text style={[styles.choiceText, item.id === selectedGroup.id && styles.choiceTextActive]}>{item.name}</Text></Pressable>)}</View>

      <View style={styles.statusRow}><Text style={styles.label}>Result status</Text><View style={styles.choices}>{STATUSES.map((status) => <Pressable key={status} onPress={() => updateGroup((group) => ({ ...group, status }))} style={[styles.statusChoice, status === selectedGroup.status && styles.choiceActive]}><Text style={[styles.choiceText, status === selectedGroup.status && styles.choiceTextActive]}>{status}</Text></Pressable>)}</View></View>

      <Text style={styles.sectionTitle}>{selectedClass.name} · {selectedGroup.name}</Text>
      <Text style={styles.help}>Edit any score, review the automatically ranked preview, then publish. Draft edits remain on this screen until published.</Text>
      <View style={styles.editor}>
        {ranked.map((competitor, index) => (
          <View key={competitor.id} style={[styles.competitor, width >= 760 && styles.competitorWide]}>
            <View style={styles.rank}><Text style={styles.rankNumber}>{index + 1}</Text><Text style={styles.rankLabel}>Position</Text></View>
            <View style={styles.fields}>
              <View style={styles.primaryFields}>
                <View style={styles.field}><Text style={styles.fieldLabel}>Competitor name</Text><TextInput value={competitor.name} onChangeText={(name) => updateCompetitor(competitor.id, { name })} style={styles.input} /></View>
                <View style={styles.field}><Text style={styles.fieldLabel}>Town</Text><TextInput value={competitor.town} onChangeText={(town) => updateCompetitor(competitor.id, { town })} style={styles.input} /></View>
                <View style={styles.pointsField}><Text style={styles.fieldLabel}>Points</Text><TextInput value={String(competitor.points)} onChangeText={(value) => updateCompetitor(competitor.id, { points: Number(value) })} keyboardType="decimal-pad" style={styles.input} /></View>
              </View>
              <View style={styles.days}>{DAYS.map((day) => <View key={day} style={styles.dayField}><Text style={styles.fieldLabel}>{day}</Text><TextInput value={competitor.daily[day] == null ? '' : String(competitor.daily[day])} placeholder="—" onChangeText={(value) => updateCompetitor(competitor.id, { daily: { ...competitor.daily, [day]: value.trim() === '' ? null : Number(value) } })} keyboardType="decimal-pad" style={styles.input} /></View>)}</View>
              <View style={styles.competitorStatus}><Text style={styles.fieldLabel}>Competitor status</Text><View style={styles.choices}>{STATUSES.map((status) => <Pressable key={status} onPress={() => updateCompetitor(competitor.id, { status })} style={[styles.miniChoice, competitor.status === status && styles.choiceActive]}><Text style={[styles.miniChoiceText, competitor.status === status && styles.choiceTextActive]}>{status}</Text></Pressable>)}</View></View>
            </View>
          </View>
        ))}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      <View style={styles.actions}>
        <Pressable disabled={busy} onPress={publish} style={[styles.publish, busy && styles.disabled]}><Feather name="upload-cloud" size={20} color="#fff" /><Text style={styles.publishText}>{busy ? 'Working…' : 'Publish Results'}</Text></Pressable>
        <Pressable disabled={busy} onPress={reset} style={styles.reset}><Feather name="rotate-ccw" size={18} color={colors.primary} /><Text style={styles.resetText}>Reset Demo Results</Text></Pressable>
      </View>
      <View style={styles.rule}><Text style={styles.ruleTitle}>Demonstration ranking rule</Text><Text style={styles.ruleText}>Higher points rank first. Equal points are ordered by competitor name only to keep this demo deterministic. IPM must confirm official scoring and tie-breaking before any production use.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F4EE' }, content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 24, paddingBottom: 64 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, back: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 22 }, backText: { fontSize: 16, fontWeight: '600' },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }, title: { fontSize: 30, fontWeight: '800', color: colors.textPrimary }, subtitle: { marginTop: 6, fontSize: 16, color: '#53605A' },
  demoBadge: { backgroundColor: '#FFF1B8', borderColor: '#8A6A00', borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }, demoBadgeText: { color: '#644D00', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  notice: { marginTop: 20, borderRadius: 14, backgroundColor: '#E7F1EB', padding: 18, borderWidth: 1, borderColor: '#98B7A4' }, noticeTitle: { fontSize: 17, fontWeight: '800', color: '#183E29' }, noticeText: { fontSize: 15, lineHeight: 22, color: '#294C37', marginTop: 5 },
  label: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 22, marginBottom: 8 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 44, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#AAB2AD' }, statusChoice: { minHeight: 42, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#AAB2AD' }, choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary }, choiceText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary }, choiceTextActive: { color: '#fff' }, statusRow: { marginTop: 4 },
  sectionTitle: { fontSize: 23, fontWeight: '800', color: colors.textPrimary, marginTop: 30 }, help: { fontSize: 15, lineHeight: 22, color: '#53605A', marginTop: 6, marginBottom: 12 }, editor: { gap: 12 }, competitor: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#D8DDD9', gap: 14 }, competitorWide: { padding: 20 }, rank: { width: 55, alignItems: 'center', paddingTop: 18 }, rankNumber: { fontSize: 26, fontWeight: '800', color: colors.primary }, rankLabel: { fontSize: 11, color: '#647069' }, fields: { flex: 1, gap: 10 }, primaryFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, field: { flexGrow: 1, flexBasis: 210 }, pointsField: { flexBasis: 100, flexGrow: 0 }, fieldLabel: { fontSize: 13, fontWeight: '700', color: '#445049', marginBottom: 5 }, input: { minHeight: 46, borderWidth: 1, borderColor: '#AAB2AD', borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 12, fontSize: 16, color: colors.textPrimary }, days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, dayField: { width: 82 }, competitorStatus: { marginTop: 2 }, miniChoice: { minHeight: 38, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#AAB2AD' }, miniChoiceText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  error: { marginTop: 16, padding: 14, backgroundColor: '#FDE8E7', borderRadius: 10, color: '#8D1A13', fontSize: 15, fontWeight: '600' }, success: { marginTop: 16, padding: 14, backgroundColor: '#E4F4E9', borderRadius: 10, color: '#175C31', fontSize: 15, fontWeight: '700' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 }, publish: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 24 }, publishText: { color: '#fff', fontSize: 17, fontWeight: '800' }, reset: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 20 }, resetText: { color: colors.primary, fontSize: 16, fontWeight: '700' }, disabled: { opacity: 0.55 },
  rule: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#CBD1CD', paddingTop: 18 }, ruleTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary }, ruleText: { marginTop: 5, fontSize: 14, lineHeight: 21, color: '#53605A' },
});
