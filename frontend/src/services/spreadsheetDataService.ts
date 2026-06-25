// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_TIMEOUT_MS = 15000;
const CACHE_KEY_PREFIX = 'ipm_spreadsheet_cache';
const DEFAULT_API_BASE_URL = 'https://ipm-backend-eoiw.onrender.com';

export type CachedApiSource = 'network' | 'cache';

export type CachedApiResult<T> = {
  data: T;
  source: CachedApiSource;
  lastSuccessfulUpdate: string;
  cacheAge: number;
};

type CacheEntry<T> = {
  data: T;
  lastSuccessfulUpdate: string;
  cacheAge: number;
};

type FetchWithCacheOptions = {
  cacheKey: string;
  url: string;
  timeoutMs?: number;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  start_time: string;
  end_time: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  days_active: string;
  location_name: string | null;
};

export type ScheduleResponse = {
  events: ScheduleEvent[];
  last_updated: string;
  total_count: number;
};

export type Vendor = {
  id: string;
  name: string;
  type: string;
  location: string;
  hours_of_operation: string;
  days_of_operation: string;
  priority: number;
};

export type VendorsResponse = {
  vendors: Vendor[];
  last_updated: string;
  total_count: number;
};

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_API_BASE_URL;
}

function getCacheKey(cacheKey: string) {
  return `${CACHE_KEY_PREFIX}:${cacheKey}`;
}

function getCacheAge(lastSuccessfulUpdate: string) {
  return Math.max(0, Date.now() - new Date(lastSuccessfulUpdate).getTime());
}

async function readCache<T>(cacheKey: string): Promise<CachedApiResult<T> | null> {
  const storageKey = getCacheKey(cacheKey);

  try {
    const cachedValue = await AsyncStorage.getItem(storageKey);
    if (!cachedValue) {
      return null;
    }

    let cacheEntry: CacheEntry<T>;
    try {
      cacheEntry = JSON.parse(cachedValue) as CacheEntry<T>;
    } catch (error) {
      console.error('Failed to parse cached API data:', error);
      await AsyncStorage.removeItem(storageKey);
      return null;
    }

    const cacheAge = getCacheAge(cacheEntry.lastSuccessfulUpdate);
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({ ...cacheEntry, cacheAge })
    );

    return {
      data: cacheEntry.data,
      source: 'cache',
      lastSuccessfulUpdate: cacheEntry.lastSuccessfulUpdate,
      cacheAge,
    };
  } catch (error) {
    console.error('Failed to read cached API data:', error);
    return null;
  }
}

async function writeCache<T>(cacheKey: string, data: T, timestamp: string) {
  const cacheEntry: CacheEntry<T> = {
    data,
    lastSuccessfulUpdate: timestamp,
    cacheAge: 0,
  };

  await AsyncStorage.setItem(getCacheKey(cacheKey), JSON.stringify(cacheEntry));
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCachedApiData<T>({
  cacheKey,
  url,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: FetchWithCacheOptions): Promise<CachedApiResult<T>> {
  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = (await response.json()) as T;
    const lastSuccessfulUpdate = new Date().toISOString();
    try {
      await writeCache(cacheKey, data, lastSuccessfulUpdate);
    } catch (error) {
      console.error('Failed to write cached API data:', error);
    }

    return {
      data,
      source: 'network',
      lastSuccessfulUpdate,
      cacheAge: 0,
    };
  } catch (error) {
    const cachedData = await readCache<T>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    throw error;
  }
}

export function getScheduleData() {
  return fetchCachedApiData<ScheduleResponse>({
    cacheKey: 'schedule',
    url: `${getApiBaseUrl()}/api/schedule`,
  });
}

export function getVendorsData() {
  return fetchCachedApiData<VendorsResponse>({
    cacheKey: 'vendors',
    url: `${getApiBaseUrl()}/api/vendors`,
  });
}
