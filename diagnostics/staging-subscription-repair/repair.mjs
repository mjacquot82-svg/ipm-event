import { ORIGIN, RESULT, digestSubscription, safeResult, unverifiable } from '../staging-subscription-compare/compare.mjs';
const API = 'https://ipm-staging-backend.onrender.com/api/staging-diagnostics/reconcile-subscription';
const statuses = new Set(['ALREADY_MATCHED', 'PRECONDITION_NOT_MET', 'ATTEMPT_ALREADY_USED', 'MATCH_VERIFIED', 'OUTCOME_UNCONFIRMED', 'READ_FAILED', 'NOT_AUTHORIZED', 'UNVERIFIABLE']);
const failure = () => ({ repair_status: 'UNVERIFIABLE', ...unverifiable(), browser_subscription_preserved: 'unverifiable' });
function encode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
async function bounded(read) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(read), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error()), 5000);
  })]); } finally { clearTimeout(timer); }
}
export async function repairExistingSubscription(env = globalThis) {
  if (env.location?.origin !== ORIGIN || env.Notification?.permission !== 'granted') return failure();
  try {
    // Read an existing capability only. Never create or persist identity.
    const capability = env.localStorage.getItem('@ipm_notification_capability_v1');
    if (!/^[A-Za-z0-9_-]{43}$/.test(capability || '')) return failure();
    const registration = await bounded(() => env.navigator.serviceWorker.getRegistration('/'));
    if (!registration?.active || registration.scope !== ORIGIN + '/') return failure();
    const worker = new URL(registration.active.scriptURL);
    if (worker.origin !== ORIGIN || worker.pathname !== '/webpushr-sw.js') return failure();
    const subscription = await bounded(() => registration.pushManager.getSubscription());
    if (!subscription || (subscription.expirationTime !== null && subscription.expirationTime !== undefined
        && (!Number.isFinite(subscription.expirationTime) || subscription.expirationTime <= Date.now()))) return failure();
    const challenge = env.crypto.getRandomValues(new Uint8Array(32));
    const comparison = await digestSubscription(subscription, challenge, env.crypto);
    // These four fields travel privately over TLS to the authorized backend.
    // They are never rendered, logged, placed in a URL or persisted by this page.
    const token = { data: subscription.endpoint, p256dh: encode(subscription.getKey('p256dh')),
      auth: encode(subscription.getKey('auth')), applicationServerKey: encode(subscription.options.applicationServerKey) };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    let body;
    try {
      const response = await env.fetch(API, { method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-IPM-Staging-Diagnostic': 'reconcile-existing-subscription',
          'X-Notification-Device-Capability': capability }, signal: controller.signal,
        body: JSON.stringify({ subscription: token, comparison }) });
      body = response.ok ? await response.json() : null;
    } finally { clearTimeout(timer); }
    const safe = safeResult(body);
    const current = await bounded(() => registration.pushManager.getSubscription());
    let preserved = 'unverifiable';
    if (current) {
      const after = await digestSubscription(current, challenge, env.crypto);
      preserved = Object.keys(comparison.digests).every(field => comparison.digests[field] === after.digests[field]);
    }
    // A provider match to the submitted snapshot is insufficient if the browser changed meanwhile.
    return { repair_status: statuses.has(body?.repair_status) ? body.repair_status : 'UNVERIFIABLE',
      ...(preserved === true ? safe : unverifiable()), browser_subscription_preserved: preserved };
  } catch { return failure(); }
}
