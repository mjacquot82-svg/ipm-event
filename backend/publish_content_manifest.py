#!/usr/bin/env python3
"""Publish the staging content manifest as an atomic Netlify static deploy.

This job is deliberately pull based: the database revision triggers remain the
source of truth and the job reconciles the published object on every run.  It
never writes Schedule or Announcement rows.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


EXPECTED_ENV = "staging"
EXPECTED_EVENT = "ipm-staging"
EXPECTED_EVENT_ID = "51000000-0000-4000-8000-000000000001"
LEASE_KEY = "staging-content-manifest"


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"missing required environment variable: {name}")
    return value


def json_request(url: str, *, method: str = "GET", body: object | None = None,
                 headers: dict[str, str] | None = None) -> object:
    payload = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    request = Request(url, data=payload, method=method, headers={
        "Accept": "application/json",
        "User-Agent": "ipm-staging-content-manifest-publisher/1",
        **(headers or {}),
    })
    with urlopen(request, timeout=20) as response:
        raw = response.read()
        if not raw:
            return None
        return json.loads(raw.decode())


def raw_request(url: str, *, method: str = "GET", body: bytes | None = None,
               headers: dict[str, str] | None = None) -> bytes:
    request = Request(url, data=body, method=method, headers={
        "User-Agent": "ipm-staging-content-manifest-publisher/1",
        **(headers or {}),
    })
    with urlopen(request, timeout=20) as response:
        return response.read()


def supabase_rows() -> dict[str, dict[str, object]]:
    base = env("SUPABASE_URL").rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    query = (
        "/rest/v1/content_revisions?select=content_type,revision,updated_at"
        f"&event_id=eq.{EXPECTED_EVENT_ID}&content_type=in.(schedule,announcements)"
    )
    rows = json_request(base + query, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    if not isinstance(rows, list):
        raise RuntimeError("content_revisions response was not a list")
    result = {str(row["content_type"]): row for row in rows}
    if set(result) != {"schedule", "announcements"}:
        raise RuntimeError("staging content revisions are incomplete")
    return result


def acquire_lease(owner: str) -> bool:
    base = env("SUPABASE_URL").rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    now = datetime.now(timezone.utc).isoformat()
    lease_until = datetime.fromtimestamp(time.time() + 90, timezone.utc).isoformat()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "resolution=ignore-duplicates"}
    json_request(base + "/rest/v1/content_manifest_publish_leases", method="POST", body={
        "lease_key": LEASE_KEY, "owner": owner, "lease_until": now,
    }, headers=headers)
    rows = json_request(
        base + "/rest/v1/content_manifest_publish_leases"
        f"?lease_key=eq.{quote(LEASE_KEY)}&or=(lease_until.lt.{quote(now)},owner.eq.{quote(owner)})",
        method="PATCH", body={"owner": owner, "lease_until": lease_until},
        headers={**headers, "Prefer": "return=representation"},
    )
    return isinstance(rows, list) and bool(rows)


def release_lease(owner: str) -> None:
    base = env("SUPABASE_URL").rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    json_request(
        base + "/rest/v1/content_manifest_publish_leases"
        f"?lease_key=eq.{quote(LEASE_KEY)}&owner=eq.{quote(owner)}",
        method="PATCH", body={"lease_until": datetime.now(timezone.utc).isoformat()},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )


def netlify_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {env('NETLIFY_AUTH_TOKEN')}"}


def netlify_url(path: str) -> str:
    return "https://api.netlify.com/api/v1" + path


def current_files(site_id: str) -> list[dict[str, object]]:
    files = json_request(netlify_url(f"/sites/{quote(site_id, safe='')}/files"), headers=netlify_headers())
    if not isinstance(files, list) or not files:
        raise RuntimeError("Netlify returned no deployed files; refusing destructive deploy")
    return files


def current_manifest(site_id: str, files: list[dict[str, object]]) -> dict[str, object] | None:
    if not any(item.get("path") == "/content-manifest.json" for item in files):
        return None
    raw = raw_request(
        netlify_url(f"/sites/{quote(site_id, safe='')}/files/content-manifest.json"),
        headers={**netlify_headers(), "Accept": "application/vnd.bitballoon.v1.raw"},
    )
    value = json.loads(raw.decode())
    return value if isinstance(value, dict) else None


def publish(site_id: str, manifest: dict[str, object], files: list[dict[str, object]]) -> str:
    content = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    digest = hashlib.sha1(content).hexdigest()
    file_map = {str(item["path"]): str(item["sha"]) for item in files}
    file_map["/content-manifest.json"] = digest
    deploy = json_request(
        netlify_url(f"/sites/{quote(site_id, safe='')}/deploys"), method="POST",
        body={"files": file_map}, headers=netlify_headers(),
    )
    if not isinstance(deploy, dict) or not deploy.get("id"):
        raise RuntimeError("Netlify did not return a deploy id")
    deploy_id = str(deploy["id"])
    required = set(deploy.get("required", []))
    if digest in required:
        raw_request(
            netlify_url(f"/deploys/{quote(deploy_id, safe='')}/files/content-manifest.json"),
            method="PUT", body=content,
            headers={**netlify_headers(), "Content-Type": "application/octet-stream"},
        )
    for _ in range(30):
        state = json_request(netlify_url(f"/deploys/{quote(deploy_id, safe='')}"), headers=netlify_headers())
        if isinstance(state, dict) and state.get("state") == "ready":
            return deploy_id
        if isinstance(state, dict) and state.get("state") in {"error", "failed"}:
            raise RuntimeError(f"Netlify deploy failed: {state.get('error_message', state.get('state'))}")
        time.sleep(2)
    raise RuntimeError(f"Netlify deploy {deploy_id} did not become ready")


def run_once() -> int:
    if os.environ.get("MANIFEST_ENVIRONMENT", EXPECTED_ENV) != EXPECTED_ENV:
        raise RuntimeError("publisher is staging-only")
    if os.environ.get("MANIFEST_EVENT", EXPECTED_EVENT) != EXPECTED_EVENT:
        raise RuntimeError("unexpected staging event identity")
    owner = f"{os.uname().nodename}:{os.getpid()}:{uuid.uuid4()}"
    if not acquire_lease(owner):
        print("content-manifest publisher: lease busy; skipping")
        return 0
    try:
        rows = supabase_rows()
        manifest = {
            "environment": EXPECTED_ENV,
            "event": EXPECTED_EVENT,
            "schedule": {"revision": int(rows["schedule"]["revision"]), "updatedAt": rows["schedule"]["updated_at"]},
            "announcements": {"revision": int(rows["announcements"]["revision"]), "updatedAt": rows["announcements"]["updated_at"]},
        }
        site_id = env("NETLIFY_SITE_ID")
        files = current_files(site_id)
        previous = current_manifest(site_id, files)
        if previous:
            for content_type in ("schedule", "announcements"):
                old = int(previous.get(content_type, {}).get("revision", 0))
                new = int(manifest[content_type]["revision"])
                if new < old:
                    raise RuntimeError(f"refusing revision rollback for {content_type}: {old} -> {new}")
        if previous == manifest:
            print("content-manifest: IN SYNC", json.dumps(manifest, sort_keys=True))
            return 0
        deploy_id = publish(site_id, manifest, files)
        print(f"content-manifest: published IN SYNC deploy={deploy_id} {json.dumps(manifest, sort_keys=True)}")
        return 0
    except Exception as exc:
        print(f"content-manifest: OUT OF SYNC: {exc}", file=sys.stderr)
        return 1
    finally:
        release_lease(owner)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--daemon", action="store_true", help="run two reconciliation cycles 30 seconds apart")
    args = parser.parse_args()
    if not args.daemon:
        return run_once()
    status = run_once()
    time.sleep(30)
    return max(status, run_once())


if __name__ == "__main__":
    raise SystemExit(main())
