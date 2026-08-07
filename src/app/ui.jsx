// Small presentational primitives shared across the shell's screens.

import { gradFor, initialsOf } from "./theme.jsx";
import { Search } from "./icons.jsx";

// Cover art: real box art when the catalog gave us a URL, otherwise a stable
// gradient "box" stamped with the title's initials.
export function Cover({ game, className = "" }) {
  const url = game.coverImageUrl || game.cover;
  if (url) {
    return <img className={`cover ${className}`} src={url} alt="" referrerPolicy="no-referrer" />;
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
