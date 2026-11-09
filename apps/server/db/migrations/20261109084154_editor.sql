-- migrate:up
create type link_access as enum ('none', 'viewer', 'editor');

create table users (
    id            uuid primary key default gen_random_uuid(),
    email         text not null,
    full_name     text not null,
    password_hash text not null,
    color         text not null default '#2563eb',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Case-insensitive: A@x.com and a@x.com are the same account.
-- Look users up with: where lower(email) = lower($1)
create unique index users_email_lower_idx on users (lower(email));

create table documents (
    id             text primary key,                               -- the :id in /doc/:id (Hocuspocus document name)
    title          text not null default 'Untitled',
    owner_id       uuid references users(id) on delete cascade,    -- null while owned by a guest
    guest_owner_id text,                                           -- anonymous browser id; moved to owner_id on login
    ydoc_state     bytea,                                          -- Y.encodeStateAsUpdate(doc), written by onStoreDocument
    link_access    link_access not null default 'editor',          -- what anyone with the link can do
    last_edited_by uuid references users(id) on delete set null,   -- null when the last editor was a guest
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    deleted_at     timestamptz,
    -- Exactly one owner: a real user or a guest.
    constraint documents_one_owner check ((owner_id is null) <> (guest_owner_id is null))
);

-- "My documents" list.
create index documents_owner_id_idx on documents (owner_id) where deleted_at is null;

-- Claiming guest docs on login, and the cleanup job for unclaimed ones.
create index documents_guest_owner_id_idx on documents (guest_owner_id) where guest_owner_id is not null;

-- migrate:down
drop table if exists documents;
drop table if exists users;
drop type  if exists link_access;
