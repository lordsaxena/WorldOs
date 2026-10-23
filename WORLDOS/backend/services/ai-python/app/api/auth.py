import asyncio
import base64
import hashlib
import hmac
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import settings
from app.database import Database, DatabaseConnection


router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger("worldos.api")
PASSWORD_ITERATIONS = 600_000
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PROFILE_FIELDS = (
    "city_name",
    "state_region",
    "country",
    "location_description",
)


class RegistrationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)
    city_name: str | None = Field(default=None, max_length=120)
    state_region: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)
    location_description: str | None = Field(default=None, max_length=500)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Enter a valid email address.")
        return email

    @field_validator(*PROFILE_FIELDS)
    @classmethod
    def normalize_location_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Enter a valid email address.")
        return email


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city_name: str | None = Field(default=None, max_length=120)
    state_region: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)
    location_description: str | None = Field(default=None, max_length=500)

    @field_validator(*PROFILE_FIELDS)
    @classmethod
    def normalize_location_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class UserProfile(BaseModel):
    id: UUID
    email: str
    city_name: str | None
    state_region: str | None
    country: str | None
    location_description: str | None
    created_at: datetime


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS, dklen=32
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = password_digest(password, salt)
    return "$".join(
        (
            "pbkdf2_sha256",
            str(PASSWORD_ITERATIONS),
            base64.urlsafe_b64encode(salt).decode("ascii"),
            base64.urlsafe_b64encode(digest).decode("ascii"),
        )
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = encoded.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        if iterations != PASSWORD_ITERATIONS:
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_text.encode("ascii"))
        actual = password_digest(password, salt)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin not in settings.allowed_origins:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "invalid_origin", "message": "Request origin is not allowed."},
        )


def set_session_cookie(response: Response, token: str, expires_at: datetime) -> None:
    max_age = max(
        0, int((expires_at - datetime.now(timezone.utc)).total_seconds())
    )
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=max_age,
        expires=max_age,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )


async def create_session(
    connection: DatabaseConnection, user_id: UUID, response: Response
) -> None:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.session_lifetime_hours
    )
    await connection.execute(
        """
        INSERT INTO worldos_sessions (token_hash, user_id, expires_at)
        VALUES (%s, %s, %s)
        """,
        (hash_session_token(token), user_id, expires_at),
    )
    set_session_cookie(response, token, expires_at)


async def user_from_session(
    connection: DatabaseConnection, token: str | None
) -> UserProfile:
    if not token or len(token) > 128:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "authentication_required", "message": "Sign in required."},
        )
    cursor = await connection.execute(
        """
        SELECT u.id, u.email, u.city_name, u.state_region, u.country,
               u.location_description, u.created_at, s.expires_at
        FROM worldos_sessions AS s
        JOIN worldos_users AS u ON u.id = s.user_id
        WHERE s.token_hash = %s
        """,
        (hash_session_token(token),),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "authentication_required", "message": "Sign in required."},
        )
    if row["expires_at"] <= datetime.now(timezone.utc):
        await connection.execute(
            "DELETE FROM worldos_sessions WHERE token_hash = %s",
            (hash_session_token(token),),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "session_expired", "message": "Sign in again."},
        )
    return UserProfile.model_validate(
        {key: row[key] for key in UserProfile.model_fields}
    )


async def current_user(
    connection: Database,
    token: Annotated[
        str | None, Cookie(alias=settings.session_cookie_name)
    ] = None,
) -> UserProfile:
    return await user_from_session(connection, token)


@router.post("/register", response_model=UserProfile, status_code=201)
async def register(
    payload: RegistrationRequest,
    request: Request,
    response: Response,
    connection: Database,
) -> UserProfile:
    require_same_origin(request)
    password_hash = await asyncio.to_thread(hash_password, payload.password)
    user_id = uuid4()
    try:
        async with connection.transaction():
            cursor = await connection.execute(
                """
                INSERT INTO worldos_users (
                    id, email, password_hash, city_name, state_region, country,
                    location_description
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, email, city_name, state_region, country,
                          location_description, created_at
                """,
                (
                    user_id,
                    payload.email,
                    password_hash,
                    payload.city_name,
                    payload.state_region,
                    payload.country,
                    payload.location_description,
                ),
            )
            row = await cursor.fetchone()
            await create_session(connection, user_id, response)
    except Exception as error:
        if getattr(error, "sqlstate", None) != "23505":
            raise
        logger.info(
            "Account registration rejected",
            extra={"event": "account_registration_conflict"},
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "account_exists",
                "message": "An account with this email already exists.",
            },
        ) from error
    return UserProfile.model_validate(row)


@router.post("/login", response_model=UserProfile)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    connection: Database,
) -> UserProfile:
    require_same_origin(request)
    cursor = await connection.execute(
        """
        SELECT id, email, password_hash, city_name, state_region, country,
               location_description, created_at
        FROM worldos_users WHERE email = %s
        """,
        (payload.email,),
    )
    row = await cursor.fetchone()
    if row is None:
        await asyncio.to_thread(password_digest, payload.password, b"worldos-login-salt")
        valid_password = False
    else:
        valid_password = await asyncio.to_thread(
            verify_password, payload.password, row["password_hash"]
        )
    if not valid_password or row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "invalid_credentials",
                "message": "Email or password is incorrect.",
            },
        )

    async with connection.transaction():
        await connection.execute(
            "DELETE FROM worldos_sessions WHERE expires_at <= %s",
            (datetime.now(timezone.utc),),
        )
        await create_session(connection, row["id"], response)
    return UserProfile.model_validate(
        {key: row[key] for key in UserProfile.model_fields}
    )


@router.get("/me", response_model=UserProfile)
async def get_profile(user: Annotated[UserProfile, Depends(current_user)]) -> UserProfile:
    return user


@router.put("/me", response_model=UserProfile)
async def update_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    connection: Database,
    user: Annotated[UserProfile, Depends(current_user)],
) -> UserProfile:
    require_same_origin(request)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "empty_profile_update",
                "message": "Provide at least one profile field to update.",
            },
        )

    values = {key: changes[key] for key in PROFILE_FIELDS if key in changes}
    assignments = ", ".join(f"{column} = %s" for column in values)
    cursor = await connection.execute(
        f"""
        UPDATE worldos_users
        SET {assignments}, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id, email, city_name, state_region, country,
                  location_description, created_at
        """,
        (*values.values(), user.id),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "account_not_found", "message": "Account no longer exists."},
        )
    return UserProfile.model_validate(row)


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    connection: Database,
    token: Annotated[
        str | None, Cookie(alias=settings.session_cookie_name)
    ] = None,
) -> Response:
    require_same_origin(request)
    if token and len(token) <= 128:
        await connection.execute(
            "DELETE FROM worldos_sessions WHERE token_hash = %s",
            (hash_session_token(token),),
        )
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
