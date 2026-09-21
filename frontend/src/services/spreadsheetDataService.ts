// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1500;
// Cached attendee data is still usable offline, but native clients refresh it
// at least every 15 minutes when connectivity is available. Web reads refresh
// immediately so reconnects do not leave a stale schedule or vendor catalog.
const CACHE_MAX_AGE_MS = 15 * 60 * 1000;
// Server-backed content must be isolated by backend origin. The old v1 and
// production namespaces were shared by staging and production.
const CACHE_KEY_PREFIX = 'ipm_supabase_cache:v2';
const LEGACY_CACHE_KEY_PREFIX = 'ipm_spreadsheet_cache';
const DEFAULT_API_BASE_URL = 'https://ipm-backend-eoiw.onrender.com';

export type CachedApiSource = 'network' | 'cache';

export type CachedApiResult<T> = {
  data: T;
  source: CachedApiSource;
  lastSuccessfulUpdate: string;
  cacheAge: number;
  contentRevision?: number;
};

type CacheEntry<T> = {
  data: T;
  lastSuccessfulUpdate: string;
  cacheAge: number;
  contentRevision?: number;
};

type ContentType = 'schedule' | 'announcements';
type ContentManifest = {
  environment: 'production';
  event: 'ipm-2026';
  schedule: { revision: number; updatedAt: string };
  announcements: { revision: number; updatedAt: string };
};

type FetchWithCacheOptions<T> = {
  cacheKey: string;
  url: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  preferCache?: boolean;
  isCacheableResponse: (data: unknown) => data is T;
  onBackgroundRefresh?: (result: CachedApiResult<T>) => void;
  onBackgroundRefreshError?: (error: unknown) => void;
  contentType?: ContentType;
};

export type SupabaseFetchOptions<T> = {
  preferCache?: boolean;
  timeoutMs?: number;
  maxAttempts?: number;
  onBackgroundRefresh?: (result: CachedApiResult<T>) => void;
  onBackgroundRefreshError?: (error: unknown) => void;
  contentType?: ContentType;
};

export type EventImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
  crop?: 'top-square';
};

export type ScheduleEvent = {
  event_image?: EventImage | null;
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
  content_revision: number;
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

export type AnnouncementImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
  storage_path?: string;
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
  image?: AnnouncementImage | null;
};

export type AnnouncementsResponse = {
  announcements: Announcement[];
  total_count: number;
  content_revision: number;
};

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_API_BASE_URL;
}

