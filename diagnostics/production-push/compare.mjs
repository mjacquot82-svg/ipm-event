// Standalone: no app/SDK initialization, worker changes or storage writes.
export const ORIGIN = 'https://theipm.ca';
export const RESULT = 'CURRENT_BROWSER_SUBSCRIPTION_MATCHES_PROVIDER';
const FIELDS = ['endpoint', 'p256dh', 'auth', 'application_server_key'];
const API = 'https://ipm-backend-eoiw.onrender.com/api/production-diagnostics/push-target';
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
const BOOLS = ['production_registration_identified','browser_subscription_present','browser_provider_match',
 'endpoint_match','p256dh_match','auth_match','application_server_key_match',
 'configured_test_target_matches_current_registration','provider_opt_in','provider_has_push_token','provider_os_notifications_visible'];
const STATUSES = ['UNVERIFIABLE','WRONG_ORIGIN','CAPABILITY_UNAVAILABLE','BROWSER_UNAVAILABLE','BROWSER_CHANGED',
 'INVALID_INPUT','CONFIGURATION_UNAVAILABLE','REGISTRATION_READ_UNAVAILABLE','REGISTRATION_UNRESOLVED',
 'PROVIDER_READ_UNAVAILABLE','PROVIDER_DATA_UNVERIFIABLE','COMPARED','ORIGIN_REJECTED'];
export function safeResult(body = {}) {
  const out = Object.fromEntries(BOOLS.map(k => [k, typeof body[k] === 'boolean' ? body[k] : 'unverifiable']));
  out.configured_test_target_count = Number.isSafeInteger(body.configured_test_target_count) && body.configured_test_target_count >= 0 ? body.configured_test_target_count : 'unverifiable';
  out.provider_update_at = typeof body.provider_update_at === 'string' && /^[0-9T:Z.+-]{20,35}$/.test(body.provider_update_at) && Number.isFinite(Date.parse(body.provider_update_at)) ? body.provider_update_at : 'unavailable';
  out.diagnostic_status = STATUSES.includes(body.diagnostic_status) ? body.diagnostic_status : 'UNVERIFIABLE';
  const fields = FIELDS.map(k => out[k + '_match']);
  if (out.browser_provider_match === true && !fields.every(v => v === true)) out.browser_provider_match = 'unverifiable';
  return out;
}
async function bounded(read) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(read), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error()), 5000);
  })]); } finally { clearTimeout(timer); }
}
export async function compareCurrentSubscription(env = globalThis) {
  if (env.location?.origin !== ORIGIN) return safeResult({diagnostic_status:'WRONG_ORIGIN'});
  try {
    const capability = env.localStorage.getItem('@ipm_notification_capability_v1');
    if (!/^[A-Za-z0-9_-]{43}$/.test(capability || '')) return safeResult({diagnostic_status:'CAPABILITY_UNAVAILABLE'});
    const registration = await bounded(() => env.navigator.serviceWorker.getRegistration('/'));
    if (!registration?.active || registration.scope !== ORIGIN + '/') return safeResult({diagnostic_status:'BROWSER_UNAVAILABLE'});
    const subscription = await bounded(() => registration.pushManager.getSubscription());
    if (!subscription) return safeResult({browser_subscription_present:false,diagnostic_status:'BROWSER_UNAVAILABLE'});
    const challenge = env.crypto.getRandomValues(new Uint8Array(32));
    const payload = await digestSubscription(subscription, challenge, env.crypto);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);
    let body;
    try {
      const response = await env.fetch(API, {method:'POST',credentials:'omit',cache:'no-store',redirect:'error',
        headers:{'Content-Type':'application/json','X-Notification-Device-Capability':capability},
        body:JSON.stringify(payload),signal:controller.signal});
      if (!response.ok) throw new Error();
      body = safeResult(await response.json());
    } finally { clearTimeout(timer); }
    // A result for an old browser subscription is never presented as current equality.
    const current = await bounded(() => registration.pushManager.getSubscription());
    if (!current) return safeResult({browser_subscription_present:false,diagnostic_status:'BROWSER_CHANGED'});
    const after = await digestSubscription(current, challenge, env.crypto);
    if (FIELDS.some(k => payload.digests[k] !== after.digests[k]) || env.localStorage.getItem('@ipm_notification_capability_v1') !== capability)
      return safeResult({browser_subscription_present:true,diagnostic_status:'BROWSER_CHANGED'});
    return body;
  } catch { return safeResult({diagnostic_status:'UNVERIFIABLE'}); }
}
if (typeof document !== 'undefined') {
  const button = document.getElementById('compare');
  button?.addEventListener('click', async () => {
    button.disabled = true; // One attempt per page load; no retry loop.
    const output = document.getElementById('result');
    output.textContent = 'Checking…';
    output.textContent = JSON.stringify(await compareCurrentSubscription(), null, 2);
  });
}
