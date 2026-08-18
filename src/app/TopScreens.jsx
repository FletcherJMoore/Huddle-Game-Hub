import { useEffect, useState } from "react";

import { searchCatalog, addGame, getSteamLibrary, unlinkSteam, STEAM_LOGIN_URL } from "../lib/api.js";
import { FRIENDS } from "../lib/social.js";
import { gradFor } from "./theme.jsx";
import { Cover, Avatar, SearchBox } from "./ui.jsx";
import { Plus, ChevronDown } from "./icons.jsx";

function BoardTiles({ boards, onOpen }) {
  return (
    <div className="tile-grid">
      {boards.map((b) => (
        <button key={b.id} className="board-tile" style={{ backgroundImage: gradFor(b.id || b.name) }} onClick={() => onOpen(b.id)}>
          <span className="tile-emoji">{b.emoji || "🎮"}</span>
          <span className="tile-name">{b.name}</span>
          <span className="tile-meta">
            {b.memberCount} member{b.memberCount === 1 ? "" : "s"} · {b.role}
          </span>
        </button>
      ))}
    </div>
  );
}

export function OverviewScreen({ user, boards, onOpenBoard }) {
  const [catalogCount, setCatalogCount] = useState(0);
  useEffect(() => {
    searchCatalog("", null).then((r) => setCatalogCount(r.length)).catch(() => {});
  }, []);

  return (
    <div>
      <p className="lead">
        Welcome back, {user?.name?.split(" ")[0] || "there"}. Here's what's going on across your boards.
      </p>
      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-num">{boards.length}</span>
          <span className="stat-label">Boards</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{FRIENDS.length}</span>
          <span className="stat-label">Friends</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{catalogCount}</span>
          <span className="stat-label">Games in catalog</span>
        </div>
      </div>
      <div className="subhead-row">
        <h2>Your boards</h2>
      </div>
      <BoardTiles boards={boards} onOpen={onOpenBoard} />
    </div>
  );
}

export function BoardsScreen({ boards, onOpenBoard, onNewBoard }) {
  const [q, setQ] = useState("");
  const filtered = boards.filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="action-row">
        <SearchBox placeholder="Search boards" value={q} onChange={setQ} />
        <button className="primary-btn" onClick={onNewBoard}>
          <Plus size={14} /> New board
        </button>
      </div>
      <BoardTiles boards={filtered} onOpen={onOpenBoard} />
    </div>
  );
}

