# WorldOS Python API

The Python service provides health/status routes and PostgreSQL-backed email
accounts with private profile location details. The urban simulation, scenarios,
and assistant remain local browser functionality; profile locations do not
change the synthetic model. There is no agent execution engine, workflow store,
event bus, shared geographic catalog, external geographic data provider, or
WebSocket service.

## Run on Windows

Start a local PostgreSQL container from `WORLDOS\backend`:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
```

The example uses a placeholder local-only PostgreSQL password. Change it in
`backend\.env` before using the service outside local development. Then start
the API from `WORLDOS\backend\services\ai-python`:

```powershell
Copy-Item ..\..\.env .env
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The interactive OpenAPI documentation is at `http://127.0.0.1:8000/docs`.
The frontend defaults to `http://localhost:8000`; set `VITE_API_BASE_URL` to
override it before starting Vite. An example is in [`.env.example`](../.env.example).

## Environment

`WORLDOS_DATABASE_URL` is required. The API runs the idempotent account schema
migration at startup and refuses to report readiness if PostgreSQL is
unavailable. `WORLDOS_ENVIRONMENT` controls the runtime label and whether
session cookies use the `Secure` flag. `WORLDOS_CORS_ORIGINS` is a comma-
separated list of explicit origins; wildcard origins are rejected.
`WORLDOS_SESSION_LIFETIME_HOURS` defaults to 168 (seven days).

The browser uses an HttpOnly, SameSite=Lax cookie. Passwords are hashed using
PBKDF2-HMAC-SHA256; only a hash of each random session token is stored in the
database. Mutating authentication requests require an allowed `Origin`.
Email confirmation, password reset, account deletion, and production
rate-limiting are not implemented; deploy behind HTTPS and an appropriately
configured request-rate limit before public launch.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Service name and docs link |
| `GET` | `/health` | Liveness of the Python API process |
| `GET` | `/ready` | Startup/database readiness (`503` until ready) |
| `GET` | `/api/v1/system/status` | Python API and PostgreSQL startup status |
| `POST` | `/api/v1/auth/register` | Register with email/password and optional private location |
| `POST` | `/api/v1/auth/login` | Verify credentials and issue a session cookie |
| `POST` | `/api/v1/auth/logout` | Revoke current session and clear cookie (`204`) |
| `GET` | `/api/v1/auth/me` | Return the current user's profile (`401` if signed out) |
| `PUT` | `/api/v1/auth/me` | Update private city/town, state/region, country, or description |

Registration accepts `email`, `password` (12-128 characters), and optional
`city_name`, `state_region`, `country`, and `location_description`.
Profile updates accept any subset of those location fields; explicit `null` or
an empty string clears a field. A profile response contains `id`, `email`,
location fields, and `created_at`; password hashes and session tokens are never
returned. A duplicate email returns `409`; invalid input returns `422`.

Location fields are private to the signed-in account and user-entered; they
are not a searchable global directory, validated facts, or a live city-data
source. The status response reports the PostgreSQL component as healthy after
startup validation; other WorldOS agents, workflows, and event services are
not represented as available.