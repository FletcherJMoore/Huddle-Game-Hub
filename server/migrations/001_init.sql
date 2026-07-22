-- Initial schema for the Railway/Postgres backend.
--
-- Hybrid model: identity, access control, invites, and chat live in relational
-- tables; the rest of a board's content (games, schedule, votes, reads,
-- downToPlay, memberProfiles) rides along in boards.content as JSONB so the
-- existing normalizeBoard() client code keeps working and realtime broadcasts
-- can ship the whole board object at once.

-- Users. Google-only auth, so google_sub is the external identity; no password.
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  google_sub  text unique,
  email       text unique not null,
  name        text,
  photo_url   text,
  created_at  timestamptz not null default now()
);

-- Boards. content holds the nested board document (everything except members,
-- who are relational below, and chat, which is its own table).
create table if not exists boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text,
  accent      text,
  icon_url    text,
  content     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Membership + role. Replaces the Firebase database.rules access checks:
-- "only members can read a board" becomes a join against this table.
create table if not exists board_members (
  board_id    uuid not null references boards(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        text not null check (role in ('owner', 'editor', 'member')),
  created_at  timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists idx_board_members_user on board_members (user_id);

-- Chat. Separate from boards.content because messages grow unbounded and need
-- their own pagination/ordering.
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  author_id   uuid references users(id) on delete set null,
  text        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_messages_board_created on messages (board_id, created_at);

-- Pending email invites. token backs the accept link; one invite per email
-- per board.
create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('editor', 'member')),
  invited_by  uuid references users(id) on delete set null,
  token       text unique not null,
  created_at  timestamptz not null default now(),
  unique (board_id, email)
);

create index if not exists idx_invites_email on invites (email);
