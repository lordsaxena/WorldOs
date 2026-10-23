from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Mapping, Sequence
from pathlib import Path
from typing import Any, Annotated, AsyncContextManager, Protocol, TypeAlias

from fastapi import Depends, HTTPException

from app.config import settings


logger = logging.getLogger("worldos.api")
MIGRATION_PATH = Path(__file__).parent.parent / "migrations" / "001_accounts.sql"


class DatabaseCursor(Protocol):
    async def fetchone(self) -> Mapping[str, Any] | None: ...


class DatabaseConnection(Protocol):
    async def execute(
        self, query: str, parameters: Sequence[Any] = (), **kwargs: Any
    ) -> DatabaseCursor: ...

    def transaction(self) -> AsyncContextManager[Any]: ...


async def initialize_database() -> None:
    if not settings.database_url:
        raise RuntimeError(
            "WORLDOS_DATABASE_URL must be configured before the API can start."
        )

    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as error:
        raise RuntimeError(
            "The psycopg PostgreSQL driver is installed but could not be loaded."
        ) from error

    try:
        async with await psycopg.AsyncConnection.connect(
            settings.database_url, connect_timeout=5, row_factory=dict_row
        ) as connection:
            migration = MIGRATION_PATH.read_text(encoding="utf-8")
            await connection.execute(migration, prepare=False)
            await connection.execute("SELECT 1")
    except (OSError, psycopg.Error) as error:
        logger.exception(
            "Database startup check failed",
            extra={"event": "database_startup_failed"},
        )
        raise RuntimeError(
            "WorldOS PostgreSQL is unavailable or its schema could not be initialized."
        ) from error


async def get_database() -> AsyncIterator[Any]:
    import psycopg
    from psycopg.rows import dict_row

    try:
        async with await psycopg.AsyncConnection.connect(
            settings.database_url, connect_timeout=5, row_factory=dict_row
        ) as connection:
            yield connection
    except psycopg.OperationalError as error:
        logger.warning(
            "Database connection failed",
            extra={"event": "database_connection_failed"},
        )
        raise HTTPException(
            status_code=503,
            detail={"code": "database_unavailable", "message": "Database unavailable."},
        ) from error


Database: TypeAlias = Annotated[DatabaseConnection, Depends(get_database)]
