// Small presentational primitives shared across the shell's screens.

import { useEffect, useMemo, useState } from "react";

import { gradFor, initialsOf } from "./theme.jsx";
import { Search } from "./icons.jsx";

const steamImg = (appid, file) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/${file}`;

// Ordered box-art URLs to try for a game. For Steam titles the portrait capsule
// (library_600x900) is nicest but many older/newer apps lack it, so we fall
// back to the landscape header and the store capsule, which almost always
// exist. BGG catalog hits already ship a `covers` array.
function coverCandidates(game) {
  if (Array.isArray(game.covers) && game.covers.length) return game.covers;
  const list = [];
  if (game.coverImageUrl || game.cover) list.push(game.coverImageUrl || game.cover);
  if (game.steamAppId) {
    list.push(
      steamImg(game.steamAppId, "library_600x900.jpg"),
      steamImg(game.steamAppId, "header.jpg"),
      steamImg(game.steamAppId, "capsule_616x353.jpg")
    );
  }
  return [...new Set(list)];
}

// Cover art: walks the candidate URLs, dropping to the next when one fails to
// load, and finally to a stable gradient "box" stamped with the title's
// initials — so a missing image is never a broken tile.
export function Cover({ game, className = "" }) {
  const candidates = useMemo(() => coverCandidates(game), [game.coverImageUrl, game.cover, game.steamAppId, game.covers]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [candidates[0]]);

  const url = candidates[idx];
  if (url) {
    return (
      <img
        className={`cover ${className}`}
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => i + 1)}
      />
    );
  }
  return (
    <span className={`cover ${className}`} style={{ backgroundImage: gradFor(game.title || game.id || "game") }}>
      {initialsOf(game.title || "")}
    </span>
  );
}

export function Avatar({ name = "?", photoUrl, online, className = "" }) {
  const initial = name === "You" ? "Y" : (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span className={`avatar ${className}`}>
      {photoUrl ? <img src={photoUrl} alt="" referrerPolicy="no-referrer" /> : initial}
      {online !== undefined && <span className={`presence${online ? " on" : ""}`} />}
    </span>
  );
}

export function SearchBox({ placeholder, value, onChange, readOnly }) {
  return (
    <div className="search-box">
      <Search size={15} />
      {readOnly ? (
        <span className="search-placeholder">{placeholder}</span>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}
