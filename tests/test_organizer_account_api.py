"""F02: actual ASGI routes and authentication, with synthetic in-memory Mongo only."""
import asyncio
from copy import deepcopy
from datetime import datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest

from backend import server


class Collection:
    def __init__(self, rows=()):
        self.rows = deepcopy(list(rows))

    def matches(self, row, query):
        return all(row.get(k) > v['$gt'] if isinstance(v, dict) and '$gt' in v
                   else row.get(k) == v for k, v in query.items())

    async def find_one(self, query):
        return next((deepcopy(r) for r in self.rows if self.matches(r, query)), None)

    async def insert_one(self, row):
        self.rows.append(deepcopy(row))

    async def update_one(self, query, update):
        for row in self.rows:
            if self.matches(row, query):
                row.update(update['$set'])
                break

    async def delete_one(self, query):
        self.rows[:] = [r for r in self.rows if not self.matches(r, query)]

    async def count_documents(self, query):
        return sum(self.matches(r, query) for r in self.rows)

    def find(self, query):
        rows = [deepcopy(r) for r in self.rows if self.matches(r, query)]
        class Cursor:
            def sort(self, *_):
                return self

            async def to_list(self, limit):
                return rows[:limit]
        return Cursor()


@pytest.fixture
def db(monkeypatch):
    now = datetime.utcnow()
    users = [{
        'id': role, 'username': role.lower(), 'display_name': role,
        'role': role, 'event_id': 'event-a', 'is_active': True,
        'password_hash': server.hash_password('synthetic-test-password'),
        'created_at': now, 'updated_at': now,
    } for role in ['Owner', 'Communications', 'Schedule']]
    users.append({**users[0], 'id': 'other-event', 'username': 'other', 'event_id': 'event-b'})
    sessions = [{'id': role, 'user_id': role, 'event_id': 'event-a',
                 'token_hash': server.hash_session_token('synthetic-' + role),
                 'expires_at': now + timedelta(hours=1)} for role in ['Owner', 'Communications', 'Schedule']]
    database = SimpleNamespace(organizer_users=Collection(users), organizer_sessions=Collection(sessions))
    monkeypatch.setattr(server, 'require_mongodb', lambda: database)
    return database


def request(method, path='/api/admin/users', *, role=None, body=None):
    async def run():
        cookies = {server.ADMIN_SESSION_COOKIE_NAME: 'synthetic-' + role} if role else {}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),
                                    base_url='https://synthetic.invalid', cookies=cookies) as client:
            return await client.request(method, path, json=body)
    return asyncio.run(run())


def payload(role='Owner', **extra):
    return {'username': 'new-user', 'password': 'synthetic-test-password', 'role': role, **extra}


@pytest.mark.parametrize('target', ['Owner', 'Communications', 'Schedule'])
def test_owner_can_create_each_role(db, target):
    response = request('POST', role='Owner', body=payload(target))
    assert response.status_code == 200
    assert response.json()['role'] == target
    assert response.json()['event_id'] == 'event-a'
    assert 'password_hash' not in response.json()
    created = db.organizer_users.rows[-1]
    assert server.verify_password('synthetic-test-password', created['password_hash'])


@pytest.mark.parametrize('actor', ['Communications', 'Schedule'])
@pytest.mark.parametrize('target', ['Owner', 'Communications', 'Schedule'])
def test_non_owner_cannot_create_any_role_via_api(db, actor, target):
    before = deepcopy(db.organizer_users.rows)
    response = request('POST', role=actor, body=payload(target))
    assert response.status_code == 403
    assert db.organizer_users.rows == before


@pytest.mark.parametrize('actor', ['Communications', 'Schedule'])
def test_non_owner_cannot_list_accounts(db, actor):
    assert request('GET', role=actor).status_code == 403


def test_owner_listing_is_event_scoped_and_private(db):
    response = request('GET', role='Owner')
    assert response.status_code == 200
    assert response.json()['total_count'] == 3
    assert all(u['event_id'] == 'event-a' and 'password_hash' not in u for u in response.json()['users'])


@pytest.mark.parametrize('method', ['GET', 'POST'])
def test_unauthenticated_account_operations_denied(db, method):
    before = deepcopy(db.organizer_users.rows)
    assert request(method, body=payload() if method == 'POST' else None).status_code == 401
    assert db.organizer_users.rows == before


@pytest.mark.parametrize('actor', [None, 'Communications', 'Schedule', 'Owner'])
@pytest.mark.parametrize('method', ['PATCH', 'PUT', 'DELETE'])
@pytest.mark.parametrize('target', ['Owner', 'self'])
def test_no_existing_account_promotion_or_deletion_api(db, actor, method, target):
    before = deepcopy(db.organizer_users.rows)
    account_id = actor if target == 'self' and actor else target
    response = request(method, '/api/admin/users/' + account_id, role=actor, body={'role': 'Owner'})
    assert response.status_code in (404, 405)
    assert db.organizer_users.rows == before


