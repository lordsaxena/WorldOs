import json
import unittest
from unittest.mock import AsyncMock, patch
from typing import Any, AsyncContextManager

from pydantic import ValidationError
from fastapi import HTTPException

from app.config import Settings, settings
from app.database import get_database
from app.main import app, handle_unexpected_error
from starlette.requests import Request
from starlette.types import Message, Scope


async def request(
    path: str,
    method: str = "GET",
    headers: list[tuple[bytes, bytes]] | None = None,
) -> tuple[int, dict[bytes, bytes], bytes]:
    request_headers = [(b"host", b"testserver"), *(headers or [])]
    messages: list[Message] = []
    has_sent_request = False

    async def receive() -> Message:
        nonlocal has_sent_request
        if not has_sent_request:
            has_sent_request = True
            return {"type": "http.request", "body": b"", "more_body": False}
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
    body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    return start["status"], dict(start["headers"]), body


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.initialize_database = patch(
            "app.main.initialize_database", new_callable=AsyncMock
        )
        self.initialize_database.start()
        database = AsyncMock()

        async def override_database():
            yield database

        app.dependency_overrides[get_database] = override_database
        self.lifespan: AsyncContextManager[Any] = app.router.lifespan_context(app)
        await self.lifespan.__aenter__()

    async def asyncTearDown(self) -> None:
        await self.lifespan.__aexit__(None, None, None)
        app.dependency_overrides.clear()
        self.initialize_database.stop()

    async def test_root_and_health_preserve_existing_contract(self) -> None:
        root_status, _, root_body = await request("/")
        self.assertEqual(root_status, 200)
        self.assertEqual(json.loads(root_body)["status"], "online")

        status, headers, body = await request("/health")
        self.assertEqual(status, 200)
        self.assertEqual(
            json.loads(body), {"status": "healthy", "service": "ai-python"}
        )
        self.assertIn(b"x-request-id", headers)

    async def test_readiness_tracks_lifespan(self) -> None:
        status, _, body = await request("/ready")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["status"], "ready")

        app.state.ready = False
        status, _, body = await request("/ready")
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(body)["status"], "not_ready")
        status, _, body = await request("/api/v1/system/status")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["status"], "starting")
        app.state.ready = True

    async def test_readiness_reports_database_connection_failures(self) -> None:
        async def unavailable_database():
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "database_unavailable",
                    "message": "Database unavailable.",
                },
            )

        app.dependency_overrides[get_database] = unavailable_database
        status, _, body = await request("/ready")
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(body)["detail"]["code"], "database_unavailable")

    async def test_system_status_reports_only_real_runtime_components(self) -> None:
        status, _, body = await request("/api/v1/system/status")
        payload = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(payload["service"], "ai-python")
        self.assertEqual(payload["status"], "healthy")
        self.assertGreaterEqual(payload["uptime_seconds"], 0)
        self.assertEqual(
            payload["components"],
            {
                "python_api": {"status": "healthy"},
                "postgresql": {"status": "healthy"},
            },
        )
        self.assertTrue(payload["runtime"]["python_version"])
        self.assertEqual(payload["runtime"]["environment"], settings.environment)

    async def test_unknown_routes_return_not_found(self) -> None:
        status, _, _ = await request("/api/v1/does-not-exist")
        self.assertEqual(status, 404)

    async def test_cors_wildcard_configuration_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            Settings(cors_origins="*")

    async def test_unexpected_errors_return_safe_request_scoped_details(self) -> None:
        request_scope: Scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/unexpected",
            "raw_path": b"/unexpected",
            "query_string": b"",
            "root_path": "",
            "headers": [],
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
            "state": {},
        }
        request_object = Request(request_scope)
        with self.assertLogs("worldos.api", level="ERROR"):
            try:
                raise RuntimeError("sensitive internal detail")
            except RuntimeError as error:
                response = await handle_unexpected_error(request_object, error)

        response_body = bytes(response.body)
        payload = json.loads(response_body)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(payload["error"]["code"], "internal_error")
        self.assertNotIn("sensitive internal detail", response_body.decode())
        self.assertEqual(
            response.headers["x-request-id"], payload["error"]["request_id"]
        )

    async def test_cors_allows_configured_frontend_and_rejects_other_origins(self) -> None:
        allowed_origin = settings.allowed_origins[0].encode()
        status, headers, _ = await request(
            "/health",
            method="OPTIONS",
            headers=[
                (b"origin", allowed_origin),
                (b"access-control-request-method", b"GET"),
            ],
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers[b"access-control-allow-origin"], allowed_origin)

        status, _, _ = await request(
            "/health",
            method="OPTIONS",
            headers=[
                (b"origin", b"https://untrusted.example"),
                (b"access-control-request-method", b"GET"),
            ],
        )
        self.assertEqual(status, 400)


if __name__ == "__main__":
    unittest.main()
