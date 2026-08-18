// Video-game catalog search, proxied to the IGDB API (owned by Twitch). The
// Twitch app credentials and the OAuth token stay here on the server; the client
// only ever sees normalized game objects.
//
//   GET /api/catalog/search?q=<query>
//     - with a query: relevance search
//     - empty query:  a default browse set of popular games
//
// Configure with TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET (from a Twitch
// developer application). Without them the endpoint returns 503.

import express from "express";

import { requireAuth } from "./auth.js";

export const catalogRouter = express.Router();
catalogRouter.use(requireAuth);

const IGDB_PLATFORM_MAP = [
  { match: /playstation 5/i, value: "PS5" },
  { match: /playstation 4/i, value: "PS4" },
  { match: /xbox/i, value: "Xbox" },
  { match: /nintendo switch|switch/i, value: "Switch" },
  { match: /windows|mac|linux|^pc/i, value: "PC" },
  { match: /ios|android/i, value: "Mobile" }
];

const IGDB_CONFIGURED = Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);

// Trims IGDB's summary text to a card-sized blurb.
function truncate(raw, max = 220) {
  if (!raw) return "";
  const text = String(raw).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function igdbImage(imageId, size) {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : null;
}

let twitchToken = null;
let twitchTokenExpiry = 0;

// Client-credentials token for the IGDB (Twitch) API, cached until it expires.
async function getTwitchToken() {
  if (!IGDB_CONFIGURED) return null;
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials"
  });
  const resp = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: "POST" });
  if (!resp.ok) throw new Error("twitch-auth-failed");

  const data = await resp.json();
  twitchToken = data.access_token;
  twitchTokenExpiry = Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000;
  return twitchToken;
}

// Normalizes one IGDB game into the shape the client's GameTile expects.
function mapIgdbGame(g) {
  const platforms = new Set();
  (g.platforms ?? []).forEach((p) => {
    const hit = IGDB_PLATFORM_MAP.find((x) => x.match.test(p.name || ""));
    if (hit) platforms.add(hit.value);
  });

  const companies = g.involved_companies ?? [];
  const developer =
    (companies.find((c) => c.developer)?.company?.name || companies[0]?.company?.name) ?? "";

  // Prefer 16:9 artwork/screenshots for the full-bleed hero; fall back to the
  // (portrait) cover so a tile always has an image.
  const heroId = g.artworks?.[0]?.image_id || g.screenshots?.[0]?.image_id || null;

  return {
    catalogId: g.id,
    title: g.name,
    genre: g.genres?.[0]?.name ?? "",
    developer,
    description: truncate(g.summary),
    players: "",
    platforms: [...platforms],
    coverImageUrl: igdbImage(g.cover?.image_id, "cover_big"),
    heroImage: igdbImage(heroId, "1080p")
  };
}

const IGDB_FIELDS =
  "fields name, summary, genres.name, platforms.name, cover.image_id, " +
  "artworks.image_id, screenshots.image_id, " +
  "involved_companies.developer, involved_companies.company.name";

// Builds the IGDB query body. A search term uses relevance ordering; an empty
// term browses the most-rated main games.
function igdbQuery(query) {
  if (query) {
    return `search "${query.replace(/"/g, "")}"; ${IGDB_FIELDS}; where category = 0 & version_parent = null; limit 24;`;
  }
  return `${IGDB_FIELDS}; where category = 0 & cover != null & total_rating_count > 40; sort total_rating_count desc; limit 24;`;
}

async function searchIgdb(query) {
  const token = await getTwitchToken();
  if (!token) return null;

  const resp = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    },
    body: igdbQuery(query)
  });
  if (!resp.ok) throw new Error("igdb-request-failed");

  return (await resp.json()).map(mapIgdbGame);
}

catalogRouter.get("/search", async (req, res) => {
  if (!IGDB_CONFIGURED) {
    return res.status(503).json({ error: "The games catalog isn't configured on the server." });
  }

  const query = String(req.query.q ?? "").trim();
  try {
    const results = await searchIgdb(query);
    res.json({ results: results ?? [] });
  } catch {
    res.status(502).json({ error: "Games catalog search is unavailable right now." });
  }
});
