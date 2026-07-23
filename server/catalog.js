// Games catalog search, proxied to the BoardGameGeek / VideoGameGeek shared
// XML API2 (ported from the old Cloud Function). Both the video and party sides
// hit the same endpoint with a different `type`; the Bearer token stays here on
// the server. GET /api/catalog/search?q=<query>&type=video|party

import express from "express";
import { XMLParser } from "fast-xml-parser";

import { requireAuth } from "./auth.js";

export const catalogRouter = express.Router();
catalogRouter.use(requireAuth);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// Decodes the double-encoded entities the XML API ships and trims to a blurb.
function truncateText(raw, max = 220) {
  if (!raw) return "";
  const text = String(raw)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#10;|&#13;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function primaryName(thing) {
  const names = asArray(thing.name);
  return names.find((n) => n["@_type"] === "primary")?.["@_value"] || names[0]?.["@_value"] || "Untitled";
}

function linkValue(thing, linkType) {
  return asArray(thing.link).find((l) => l["@_type"] === linkType)?.["@_value"] || "";
}

function linkValues(thing, linkType) {
  return asArray(thing.link)
    .filter((l) => l["@_type"] === linkType)
    .map((l) => l["@_value"]);
}

function playersOf(thing) {
  const min = thing.minplayers?.["@_value"];
  const max = thing.maxplayers?.["@_value"];
  return min && max ? (min === max ? min : `${min}-${max}`) : "";
}

const VGG_PLATFORM_MAP = [
  { match: /playstation 5/i, value: "PS5" },
  { match: /xbox/i, value: "Xbox" },
  { match: /switch/i, value: "Switch" },
  { match: /windows|^pc$/i, value: "PC" },
  { match: /ios|android|mobile/i, value: "Mobile" }
];

function mapVggPlatforms(thing) {
  const mapped = new Set();
  linkValues(thing, "videogameplatform").forEach((name) => {
    const hit = VGG_PLATFORM_MAP.find((p) => p.match.test(name));
    if (hit) mapped.add(hit.value);
  });
  return [...mapped];
}

// All the box arts we know for a title — the primary image plus each version's
// — deduped, primary first. The client measures these and keeps the one whose
// aspect ratio is closest to a game box.
function coversOf(thing) {
  const primary = thing.thumbnail || thing.image || null;
  const versionImages = asArray(thing.versions?.item)
    .map((v) => v.thumbnail || v.image)
    .filter(Boolean);
  return [...new Set([primary, ...versionImages].filter(Boolean))].slice(0, 6);
}

// /search for name matches, then /thing for details of the top few hits. Since
// 2025-07-02 the API requires a registered app's Bearer token on every request.
async function fetchGeekThings(query, type) {
  const headers = { Authorization: `Bearer ${process.env.BGG_API_TOKEN}` };

  const searchParams = new URLSearchParams({ query, type });
  const searchResp = await fetch(`https://boardgamegeek.com/xmlapi2/search?${searchParams}`, { headers });
  if (!searchResp.ok) throw new Error("catalog-unavailable");
  const ids = asArray(parser.parse(await searchResp.text()).items?.item)
    .map((item) => item["@_id"])
    .filter(Boolean)
    .slice(0, 6);
  if (!ids.length) return [];

  // versions=1 pulls each title's alternate editions/releases inline — most
  // games have several box arts, and we want the one that best fits the shelf.
  const thingResp = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(",")}&versions=1`, {
    headers
  });
  if (!thingResp.ok) throw new Error("catalog-unavailable");
  const thingById = new Map(
    asArray(parser.parse(await thingResp.text()).items?.item).map((t) => [String(t["@_id"]), t])
  );
  return ids.map((id) => thingById.get(String(id))).filter(Boolean);
}

catalogRouter.get("/search", async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  const kind = req.query.type === "party" ? "party" : "video";
  if (!query) return res.json({ results: [] });

  try {
    const things = await fetchGeekThings(query, kind === "party" ? "boardgame" : "videogame");
    const results = things.map((thing) => {
      const covers = coversOf(thing);
      return {
        catalogId: Number(thing["@_id"]),
        title: primaryName(thing),
        coverImageUrl: covers[0] ?? null,
        covers,
        genre: kind === "party" ? linkValue(thing, "boardgamecategory") : linkValue(thing, "videogamegenre"),
        description: truncateText(thing.description),
        players: playersOf(thing),
        platforms: kind === "party" ? [] : mapVggPlatforms(thing),
        kind
      };
    });
    res.json({ results });
  } catch {
    res.status(502).json({ error: "Games catalog search is unavailable right now." });
  }
});
