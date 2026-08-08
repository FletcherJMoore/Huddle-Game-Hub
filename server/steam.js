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

// Portrait box art (600x900), which fits the catalog's 3:4 cover slots.
const coverFor = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;

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
