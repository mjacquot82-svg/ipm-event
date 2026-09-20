// Pure validation helpers shared by the k6 test and offline tests.
// This module has no k6, filesystem, network, or Node-specific dependencies.

export const STAGING_MANIFEST_URL = 'https://staging.theipm.ca/content-manifest.json';
export const STAGING_ENVIRONMENT = 'staging';
export const STAGING_EVENT = 'ipm-staging';

const revisionIsValid = (value) => (
  (typeof value === 'string' && value.trim().length > 0)
  || (typeof value === 'number' && Number.isFinite(value))
);

const contentTypeIsJson = (headers = {}) => {
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
  return typeof value === 'string' && (/application\/json/i.test(value) || /\+json/i.test(value));
};

export function validateTarget(url, env = {}) {
  if (Object.keys(env).some((key) => /(?:TARGET|BASE|HOST|PROXY|BACKEND|SUPABASE)/i.test(key))) {
    return { ok: false, reason: 'target override is forbidden' };
  }
  if (url !== STAGING_MANIFEST_URL) return { ok: false, reason: 'target is not the exact staging manifest URL' };
  let parsed;
  try { parsed = new URL(url); } catch (_) { return { ok: false, reason: 'target is not a URL' }; }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'staging.theipm.ca'
      || parsed.port || parsed.pathname !== '/content-manifest.json' || parsed.search || parsed.hash) {
    return { ok: false, reason: 'target URL is outside the staging allowlist' };
  }
  const productionIdentities = new Set([
    'theipm.ca', 'www.theipm.ca', 'ipm-backend-eoiw.onrender.com',
    'hppboivlpqkfhhzfftuu.supabase.co',
  ]);
  if (productionIdentities.has(parsed.hostname)) return { ok: false, reason: 'production target rejected' };
  return { ok: true };
}

export function validateManifestResponse(response, expected = null) {
  if (!response || response.status !== 200) return { ok: false, reason: 'HTTP status is not 200' };
  if (!contentTypeIsJson(response.headers)) return { ok: false, reason: 'response is not JSON' };
  let body;
  try { body = typeof response.json === 'function' ? response.json() : JSON.parse(response.body); }
  catch (_) { return { ok: false, reason: 'response is not valid JSON' }; }
  if (!body || body.environment !== STAGING_ENVIRONMENT) return { ok: false, reason: 'wrong environment' };
  if (body.event !== STAGING_EVENT) return { ok: false, reason: 'wrong event' };
  if (!body.schedule || !revisionIsValid(body.schedule.revision)) return { ok: false, reason: 'missing schedule revision' };
  if (!body.announcements || !revisionIsValid(body.announcements.revision)) return { ok: false, reason: 'missing announcements revision' };
  if (expected && (body.schedule.revision !== expected.scheduleRevision
      || body.announcements.revision !== expected.announcementsRevision)) {
    return { ok: false, reason: 'manifest revision changed' };
  }
  return {
    ok: true,
    baseline: {
      scheduleRevision: body.schedule.revision,
      announcementsRevision: body.announcements.revision,
    },
    body,
  };
}
