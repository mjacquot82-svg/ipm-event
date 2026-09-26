#!/usr/bin/env python3
"""Run one guarded cycle of due scheduled IPM announcement broadcasts."""
from __future__ import annotations
import asyncio, json, logging, os, sys
from datetime import datetime, timezone

if __package__:
    from .platform_services import (SupabaseAnnouncementService, SupabaseContentClient,
        SupabaseScheduledAnnouncementRepository, SupabaseNotificationDeliveryService, WonderPushClient, WonderPushError)
else:
    from platform_services import (SupabaseAnnouncementService, SupabaseContentClient,
        SupabaseScheduledAnnouncementRepository, SupabaseNotificationDeliveryService, WonderPushClient, WonderPushError)

PRODUCTION_EVENT="ipm-2026"
PRODUCTION_SUPABASE_URL="https://hppboivlpqkfhhzfftuu.supabase.co"
PRODUCTION_APP_URL="https://theipm.ca"
MODE=os.environ.get("SCHEDULED_ANNOUNCEMENTS_MODE","broadcast").strip()
EVENT=os.environ.get("DEFAULT_EVENT_ID","").strip()
SUPABASE_URL=os.environ.get("SUPABASE_URL","").strip()
APP_URL=os.environ.get("PUBLIC_APP_URL","").strip()

def require_environment():
    if os.environ.get("SCHEDULED_ANNOUNCEMENTS_LIVE","").strip()!="true":
        raise ValueError("production_guard_failed")
    if MODE not in {"broadcast","test"}:
        raise ValueError("production_guard_failed")
    if not EVENT or not SUPABASE_URL or not APP_URL:
        raise ValueError("production_guard_failed")
    if MODE == "broadcast" and (
        EVENT != PRODUCTION_EVENT
        or SUPABASE_URL != PRODUCTION_SUPABASE_URL
        or APP_URL != PRODUCTION_APP_URL
    ):
        raise ValueError("production_guard_failed")
    key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
    token=os.environ.get("WONDERPUSH_ACCESS_TOKEN","").strip()
    if not key or not token: raise ValueError("production_guard_failed")
    return key,token

async def run_once(now=None):
    key,token=require_environment(); now=now or datetime.now(timezone.utc)
    client=SupabaseContentClient(supabase_url=SUPABASE_URL,service_role_key=key)
    queue=SupabaseScheduledAnnouncementRepository(client,EVENT)
    announcements=SupabaseAnnouncementService(supabase_url=SUPABASE_URL,service_role_key=key,event_slug=EVENT)
    deliveries=SupabaseNotificationDeliveryService(supabase_url=SUPABASE_URL,service_role_key=key,event_slug=EVENT)
    provider=WonderPushClient(access_token=token)
    result={"due":0,"claimed":0,"sent":0,"failed":0}
    for job in await queue.due(now,EVENT):
        result["due"]+=1
        claimed=await queue.claim(job["id"],EVENT)
        if not claimed: continue
        result["claimed"]+=1
        try:
            item=await announcements.get(job["announcement_id"],EVENT)
            if not item or item.get("status")!="draft": raise RuntimeError("announcement_not_draft")
            if item.get("expires_at"):
                expiry=datetime.fromisoformat(str(item["expires_at"]).replace("Z","+00:00"))
                if expiry<=now: raise RuntimeError("announcement_expired")
            base=f"{APP_URL}/announcements/{item['id']}"
            image=item.get("image") if isinstance(item.get("image"),dict) else None
            content=provider.notification_content(item["title"],item["message"],base,image_url=(image or {}).get("url"))
            # Reserve the one-and-only broad delivery before publishing. If this
            # uniqueness gate fails, the announcement remains a draft.
            delivery=await deliveries.create_requested(event_id=EVENT,announcement_id=item["id"],audience="everyone",
                requested_by=f"scheduled:{job['scheduled_by']}",target_url=content["target_url"],
                notification_title=content["title"],notification_message=content["message"],provider="wonderpush")
            published=await announcements.set_status(item["id"],"published",EVENT)
            if not published: raise RuntimeError("publish_failed")
            target=f"{base}?notification_ref={delivery['id']}"
            content=provider.notification_content(published["title"],published["message"],target,image_url=(image or {}).get("url"))
            if hasattr(deliveries,"update_target_url"): await deliveries.update_target_url(delivery["id"],content["target_url"])
            if MODE == "test":
                ids=[value.strip() for value in os.environ.get("WONDERPUSH_TEST_INSTALLATION_IDS","").split(",") if value.strip()]
                campaign=os.environ.get("WONDERPUSH_TEST_CAMPAIGN_ID","").strip()
                if len(ids)!=1 or not campaign or ids[0].upper()=="@ALL": raise RuntimeError("test_target_guard_failed")
                provider_id=await provider.send_test(**content,installation_ids=ids,
                    idempotency_key="scheduled-test-"+delivery["id"],campaign_id=campaign,
                    expiration_time=(int(expiry.timestamp()) if item.get("expires_at") else None))
            else:
                provider_id=await provider.send_everyone(**content,idempotency_key="announcement-"+delivery["id"],
                    expiration_time=(int(expiry.timestamp()) if item.get("expires_at") else None))
            await deliveries.mark_sent(delivery["id"],provider_id)
            await queue.finish(job["id"],sent=True,event_id=EVENT); result["sent"]+=1
        except Exception as exc:
            code="provider_error" if isinstance(exc,WonderPushError) else "scheduled_send_failed"
            await queue.finish(job["id"],sent=False,error_code=code,event_id=EVENT); result["failed"]+=1
    return result

def main(args=None):
    if args: return 2
    previous=logging.root.manager.disable; logging.disable(logging.CRITICAL)
    try:
        print(json.dumps(asyncio.run(run_once()),sort_keys=True)); return 0
    except Exception:
        print(json.dumps({"status":"failed"}),file=sys.stderr); return 1
    finally: logging.disable(previous)

if __name__=="__main__": raise SystemExit(main(sys.argv[1:]))
