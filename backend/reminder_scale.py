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

    async def acquire(self) -> None:
        while True:
            async with self.lock:
                now = self.clock()
                while self.timestamps and self.timestamps[0] <= now - 1:
                    self.timestamps.popleft()
                if len(self.timestamps) < self.rate:
                    self.timestamps.append(now)
                    return
                delay = max(0.001, 1 - (now - self.timestamps[0]))
            await self.sleep(delay)


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
