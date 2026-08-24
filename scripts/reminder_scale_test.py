#!/usr/bin/env python3
"""Repeatable provider-free IPM reminder burst simulation."""
import json
from backend.reminder_scale import scale_report

print(json.dumps(scale_report(), indent=2, sort_keys=True))
