#!/usr/bin/env python3
"""Repeatable provider-free IPM reminder burst simulation."""
import json
from backend.reminder_scale import batched_scale_report, scale_report

print(json.dumps({"single_target_baseline": scale_report(),
    "exact_target_batching": batched_scale_report()}, indent=2, sort_keys=True))
