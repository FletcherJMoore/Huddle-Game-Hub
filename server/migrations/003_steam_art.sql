-- Cover-art cache for Steam games. We resolve each game's best cover once — the
-- portrait capsule when it exists, otherwise Steam's real header image (from the
-- keyless store appdetails API, which older/new/niche titles do have even when
-- the predictable CDN paths 404) — and cache the URL per app id so we don't
-- re-resolve on every library load. cover_url is null when nothing was found;
-- fetched_at drives a periodic re-check.
create table if not exists steam_art (
  app_id     bigint primary key,
  cover_url  text,
  fetched_at timestamptz not null default now()
);
