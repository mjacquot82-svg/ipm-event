#!/usr/bin/env python3
"""Dry-run-first, ID-preserving Daily Event Schedule update.

This command never uses replace_schedule. Existing rows are patched by stable
schedule_item id; genuinely missing rows are inserted only with --apply.
"""
from __future__ import annotations
import argparse, json, sys
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Any
try:
    from backend.import_mnp_lifestyles_schedule import SupabaseRest, service_key_from_stdin
except ModuleNotFoundError:
    from import_mnp_lifestyles_schedule import SupabaseRest, service_key_from_stdin

PROJECT_REF = "hppboivlpqkfhhzfftuu"
EVENT_SLUG = "ipm-2026"
MANIFEST_PATH = Path(__file__).parent / "import_manifests" / "daily_event_schedule_2026.json"
PROTECTED = ("id", "event_id")
class ScheduleUpdateSafetyError(RuntimeError): pass

def load_manifest(path=MANIFEST_PATH):
    m=json.loads(Path(path).read_text())
    if m.get("source") != "organizer_daily_event_schedule_2026-09-22_to_2026-09-26": raise ScheduleUpdateSafetyError("source check failed")
    if len(m.get("existing_updates",[])) != 9 or len(m.get("existing_exact_ids",[])) != 5 or len(m.get("additions",[])) != 8: raise ScheduleUpdateSafetyError("audited row counts changed")
    ids=[r["id"] for r in m["existing_updates"]]
    if len(ids)!=len(set(ids)): raise ScheduleUpdateSafetyError("duplicate update ids")
    return m

def desired_row(item,event_id):
    return {"event_id":event_id,"title":item["title"],"description":item.get("description",""),"starts_at":datetime.fromisoformat(f"{item['date']}T00:00:00-04:00").replace(hour=0).isoformat(),"ends_at":None,"timezone":"America/Toronto","category":item["category"],"location_name":item["location_name"],"days_active":item["days_active"],"source":"admin","status":"published"}

def local_iso(date_text, time_text):
    value = datetime.strptime(f"{date_text} {time_text}", "%Y-%m-%d %I:%M %p")
    return value.replace(tzinfo=ZoneInfo("America/Toronto")).isoformat()

def db_patch(item):
    return {"title": item["title"], "starts_at": local_iso(item["date"], item["start_time"]), "ends_at": local_iso(item["date"], item["end_time"]), "category": item["category"], "location_name": item["location_name"], "days_active": item["days_active"]}

def main():
    p=argparse.ArgumentParser(); p.add_argument("--apply",action="store_true"); p.add_argument("--api-keys-json-stdin",action="store_true"); a=p.parse_args()
    if not a.api_keys_json_stdin: raise ScheduleUpdateSafetyError("Use --api-keys-json-stdin")
    m=load_manifest(); c=SupabaseRest(PROJECT_REF,service_key_from_stdin())
    events=c.call("GET","/events",params={"select":"id,slug,timezone","slug":f"eq.{EVENT_SLUG}"})
    if len(events)!=1 or events[0].get("slug")!=EVENT_SLUG or events[0].get("timezone")!="America/Toronto": raise ScheduleUpdateSafetyError("production event identity check failed")
    event_id=events[0]["id"]; rows=c.call("GET","/schedule_items",params={"select":"*","event_id":f"eq.{event_id}"}); by={r["id"]:r for r in rows}
    expected=set(x["id"] for x in m["existing_updates"]+[{"id":i} for i in m["existing_exact_ids"]])
    if not expected.issubset(by): raise ScheduleUpdateSafetyError("an audited existing schedule id is missing")
    summary={"mode":"apply" if a.apply else "dry-run","project_ref":PROJECT_REF,"existing_updates":len(m["existing_updates"]),"exact_existing":len(m["existing_exact_ids"]),"additions":len(m["additions"]),"current_count":len(rows),"candidate_count":len(rows)+len(m["additions"]),"replace_schedule_used":False}
    print(json.dumps(summary,indent=2))
    if not a.apply:return 0
    for item in m["existing_updates"]: c.call("PATCH","/schedule_items",params={"id":f"eq.{item['id']}","event_id":f"eq.{event_id}"},body=db_patch(item))
    for item in m["additions"]: c.call("POST","/schedule_items",body={"event_id":event_id,"title":item["title"],"description":"","starts_at":local_iso(item["date"],item["start_time"]),"ends_at":local_iso(item["date"],item["end_time"]),"timezone":"America/Toronto","category":item["category"],"location_name":item["location_name"],"days_active":item["days_active"],"source":"admin","status":"published"})
    return 0
if __name__=='__main__':
    try: raise SystemExit(main())
    except ScheduleUpdateSafetyError as e: print(f"UPDATE STOPPED: {e}",file=sys.stderr); raise SystemExit(2)
