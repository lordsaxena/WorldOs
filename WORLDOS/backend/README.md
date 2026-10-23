# WorldOS Python API

The Python service currently provides process health and runtime status only.
The urban simulation, scenarios, and assistant remain local browser functionality;
they are not sent to the backend. There is no implemented agent execution engine,
workflow store, event bus, database integration, or WebSocket service. The API
does not claim those capabilities are online.

## Run on Windows

From `WORLDOS\backend\services\ai-python`:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The interactive OpenAPI documentation is at `http://127.0.0.1:8000/docs`.
The frontend defaults to `http://localhost:8000`; set `VITE_API_BASE_URL` to
override it before starting Vite. An example is in [`.env.example`](../.env.example).

## Environment

Copy `backend\.env.example` to `.env` in the Python service directory to set
the environment label and comma-separated allowed frontend origins. From the
service directory, run `Copy-Item ..\..\.env.example .env`. Origins must be
explicit; wildcard origins are rejected. No credentials or external services
are required for the current endpoints.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Service name and docs link |
| `GET` | `/health` | Liveness of the Python API process |
| `GET` | `/ready` | Startup readiness (`503` until startup completes) |
| `GET` | `/api/v1/system/status` | Versioned Python API runtime and component status |

The system-status response reports only this API process and runtime. Readiness
does not imply that agents, workflows, a database, or event infrastructure are
available.