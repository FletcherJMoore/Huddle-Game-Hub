import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { listBoards, createBoard } from "../lib/api.js";

const EMOJI_CHOICES = ["🎮", "🎲", "🕹️", "🃏", "🏆", "🎯", "👾", "🍕"];

function BoardCard({ board, onOpen, index }) {
  return (
    <motion.button
      className="board-card"
      onClick={() => onOpen(board.id)}
      style={{ "--card-accent": board.accent || "#7c5cff" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 26 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="board-card-emoji">{board.emoji || "🎮"}</span>
      <span className="board-card-name">{board.name}</span>
      <span className="board-card-meta">
        {board.memberCount} {board.memberCount === 1 ? "member" : "members"} · {board.role}
      </span>
    </motion.button>
  );
}

export default function Dashboard({ onOpenBoard }) {
  const [boards, setBoards] = useState(null); // null while loading
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎮");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoadError("");
    try {
      setBoards(await listBoards());
    } catch (err) {
      setBoards([]);
      setLoadError(err.message || "Couldn't load your boards.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setFormError("");
    try {
      const board = await createBoard({ name: name.trim(), emoji });
      onOpenBoard(board.id);
    } catch (err) {
      setFormError(err.message || "Couldn't create the board.");
      setBusy(false);
    }
  }

  return (
    <main className="dashboard">
      <div className="dashboard-head">
        <h1>Your boards</h1>
        <button className="primary-btn" onClick={() => setCreating(true)}>
          + New board
        </button>
      </div>

      {boards === null ? (
        <p className="muted">Loading…</p>
      ) : boards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🎲</div>
          <h2>No boards yet</h2>
          <p className="muted">
            {loadError || "Create your first board to start planning game nights."}
          </p>
          <button className="primary-btn" onClick={() => setCreating(true)}>
            + New board
          </button>
        </div>
      ) : (
        <div className="board-grid">
          {boards.map((board, i) => (
            <BoardCard key={board.id} board={board} index={i} onOpen={onOpenBoard} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {creating && (
          <motion.div
            className="modal-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !busy && setCreating(false)}
          >
            <motion.form
              className="modal"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreate}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
            >
              <h2>New board</h2>
              <label className="field">
                <span>Name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Friday Game Night"
                  maxLength={60}
                />
              </label>
              <div className="field">
                <span>Icon</span>
                <div className="emoji-row">
                  {EMOJI_CHOICES.map((choice) => (
                    <button
                      type="button"
                      key={choice}
                      className={`emoji-choice${choice === emoji ? " selected" : ""}`}
                      onClick={() => setEmoji(choice)}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
              {formError && <p className="form-error">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setCreating(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={busy || !name.trim()}>
                  {busy ? "Creating…" : "Create board"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
