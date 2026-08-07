import { useEffect, useState } from "react";

import { searchCatalog } from "../lib/api.js";
import { FRIENDS } from "../lib/social.js";
import { gradFor } from "./theme.jsx";
import { Cover, Avatar, SearchBox } from "./ui.jsx";
import { Plus } from "./icons.jsx";

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

export function CatalogScreen({ onAddToBoard }) {
  const [q, setQ] = useState("");
  const [games, setGames] = useState([]);
  useEffect(() => {
    let alive = true;
    searchCatalog(q, null).then((r) => alive && setGames(r)).catch(() => alive && setGames([]));
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <div>
      <div className="action-row">
        <SearchBox placeholder="Search the catalog" value={q} onChange={setQ} />
      </div>
      <div className="catalog-grid">
        {games.map((g) => (
          <div key={g.catalogId || g.title} className="game-card">
            <Cover game={g} className="cover-3x4" />
            <span className="game-title">{g.title}</span>
            <span className="game-meta">
              {(g.platforms || []).join(", ")} · {g.players} players
            </span>
            <button className="ghost-btn sm" onClick={() => onAddToBoard?.(g)}>
              Add to board
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
