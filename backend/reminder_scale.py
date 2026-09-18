"""Provider-free load model and runtime delivery controls for itinerary reminders."""
from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import asdict, dataclass
from time import monotonic, perf_counter
from typing import Awaitable, Callable


class SlidingWindowRateLimiter:
    def __init__(self, rate_per_second: int = 10, *, clock=monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep):
        self.rate = max(1, rate_per_second)
        self.clock, self.sleep = clock, sleep
        self.timestamps: deque[float] = deque()
        self.lock = asyncio.Lock()
        self.blocked_until = 0.0

    async def acquire(self) -> None:
        while True:
            async with self.lock:
                now = self.clock()
                if now < self.blocked_until:
                    delay = self.blocked_until - now
                else:
                    delay = 0.0
                while self.timestamps and self.timestamps[0] <= now - 1:
                    self.timestamps.popleft()
                if delay == 0 and len(self.timestamps) < self.rate:
                    self.timestamps.append(now)
                    return
                if delay == 0: delay = max(0.001, 1 - (now - self.timestamps[0]))
            await self.sleep(delay)

    async def defer(self, seconds: int | float) -> None:
        async with self.lock:
            self.blocked_until = max(self.blocked_until, self.clock() + max(0, seconds))


class ProviderCircuitBreaker:
    def __init__(self, *, minimum_calls: int = 20, failure_threshold: float = 0.5,
        window_size: int = 50, cooldown_seconds: int = 60, clock=monotonic):
        self.minimum_calls = minimum_calls
        self.failure_threshold = failure_threshold
        self.results: deque[bool] = deque(maxlen=window_size)
        self.cooldown_seconds, self.clock = cooldown_seconds, clock
        self.opened_at: float | None = None

    @property
    def state(self) -> str:
        if self.opened_at is None: return "closed"
        if self.clock() - self.opened_at >= self.cooldown_seconds: return "half_open"
        return "open"

    def allow(self) -> bool:
        return self.state != "open"

    def record(self, success: bool) -> None:
        if self.state == "half_open":
            if success: self.opened_at, self.results = None, deque(maxlen=self.results.maxlen)
            else: self.opened_at = self.clock()
            return
        self.results.append(success)
        if len(self.results) >= self.minimum_calls:
            failures = sum(not item for item in self.results)
            if failures / len(self.results) >= self.failure_threshold:
                self.opened_at = self.clock()


def classify_provider_failure(error: Exception) -> tuple[str, str]:
    text = str(error).lower()
    if "429" in text or "rate limit" in text: return "provider_failed", "429"
    if any(code in text for code in ("500", "502", "503", "504")): return "provider_failed", "5xx"
    if "rejected" in text: return "provider_failed", "rejected"
    # A malformed success response may follow an accepted provider write. Treat it
    # as ambiguous so an automatic retry cannot create a duplicate notification.
    if "malformed" in text: return "delivery_unknown", "ambiguous"
    return "delivery_unknown", "ambiguous"


@dataclass
class LoadResult:
    eligible: int
    total_candidates: int
    accepted: int
    duplicate_claims_prevented: int
    late_suppressed: int
    unstarred_suppressed: int
    unreachable_suppressed: int
    worker_count: int
    configured_rate_per_second: int
    configured_batch_size: int
    identify_seconds: float
    claim_seconds: float
    simulated_drain_seconds: float
    within_1_minute_pct: float
    within_2_minutes_pct: float
    within_5_minutes_pct: float


@dataclass
class BatchedLoadResult:
    eligible: int
    event_count: int
    provider_max_targets: int
    api_requests: int
    batch_sizes: list[int]
    duplicate_claims_prevented: int
    duplicate_targets: int
    worker_count: int
    modeled_drain_seconds: float
    within_1_minute_pct: float
    within_2_minutes_pct: float
    within_5_minutes_pct: float


