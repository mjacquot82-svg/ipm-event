"""Volunteer Glasses pre-order: password-gated order form + owner export.

Env vars (set in hosting, never in code):
  VOLUNTEER_ORDER_PASSWORD        shared password volunteers enter
  VOLUNTEER_ORDER_ADMIN_PASSWORD  owner password for the order list / CSV
  VOLUNTEER_ORDER_CLOSES_AT       ISO local datetime, America/Toronto
                                  (default 2026-11-15T12:00, exclusive cutoff)
Orders are stored in MongoDB collection ``volunteer_glass_orders``.
"""
import csv
import hmac
import os
import uuid
from datetime import datetime, timezone
from io import StringIO
from typing import Callable, Dict, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

TORONTO = ZoneInfo("America/Toronto")
# Accept orders before noon on November 15 in Toronto; noon itself is closed.
DEFAULT_CLOSES_AT = "2026-11-15T12:00"
PRICE_PER_SET_CENTS = 1600
MAX_SETS_PER_STYLE = 50
STYLES = [
    {"id": "colored_logo", "name": "Colored Logo", "description": "Pint glass with the full-colour IPM logo"},
    {"id": "large_etched", "name": "Large Etched", "description": "Tall glass with the etched IPM logo"},
    {"id": "short_etched", "name": "Short Etched", "description": "Short rocks glass with the etched IPM logo"},
]
STYLE_IDS = [s["id"] for s in STYLES]
COLLECTION = "volunteer_glass_orders"


def closes_at() -> datetime:
    raw = (os.environ.get("VOLUNTEER_ORDER_CLOSES_AT") or DEFAULT_CLOSES_AT).strip()
    value = datetime.fromisoformat(raw)
    if value.tzinfo is None:
        value = value.replace(tzinfo=TORONTO)
    return value


def is_open(now: Optional[datetime] = None) -> bool:
    return (now or datetime.now(timezone.utc)) < closes_at()


def _check(secret_env: str, supplied: Optional[str]) -> None:
    expected = os.environ.get(secret_env) or ""
    if not expected:
        raise HTTPException(status_code=503, detail="Volunteer ordering is not configured")
    if not supplied or not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Incorrect password")


class OrderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    contact: str = Field(min_length=3, max_length=160)
    quantities: Dict[str, int]
    notes: Optional[str] = Field(default=None, max_length=500)


def validate_quantities(quantities: Dict[str, int]) -> Dict[str, int]:
    unknown = set(quantities) - set(STYLE_IDS)
    if unknown:
        raise HTTPException(status_code=422, detail="Unknown glass style")
    clean = {}
    for sid in STYLE_IDS:
        q = quantities.get(sid, 0)
        if not isinstance(q, int) or q < 0 or q > MAX_SETS_PER_STYLE:
            raise HTTPException(status_code=422, detail="Invalid quantity")
        clean[sid] = q
    if sum(clean.values()) == 0:
        raise HTTPException(status_code=422, detail="Choose at least one set")
    return clean


def summarize(orders):
    totals = {sid: 0 for sid in STYLE_IDS}
    for o in orders:
        for sid in STYLE_IDS:
            totals[sid] += int(o.get("quantities", {}).get(sid, 0))
    sets = sum(totals.values())
    return {"sets_by_style": totals, "total_sets": sets, "total_cents": sets * PRICE_PER_SET_CENTS}


def orders_csv(orders) -> str:
    buf = StringIO()
    w = csv.writer(buf)
    names = [s["name"] for s in STYLES]
    w.writerow(["Submitted (Toronto)", "Name", "Contact", *[f"{n} sets" for n in names], "Total sets", "Total $", "Notes"])
    for o in orders:
        q = o.get("quantities", {})
        sets = sum(int(q.get(s, 0)) for s in STYLE_IDS)
        created = o.get("created_at")
        if isinstance(created, datetime):
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            created = created.astimezone(TORONTO).strftime("%Y-%m-%d %H:%M")
        w.writerow([created, o.get("name"), o.get("contact"), *[q.get(s, 0) for s in STYLE_IDS], sets,
                    f"{sets * PRICE_PER_SET_CENTS / 100:.2f}", o.get("notes") or ""])
    t = summarize(orders)
    w.writerow([])
    w.writerow(["TOTAL", "", "", *[t["sets_by_style"][s] for s in STYLE_IDS], t["total_sets"], f"{t['total_cents'] / 100:.2f}", ""])
    return buf.getvalue()


def build_router(get_db: Callable) -> APIRouter:
    router = APIRouter(prefix="/volunteer-glasses", tags=["volunteer-glasses"])

    def info():
        return {"open": is_open(), "closes_at": closes_at().isoformat(), "price_per_set_cents": PRICE_PER_SET_CENTS,
                "set_size": 2, "styles": STYLES, "payment": "Cash payment at pickup. No online payment."}

    @router.get("/status")
    async def status():
        return {"open": is_open(), "closes_at": closes_at().isoformat()}

    @router.post("/unlock")
    async def unlock(x_volunteer_password: Optional[str] = Header(default=None)):
        _check("VOLUNTEER_ORDER_PASSWORD", x_volunteer_password)
        return info()

    @router.post("/orders", status_code=201)
    async def create_order(order: OrderRequest, x_volunteer_password: Optional[str] = Header(default=None)):
        _check("VOLUNTEER_ORDER_PASSWORD", x_volunteer_password)
        if not is_open():
            raise HTTPException(status_code=403, detail="Pre-order closed")
        quantities = validate_quantities(order.quantities)
        sets = sum(quantities.values())
        doc = {"id": str(uuid.uuid4()), "name": order.name.strip(), "contact": order.contact.strip(),
               "quantities": quantities, "notes": (order.notes or "").strip() or None,
               "total_sets": sets, "total_cents": sets * PRICE_PER_SET_CENTS,
               "created_at": datetime.now(timezone.utc)}
        await get_db()[COLLECTION].insert_one(dict(doc))
        return {"id": doc["id"], "total_sets": sets, "total_cents": doc["total_cents"]}

    async def _all():
        return await get_db()[COLLECTION].find({}, {"_id": 0}).sort("created_at", 1).to_list(5000)

    @router.get("/admin/orders")
    async def admin_orders(x_admin_password: Optional[str] = Header(default=None)):
        _check("VOLUNTEER_ORDER_ADMIN_PASSWORD", x_admin_password)
        orders = await _all()
        return {"orders": orders, "summary": summarize(orders), "closes_at": closes_at().isoformat(), "open": is_open()}

    @router.delete("/admin/orders/{order_id}")
    async def admin_delete(order_id: str, x_admin_password: Optional[str] = Header(default=None)):
        _check("VOLUNTEER_ORDER_ADMIN_PASSWORD", x_admin_password)
        result = await get_db()[COLLECTION].delete_one({"id": order_id})
        if not result.deleted_count:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"deleted": order_id}

    @router.get("/admin/orders.csv")
    async def admin_csv(x_admin_password: Optional[str] = Header(default=None)):
        _check("VOLUNTEER_ORDER_ADMIN_PASSWORD", x_admin_password)
        return Response(orders_csv(await _all()), media_type="text/csv",
                        headers={"Content-Disposition": 'attachment; filename="volunteer-glasses-orders.csv"'})

    return router
