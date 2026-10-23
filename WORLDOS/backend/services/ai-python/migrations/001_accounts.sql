CREATE TABLE IF NOT EXISTS worldos_users (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    city_name VARCHAR(120),
    state_region VARCHAR(120),
    country VARCHAR(120),
    location_description VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worldos_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES worldos_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS worldos_sessions_expires_at_idx
    ON worldos_sessions (expires_at);
