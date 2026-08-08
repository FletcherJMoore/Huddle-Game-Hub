// Steam library. Once a user has linked their Steam account (steam_id set via
// Steam OpenID in auth.js), this pulls their owned games straight from the Steam
// Web API — the STEAM_API_KEY stays server-side. The game's owned list is
// fetched live rather than imported, so it's always current.
//
//   GET    /api/steam/games  → the caller's owned games (their personal library)
//   DELETE /api/steam         → unlink the Steam account

import express from "express";

import { requireAuth } from "./auth.js";
import { query } from "./db.js";

export const steamRouter = express.Router();
steamRouter.use(requireAuth);

const KEY = process.env.STEAM_API_KEY;
const SGDB_KEY = process.env.STEAMGRIDDB_API_KEY;

// Portrait box art (600x900), which fits the catalog's 3:4 cover slots. This is
// the baseline; SteamGridDB (below) overrides it with better art where it can.
const coverFor = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;

// Run an async fn over items with a bounded number in flight.
async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

// Best 600x900 portrait grid for a Steam app from SteamGridDB, or null.
async function sgdbCover(appid) {
  try {
    const url = `https://www.steamgriddb.com/api/v2/grids/steam/${appid}?dimensions=600x900&types=static&nsfw=false`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${SGDB_KEY}` } });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.success && data.data?.[0]?.url) || null;
  } catch {
    return null;
  }
}

const ART_TTL_DAYS = 30; // re-check a miss after this long (new games gain art)
const MAX_LOOKUPS_PER_REQUEST = 60; // bound first-load latency; the cache warms over a few loads

// Replace each game's coverImageUrl with its SteamGridDB portrait when we can,
// reading from the steam_art cache first and only hitting SGDB for the gaps.
async function enrichCovers(games) {
  if (!SGDB_KEY || !games.length) return;

  const appids = games.map((g) => g.steamAppId);
  const { rows } = await query(
    `select app_id as "appId", cover_url as "coverUrl",
            fetched_at > now() - ($2 || ' days')::interval as fresh
       from steam_art where app_id = any($1)`,
    [appids, ART_TTL_DAYS]
  );
  const cache = new Map(rows.map((r) => [Number(r.appId), r]));

  for (const g of games) {
    const hit = cache.get(g.steamAppId);
    if (hit?.coverUrl) g.coverImageUrl = hit.coverUrl;
  }

  // Look up anything we've never resolved, or a stale miss.
  const gaps = games
    .filter((g) => {
      const hit = cache.get(g.steamAppId);
      return !hit || (!hit.coverUrl && !hit.fresh);
    })
    .map((g) => g.steamAppId)
    .slice(0, MAX_LOOKUPS_PER_REQUEST);
  if (!gaps.length) return;

  const resolved = await mapLimit(gaps, 8, async (appid) => [appid, await sgdbCover(appid)]);
  await Promise.all(
    resolved.map(([appid, url]) =>
      query(
        `insert into steam_art (app_id, cover_url, fetched_at) values ($1, $2, now())
         on conflict (app_id) do update set cover_url = excluded.cover_url, fetched_at = now()`,
        [appid, url]
      )
    )
  );
  const found = new Map(resolved);
  for (const g of games) {
    const url = found.get(g.steamAppId);
    if (url) g.coverImageUrl = url;
  }
}

steamRouter.get("/games", async (req, res, next) => {
  try {
    const steamId = req.user.steamId;
    if (!steamId) return res.json({ linked: false, persona: null, games: [] });
    if (!KEY) return res.status(503).json({ error: "Steam is not configured on the server." });

    const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/");
    url.searchParams.set("key", KEY);
    url.searchParams.set("steamid", steamId);
    url.searchParams.set("include_appinfo", "1");
    url.searchParams.set("include_played_free_games", "1");
    url.searchParams.set("format", "json");

    const resp = await fetch(url);
    if (!resp.ok) throw new Error("steam-unavailable");
    const data = await resp.json();
    // response is {} when the profile's game details are private.
    const owned = data.response?.games ?? [];

    const games = owned
      .filter((g) => g.name)
      .map((g) => ({
        steamAppId: g.appid,
        catalogId: null,
        title: g.name,
        coverImageUrl: coverFor(g.appid),
        kind: "video",
        platforms: ["PC"],
        players: "",
        playtimeForever: g.playtime_forever ?? 0
      }))
      .sort((a, b) => b.playtimeForever - a.playtimeForever);

    await enrichCovers(games);

    res.json({ linked: true, persona: req.user.steamPersona, count: games.length, games });
  } catch (err) {
    next(err);
  }
});

steamRouter.delete("/", async (req, res, next) => {
  try {
    await query("update users set steam_id = null, steam_persona = null where id = $1", [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