@pytest.mark.parametrize('actor', ['Communications', 'Schedule'])
def test_create_cannot_overwrite_self_to_promote(db, actor):
    before = deepcopy(db.organizer_users.rows)
    response = request('POST', role=actor, body=payload(username=actor.lower(), id=actor))
    assert response.status_code == 403
    assert db.organizer_users.rows == before


def test_existing_session_uses_current_server_role(db):
    db.organizer_users.rows[0]['role'] = 'Schedule'
    assert request('POST', role='Owner', body=payload()).status_code == 403


@pytest.mark.parametrize('state', ['expired', 'inactive', 'missing'])
def test_unusable_session_cannot_manage_accounts(db, state):
    if state == 'expired':
        db.organizer_sessions.rows[0]['expires_at'] = datetime.utcnow() - timedelta(seconds=1)
    elif state == 'inactive':
        db.organizer_users.rows[0]['is_active'] = False
    else:
        db.organizer_sessions.rows.clear()
    assert request('POST', role='Owner', body=payload()).status_code == 401


@pytest.mark.parametrize('actor', ['Owner', 'Communications', 'Schedule'])
def test_existing_organizer_session_still_works(db, actor):
    response = request('GET', '/api/admin/auth/me', role=actor)
    assert response.status_code == 200
    assert response.json()['user']['role'] == actor


def test_owner_cannot_overwrite_existing_account_via_create(db):
    before = deepcopy(db.organizer_users.rows)
    assert request('POST', role='Owner', body=payload(username='schedule')).status_code == 409
    assert db.organizer_users.rows == before


@pytest.mark.parametrize('actor', [None, 'Communications', 'Schedule'])
def test_bootstrap_cannot_replace_existing_event_owner(db, actor):
    before = deepcopy(db.organizer_users.rows)
    assert request('POST', '/api/admin/bootstrap', role=actor,
                   body=payload(event_id='event-a')).status_code == 409
    assert db.organizer_users.rows == before


@pytest.mark.parametrize('actor', [None, 'Communications', 'Schedule'])
def test_bootstrap_new_event_cannot_bypass_owner_guard(db, actor):
    before = deepcopy(db.organizer_users.rows)
    response = request('POST', '/api/admin/bootstrap', role=actor,
                       body=payload(event_id='attacker-created-event'))
    assert response.status_code == 409
    assert db.organizer_users.rows == before


def test_first_owner_bootstrap_on_empty_database_still_works(db):
    db.organizer_users.rows.clear()
    response = request('POST', '/api/admin/bootstrap', body=payload(event_id='first-event'))
    assert response.status_code == 200
    assert response.json()['user']['role'] == 'Owner'
    assert len(db.organizer_users.rows) == 1
    assert request('POST', '/api/admin/bootstrap', body=payload(event_id='second-event')).status_code == 409


@pytest.mark.parametrize('actor', ['Owner', 'Communications', 'Schedule'])
def test_real_login_and_session_round_trip(db, actor):
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),
                                    base_url='https://synthetic.invalid') as client:
            login = await client.post('/api/admin/auth/login', json={
                'username': actor.lower(), 'password': 'synthetic-test-password', 'event_id': 'event-a'})
            assert login.status_code == 200
            assert (await client.get('/api/admin/auth/me')).json()['user']['role'] == actor
            creation = await client.post('/api/admin/users', json=payload())
            assert creation.status_code == (200 if actor == 'Owner' else 403)
            assert (await client.post('/api/admin/auth/logout')).status_code == 200
            assert (await client.get('/api/admin/auth/me')).status_code == 401
    asyncio.run(run())


@pytest.mark.parametrize('actor,expected', [('Owner', 200), ('Schedule', 200), ('Communications', 403)])
def test_schedule_role_access_unchanged(db, monkeypatch, actor, expected):
    async def listing(event_id):
        assert event_id == 'event-a'
        return {'events': [], 'total_count': 0, 'last_updated': datetime.utcnow()}
    monkeypatch.setattr(server, 'schedule_service', SimpleNamespace(list_admin_schedule=listing))
    assert request('GET', '/api/admin/schedule', role=actor).status_code == expected


@pytest.mark.parametrize('actor,expected', [('Owner', 200), ('Communications', 200), ('Schedule', 403)])
def test_announcement_role_access_unchanged(db, monkeypatch, actor, expected):
    async def listing(event_id):
        assert event_id == 'event-a'
        return []
    monkeypatch.setattr(server, 'require_announcement_service', lambda: SimpleNamespace(list=listing))
    assert request('GET', '/api/admin/announcements', role=actor).status_code == expected