export function FriendsScreen() {
  const [q, setQ] = useState("");
  const filtered = FRIENDS.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="action-row">
        <SearchBox placeholder="Search friends" value={q} onChange={setQ} />
        <button className="primary-btn">
          <Plus size={14} /> Add friend
        </button>
      </div>
      <div className="list-card">
        {filtered.map((f) => (
          <div key={f.id} className="list-row">
            <Avatar name={f.name} online={f.online} className="lg" />
            <span className="col">
              <span className="row-name">{f.name}</span>
              <span className="row-sub">
                {f.online ? "Online" : "Offline"} · {f.mutual} mutual board{f.mutual === 1 ? "" : "s"}
              </span>
            </span>
            <button className="ghost-btn">Message</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// A game card's "Add to board" control — opens a small board picker and adds
// the game to the chosen board's catalog (via the same propose-a-game endpoint).
function AddToBoardButton({ game, boards, variant = "ghost" }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(null);
  const triggerClass = variant === "primary" ? "primary-btn sm" : "ghost-btn sm";

  async function pick(board) {
    setOpen(false);
    try {
      await addGame(board.id, {
        title: game.title,
        kind: game.kind || "video",
        genre: game.genre || "",
        players: game.players || "",
        platforms: game.platforms || [],
        coverImageUrl: game.coverImageUrl || null,
        catalogId: game.catalogId ?? null
      });
      setAdded(board.name);
    } catch {
      /* leave the button ready to retry */
    }
  }

  if (added) {
    return (
      <button className="ghost-btn sm" disabled>
        Added to {added}
      </button>
    );
  }

  return (
    <div className="add-board-wrap">
      <button className={triggerClass} onClick={() => setOpen((o) => !o)}>
        Add to board
      </button>
      {open && (
        <>
          <div className="add-board-backdrop" onClick={() => setOpen(false)} />
          <div className="add-board-menu">
            {boards.length === 0 ? (
              <span className="hint">No boards yet</span>
            ) : (
              boards.map((b) => (
                <button key={b.id} className="switcher-row" onClick={() => pick(b)}>
                  <span className="switcher-emoji">{b.emoji || "🎮"}</span>
                  <span className="switcher-name">{b.name}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// A styled <select> that matches the shell's controls. `options` is a list of
// plain string values; an "all" sentinel renders the provided `allLabel`.
function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="filter-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}

// A Steam-style launcher tile: full-bleed key art with the title baked in, and
// a description/actions panel that fades in on hover (like the Fortnite card in
// the reference).
function LauncherCard({ game, boards }) {
  return (
    <div className="launcher-card" style={{ backgroundImage: game.hero || gradFor(game.title) }}>
      <div className="launcher-scrim" />
      <span className="launcher-logo">{game.title}</span>

      <div className="launcher-info">
        <span className="launcher-name">{game.title}</span>
        <span className="launcher-tags">
          {game.genre && <span className="launcher-tag">{game.genre}</span>}
          {game.developer && <span className="launcher-studio">{game.developer}</span>}
        </span>
        <p className="launcher-desc">{game.description}</p>
        <div className="launcher-meta">
          {game.players} players · {(game.platforms || []).join(", ")}
        </div>
        <div className="launcher-actions">
          <AddToBoardButton game={game} boards={boards} variant="primary" />
          <button className="ghost-btn sm">Game info</button>
        </div>
      </div>
    </div>
  );
}

function uniqueSorted(list) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function BrowseCatalog({ boards }) {
  const [games, setGames] = useState([]);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [studio, setStudio] = useState("");

  useEffect(() => {
    let alive = true;
    searchCatalog("", null).then((r) => alive && setGames(r)).catch(() => alive && setGames([]));
    return () => {
      alive = false;
    };
  }, []);

  const genres = uniqueSorted(games.map((g) => g.genre));
  const studios = uniqueSorted(games.map((g) => g.developer));

  const query = q.trim().toLowerCase();
  const filtered = games.filter(
    (g) =>
      (!query || g.title.toLowerCase().includes(query)) &&
      (!genre || g.genre === genre) &&
      (!studio || g.developer === studio)
  );

  const hasFilters = q || genre || studio;

  return (
    <div>
      <div className="catalog-filters">
        <SearchBox placeholder="Search by name" value={q} onChange={setQ} />
        <FilterSelect label="All categories" value={genre} options={genres} onChange={setGenre} />
        <FilterSelect label="All studios" value={studio} options={studios} onChange={setStudio} />
        {hasFilters && (
          <button
            className="ghost-btn sm"
            onClick={() => {
              setQ("");
              setGenre("");
              setStudio("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="muted catalog-empty">No games match those filters.</p>
      ) : (
        <div className="launcher-grid">
          {filtered.map((g) => (
            <LauncherCard key={g.catalogId || g.title} game={g} boards={boards} />
          ))}
        </div>
      )}
    </div>
  );
}

function hoursLabel(minutes) {
  if (!minutes) return "Never played";
  const hrs = minutes / 60;
  return hrs >= 1 ? `${Math.round(hrs)} hrs on record` : `${minutes} min on record`;
}

function SteamLinkCTA() {
  return (
    <div className="steam-cta">
      <div className="steam-cta-mark">🎮</div>
      <h3>Link your Steam account</h3>
      <p className="muted">Pull in the games you own on Steam, then add any of them to a board.</p>
      <a className="steam-btn" href={STEAM_LOGIN_URL}>
        Sign in through Steam
      </a>
      <span className="hint">Your Steam profile's game details need to be public.</span>
    </div>
  );
}

function SteamLibrary({ boards }) {
  const [lib, setLib] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSteamLibrary()
      .then(setLib)
      .catch((e) => setError(e.message || "Couldn't load your Steam library."));
  }, []);

  async function unlink() {
    await unlinkSteam().catch(() => {});
    setLib({ linked: false, games: [] });
  }

  if (error) return <div className="list-card"><div className="list-row muted">{error}</div></div>;
  if (!lib) return <p className="muted">Loading…</p>;
  if (!lib.linked) return <SteamLinkCTA />;

  return (
    <div>
      <div className="steam-head">
        <span className="steam-status">
          <span className="steam-dot" /> Linked{lib.persona ? ` as ${lib.persona}` : ""} · {lib.count ?? lib.games.length} games
        </span>
        <button className="ghost-btn sm" onClick={unlink}>
          Unlink
        </button>
      </div>
      {lib.games.length === 0 ? (
        <div className="list-card">
          <div className="list-row muted">No games found — make sure your Steam profile's game details are public.</div>
        </div>
      ) : (
        <div className="catalog-grid">
          {lib.games.map((g) => (
            <div key={g.steamAppId} className="game-card">
              <Cover game={g} className="cover-3x4" />
              <span className="game-title">{g.title}</span>
              <span className="game-meta">{hoursLabel(g.playtimeForever)}</span>
              <AddToBoardButton game={g} boards={boards} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CatalogScreen({ boards = [] }) {
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.search).get("steam") === "linked" ? "steam" : "browse"
  );

  return (
    <div>
      <div className="segmented-2 catalog-modes">
        <button className={mode === "browse" ? "seg-on" : ""} onClick={() => setMode("browse")}>
          Browse
        </button>
        <button className={mode === "steam" ? "seg-on" : ""} onClick={() => setMode("steam")}>
          My Steam library
        </button>
      </div>
      {mode === "browse" ? <BrowseCatalog boards={boards} /> : <SteamLibrary boards={boards} />}
    </div>
  );
}
