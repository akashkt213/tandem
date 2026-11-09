-- migrate:up

-- One row per login session (browser/device). The cookie holds a random token;
-- only its SHA-256 hash is stored, so a database leak doesn't hand out sessions.
-- Each refresh revokes the old row and inserts a new one (rotation).
create table refresh_tokens (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references users(id) on delete cascade,
    token_hash  text not null unique,
    expires_at  timestamptz not null,
    revoked_at  timestamptz,                -- set on logout, or when rotated
    replaced_by uuid references refresh_tokens(id) on delete set null,
    user_agent  text,                       -- for a future "your sessions" page
    created_at  timestamptz not null default now()
);

-- "Log out everywhere" and theft handling revoke all of a user's tokens.
create index refresh_tokens_user_id_idx on refresh_tokens (user_id);

-- migrate:down
drop table if exists refresh_tokens;
