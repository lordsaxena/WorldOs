import json
import logging
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator, Literal
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import settings


logger = logging.getLogger("worldos.api")
logging.basicConfig(level=logging.INFO, format="%(message)s")


class HealthResponse(BaseModel):
    status: Literal["healthy"]
    service: str


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    service: str


class ComponentStatus(BaseModel):
    status: Literal["healthy", "starting"]


class RuntimeInfo(BaseModel):
    python_version: str
    environment: str


class SystemStatusResponse(BaseModel):
    service: str
    version: str
    status: Literal["healthy", "starting"]
    started_at: datetime | None
    uptime_seconds: float
    runtime: RuntimeInfo
    components: dict[str, ComponentStatus]


def log_event(level: int, event: str, **fields: object) -> None:
    logger.log(
        level,
        json.dumps(
            {"event": event, "service": settings.service_name, **fields},
            default=str,
        ),
    )


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    application.state.ready = True
    application.state.started_at = datetime.now(timezone.utc)
    application.state.started_monotonic = time.monotonic()
    log_event(
        logging.INFO,
        "service_started",
        environment=settings.environment,
        version=settings.api_version,
    )
    try:
        yield
    finally:
        application.state.ready = False
        log_event(logging.INFO, "service_stopped")


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="Health and runtime status for the WorldOS Python API.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.middleware("http")
async def assign_request_id(request: Request, call_next):
    request.state.request_id = uuid4().hex
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(Exception)
async def handle_unexpected_error(
    request: Request, exception: Exception
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", uuid4().hex)
    logger.exception(
        json.dumps(
            {
                "event": "unhandled_exception",
                "service": settings.service_name,
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "exception_type": type(exception).__name__,
            }
        )
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred.",
                "request_id": request_id,
            }
        },
        headers={"X-Request-ID": request_id},
    )


@app.get("/", response_model=dict[str, str])
async def root() -> dict[str, str]:
    return {
        "name": settings.api_title,
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="healthy", service=settings.service_name)


@app.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={503: {"model": ReadinessResponse}},
)
async def readiness(request: Request) -> ReadinessResponse | JSONResponse:
    if not getattr(request.app.state, "ready", False):
        response = ReadinessResponse(status="not_ready", service=settings.service_name)
        return JSONResponse(status_code=503, content=response.model_dump())
    return ReadinessResponse(status="ready", service=settings.service_name)


@app.get("/api/v1/system/status", response_model=SystemStatusResponse)
async def system_status(request: Request) -> SystemStatusResponse:
    is_ready = getattr(request.app.state, "ready", False)
    started_at = getattr(request.app.state, "started_at", None)
    started_monotonic = getattr(request.app.state, "started_monotonic", None)
    uptime_seconds = (
        max(0.0, time.monotonic() - started_monotonic)
        if started_monotonic is not None
        else 0.0
    )
    component_status: Literal["healthy", "starting"] = (
        "healthy" if is_ready else "starting"
    )
    return SystemStatusResponse(
        service=settings.service_name,
        version=settings.api_version,
        status=component_status,
        started_at=started_at,
        uptime_seconds=uptime_seconds,
        runtime=RuntimeInfo(
            python_version=sys.version.split()[0],
            environment=settings.environment,
        ),
        components={"python_api": ComponentStatus(status=component_status)},
    )
