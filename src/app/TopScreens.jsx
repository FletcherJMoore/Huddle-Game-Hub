import { useEffect, useState } from "react";

import { searchCatalog, addGame } from "../lib/api.js";
import { FRIENDS } from "../lib/social.js";
import { gradFor } from "./theme.jsx";
import { Avatar, SearchBox, GameTile } from "./ui.jsx";
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
    searchCatalog("").then((r) => setCatalogCount(r.length)).catch(() => {});
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
        kind: "video",
        genre: game.genre || "",
        developer: game.developer || "",
        description: game.description || "",
        players: game.players || "",
        platforms: game.platforms || [],
        coverImageUrl: game.coverImageUrl || null,
        heroImage: game.heroImage || null,
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

function uniqueSorted(list) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function CatalogScreen({ boards = [] }) {
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [studio, setStudio] = useState("");

  // Debounced search: the query hits IGDB (or the mock catalog) directly, so the
  // list is whatever the source returns. An empty query browses popular games.
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    const t = setTimeout(() => {
      searchCatalog(q.trim())
        .then((r) => {
          if (!alive) return;
          setGames(r);
          setStatus("ok");
        })
        .catch(() => {
          if (!alive) return;
          setGames([]);
          setStatus("error");
        });
    }, q.trim() ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const genres = uniqueSorted(games.map((g) => g.genre));
  const studios = uniqueSorted(games.map((g) => g.developer));

  const filtered = games.filter(
    (g) => (!genre || g.genre === genre) && (!studio || g.developer === studio)
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

      {status === "loading" ? (
        <p className="muted catalog-empty">Loading games…</p>
      ) : status === "error" ? (
        <p className="muted catalog-empty">Couldn't reach the games catalog. Try again in a moment.</p>
      ) : filtered.length === 0 ? (
        <p className="muted catalog-empty">
          {q.trim() ? `No games found for "${q.trim()}".` : "No games match those filters."}
        </p>
      ) : (
        <div className="launcher-grid">
          {filtered.map((g) => (
            <GameTile
              key={g.catalogId || g.title}
              game={g}
              action={
                <>
                  <AddToBoardButton game={g} boards={boards} variant="primary" />
                  <button className="ghost-btn sm">Game info</button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
