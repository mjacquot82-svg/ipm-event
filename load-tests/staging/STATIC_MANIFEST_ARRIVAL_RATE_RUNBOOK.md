# Static manifest arrival-rate test runbook

This package measures only the static staging manifest:

`https://staging.theipm.ca/content-manifest.json`

It does not test first-time users, backend refreshes, simultaneous content changes, or browser session behavior. Each load iteration makes exactly one GET; `constant-arrival-rate` controls pacing. `setup()` makes one guarded baseline request before load and stores the schedule and announcements revisions. Any invalid response, including a revision change, aborts the run.

## Scenarios

Run one scenario per separately authorized invocation. The script defaults to `RATE_22`; do not chain scenarios.

| Scenario | Rate | preAllocatedVUs | maxVUs | Interpretation |
| --- | ---: | ---: | ---: | --- |
| `RATE_22` | 22/s | 25 | 50 | Mean steady-state rate for 1,000 returning attendees |
| `RATE_44` | 44/s | 25 | 50 | Mean steady-state rate for 2,000 |
| `RATE_111` | 111/s | 25 | 50 | Mean steady-state rate for 5,000 |
| `RATE_222` | 222/s | 25 | 50 | Mean steady-state rate for 10,000 |
| `RATE_333` | 333/s | 40 | 80 | Aggressive 30-second-bound rate for 10,000; separate authorization required |

Each scenario runs for five minutes. The worker allocations are sized for the observed 5–40 ms response range without allocating one VU per attendee. `dropped_iterations` must remain zero; otherwise the requested rate was not generated and the run is not capacity evidence.

The thresholds are valid manifest rate ≥99.9%, HTTP failure rate <0.1%, transport error rate <0.1%, zero dropped iterations, and p95 request duration <100 ms. The summary includes p99. Review p50, p95, p99, max, bytes sent/received, and connection timings (`blocked`, `connecting`, `tls_handshaking`, `waiting`, and `receiving`) where emitted by k6.

Example invocation (future use only; do not run as part of package creation):

```sh
SCENARIO=RATE_22 k6 run load-tests/staging/static-manifest-arrival-rate.js
```

Future order is `RATE_22`, stop and inspect; then separately authorized `RATE_44`, stop and inspect; then `RATE_111`, `RATE_222`, each separately stopped and inspected. `RATE_333` requires separate authorization.

## Azure runner monitoring

On the existing Ubuntu 24.04, 2-vCPU/4-GB East US VM, start lightweight monitors in separate terminals immediately before an authorized run. Substitute the actual k6 PID after it starts. Do not install packages or run another load test for monitoring.

```sh
# CPU, memory, run queue, and swap pressure (one line per second)
vmstat 1

# Process CPU/RSS and open FD count (replace PID)
watch -n 2 'ps -o pid,ppid,%cpu,%mem,rss,vsz,nlwp,stat,cmd -p PID; printf "fds="; ls /proc/PID/fd | wc -l; cat /proc/PID/limits | grep -i "open files"'

# Aggregate socket states (one line per second)
watch -n 1 'ss -s; ss -tan state established | wc -l; ss -tan state time-wait | wc -l; ss -tan state syn-sent | wc -l'

# Destination-specific sockets; resolve the current staging edge addresses first
watch -n 1 "ss -tan '( dport = :443 )' | awk 'NR==1 || /ESTAB|TIME-WAIT|SYN-SENT/'"

# Network counters and kernel errors (interface name may be eth0)
watch -n 2 'ip -s link show dev eth0; nstat -az | egrep "TcpRetransSegs|TcpExtTCPAbort|IpInDiscards|IpOutDiscards"'

# Kernel memory/OOM evidence after the run
dmesg -T | egrep -i 'oom|out of memory|conntrack|nf_conntrack' || true
```

Record k6 output alongside UTC timestamps. Capture CPU per core, available RAM/swap activity, k6 RSS, socket states, FD count versus limit, ephemeral-port range/occupancy, network bytes/packets/drops, retransmits/resets, DNS errors, and Azure outbound/SNAT metrics when that path is configured. Do not infer SNAT behavior from guest socket counts alone.

## Interpretation boundary

Passing `RATE_22`, `RATE_44`, `RATE_111`, or `RATE_222` supports the corresponding mean manifest check rate under the stated 30–60-second model. It does not prove the same number of simultaneous first-time users, simultaneous backend refreshes, synchronized content changes, or complete browser sessions. `RATE_333` represents the aggressive upper-bound check rate only.
