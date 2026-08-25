-- Accept-tracking for crew invites. The invites table (001_init.sql) already
-- holds board_id, email, role, invited_by, and a unique token; this adds the
-- columns needed to mark an invite accepted and (optionally, later) expire it.
-- Status is derived: accepted when accepted_at is set; expired when expires_at
-- is non-null and past (unused for now — invites don't expire yet); otherwise
-- pending.
alter table invites
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references users(id) on delete set null,
  add column if not exists expires_at  timestamptz;
