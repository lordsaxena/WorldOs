import json
import re
import unittest
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncContextManager
from unittest.mock import AsyncMock, patch

from app.api.auth import hash_session_token
from app.config import settings
from app.database import get_database
from app.main import app
from starlette.types import Message, Scope


class FakeCursor:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    async def fetchone(self) -> dict[str, Any] | None:
        return self.row


class FakeUniqueViolation(Exception):
    sqlstate = "23505"


class FakeDatabase:
    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {}
        self.sessions: dict[str, dict[str, Any]] = {}

    @asynccontextmanager
    async def transaction(self):
        yield

    async def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> FakeCursor:
        normalized = " ".join(query.split())
        if normalized.startswith("INSERT INTO worldos_users"):
            user_id, email, password_hash, city, state, country, description = parameters
            if email in self.users:
                raise FakeUniqueViolation
            row = {
                "id": user_id,
                "email": email,
                "password_hash": password_hash,
                "city_name": city,
                "state_region": state,
                "country": country,
                "location_description": description,
                "created_at": datetime.now(timezone.utc),
            }
            self.users[email] = row
            return FakeCursor(row)
        if "FROM worldos_users WHERE email = %s" in normalized:
            return FakeCursor(self.users.get(parameters[0]))
        if normalized.startswith("INSERT INTO worldos_sessions"):
            token_hash, user_id, expires_at = parameters
            self.sessions[token_hash] = {
                "user_id": user_id,
                "expires_at": expires_at,
            }
            return FakeCursor(None)
        if "FROM worldos_sessions AS s" in normalized:
            session = self.sessions.get(parameters[0])
            if session is None:
                return FakeCursor(None)
            user = next(
                (candidate for candidate in self.users.values()
                 if candidate["id"] == session["user_id"]),
                None,
            )
            if user is None:
                return FakeCursor(None)
            return FakeCursor({**user, "expires_at": session["expires_at"]})
        if normalized.startswith("DELETE FROM worldos_sessions WHERE token_hash"):
            self.sessions.pop(parameters[0], None)
            return FakeCursor(None)
        if normalized.startswith("DELETE FROM worldos_sessions WHERE expires_at"):
            expiration = parameters[0]
            self.sessions = {
                token: session for token, session in self.sessions.items()
                if session["expires_at"] > expiration
            }
            return FakeCursor(None)
        if normalized.startswith("UPDATE worldos_users"):
            assignments = re.findall(
                r"([a-z_]+) = %s", normalized.split("SET ", 1)[1].split(
                    ", updated_at", 1
                )[0]
            )
            *values, user_id = parameters
            user = next(
                (candidate for candidate in self.users.values()
                 if candidate["id"] == user_id),
                None,
            )
            if user is None:
                return FakeCursor(None)
            user.update(dict(zip(assignments, values)))
            return FakeCursor(user)
        raise AssertionError(f"Unexpected SQL in test: {normalized}")


async def request(
    path: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    headers: list[tuple[bytes, bytes]] | None = None,
) -> tuple[int, dict[bytes, bytes], bytes]:
    request_body = json.dumps(body).encode() if body is not None else b""
    request_headers = [(b"host", b"testserver"), *(headers or [])]
    if body is not None:
        request_headers.extend(
            [(b"content-type", b"application/json"),
             (b"content-length", str(len(request_body)).encode())]
        )
    messages: list[Message] = []
    has_sent_request = False

    async def receive() -> Message:
        nonlocal has_sent_request
        if not has_sent_request:
            has_sent_request = True
            return {"type": "http.request", "body": request_body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message: Message) -> None:
        messages.append(message)

    scope: Scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": request_headers,
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "state": {},
    }
    await app(scope, receive, send)
    start = next(message for message in messages if message["type"] == "http.response.start")
    response_body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    return start["status"], dict(start["headers"]), response_body


class AuthenticationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.initialize_database = patch(
            "app.main.initialize_database", new_callable=AsyncMock
        )
        self.initialize_database.start()
        self.database = FakeDatabase()

        async def override_database():
            yield self.database

        app.dependency_overrides[get_database] = override_database
        self.lifespan: AsyncContextManager[Any] = app.router.lifespan_context(app)
        await self.lifespan.__aenter__()
        self.origin = (b"origin", settings.allowed_origins[0].encode())

    async def asyncTearDown(self) -> None:
        await self.lifespan.__aexit__(None, None, None)
        app.dependency_overrides.clear()
        self.initialize_database.stop()

    async def test_register_profile_update_login_and_logout(self) -> None:
        status, headers, body = await request(
            "/api/v1/auth/register",
            "POST",
            {
                "email": "  WORLDOS@example.com ",
                "password": "correct horse battery",
                "city_name": "  Springfield ",
                "state_region": "Test State",
                "country": "Example Country",
            },
            [self.origin],
        )
        self.assertEqual(status, 201, body.decode())
        profile = json.loads(body)
        self.assertEqual(profile["email"], "worldos@example.com")
        self.assertEqual(profile["city_name"], "Springfield")
        self.assertEqual(profile["state_region"], "Test State")
        self.assertEqual(profile["country"], "Example Country")
        self.assertNotIn("password", profile)
        self.assertNotIn("password_hash", profile)
        set_cookie = headers[b"set-cookie"].decode()
        self.assertIn("HttpOnly", set_cookie)
        self.assertIn("SameSite=lax", set_cookie)
        cookie = set_cookie.split(";", 1)[0].encode()
        self.assertTrue(self.database.sessions)

        status, _, body = await request(
            "/api/v1/auth/me", headers=[(b"cookie", cookie)]
        )
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["email"], "worldos@example.com")

        status, _, body = await request(
            "/api/v1/auth/me",
            "PUT",
            {"city_name": "New Town", "location_description": "Profile-only details"},
            [self.origin, (b"cookie", cookie)],
        )
        self.assertEqual(status, 200, body.decode())
        updated_profile = json.loads(body)
        self.assertEqual(updated_profile["city_name"], "New Town")
        self.assertEqual(updated_profile["location_description"], "Profile-only details")

        status, _, body = await request(
            "/api/v1/auth/login",
            "POST",
            {"email": "WORLDOS@example.com", "password": "incorrect password"},
            [self.origin],
        )
        self.assertEqual(status, 401)
        self.assertEqual(json.loads(body)["detail"]["code"], "invalid_credentials")

        status, login_headers, body = await request(
            "/api/v1/auth/login",
            "POST",
            {"email": "WORLDOS@example.com", "password": "correct horse battery"},
            [self.origin],
        )
        self.assertEqual(status, 200, body.decode())
        self.assertEqual(json.loads(body)["email"], "worldos@example.com")
        login_cookie = login_headers[b"set-cookie"].decode().split(";", 1)[0].encode()

        status, logout_headers, _ = await request(
            "/api/v1/auth/logout",
            "POST",
            headers=[self.origin, (b"cookie", login_cookie)],
        )
        self.assertEqual(status, 204)
        self.assertIn(b"Max-Age=0", logout_headers[b"set-cookie"])
        self.assertEqual(len(self.database.sessions), 1)
        status, _, _ = await request(
            "/api/v1/auth/me", headers=[(b"cookie", login_cookie)]
        )
        self.assertEqual(status, 401)

    async def test_duplicate_email_returns_conflict(self) -> None:
        payload = {"email": "duplicate@example.com", "password": "a secure passphrase"}
        for expected_status in (201, 409):
            status, _, _ = await request(
                "/api/v1/auth/register", "POST", payload, [self.origin]
            )
            self.assertEqual(status, expected_status)

    async def test_auth_requests_reject_untrusted_origins(self) -> None:
        status, _, body = await request(
            "/api/v1/auth/register",
            "POST",
            {"email": "person@example.com", "password": "a secure passphrase"},
            [(b"origin", b"https://attacker.example")],
        )
        self.assertEqual(status, 403)
        self.assertEqual(json.loads(body)["detail"]["code"], "invalid_origin")
        self.assertFalse(self.database.users)

    async def test_registration_validates_password_and_email(self) -> None:
        for payload in (
            {"email": "not-an-email", "password": "a secure passphrase"},
            {"email": "person@example.com", "password": "short"},
        ):
            status, _, _ = await request(
                "/api/v1/auth/register", "POST", payload, [self.origin]
            )
            self.assertEqual(status, 422)
        self.assertFalse(self.database.users)

    async def test_location_profile_is_private_and_session_token_is_hashed(self) -> None:
        status, headers, _ = await request(
            "/api/v1/auth/register",
            "POST",
            {"email": "private@example.com", "password": "a secure passphrase"},
            [self.origin],
        )
        self.assertEqual(status, 201)
        token = headers[b"set-cookie"].decode().split("=", 1)[1].split(";", 1)[0]
        self.assertNotIn(token, self.database.sessions)
        self.assertIn(hash_session_token(token), self.database.sessions)

        status, _, body = await request("/api/v1/auth/me")
        self.assertEqual(status, 401)
        self.assertEqual(json.loads(body)["detail"]["code"], "authentication_required")


if __name__ == "__main__":
    unittest.main()
