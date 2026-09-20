import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import {
  STAGING_MANIFEST_URL,
  validateManifestResponse,
  validateTarget,
} from './manifest-validation.js';

// This test models a returning attendee whose cached content is unchanged.
// Each VU checks the static manifest, then waits 30–60 seconds before checking again.
// It never fetches Schedule, Announcements, Vendors, or any backend/provider route.

const scenario = __ENV.SCENARIO || 'SMOKE';
const scenarios = {
  SMOKE: {
    stages: [
      { duration: '15s', target: 5 },
      { duration: '2m', target: 5 },
      { duration: '15s', target: 0 },
    ],
  },
  VERIFY: {
    stages: [
      { duration: '1m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '1m', target: 0 },
    ],
  },
  RETURNING_1000: {
    stages: [
      { duration: '1m', target: 100 },
      { duration: '1m', target: 250 },
      { duration: '2m', target: 500 },
      { duration: '2m', target: 750 },
      { duration: '2m', target: 1000 },
      { duration: '5m', target: 1000 },
      { duration: '2m', target: 0 },
    ],
  },
};
if (!Object.prototype.hasOwnProperty.call(scenarios, scenario)) throw new Error(`Unsupported SCENARIO: ${scenario}`);

const targetGuard = validateTarget(STAGING_MANIFEST_URL, __ENV);
if (!targetGuard.ok) throw new Error(`Unsafe target: ${targetGuard.reason}`);

const validManifest = new Rate('valid_manifest_success');
const transportErrors = new Rate('manifest_transport_errors');

export const options = {
  scenarios: {
    returning_attendee: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: scenarios[scenario].stages,
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  maxRedirects: 0,
  insecureSkipTLSVerify: false,
  noCookiesReset: true,
  userAgent: 'IPM-returning-user-static-manifest/1',
  tags: { scenario, target: 'staging-static-manifest' },
  thresholds: {
    valid_manifest_success: [{ threshold: 'rate>=0.99', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
    manifest_transport_errors: ['rate<0.01'],
    checks: ['rate>=0.99'],
  },
};

export function setup() {
  // This is the only request before VUs start. Its revisions are immutable test state.
  const response = http.get(STAGING_MANIFEST_URL, { redirects: 0, timeout: '10s', tags: { phase: 'setup' } });
  const result = validateManifestResponse(response);
  if (!result.ok) throw new Error(`Setup manifest rejected: ${result.reason}`);
  console.log(JSON.stringify({ event: 'manifest_baseline', scenario, target: STAGING_MANIFEST_URL, baseline: result.baseline }));
  return result.baseline;
}

export default function (baseline) {
  const response = http.get(STAGING_MANIFEST_URL, {
    redirects: 0,
    timeout: '10s',
    tags: { phase: 'load', endpoint: 'content-manifest' },
    headers: { Accept: 'application/json' },
  });
  const result = validateManifestResponse(response, baseline);
  const valid = check(response, {
    'manifest is a valid unchanged staging manifest': () => result.ok,
    'manifest has staging identity': () => result.reason !== 'wrong environment' && result.reason !== 'wrong event',
  });
  validManifest.add(valid);
  transportErrors.add(response.status === 0 || response.status >= 400);
  if (!result.ok && result.reason !== 'HTTP status is not 200') {
    exec.test.abort(`Manifest validation failed: ${result.reason}`);
  }
  sleep(30 + Math.random() * 30);
}
