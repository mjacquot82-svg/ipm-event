import { getApiBaseUrl } from './adminAuthService';

export type HealthLabel = 'Healthy' | 'Degraded' | 'Unavailable' | 'Not tracked';
export type HealthRow = { name: string; status: HealthLabel; detail: string };
export type HealthSnapshot = { rows: HealthRow[]; checkedAt: string };

async function readJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', signal: controller.signal });
    return { ok: response.ok, body: await response.json() };
  } finally { clearTimeout(timer); }
}

export async function checkSystemHealth(): Promise<HealthSnapshot> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const [backend, manifest, provider] = await Promise.allSettled([
    readJson(`${base}/api/health`),
    readJson('/content-manifest.json'),
    readJson(`${base}/api/notification-registrations/operations`),
  ]);
  const health = backend.status === 'fulfilled' ? backend.value : null;
  const validHealth = health?.body?.event === 'ipm-2026' && health?.body?.backend === 'ok';
  const backendStatus: HealthLabel = validHealth ? (health?.ok && health.body.status === 'healthy' ? 'Healthy' : 'Degraded') : 'Unavailable';
  const content = manifest.status === 'fulfilled' && manifest.value.ok ? manifest.value.body : null;
  const validManifest = content?.environment === 'production' && content?.event === 'ipm-2026'
    && ['schedule', 'announcements'].every((key) => Number.isSafeInteger(content[key]?.revision)
      && content[key].revision >= 1 && typeof content[key].updatedAt === 'string'
      && Number.isFinite(Date.parse(content[key].updatedAt)));
  const configured = provider.status === 'fulfilled' && provider.value.ok ? provider.value.body?.provider_configured : undefined;
  return {
    checkedAt: new Date().toISOString(),
    rows: [
      { name: 'Frontend / app', status: 'Healthy', detail: 'This admin page is running.' },
      { name: 'Backend', status: backendStatus, detail: backendStatus === 'Degraded' ? 'Process responding; dependency check failed.' : 'Read-only health endpoint.' },
      { name: 'Supabase', status: validHealth && health?.ok && health.body.supabase === 'ok' ? 'Healthy' : 'Unavailable', detail: 'IPM 2026 event read check.' },
      { name: 'Content manifest', status: validManifest ? 'Healthy' : 'Unavailable', detail: 'Production manifest readable and valid; freshness is not verified.' },
      { name: 'T-30 reminder cron', status: 'Not tracked', detail: 'Not tracked in app.' },
      { name: 'Content manifest cron', status: 'Not tracked', detail: 'Not tracked in app.' },
      { name: 'WonderPush', status: configured === true ? 'Healthy' : configured === false ? 'Degraded' : 'Unavailable', detail: configured === true ? 'Configured only; provider availability and delivery are not checked.' : configured === false ? 'Provider is not configured.' : 'Configuration status unavailable.' },
    ],
  };
}
