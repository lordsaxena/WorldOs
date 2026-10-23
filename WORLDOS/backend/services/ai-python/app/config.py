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
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173"
    )

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


settings = Settings()
