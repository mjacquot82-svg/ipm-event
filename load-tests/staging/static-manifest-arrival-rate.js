import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import {
  STAGING_MANIFEST_URL,
  validateManifestResponse,
  validateTarget,
} from './manifest-validation.js';

// This test measures static manifest request capacity at a requested arrival rate.
// It intentionally does not model one sleeping VU per attendee.
const scenarios = {
  RATE_22: { rate: 22, preAllocatedVUs: 25, maxVUs: 50 },
  RATE_44: { rate: 44, preAllocatedVUs: 25, maxVUs: 50 },
  RATE_111: { rate: 111, preAllocatedVUs: 25, maxVUs: 50 },
  RATE_222: { rate: 222, preAllocatedVUs: 25, maxVUs: 50 },
  // Prepared for separate authorization; never selected by default.
  RATE_333: { rate: 333, preAllocatedVUs: 40, maxVUs: 80 },
};

const scenario = __ENV.SCENARIO || 'RATE_22';
if (!Object.prototype.hasOwnProperty.call(scenarios, scenario)) {
  throw new Error(`Unsupported SCENARIO: ${scenario}`);
}
const selected = scenarios[scenario];
const targetGuard = validateTarget(STAGING_MANIFEST_URL, __ENV);
if (!targetGuard.ok) throw new Error(`Unsafe target: ${targetGuard.reason}`);

const validManifest = new Rate('valid_manifest_success');
const transportErrors = new Rate('manifest_transport_errors');

export const options = {
  scenarios: {
    manifest_arrival_rate: {
      executor: 'constant-arrival-rate',
      rate: selected.rate,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: selected.preAllocatedVUs,
      maxVUs: selected.maxVUs,
    },
  },
  maxRedirects: 0,
  insecureSkipTLSVerify: false,
  noCookiesReset: true,
  userAgent: 'IPM-static-manifest-arrival-rate/1',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  tags: { scenario, target: 'staging-static-manifest' },
  thresholds: {
    valid_manifest_success: [{ threshold: 'rate>=0.999', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_failed: [{ threshold: 'rate<0.001', abortOnFail: true, delayAbortEval: '30s' }],
    manifest_transport_errors: ['rate<0.001'],
    dropped_iterations: ['count==0'],
    http_req_duration: ['p(95)<100'],
  },
};

export function setup() {
  const response = http.get(STAGING_MANIFEST_URL, {
    redirects: 0,
    timeout: '10s',
    tags: { phase: 'setup', endpoint: 'content-manifest' },
  });
  const result = validateManifestResponse(response);
  if (!result.ok) throw new Error(`Setup manifest rejected: ${result.reason}`);
  console.log(JSON.stringify({
    event: 'manifest_arrival_baseline',
    scenario,
    requestedRate: selected.rate,
    preAllocatedVUs: selected.preAllocatedVUs,
    maxVUs: selected.maxVUs,
    target: STAGING_MANIFEST_URL,
    baseline: result.baseline,
  }));
  return result.baseline;
}

export default function (baseline) {
  // Exactly one load request per iteration. The arrival-rate executor supplies pacing.
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
  if (!result.ok) {
    exec.test.abort(`Manifest validation failed: ${result.reason}`);
  }
}
