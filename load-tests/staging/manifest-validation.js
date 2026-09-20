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
  // Keep this deterministic and runtime-portable. k6 v2.2.0 does not provide the
  // browser WHATWG URL constructor during `k6 inspect`; no URL parsing is needed
  // because the primary target is an exact, single-string allowlist.
  if (typeof url !== 'string') return { ok: false, reason: 'target is not a string' };
  const productionIdentities = [
    'theipm.ca', 'www.theipm.ca', 'ipm-backend-eoiw.onrender.com',
    'hppboivlpqkfhhzfftuu.supabase.co',
  ];
  const lowered = url.toLowerCase();
  const hasProductionHost = productionIdentities.some((identity) => ['https://', 'http://'].some((scheme) => {
    const prefix = `${scheme}${identity}`;
    const next = lowered.charAt(prefix.length);
    return lowered.indexOf(prefix) === 0 && (next === '' || next === ':' || next === '/' || next === '?' || next === '#');
  }));
  if (hasProductionHost) {
    return { ok: false, reason: 'production target rejected' };
  }
  if (url !== STAGING_MANIFEST_URL) return { ok: false, reason: 'target is not the exact staging manifest URL' };
  // Explicitly retain scheme/host/path/query/fragment/port constraints without
  // invoking URL, URI, browser, or filesystem APIs.
  if (!/^https:\/\/staging\.theipm\.ca\/content-manifest\.json$/.test(url)) {
    return { ok: false, reason: 'target URL is outside the staging allowlist' };
  }
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
