-- Cover-art cache. SteamGridDB gives clean 600x900 portrait art for games whose
-- Steam CDN capsule is missing (older titles, sub-apps, brand-new releases), but
-- it's rate-limited, so we cache the resolved URL per Steam app id. cover_url is
-- null when a lookup found nothing; fetched_at drives a periodic re-check.
create table if not exists steam_art (
  app_id     bigint primary key,
  cover_url  text,
  fetched_at timestamptz not null default now()
);
