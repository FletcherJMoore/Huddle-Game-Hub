-- 1:1 direct messages between two users. A conversation is implicit: all rows
-- where {sender, recipient} match a given pair, ordered by time.
create table if not exists direct_messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references users(id) on delete cascade,
  recipient_id  uuid not null references users(id) on delete cascade,
  text          text not null,
  created_at    timestamptz not null default now()
);

-- Fetching a thread scans both directions of the pair; these two indexes cover
-- "messages I sent to X" and "messages X sent to me", newest first.
create index if not exists idx_dm_sender on direct_messages (sender_id, recipient_id, created_at);
create index if not exists idx_dm_recipient on direct_messages (recipient_id, sender_id, created_at);
