// Standalone: no app, storage, WonderPush SDK or worker initialization.
export const ORIGIN = 'https://staging.theipm.ca';
export const RESULT = 'CURRENT_BROWSER_SUBSCRIPTION_MATCHES_PROVIDER';
const FIELDS = ['endpoint', 'p256dh', 'auth', 'application_server_key'];
const API = 'https://ipm-staging-backend.onrender.com/api/staging-diagnostics/compare-subscription';
const utf8 = new TextEncoder();
export function unverifiable() { return { [RESULT]: 'unverifiable' }; }
function keyBytes(value, size) {
  if (Object.prototype.toString.call(value) !== '[object ArrayBuffer]') throw new Error();
  const bytes = new Uint8Array(value);
  if (bytes.length !== size || (size === 65 && bytes[0] !== 4)) throw new Error();
  return bytes;
}
function endpointBytes(value) {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,8192}$/.test(value)) throw new Error();
  const url = new URL(value);
  if (!value.startsWith('https://') || url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) throw new Error();
  return utf8.encode(value);
}
function hex(bytes) { return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join(''); }
export async function digestSubscription(subscription, challenge, crypto) {
  const values = {
    endpoint: endpointBytes(subscription.endpoint),
    p256dh: keyBytes(subscription.getKey('p256dh'), 65),
    auth: keyBytes(subscription.getKey('auth'), 16),
    application_server_key: keyBytes(subscription.options?.applicationServerKey, 65),
  };
  const key = await crypto.subtle.importKey('raw', challenge, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digests = {};
  for (const field of FIELDS) {
    const prefix = utf8.encode(`ipm-subscription-compare-v1\0${field}\0`);
    const input = new Uint8Array(prefix.length + values[field].length);
    input.set(prefix); input.set(values[field], prefix.length);
    digests[field] = hex(await crypto.subtle.sign('HMAC', key, input));
  }
  return { challenge: hex(challenge), digests };
}
export function safeResult(body) {
  if (!body || typeof body[RESULT] !== 'boolean') return unverifiable();
  const matches = {};
  for (const field of FIELDS) {
    if (typeof body[field + '_match'] !== 'boolean') return unverifiable();
    matches[field + '_match'] = body[field + '_match'];
  }
  if (body[RESULT] !== Object.values(matches).every(Boolean)) return unverifiable();
  return { [RESULT]: body[RESULT], ...matches };
}
async function bounded(read) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(read), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error()), 5000);
    })]);
  } finally { clearTimeout(timer); }
}
export async function compareCurrentSubscription(env = globalThis) {
  if (env.location?.origin !== ORIGIN) return unverifiable();
  try {
    const registration = await bounded(() => env.navigator.serviceWorker.getRegistration('/'));
    if (!registration?.active || registration.scope !== ORIGIN + '/') return unverifiable();
    const subscription = await bounded(() => registration.pushManager.getSubscription());
    if (!subscription) return unverifiable();
    // Fresh per-tap randomness and all material/digests exist only in memory.
    const challenge = env.crypto.getRandomValues(new Uint8Array(32));
    const payload = await digestSubscription(subscription, challenge, env.crypto);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75000);
    try {
      const response = await env.fetch(API, {
        method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-IPM-Staging-Diagnostic': 'compare-current-subscription' },
        signal: controller.signal, body: JSON.stringify(payload),
      });
      return response.ok ? safeResult(await response.json()) : unverifiable();
    } finally { clearTimeout(timer); }
  } catch { return unverifiable(); }
}
