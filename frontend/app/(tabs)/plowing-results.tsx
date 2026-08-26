import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../src/theme/colors';
import { attendeePageContent, useAttendeeLayout } from '../../src/theme/attendeePageLayout';
import { getPlowingResults, PlowingResults } from '../../src/services/plowingResultsService';

const IS_STAGING = process.env.EXPO_PUBLIC_BACKEND_URL?.includes('staging');
const DAYS = ['Tue', 'Wed', 'Thu', 'Fri'] as const;

export default function PlowingResultsScreen() {
  const router = useRouter();
  const { sectionStyle } = useAttendeeLayout();
  const [results, setResults] = useState<PlowingResults | null>(null);
  const [classId, setClassId] = useState('class-5');
  const [groupId, setGroupId] = useState('group-1');
  const [view, setView] = useState<'standings' | 'daily'>('standings');
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await getPlowingResults();
      setResults(response.data); setCached(response.cached); setError(null);
      const selectedClass = response.data.classes.find((item) => item.id === classId) || response.data.classes[0];
      if (selectedClass && !selectedClass.groups.some((item) => item.id === groupId)) setGroupId(selectedClass.groups[0].id);
    } catch { setError('Results are temporarily unavailable.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [classId, groupId]);

  useFocusEffect(useCallback(() => {
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => clearInterval(interval);
  }, [load]));

  const selectedClass = useMemo(() => results?.classes.find((item) => item.id === classId) || results?.classes[0], [results, classId]);
  const selectedGroup = selectedClass?.groups.find((item) => item.id === groupId) || selectedClass?.groups[0];
  const chooseClass = (nextClassId: string) => {
    setClassId(nextClassId);
    const nextClass = results?.classes.find((item) => item.id === nextClassId);
    if (nextClass) setGroupId(nextClass.groups[0].id);
  };

  if (!IS_STAGING) return null;
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={attendeePageContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
        <View style={[styles.header, sectionStyle]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></TouchableOpacity>
          <View><Text style={styles.heading}>Plowing Results</Text><Text style={styles.updated}>{results ? `Last updated: ${new Date(results.last_updated).toLocaleString()}` : 'Loading results…'}</Text></View>
        </View>
        <View style={[styles.demoCard, sectionStyle]}><Text style={styles.demoLabel}>DEMO RESULTS</Text><Text style={styles.demoText}>Sample standings for demonstration purposes only.</Text></View>
        {cached && <Text style={[styles.cached, sectionStyle]}>Limited connection — showing the last loaded demo results.</Text>}
        {loading && !results ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
        {error && !results ? <Text style={[styles.error, sectionStyle]}>{error}</Text> : null}
        {results && selectedClass && selectedGroup ? <>
          <View style={[styles.selectorBlock, sectionStyle]}>
            <Text style={styles.selectorLabel}>Class</Text><View style={styles.chips}>{results.classes.map((item) => <TouchableOpacity key={item.id} style={[styles.chip, item.id === selectedClass.id && styles.chipActive]} onPress={() => chooseClass(item.id)}><Text style={[styles.chipText, item.id === selectedClass.id && styles.chipTextActive]}>{item.name}</Text></TouchableOpacity>)}</View>
            <Text style={styles.selectorLabel}>Group</Text><View style={styles.chips}>{selectedClass.groups.map((item) => <TouchableOpacity key={item.id} style={[styles.chip, item.id === selectedGroup.id && styles.chipActive]} onPress={() => setGroupId(item.id)}><Text style={[styles.chipText, item.id === selectedGroup.id && styles.chipTextActive]}>{item.name}</Text></TouchableOpacity>)}</View>
          </View>
          <View style={[styles.statusRow, sectionStyle]}><View style={styles.statusBadge}><Text style={styles.statusText}>{selectedGroup.status}</Text></View><Text style={styles.rule}>Higher points rank first for this demo.</Text></View>
          <View style={[styles.tabs, sectionStyle]}>{(['standings', 'daily'] as const).map((item) => <TouchableOpacity key={item} style={[styles.tab, view === item && styles.tabActive]} onPress={() => setView(item)}><Text style={[styles.tabText, view === item && styles.tabTextActive]}>{item === 'standings' ? 'Standings' : 'Daily Results'}</Text></TouchableOpacity>)}</View>
          <View style={sectionStyle}>{selectedGroup.competitors.map((competitor) => <View key={competitor.id} style={[styles.resultCard, competitor.position <= 3 && styles.topResult]}>
            <View style={styles.rank}><Text style={styles.rankNumber}>{competitor.position}</Text><Text style={styles.rankLabel}>POSITION</Text></View>
            <View style={styles.competitor}><Text style={styles.name}>{competitor.name}</Text><Text style={styles.town}>{competitor.town}</Text><Text style={styles.competitorStatus}>{competitor.status}</Text>{view === 'daily' && <View style={styles.days}>{DAYS.map((day) => <View key={day} style={styles.day}><Text style={styles.dayLabel}>{day}</Text><Text style={styles.dayScore}>{competitor.daily[day] ?? '—'}</Text></View>)}</View>}</View>
            <View style={styles.points}><Text style={styles.pointsNumber}>{competitor.points.toFixed(1)}</Text><Text style={styles.pointsLabel}>PTS</Text></View>
          </View>)}</View>
          <Text style={[styles.disclaimer, sectionStyle]}>Demo ranking only. Official IPM scoring and tie-breaking rules must be confirmed before production use.</Text>
        </> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background}, header:{alignItems:'center',flexDirection:'row',gap:12,marginTop:16}, back:{alignItems:'center',backgroundColor:colors.surface,borderRadius:22,height:44,justifyContent:'center',width:44}, heading:{color:colors.textPrimary,fontSize:26,fontWeight:'800'}, updated:{color:colors.textSecondary,fontSize:13,marginTop:2}, demoCard:{backgroundColor:'#FFF8DB',borderColor:'#D6B84B',borderRadius:16,borderWidth:1,marginTop:18,padding:16}, demoLabel:{color:'#735B1B',fontSize:15,fontWeight:'900',letterSpacing:1},demoText:{color:'#554719',fontSize:15,lineHeight:21,marginTop:4},cached:{color:colors.textSecondary,fontSize:14,marginTop:12},loader:{marginTop:40},error:{color:colors.error,fontSize:16,marginTop:24},selectorBlock:{marginTop:20},selectorLabel:{color:colors.textPrimary,fontSize:15,fontWeight:'800',marginBottom:8,marginTop:10},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:22,borderWidth:1,minHeight:44,justifyContent:'center',paddingHorizontal:18},chipActive:{backgroundColor:colors.primary,borderColor:colors.primary},chipText:{color:colors.textPrimary,fontSize:15,fontWeight:'700'},chipTextActive:{color:'#FFFFFF'},statusRow:{alignItems:'center',flexDirection:'row',gap:10,marginTop:18},statusBadge:{backgroundColor:'#FFF2C2',borderRadius:18,paddingHorizontal:13,paddingVertical:8},statusText:{color:'#735B1B',fontSize:14,fontWeight:'800'},rule:{color:colors.textSecondary,flex:1,fontSize:13},tabs:{backgroundColor:colors.surface,borderRadius:14,flexDirection:'row',marginBottom:12,marginTop:18,padding:4},tab:{alignItems:'center',borderRadius:11,flex:1,minHeight:44,justifyContent:'center'},tabActive:{backgroundColor:colors.primary},tabText:{color:colors.textSecondary,fontSize:15,fontWeight:'700'},tabTextActive:{color:'#FFFFFF'},resultCard:{alignItems:'center',backgroundColor:colors.surface,borderColor:colors.border,borderRadius:16,borderWidth:1,flexDirection:'row',gap:12,marginBottom:10,minWidth:0,padding:14},topResult:{borderLeftColor:colors.accent,borderLeftWidth:5},rank:{alignItems:'center',width:48},rankNumber:{color:colors.primary,fontSize:25,fontWeight:'900'},rankLabel:{color:colors.textMuted,fontSize:8,fontWeight:'800'},competitor:{flex:1,minWidth:0},name:{color:colors.textPrimary,fontSize:17,fontWeight:'800'},town:{color:colors.textSecondary,fontSize:14,marginTop:2},competitorStatus:{color:colors.textMuted,fontSize:11,fontWeight:'700',marginTop:3,textTransform:'uppercase'},points:{alignItems:'flex-end'},pointsNumber:{color:colors.textPrimary,fontSize:19,fontWeight:'900'},pointsLabel:{color:colors.textMuted,fontSize:9,fontWeight:'800'},days:{flexDirection:'row',gap:5,marginTop:9},day:{alignItems:'center',backgroundColor:colors.surfaceHighlight,borderRadius:8,minWidth:43,padding:5},dayLabel:{color:colors.textMuted,fontSize:10,fontWeight:'800'},dayScore:{color:colors.textPrimary,fontSize:12,fontWeight:'700',marginTop:2},disclaimer:{color:colors.textSecondary,fontSize:13,lineHeight:19,marginBottom:28,marginTop:8},
});
