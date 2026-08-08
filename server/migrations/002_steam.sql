-- Steam account link. A user can connect their Steam account (via Steam OpenID)
-- to pull their owned games into their personal library. steam_id is the
-- SteamID64; steam_persona is their display name at link time (for the UI).
alter table users add column if not exists steam_id      text;
alter table users add column if not exists steam_persona text;

create index if not exists idx_users_steam on users (steam_id);
