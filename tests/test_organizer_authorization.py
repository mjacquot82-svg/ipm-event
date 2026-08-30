import asyncio

import pytest
from fastapi import HTTPException

from backend import server


@pytest.mark.parametrize("role", ["Communications", "Schedule"])
def test_non_owner_cannot_list_organizer_users(monkeypatch, role):
    monkeypatch.setattr(
        server,
        "require_mongodb",
        lambda: pytest.fail("authorization must run before database access"),
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.list_organizer_users({"role": role, "event_id": "event-a"}))

    assert error.value.status_code == 403


@pytest.mark.parametrize("role", ["Communications", "Schedule"])
def test_non_owner_cannot_create_organizer_users(monkeypatch, role):
    monkeypatch.setattr(
        server,
        "require_mongodb",
        lambda: pytest.fail("authorization must run before database access"),
    )
    request = server.OrganizerCreateUserRequest(
        username="new-organizer",
        password="long-enough-password",
        role="Communications",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.create_organizer_user(
            request,
            {"role": role, "event_id": "event-a"},
        ))

    assert error.value.status_code == 403


def test_owner_role_retains_organizer_user_management_access():
    server.require_owner_role({"role": "Owner", "event_id": "event-a"})