function getEnvironmentCacheIdentity() {
  const configuredApiBaseUrl = getApiBaseUrl();
  try {
    const parsed = new URL(configuredApiBaseUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return configuredApiBaseUrl || 'unknown-backend';
  }
}

function getCacheKey(cacheKey: string) {
  const identity = getEnvironmentCacheIdentity()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  // Never read the legacy environment-ambiguous namespace.
  if (cacheKey === 'vendors' && Platform.OS === 'web') {
    return `${CACHE_KEY_PREFIX}:${identity}:vendors:canonical-v2`;
  }
  return `${CACHE_KEY_PREFIX}:${identity}:${cacheKey}`;
}

function getCacheAge(lastSuccessfulUpdate: string) {
  return Math.max(0, Date.now() - new Date(lastSuccessfulUpdate).getTime());
}

let manifestPromise: Promise<ContentManifest> | null = null;
const refreshPromises = new Map<string, Promise<CachedApiResult<unknown>>>();

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
      contentRevision: cacheEntry.contentRevision,
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

async function writeCache<T>(cacheKey: string, data: T, timestamp: string, contentRevision?: number) {
  const cacheEntry: CacheEntry<T> = {
    data,
    lastSuccessfulUpdate: timestamp,
    cacheAge: 0,
    contentRevision,
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
        contentRevision: typeof (data as { content_revision?: unknown }).content_revision === 'number'
          ? (data as { content_revision: number }).content_revision
          : undefined,
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

async function getContentManifest(): Promise<ContentManifest> {
  if (Platform.OS !== 'web') throw new Error('Manifest is web-only');
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch('/content-manifest.json', {
    cache: 'no-store',
    headers: { 'X-IPM-Content-Manifest': '1' },
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Manifest request failed with status ${response.status}`);
    const manifest = await response.json() as ContentManifest;
    if (manifest.environment !== 'production' || manifest.event !== 'ipm-2026') {
      throw new Error('Manifest environment or event mismatch');
    }
    for (const type of ['schedule', 'announcements'] as const) {
      if (!Number.isInteger(manifest[type]?.revision) || manifest[type].revision < 1) {
        throw new Error(`Invalid ${type} manifest revision`);
      }
    }
    return manifest;
  }).finally(() => { manifestPromise = null; });
  return manifestPromise;
}

export async function fetchCachedApiData<T>({
  cacheKey,
  url,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  preferCache = true,
  isCacheableResponse,
  onBackgroundRefresh,
  onBackgroundRefreshError,
  contentType,
}: FetchWithCacheOptions<T>): Promise<CachedApiResult<T>> {
  await removeLegacyCache(cacheKey);
  const cachedData = preferCache ? await readCache<T>(cacheKey) : null;

  const refresh = async () => {
    const result = await fetchWithRetry<T>(
      url,
      timeoutMs,
      maxAttempts,
      retryDelayMs,
      isCacheableResponse
    );
    try {
      await writeCache(cacheKey, result.data, result.lastSuccessfulUpdate, result.contentRevision);
    } catch (error) {
      console.error('Failed to write cached API data:', error);
    }
    return result;
  };

  if (cachedData) {
    const fullRefresh = () => {
      const existing = refreshPromises.get(cacheKey);
      if (existing) return existing as Promise<CachedApiResult<T>>;
      const promise = refresh().finally(() => refreshPromises.delete(cacheKey));
      refreshPromises.set(cacheKey, promise as Promise<CachedApiResult<unknown>>);
      return promise;
    };
    const refreshCachedContent = async () => {
      if (Platform.OS !== 'web' || !contentType) {
        return cachedData.cacheAge >= CACHE_MAX_AGE_MS ? fullRefresh() : cachedData;
      }
      const manifest = await getContentManifest();
      const remoteRevision = manifest[contentType].revision;
      if (cachedData.contentRevision === remoteRevision) return cachedData;
      const result = await fullRefresh();
      if (result.contentRevision !== remoteRevision) {
        throw new Error(`Full ${contentType} response revision does not match manifest`);
      }
      return result;
    };
    void refreshCachedContent()
        .then((result) => onBackgroundRefresh?.(result))
        .catch((error) => {
          console.warn('Background API refresh failed:', error);
          onBackgroundRefreshError?.(error);
        });
    return cachedData;
  }

  return refresh();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSupabaseScheduleResponse(data: unknown): data is ScheduleResponse {
  if (!data || typeof data !== 'object' || !Array.isArray((data as ScheduleResponse).events)) return false;
  return Number.isInteger((data as ScheduleResponse).content_revision)
    && (data as ScheduleResponse).content_revision > 0
    && (data as ScheduleResponse).events.every((event) => UUID_PATTERN.test(event.id));
}

function isSupabaseVendorsResponse(data: unknown): data is VendorsResponse {
  if (!data || typeof data !== 'object' || !Array.isArray((data as VendorsResponse).vendors)) return false;
  return (data as VendorsResponse).vendors.every((vendor) => UUID_PATTERN.test(vendor.id));
}

function isAnnouncementsResponse(data: unknown): data is AnnouncementsResponse {
  return !!data && typeof data === 'object'
    && Number.isInteger((data as AnnouncementsResponse).content_revision)
    && (data as AnnouncementsResponse).content_revision > 0
    && Array.isArray((data as AnnouncementsResponse).announcements);
}

export function getScheduleData(options: SupabaseFetchOptions<ScheduleResponse> = {}) {
  return fetchCachedApiData<ScheduleResponse>({
    cacheKey: 'schedule',
    url: `${getApiBaseUrl()}/api/schedule`,
    isCacheableResponse: isSupabaseScheduleResponse,
    contentType: 'schedule',
    ...options,
  });
}

export async function getVendorsData(options: SupabaseFetchOptions<VendorsResponse> = {}) {
  const isWeb = Platform.OS === 'web';
  try {
    return await fetchCachedApiData<VendorsResponse>({
      cacheKey: 'vendors',
      url: isWeb ? '/api/vendors' : `${getApiBaseUrl()}/api/vendors`,
      isCacheableResponse: isSupabaseVendorsResponse,
      ...options,
      // Complete the canonical request before declaring the search results ready.
      preferCache: isWeb ? false : options.preferCache,
    });
  } catch (error) {
    // Preserve offline access, but only to a previously fetched canonical catalog.
    if (isWeb) {
      const cached = await readCache<VendorsResponse>('vendors');
      if (cached && isSupabaseVendorsResponse(cached.data)) return cached;
    }
    throw error;
  }
}

export function getAnnouncementsData(options: SupabaseFetchOptions<AnnouncementsResponse> = {}) {
  return fetchCachedApiData<AnnouncementsResponse>({
    cacheKey: 'announcements',
    url: `${getApiBaseUrl()}/api/announcements`,
    isCacheableResponse: isAnnouncementsResponse,
    contentType: 'announcements',
    ...options,
  });
}

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const cacheKey = `announcement:${id}`;
  const cached = await readCache<Announcement>(cacheKey);
  try {
    const response = await fetchWithTimeout(
      `${getApiBaseUrl()}/api/announcements/${encodeURIComponent(id)}`,
      12000,
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Announcement request failed with status ${response.status}`);
    }
    const data = await response.json() as Announcement;
    await writeCache(cacheKey, data, new Date().toISOString());
    return data;
  } catch (error) {
    if (cached?.data) return cached.data;
    throw error;
  }
}

/** Warm the canonical vendor catalog during the normal online Home session. */
export async function prefetchVendorsData() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) return;
  return getVendorsData({ preferCache: false, maxAttempts: 1, timeoutMs: 12000 });
}
