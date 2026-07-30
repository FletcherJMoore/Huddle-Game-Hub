import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "../auth/AuthProvider.jsx";
import { useAchievements } from "./AchievementProvider.jsx";
import { voteGame, removeGame } from "../lib/api.js";
import { voteCounts, sortByScore, isAgreed, myVote, majorityThreshold } from "../lib/games.js";
import GameCarousel from "./GameCarousel.jsx";
import GameDetail from "./GameDetail.jsx";
import ProposeGameModal from "./ProposeGameModal.jsx";

const KINDS = [
  { id: "video", label: "🎮 Video" },
  { id: "party", label: "🎲 Board" }
];

export default function GamesTab({ board, serverGames }) {
  const { user } = useAuth();
  const { unlock } = useAchievements();
  const [games, setGames] = useState(serverGames ?? board.content?.games ?? []);
  const [kind, setKind] = useState("video");

  // Reconcile with live updates broadcast to the board room.
  useEffect(() => {
    if (serverGames) setGames(serverGames);
  }, [serverGames]);

  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [proposing, setProposing] = useState(false);

  const memberCount = board.members.length;
  const canManage = board.role === "owner" || board.role === "editor";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortByScore(
      games.filter((g) => g.kind === kind && (!q || g.title.toLowerCase().includes(q)))
    );
  }, [games, kind, search]);

  const active = filtered[Math.min(activeIndex, Math.max(0, filtered.length - 1))] ?? null;

  async function handleVote(gameId, vote) {
    const game = games.find((g) => g.id === gameId);
    const next = myVote(game, user.id) === vote ? null : vote;

    const approvals = { ...(game.approvals ?? {}) };
    if (next === null) delete approvals[user.id];
    else approvals[user.id] = next;

    if (!isAgreed(game, memberCount) && isAgreed({ ...game, approvals }, memberCount)) {
      unlock(`${game.title} entered the rotation`, 20);
    }

    setGames((gs) => gs.map((g) => (g.id === gameId ? { ...g, approvals } : g)));

    try {
      setGames(await voteGame(board.id, gameId, next));
    } catch {
      /* keep optimistic */
    }
  }

  async function handleRemove(gameId) {
    setDetailOpen(false);
    try {
      setGames(await removeGame(board.id, gameId));
    } catch {
      /* ignore */
    }
  }

  const activeMeta = active
    ? [active.genre, active.players && `${active.players} players`, ...(active.platforms ?? [])]
        .filter(Boolean)
        .join(" · ")
    : "";
  const mine = active ? myVote(active, user.id) : null;
  const score = active ? voteCounts(active).score : 0;

  return (
    <div className="games-tab">
      <div className="games-controls">
        <div className="segmented">
          {KINDS.map((k) => (
            <button
              key={k.id}
              className={`seg-option${kind === k.id ? " selected" : ""}`}
              onClick={() => {
                setKind(k.id);
                setActiveIndex(0);
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <input
          className="game-search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActiveIndex(0);
          }}
          placeholder="Search games…"
        />
        <button className="primary-btn" onClick={() => setProposing(true)}>
          + Propose
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">{kind === "video" ? "🎮" : "🎲"}</div>
          <h2>No {kind === "video" ? "video" : "board"} games yet</h2>
          <p className="muted">
            {search.trim() ? "Nothing matches that search." : "Propose one and let the crew vote it up."}
          </p>
          <button className="primary-btn" onClick={() => setProposing(true)}>
            + Propose game
          </button>
        </div>
      ) : (
        <>
          <GameCarousel
            key={`${kind}-${search.trim()}`}
            games={filtered}
            onActiveChange={setActiveIndex}
            onOpenDetail={() => setDetailOpen(true)}
            memberCount={memberCount}
          />

          {active && (
            <div className="carousel-info">
              <div className="carousel-title-row">
                <h3 className="gradient-text">{active.title}</h3>
                {isAgreed(active, memberCount) && <span className="agreed-badge">In rotation</span>}
              </div>
              {activeMeta && <p className="muted carousel-meta">{activeMeta}</p>}

              <div className="carousel-vote">
                <button
                  className={`vote-big${mine === "up" ? " active-up" : ""}`}
                  onClick={() => handleVote(active.id, "up")}
                  aria-label="Upvote"
                >
                  ▲
                </button>
                <motion.span key={score} className="detail-score" initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
                  {score}
                </motion.span>
                <button
                  className={`vote-big${mine === "down" ? " active-down" : ""}`}
                  onClick={() => handleVote(active.id, "down")}
                  aria-label="Downvote"
                >
                  ▼
                </button>
                <button className="ghost-btn" onClick={() => setDetailOpen(true)}>
                  Details
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {detailOpen && active && (
          <GameDetail
            key={active.id}
            game={active}
            memberCount={memberCount}
            mine={myVote(active, user.id)}
            canRemove={active.addedBy === user.id || canManage}
            onVote={handleVote}
            onRemove={handleRemove}
            onClose={() => setDetailOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {proposing && (
          <ProposeGameModal
            boardId={board.id}
            onClose={() => setProposing(false)}
            onAdded={(updated) => {
              setGames(updated);
              setProposing(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
