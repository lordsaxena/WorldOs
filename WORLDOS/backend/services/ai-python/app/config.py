from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="WORLDOS_",
        env_file=".env",
        extra="ignore",
    )

    service_name: str = Field(default="ai-python")
    api_title: str = Field(default="WorldOS API")
    api_version: str = Field(default="1.0.0")
    environment: str = Field(default="development")
    database_url: str = Field(default="")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173"
    )
    session_cookie_name: str = Field(default="worldos_session")
    session_lifetime_hours: int = Field(default=168, ge=1, le=720)

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        if not origins or "*" in origins:
            raise ValueError("CORS origins must be an explicit, non-empty list")
        return ",".join(origins)

    @property
    def allowed_origins(self) -> list[str]:
        return self.cors_origins.split(",")

    @property
    def secure_cookies(self) -> bool:
        return self.environment.lower() not in {"development", "local", "test"}


settings = Settings()
