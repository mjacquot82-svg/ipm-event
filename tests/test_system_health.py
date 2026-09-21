"""All probes use fake transport: never contact production or send notifications."""
import asyncio
from unittest.mock import patch

import httpx
import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from backend import system_health


@pytest.fixture
def probe():
    config = {"url": system_health.PRODUCTION_SUPABASE, "event": "ipm-2026", "key": "secret-test-only"}
    router = APIRouter(prefix="/api")
    system_health.install_routes(router, lambda: config)
    app = FastAPI()
    app.include_router(router)
    return app, config


def transport_patch(handler):
    real_client = httpx.AsyncClient
    return patch.object(system_health.httpx, "AsyncClient", side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))


def test_get_and_head_read_one_event_only(probe):
    app, _ = probe
    requests = []
    def handler(request):
        requests.append(request)
        assert request.method == "GET"
        assert str(request.url).split('?')[0] == system_health.PRODUCTION_SUPABASE + '/rest/v1/events'
        assert dict(request.url.params) == {"select": "slug", "slug": "eq.ipm-2026", "limit": "1"}
        assert request.content == b''
        return httpx.Response(200, json=[{"slug": "ipm-2026"}])
    with transport_patch(handler):
        client = TestClient(app)
        response = client.get('/api/health')
        assert response.status_code == 200
        assert response.json() | {"checked_at": "time"} == {"status": "healthy", "backend": "ok", "supabase": "ok", "event": "ipm-2026", "checked_at": "time"}
        assert response.headers['cache-control'] == 'no-store'
        response = client.head('/api/health')
        assert response.status_code == 200
        assert response.content == b''
    assert len(requests) == 2


@pytest.mark.parametrize('status,body', [(401, {"code": "PGRST303", "message": "JWT issued at future secret-test-only"}), (500, {"secret": "secret-test-only"}), (200, []), (200, [{"slug": "other-event"}]), (200, {"unexpected": True})])
def test_dependency_failure_is_503_without_secret(probe, status, body):
    with transport_patch(lambda request: httpx.Response(status, json=body)):
        for method in ('GET', 'HEAD'):
            response = TestClient(probe[0]).request(method, '/api/health')
            assert response.status_code == 503
            assert 'secret-test-only' not in response.text
            if method == 'HEAD': assert response.content == b''


@pytest.mark.parametrize('field,value', [('url', 'https://staging.supabase.co'), ('url', system_health.PRODUCTION_SUPABASE + '.evil.test'), ('event', 'other-event'), ('key', '')])
def test_identity_failure_makes_no_requests(probe, field, value):
    probe[1][field] = value
    with transport_patch(lambda request: pytest.fail('Guard must prevent outbound requests')):
        assert TestClient(probe[0]).get('/api/health').status_code == 503


def test_timeout_and_invalid_json_are_safe(probe):
    def timeout(request): raise httpx.ReadTimeout('secret-test-only')
    for handler in (timeout, lambda request: httpx.Response(200, text='not json secret-test-only')):
        with transport_patch(handler):
            response = TestClient(probe[0]).get('/api/health')
            assert response.status_code == 503
            assert 'secret-test-only' not in response.text


def test_total_deadline(probe, monkeypatch):
    async def slow(request):
        await asyncio.sleep(1)
        pytest.fail('Probe did not enforce its deadline')
    monkeypatch.setattr(system_health, 'CHECK_TIMEOUT_SECONDS', 0.01)
    with transport_patch(slow):
        assert TestClient(probe[0]).get('/api/health').status_code == 503


def test_head_asgi_emits_no_body(probe):
    # TestClient strips HEAD bodies itself; also verify the actual ASGI messages.
    async def run():
        sent = []
        async def receive(): return {"type": "http.request", "body": b''}
        async def send(message): sent.append(message)
        await probe[0]({"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "HEAD", "scheme": "http", "path": "/api/health", "raw_path": b'/api/health', "query_string": b'', "headers": [], "server": ('test', 80), "client": ('test', 1), "root_path": ''}, receive, send)
        assert sent[0]['status'] == 200
        assert b''.join(message.get('body', b'') for message in sent) == b''
    with transport_patch(lambda request: httpx.Response(200, json=[{"slug": "ipm-2026"}])):
        asyncio.run(run())


def test_server_registers_probe(monkeypatch):
    from backend import server
    routes = [route for route in server.app.routes if getattr(route, 'path', None) == '/api/health']
    assert len(routes) == 1
    assert routes[0].methods == {'GET', 'HEAD'}
    monkeypatch.setattr(server, 'SUPABASE_URL', system_health.PRODUCTION_SUPABASE)
    monkeypatch.setattr(server, 'SUPABASE_SERVICE_ROLE_KEY', 'secret-test-only')
    monkeypatch.setattr(server, 'DEFAULT_EVENT_ID', 'ipm-2026')
    requests = []
    def handler(request):
        requests.append(request)
        assert request.method == 'GET'
        assert request.url.path == '/rest/v1/events'
        return httpx.Response(200, json=[{"slug": "ipm-2026"}])
    with transport_patch(handler):
        for method in ('GET', 'HEAD'):
            assert TestClient(server.app).request(method, '/api/health').status_code == 200
    assert len(requests) == 2
