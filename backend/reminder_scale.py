"""Runtime provider rate and failure controls for itinerary reminders."""
from __future__ import annotations

import asyncio
from collections import deque
from time import monotonic
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
