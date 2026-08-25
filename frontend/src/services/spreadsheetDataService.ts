// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isScheduleRecord, isVendorRecord, shouldAcceptReplacement } from './contentCachePolicy';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1500;
export const CONTENT_CACHE_SCHEMA_VERSION = 2;
const CACHE_KEY_PREFIX = 'ipm_supabase_cache:ipm-2026-production';
const EXISTING_SHARED_CACHE_KEY_PREFIX = 'ipm_supabase_cache:v1';
const LEGACY_CACHE_KEY_PREFIX = 'ipm_spreadsheet_cache';

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
  schemaVersion?: number;
};

type FetchWithCacheOptions<T> = {
  cacheKey: string;
  url: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  preferCache?: boolean;
  isCacheableResponse: (data: unknown) => data is T;
  getItemCount?: (data: T) => number;
  onBackgroundRefresh?: (result: CachedApiResult<T>) => void;
  onBackgroundRefreshError?: (error: unknown) => void;
};

export type SupabaseFetchOptions<T> = {
  preferCache?: boolean;
  onBackgroundRefresh?: (result: CachedApiResult<T>) => void;
  onBackgroundRefreshError?: (error: unknown) => void;
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

export type Announcement = {
  id: string;
  event_id: string;
  title: string;
  message: string;
  priority: 'Information' | 'Important' | 'Emergency';
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'published';
};

export type AnnouncementsResponse = {
  announcements: Announcement[];
  total_count: number;
};

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_BACKEND_URL || '';
}

function getCacheKey(cacheKey: string) {
  const prefix = cacheKey === 'schedule' || cacheKey === 'vendors'
    ? CACHE_KEY_PREFIX
    : EXISTING_SHARED_CACHE_KEY_PREFIX;

  return `${prefix}:${cacheKey}`;
}

function getCacheAge(lastSuccessfulUpdate: string) {
  return Math.max(0, Date.now() - new Date(lastSuccessfulUpdate).getTime());
}

async function readCache<T>(cacheKey: string, isCacheableResponse: (data: unknown) => data is T): Promise<CachedApiResult<T> | null> {
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

    if (!cacheEntry.lastSuccessfulUpdate || !isCacheableResponse(cacheEntry.data)) {
      await AsyncStorage.removeItem(storageKey);
      throw new Error('Saved API data is invalid');
    }
    const cacheAge = getCacheAge(cacheEntry.lastSuccessfulUpdate);
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({ ...cacheEntry, cacheAge, schemaVersion: CONTENT_CACHE_SCHEMA_VERSION })
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

async function removeLegacyCache(cacheKey: string) {
  try {
    await AsyncStorage.removeItem(`${LEGACY_CACHE_KEY_PREFIX}:${cacheKey}`);
  } catch (error) {
    console.error('Failed to remove legacy API cache:', error);
  }
}

async function writeCache<T>(cacheKey: string, data: T, timestamp: string) {
  const cacheEntry: CacheEntry<T> = {
    data,
    lastSuccessfulUpdate: timestamp,
    cacheAge: 0,
    schemaVersion: CONTENT_CACHE_SCHEMA_VERSION,
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

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry<T>(
  url: string,
  timeoutMs: number,
  maxAttempts: number,
  retryDelayMs: number,
  isCacheableResponse: (data: unknown) => data is T
): Promise<CachedApiResult<T>> {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false) {
    throw new Error('Device is offline');
  }
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: unknown = await response.json();
      if (!isCacheableResponse(data)) {
        throw new Error('API response is not Supabase-backed data');
      }

      return {
        data,
        source: 'network',
        lastSuccessfulUpdate: new Date().toISOString(),
        cacheAge: 0,
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await delay(retryDelayMs);
      }
    }
  }

  throw lastError;
}

export async function fetchCachedApiData<T>({
  cacheKey,
  url,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  preferCache = true,
  isCacheableResponse,
  getItemCount,
  onBackgroundRefresh,
  onBackgroundRefreshError,
}: FetchWithCacheOptions<T>): Promise<CachedApiResult<T>> {
  await removeLegacyCache(cacheKey);
  const lastKnownGood = await readCache<T>(cacheKey, isCacheableResponse);
  const cachedData = preferCache ? lastKnownGood : null;

  const refresh = async () => {
    const result = await fetchWithRetry<T>(
      url,
      timeoutMs,
      maxAttempts,
      retryDelayMs,
      isCacheableResponse
    );
    const oldCount = lastKnownGood && getItemCount ? getItemCount(lastKnownGood.data) : 0;
    const newCount = getItemCount ? getItemCount(result.data) : 0;
    if (!shouldAcceptReplacement(oldCount, newCount, result.data)) {
      throw new Error(`Refusing to replace saved ${cacheKey} data with an unverified empty response`);
    }
    try {
      await writeCache(cacheKey, result.data, result.lastSuccessfulUpdate);
    } catch (error) {
      console.error('Failed to write cached API data:', error);
    }
    return result;
  };

  if (cachedData) {
    void refresh()
      .then((result) => onBackgroundRefresh?.(result))
      .catch((error) => {
        console.warn('Background API refresh failed:', error);
        onBackgroundRefreshError?.(error);
      });
    return cachedData;
  }

  return refresh();
}

function isSupabaseScheduleResponse(data: unknown): data is ScheduleResponse {
  if (!data || typeof data !== 'object' || !Array.isArray((data as ScheduleResponse).events)) return false;
  return (data as ScheduleResponse).events.every(isScheduleRecord);
}

function isSupabaseVendorsResponse(data: unknown): data is VendorsResponse {
  if (!data || typeof data !== 'object' || !Array.isArray((data as VendorsResponse).vendors)) return false;
  return (data as VendorsResponse).vendors.every(isVendorRecord);
}

function isAnnouncementsResponse(data: unknown): data is AnnouncementsResponse {
  return !!data && typeof data === 'object' && Array.isArray((data as AnnouncementsResponse).announcements);
}

export function getScheduleData(options: SupabaseFetchOptions<ScheduleResponse> = {}) {
  return fetchCachedApiData<ScheduleResponse>({
    cacheKey: 'schedule',
    url: `${getApiBaseUrl()}/api/schedule`,
    isCacheableResponse: isSupabaseScheduleResponse,
    getItemCount: (data) => data.events.length,
    ...options,
  });
}

export function getVendorsData(options: SupabaseFetchOptions<VendorsResponse> = {}) {
  return fetchCachedApiData<VendorsResponse>({
    cacheKey: 'vendors',
    url: `${getApiBaseUrl()}/api/vendors`,
    isCacheableResponse: isSupabaseVendorsResponse,
    getItemCount: (data) => data.vendors.length,
    ...options,
  });
}

export function addConnectivityRefreshListener(refresh: () => void) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => undefined;
  }
  window.addEventListener('online', refresh);
  return () => window.removeEventListener('online', refresh);
}

export function getAnnouncementsData(options: SupabaseFetchOptions<AnnouncementsResponse> = {}) {
  return fetchCachedApiData<AnnouncementsResponse>({
    cacheKey: 'announcements',
    url: `${getApiBaseUrl()}/api/announcements`,
    isCacheableResponse: isAnnouncementsResponse,
    ...options,
  });
}

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/announcements/${encodeURIComponent(id)}`
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Announcement request failed with status ${response.status}`);
  }
  return response.json() as Promise<Announcement>;
}