def simulate_load(eligible: int, *, workers: int = 1, rate_per_second: int = 10,
    batch_size: int = 250, cycle_seconds: int = 60) -> LoadResult:
    """Concrete in-memory candidate/claim simulation; never imports a provider client."""
    started = perf_counter()
    late = max(1, eligible // 20)
    unstarred = max(1, eligible // 25)
    unreachable = max(1, eligible // 10)
    candidates = ([{"id": f"ready-{i}", "ready": True, "event": i % 20} for i in range(eligible)] +
        [{"id": f"late-{i}", "late": True} for i in range(late)] +
        [{"id": f"unstar-{i}", "unstarred": True} for i in range(unstarred)] +
        [{"id": f"stale-{i}", "ready": False} for i in range(unreachable)])
    due = [row for row in candidates if row.get("ready") and not row.get("late") and not row.get("unstarred")]
    identify_seconds = perf_counter() - started

    claim_started = perf_counter()
    claims: set[str] = set()
    duplicate_prevented = 0
    # Every worker races the same ordered set; the set models the database unique claim.
    for _worker in range(workers):
        for row in due:
            if row["id"] in claims: duplicate_prevented += 1
            else: claims.add(row["id"])
    claim_seconds = perf_counter() - claim_started

    send_times = []
    for index in range(len(claims)):
        cycle = index // batch_size
        inside = index % batch_size
        send_times.append(cycle * cycle_seconds + inside / rate_per_second)
    drain = max(send_times, default=0)
    pct = lambda seconds: round(100 * sum(t <= seconds for t in send_times) / max(1, len(send_times)), 2)
    return LoadResult(eligible, len(candidates), len(claims), duplicate_prevented,
        late, unstarred, unreachable, workers, rate_per_second, batch_size,
        identify_seconds, claim_seconds, round(drain, 3), pct(60), pct(120), pct(300))


def scale_report() -> dict:
    return {"scenarios": [asdict(simulate_load(size)) for size in (100, 1000, 5000, 10000)],
        "races": [asdict(simulate_load(10000, workers=count)) for count in (2, 4, 8)],
        "modeled_25000_devices_20pct": asdict(simulate_load(5000))}


def simulate_batched_load(eligible: int, *, event_count: int = 1, workers: int = 1,
    provider_max_targets: int = 10000, requests_per_second: int = 10) -> BatchedLoadResult:
    """Provider-free exact-target model after individual eligibility and atomic claims."""
    if eligible < 0 or event_count < 1 or provider_max_targets < 1: raise ValueError("Invalid load shape")
    claims: set[tuple[str, int]] = set()
    duplicate_claims = 0
    for _worker in range(workers):
        for index in range(eligible):
            key = (f"installation-{index}", index % event_count)
            if key in claims: duplicate_claims += 1
            else: claims.add(key)
    grouped: dict[int, list[str]] = {}
    for installation, event in sorted(claims, key=lambda value: (value[1], value[0])):
        grouped.setdefault(event, []).append(installation)
    batches: list[list[str]] = []
    for event in sorted(grouped):
        targets = grouped[event]
        batches.extend(targets[offset:offset + provider_max_targets]
            for offset in range(0, len(targets), provider_max_targets))
    send_times = [index / requests_per_second for index in range(len(batches))]
    target_times = [send_times[index] for index, batch in enumerate(batches) for _ in batch]
    pct = lambda seconds: round(100 * sum(value <= seconds for value in target_times) /
        max(1, len(target_times)), 2)
    return BatchedLoadResult(eligible, event_count, provider_max_targets, len(batches),
        [len(batch) for batch in batches], duplicate_claims,
        sum(len(batch) - len(set(batch)) for batch in batches), workers,
        round(max(send_times, default=0), 3), pct(60), pct(120), pct(300))


def batched_scale_report() -> dict:
    scenarios = {}
    for size in (100, 1000, 5000, 10000):
        scenarios[str(size)] = {str(events): asdict(simulate_batched_load(size, event_count=events))
            for events in (1, 5, 20)}
    return {"provider_max_targets": 10000, "scenarios": scenarios,
        "one_event_over_limit": asdict(simulate_batched_load(25000, event_count=1)),
        "modeled_25000_devices_20pct": asdict(simulate_batched_load(5000, event_count=5)),
        "races": {str(workers): asdict(simulate_batched_load(10000, event_count=20, workers=workers))
            for workers in (2, 4, 8)}}
