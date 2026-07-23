import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { searchCatalog, addGame } from "../lib/api.js";

export default function ProposeGameModal({ boardId, onClose, onAdded }) {
  const [kind, setKind] = useState("video");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const debounce = useRef();

  // Debounced catalog search as the user types (or switches video/party).
  useEffect(() => {
    clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        setResults(await searchCatalog(q, kind));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounce.current);
  }, [query, kind]);

  async function submit(game) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onAdded(await addGame(boardId, game));
    } catch (err) {
      setError(err.message || "Couldn't add the game.");
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
    >
      <motion.div
        className="modal propose-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        <h2>Propose a game</h2>

        <div className="kind-toggle">
          {["video", "party"].map((k) => (
            <button
              key={k}
              type="button"
              className={`kind-option${kind === k ? " selected" : ""}`}
              onClick={() => setKind(k)}
            >
              {k === "video" ? "🎮 Video game" : "🎲 Party / board game"}
            </button>
          ))}
        </div>

        <input
          autoFocus
          className="propose-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={kind === "video" ? "Search video games…" : "Search board games…"}
        />

        <div className="catalog-results">
          {searching && <p className="muted small">Searching…</p>}
          {!searching && query.trim() && results.length === 0 && (
            <p className="muted small">No matches — you can still add it by name below.</p>
          )}
          {results.map((r) => (
            <button
              key={r.catalogId}
              type="button"
              className="catalog-result"
              disabled={busy}
              onClick={() =>
                submit({
                  title: r.title,
                  kind,
                  genre: r.genre,
                  players: r.players,
                  platforms: r.platforms,
                  coverImageUrl: r.coverImageUrl,
                  catalogId: r.catalogId
                })
              }
            >
              <div className="catalog-cover">
                {r.coverImageUrl ? <img src={r.coverImageUrl} alt="" referrerPolicy="no-referrer" /> : "🎮"}
              </div>
              <div className="catalog-text">
                <span className="catalog-title">{r.title}</span>
                <span className="catalog-meta">
                  {[r.genre, r.players && `${r.players} players`].filter(Boolean).join(" · ")}
                </span>
              </div>
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={busy || !query.trim()}
            onClick={() => submit({ title: query.trim(), kind })}
          >
            {busy ? "Adding…" : `Add "${query.trim() || "…"}" by name`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
