// Standalone: reuse the diagnostic's existing capability; no SDK or storage writes.
const ORIGIN = 'https://theipm.ca';
const API = 'https://ipm-backend-eoiw.onrender.com/api/notification-registrations/bind-pilot';
export async function bindPilot(invitation, env = globalThis) {
  if (env.location?.origin !== ORIGIN) return {bound: false};
  try {
    const capability = env.localStorage.getItem('@ipm_notification_capability_v1');
    if (![capability, invitation].every(v => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v))) return {bound: false};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await env.fetch(API, {method: 'POST', credentials: 'omit',
        cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: {'Content-Type': 'application/json', 'X-Notification-Device-Capability': capability},
        body: JSON.stringify({invitation})});
      const r = await response.json();
      if (response.ok && r.bound === true && r.pilot_restriction_count === 1 &&
          r.observation_enabled === false && r.repair_enabled === false) {
        return {bound: true, pilot_restriction_count: 1, observation_enabled: false, repair_enabled: false};
      }
    } finally { clearTimeout(timer); }
  } catch { /* Failure/unknown outcome: external read-only check, never retry. */ }
  return {bound: false};
}
if (typeof document !== 'undefined') {
  document.getElementById('bind').addEventListener('click', async () => {
    document.getElementById('bind').disabled = true;
    const input = document.getElementById('invitation');
    const invitation = input.value; input.value = ''; input.disabled = true;
    const result = await bindPilot(invitation);
    document.getElementById('result').textContent = JSON.stringify(result) +
      (result.bound ? '\nPilot bound; observation and repair remain off.' :
        '\nBinding not confirmed. Stop; request an external read-only status check before retrying.');
  });
}
