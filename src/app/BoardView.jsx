import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { getBoard } from "../lib/api.js";

function MemberChip({ member }) {
  const initial = (member.name || member.email || "U").trim().charAt(0).toUpperCase();
  return (
    <div className="member-chip" title={`${member.name || member.email} · ${member.role}`}>
      {member.photoUrl ? (
        <img className="avatar avatar-sm" src={member.photoUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <div className="avatar avatar-sm avatar-fallback">{initial}</div>
      )}
    </div>
  );
}

export default function BoardView({ boardId, onBack }) {
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setBoard(null);
    setError("");
    getBoard(boardId)
      .then((b) => alive && setBoard(b))
      .catch((err) => alive && setError(err.message || "Couldn't load this board."));
    return () => {
      alive = false;
    };
  }, [boardId]);

  if (error) {
    return (
      <main className="board-view">
        <button className="ghost-btn" onClick={onBack}>
          ← Back
        </button>
        <p className="form-error">{error}</p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="board-view">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <motion.main
      className="board-view"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button className="ghost-btn back-btn" onClick={onBack}>
        ← All boards
      </button>

      <header className="board-header">
        <span className="board-header-emoji">{board.emoji || "🎮"}</span>
        <div>
          <h1>{board.name}</h1>
          <div className="member-chips">
            {board.members.map((m) => (
              <MemberChip key={m.userId} member={m} />
            ))}
          </div>
        </div>
      </header>

      <div className="board-tabs">
        {["Games", "Schedule", "Chat"].map((tab) => (
          <span key={tab} className="board-tab disabled">
            {tab}
          </span>
        ))}
      </div>

      <div className="board-placeholder">
        <p className="muted">
          Games, schedule, and chat land in the next slices — the board itself now lives in Postgres
          and loads through the new API.
        </p>
      </div>
    </motion.main>
  );
}
