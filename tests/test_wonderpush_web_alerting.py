"""Inspect mocked provider HTTP payloads only; never send live notifications."""
import asyncio
import json
from urllib.parse import parse_qs

import httpx
import pytest

from backend.platform_services import WonderPushClient, WonderPushError


@pytest.mark.parametrize("audience", ["announcement", "send_test", "t30"])
@pytest.mark.parametrize("image_url", [None, "https://theipm.ca/approved-announcement-image.png"])
def test_web_alerting_preserves_payload_audience_and_delivery_metadata(monkeypatch, audience, image_url):
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(202, json={"id": "mock-accepted"})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    client = WonderPushClient(access_token="fixture-only")
    target_url = "https://theipm.ca/itinerary" if audience == "t30" else "https://theipm.ca/announcements/example?notification_ref=unchanged"
    options = dict(title="IPM — Update", message="Original message.", target_url=target_url,
                   image_url=image_url, idempotency_key="unchanged-idempotency", campaign_id="unchanged-campaign",
                   expiration_time="10 minutes" if audience == "t30" else "72 hours")
    if audience == "announcement":
        asyncio.run(client.send_everyone(**options))
    elif audience == "send_test":
        asyncio.run(client.send_test(installation_ids=["a" * 40], **options))
    else:
        asyncio.run(client.send_installations(installation_ids=["a" * 40, "b" * 40], **options))
    assert len(requests) == 1
    request = requests[0]
    form = parse_qs(request.content.decode())
    notification = json.loads(form.pop("notification")[0])
    web = notification["alert"]["web"]
    assert web.pop("silent") is False
    assert web.pop("vibrate") == [200, 100, 200]
    assert "sound" not in web  # No invented URL or native-only "default" value.
    # Removing just the two new fields gives the entire previous payload.
    assert notification == {
        "alert": {"title": options["title"], "text": options["message"], "targetUrl": target_url,
                  "web": {"icon": "https://theipm.ca/ipm-icon-any-192.png", **({"image": image_url} if image_url else {})}},
        "push": {"custom": {"target_url": target_url}, "expirationTime": options["expiration_time"]},
    }
    expected_form = {"accessToken": ["fixture-only"], "campaignId": ["unchanged-campaign"]}
    if audience == "announcement":
        expected_form.update(targetSegmentIds=["@ALL"], filterPlatforms=["Web"])
    elif audience == "send_test":
        expected_form.update(targetInstallationIds=["a" * 40])
    else:
        expected_form.update(targetInstallationIds=["a" * 40 + "," + "b" * 40], filterPlatforms=["Web"])
    assert form == expected_form
    assert request.headers["X-WonderPush-Idempotency-Key"] == "unchanged-idempotency"


@pytest.mark.parametrize("method", ["send_test", "send_installations"])
@pytest.mark.parametrize("targets", [["@ALL"], [], ["a,b"], [""]])
def test_alerting_change_does_not_allow_broadcast_fallback(monkeypatch, method, targets):
    def forbidden(*args, **kwargs):
        pytest.fail("Invalid installation targeting must fail before provider HTTP")
    monkeypatch.setattr(httpx, "AsyncClient", forbidden)
    client = WonderPushClient(access_token="fixture-only")
    with pytest.raises(WonderPushError):
        asyncio.run(getattr(client, method)(installation_ids=targets, title="IPM", message="Message",
            target_url="https://theipm.ca/itinerary", idempotency_key="valid-key"))
