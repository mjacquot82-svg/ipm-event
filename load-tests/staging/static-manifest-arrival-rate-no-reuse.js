import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import {
  STAGING_MANIFEST_URL,
  classifyManifestResponse,
  validateManifestResponse,
  validateTarget,
} from './manifest-validation.js';

// Offline-prepared diagnostic; live execution requires separate authorization.
// Compare with the original RATE_22 on the same Azure VM/source public IP,
// using the same k6 v2.2.0 binary and runner configuration. No larger rates.
//
// k6 v2.2.0: noConnectionReuse=true disables HTTP connection keep-alive reuse
// globally (the runner sets http.Transport.DisableKeepAlives), so requests use
// fresh connections. It does not change OS TCP keep-alive settings.
// noVUConnectionReuse=true instead closes idle connections after each VU
// iteration, allowing reuse within an iteration. With one GET per iteration,
// either addresses inter-iteration reuse; the global option alone is the clean
// fresh-connection diagnostic. Setting both is unnecessary.
// Sources:
// https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/#no-connection-reuse
// https://github.com/grafana/k6/blob/v2.2.0/internal/js/runner.go
//
// Keep runner overrides identical between A and B; do not override this option,
// scenarios, thresholds, DNS, protocol, headers, or timeout. Record source public
// IP for both runs. Fresh connections can also change destination selection
// through existing DNS behavior; this experiment alone cannot prove causation.
//
// Interpretation against RATE_22 (~80.15% transport errors, ~19.84% valid,
// 4,792 dropped iterations; successful-response p95 ~18.4ms / p99 ~29ms):
// - Near-zero transport failures strongly implicate reuse/stale idle connections.
// - Similarly high failures mean reuse is not the primary cause; investigate
//   source-path, TLS, and runner behavior further.
// - A changed failure shape requires reporting the exact differences in failures,
//   drops and timing percentiles, without claiming causation beyond the evidence.
// All-request duration includes failures; do not compare it as if it were the
// successful-response-only baseline. Strict acceptance thresholds stay unchanged.
const scenarios = {
  RATE_22_NO_REUSE: { rate: 22, preAllocatedVUs: 25, maxVUs: 50 },
};

const scenario = __ENV.SCENARIO || 'RATE_22_NO_REUSE';
if (!Object.prototype.hasOwnProperty.call(scenarios, scenario)) {
  throw new Error(`Unsupported SCENARIO: ${scenario}`);
}
const selected = scenarios[scenario];
const targetGuard = validateTarget(STAGING_MANIFEST_URL, __ENV);
if (!targetGuard.ok) throw new Error(`Unsafe target: ${targetGuard.reason}`);

const validManifest = new Rate('valid_manifest_success');
const transportErrors = new Rate('manifest_transport_errors');
const httpDeliveryFailures = new Rate('manifest_http_delivery_failures');

export const options = {
  noConnectionReuse: true,
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
    // Reliability thresholds remain strict, but are evaluated at completion so
    // isolated early failures do not truncate the measurement sample.
    valid_manifest_success: [{ threshold: 'rate>=0.999', abortOnFail: false }],
    http_req_failed: [{ threshold: 'rate<0.001', abortOnFail: false }],
    manifest_transport_errors: ['rate<0.001'],
    manifest_http_delivery_failures: ['rate<0.001'],
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
  const classified = classifyManifestResponse(response, baseline);
  const result = classified.result || { ok: false, reason: classified.reason };
  const valid = check(response, {
    'manifest is a valid unchanged staging manifest': () => result.ok,
    'manifest has staging identity': () => result.reason !== 'wrong environment' && result.reason !== 'wrong event',
  });
  validManifest.add(valid);
  const deliveryFailure = response.status !== 200;
  httpDeliveryFailures.add(deliveryFailure);
  transportErrors.add(response.status === 0);
  if (classified.kind === 'safety') {
    exec.test.abort(`Manifest validation failed: ${result.reason}`);
  }
}

// Emit the complete k6 summary metrics, including connection-stage trends that
// the default compact console summary may omit. Trend stats include p95/p99.
// This retains threshold outcomes and all available built-in/custom metrics:
// http_req_blocked, http_req_connecting, http_req_tls_handshaking,
// http_req_waiting, http_req_receiving, http_req_duration, http_req_failed,
// dropped_iterations, valid_manifest_success, manifest_transport_errors,
// manifest_http_delivery_failures. An unsampled metric may be absent from k6.
export function handleSummary(data) {
  return {
    stdout: JSON.stringify({
      scenario,
      connectionOption: { noConnectionReuse: true },
      ...data,
    }, null, 2) + '\n',
  };
}
