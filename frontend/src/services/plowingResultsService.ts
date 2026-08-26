import AsyncStorage from '@react-native-async-storage/async-storage';

export type PlowingStatus = 'In Progress' | 'Provisional' | 'Final';
export type PlowingCompetitor = {
  id: string; name: string; town: string; points: number; position: number;
  status: PlowingStatus; daily: Record<'Tue' | 'Wed' | 'Thu' | 'Fri', number | null>;
};
export type PlowingGroup = { id: string; name: string; status: PlowingStatus; competitors: PlowingCompetitor[] };
export type PlowingClass = { id: string; name: string; groups: PlowingGroup[] };
export type PlowingResults = {
  id: string; event_id: 'ipm-2026-demo'; demo: true; source: string; ranking_rule: string;
  last_updated: string; updated_by: string; classes: PlowingClass[];
};

const CACHE_KEY = 'ipm_plowing_results_demo_cache_v1';
const API_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL || ''}/api/plowing-results`;

export async function getPlowingResults(): Promise<{ data: PlowingResults; cached: boolean }> {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`Results request failed (${response.status})`);
    const data = await response.json() as PlowingResults;
    if (!data.demo || data.event_id !== 'ipm-2026-demo' || !Array.isArray(data.classes)) {
      throw new Error('Unexpected results dataset');
    }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return { data, cached: false };
  } catch (error) {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) return { data: JSON.parse(cached) as PlowingResults, cached: true };
    throw error;
  }
}
