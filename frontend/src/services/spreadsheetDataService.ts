// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ContentHttpError,
  ContentRequestCoalescer,
  ContentRetryOptions,
  resolveCacheFirst,
  retryContentRequest,
} from './contentRecoveryCore';

const CACHE_KEY_PREFIX = 'ipm_supabase_cache:ipm-2026-production';
const EXISTING_SHARED_CACHE_KEY_PREFIX = 'ipm_supabase_cache:v1';
const LEGACY_CACHE_KEY_PREFIX = 'ipm_spreadsheet_cache';
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

type FetchWithCacheOptions<T> = {
  cacheKey: string;
  url: string;
  retryOptions?: ContentRetryOptions;
  preferCache?: boolean;
  isCacheableResponse: (data: unknown) => data is T;
  onBackgroundRefresh?: (result: CachedApiResult<T>) => void;
  onBackgroundRefreshError?: (error: unknown) => void;
};

export type SupabaseFetchOptions<T> = {
  preferCache?: boolean;
  onBackgroundRefresh?: (result: CachedApiResult<T>) => void;
  onBackgroundRefreshError?: (error: unknown) => void;
};

export type AnnouncementFetchOptions = {
  onBackgroundRefresh?: (announcement: Announcement | null) => void;
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
  return process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_API_BASE_URL;
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

async function fetchWithRetry<T>(
  url: string,
  isCacheableResponse: (data: unknown) => data is T,
  retryOptions?: ContentRetryOptions,
): Promise<CachedApiResult<T>> {
  return retryContentRequest(async (timeoutMs) => {
      const response = await fetchWithTimeout(url, timeoutMs);
      if (!response.ok) {
        throw new ContentHttpError(response.status);
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
    }, retryOptions);
}

const contentRequests = new ContentRequestCoalescer();

export async function fetchCachedApiData<T>({
  cacheKey,
  url,
  retryOptions,
  preferCache = true,
  isCacheableResponse,
  onBackgroundRefresh,
  onBackgroundRefreshError,
}: FetchWithCacheOptions<T>): Promise<CachedApiResult<T>> {
  await removeLegacyCache(cacheKey);
  const cachedData = preferCache ? await readCache<T>(cacheKey) : null;

  const refresh = () => contentRequests.run(`content:${cacheKey}`, async () => {
    const result = await fetchWithRetry<T>(
      url,
      isCacheableResponse,
      retryOptions,
    );
    try {
      await writeCache(cacheKey, result.data, result.lastSuccessfulUpdate);
    } catch (error) {
      console.error('Failed to write cached API data:', error);
    }
    return result;
  });

  return resolveCacheFirst(cachedData, refresh, {
    onRefresh: onBackgroundRefresh,
    onRefreshError: (error) => {
        console.warn('Background API refresh failed:', error);
        onBackgroundRefreshError?.(error);
      },
  });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSupabaseScheduleResponse(data: unknown): data is ScheduleResponse {
  if (!data || typeof data !== 'object' || !Array.isArray((data as ScheduleResponse).events)) return false;
  return (data as ScheduleResponse).events.every((event) => UUID_PATTERN.test(event.id));
}

function isSupabaseVendorsResponse(data: unknown): data is VendorsResponse {
  if (!data || typeof data !== 'object' || !Array.isArray((data as VendorsResponse).vendors)) return false;
  return (data as VendorsResponse).vendors.every((vendor) => UUID_PATTERN.test(vendor.id));
}

function isAnnouncementsResponse(data: unknown): data is AnnouncementsResponse {
  return !!data && typeof data === 'object' && Array.isArray((data as AnnouncementsResponse).announcements);
}

function isPublicAnnouncement(data: unknown): data is Announcement {
  if (!data || typeof data !== 'object') return false;
  const announcement = data as Announcement;
  return typeof announcement.id === 'string'
    && typeof announcement.title === 'string'
    && typeof announcement.message === 'string'
    && announcement.status === 'published'
    && (!announcement.expires_at || new Date(announcement.expires_at).getTime() > Date.now());
}

async function getCachedPublicAnnouncement(id: string) {
  const cached = await readCache<AnnouncementsResponse>('announcements');
  if (!cached || !isAnnouncementsResponse(cached.data)) return null;
  return cached.data.announcements.find(
    (announcement) => announcement.id === id && isPublicAnnouncement(announcement)
  ) || null;
}

export function getScheduleData(options: SupabaseFetchOptions<ScheduleResponse> = {}) {
  return fetchCachedApiData<ScheduleResponse>({
    cacheKey: 'schedule',
    url: `${getApiBaseUrl()}/api/schedule`,
    isCacheableResponse: isSupabaseScheduleResponse,
    ...options,
  });
}

export function getVendorsData(options: SupabaseFetchOptions<VendorsResponse> = {}) {
  return fetchCachedApiData<VendorsResponse>({
    cacheKey: 'vendors',
    url: `${getApiBaseUrl()}/api/vendors`,
    isCacheableResponse: isSupabaseVendorsResponse,
    ...options,
  });
}

export function getAnnouncementsData(options: SupabaseFetchOptions<AnnouncementsResponse> = {}) {
  return fetchCachedApiData<AnnouncementsResponse>({
    cacheKey: 'announcements',
    url: `${getApiBaseUrl()}/api/announcements`,
    isCacheableResponse: isAnnouncementsResponse,
    ...options,
  });
}

export async function getAnnouncementById(
  id: string,
  options: AnnouncementFetchOptions = {},
): Promise<Announcement | null> {
  const cached = await getCachedPublicAnnouncement(id);
  const refresh = () => contentRequests.run(`announcement-detail:${id}`, () =>
    retryContentRequest(async (timeoutMs) => {
      const response = await fetchWithTimeout(
        `${getApiBaseUrl()}/api/announcements/${encodeURIComponent(id)}`,
        timeoutMs,
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new ContentHttpError(response.status);
      const announcement: unknown = await response.json();
      if (!isPublicAnnouncement(announcement) || announcement.id !== id) {
        throw new Error('Announcement response is not public announcement data');
      }
      return announcement;
    })
  );

  return resolveCacheFirst(cached, refresh, {
    onRefresh: options.onBackgroundRefresh,
    onRefreshError: options.onBackgroundRefreshError,
  });
}
