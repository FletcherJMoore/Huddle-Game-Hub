import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "../auth/AuthProvider.jsx";
import { voteGame, removeGame } from "../lib/api.js";
import { voteCounts, sortByScore, isAgreed, myVote, majorityThreshold } from "../lib/games.js";
import ProposeGameModal from "./ProposeGameModal.jsx";

function GameCard({ game, rank, memberCount, mine, canRemove, onVote, onRemove }) {
  const { score } = voteCounts(game);
  const agreed = isAgreed(game, memberCount);
  const meta = [game.genre, game.players && `${game.players} players`, ...(game.platforms ?? [])]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.li
      layout
      className={`game-card${agreed ? " agreed" : ""}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ layout: { type: "spring", stiffness: 520, damping: 42 }, duration: 0.2 }}
    >
      <span className="game-rank">{rank}</span>
      <div className="game-cover" data-kind={game.kind}>
        {game.coverImageUrl ? (
          <img src={game.coverImageUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{game.kind === "party" ? "🎲" : "🎮"}</span>
        )}
      </div>

      <div className="game-info">
        <div className="game-title-row">
          <span className="game-title">{game.title}</span>
          {agreed && <span className="agreed-badge">In rotation</span>}
        </div>
        {meta && <span className="game-meta">{meta}</span>}
      </div>

      <div className="vote-control">
        <button
          className={`vote-btn${mine === "up" ? " active-up" : ""}`}
          onClick={() => onVote(game.id, "up")}
          aria-label="Upvote"
        >
          ▲
        </button>
        <motion.span key={score} className="vote-score" initial={{ scale: 1.35 }} animate={{ scale: 1 }}>
          {score}
        </motion.span>
        <button
          className={`vote-btn${mine === "down" ? " active-down" : ""}`}
          onClick={() => onVote(game.id, "down")}
          aria-label="Downvote"
        >
          ▼
        </button>
      </div>

      {canRemove && (
        <button className="game-remove" onClick={() => onRemove(game.id)} aria-label="Remove game">
          ×
        </button>
      )}
    </motion.li>
  );
}

export default function GamesTab({ board }) {
  const { user } = useAuth();
  const [games, setGames] = useState(board.content?.games ?? []);
  const [proposing, setProposing] = useState(false);

  const memberCount = board.members.length;
  const canManage = board.role === "owner" || board.role === "editor";
  const ranked = useMemo(() => sortByScore(games), [games]);

  async function handleVote(gameId, vote) {
    const game = games.find((g) => g.id === gameId);
    const next = myVote(game, user.id) === vote ? null : vote; // second click clears

    // Optimistic: update my vote locally so the re-rank animates instantly.
    setGames((gs) =>
      gs.map((g) => {
        if (g.id !== gameId) return g;
        const approvals = { ...(g.approvals ?? {}) };
        if (next === null) delete approvals[user.id];
        else approvals[user.id] = next;
        return { ...g, approvals };
      })
    );

    try {
      setGames(await voteGame(board.id, gameId, next));
    } catch {
      /* keep the optimistic state; a reload reconciles */
    }
  }

  async function handleRemove(gameId) {
    try {
      setGames(await removeGame(board.id, gameId));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="games-tab">
      <div className="games-head">
        <span className="muted">
          {games.length} {games.length === 1 ? "game" : "games"} · majority ={" "}
          {majorityThreshold(memberCount)} up-votes
        </span>
        <button className="primary-btn" onClick={() => setProposing(true)}>
          + Propose game
        </button>
      </div>

      {ranked.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🕹️</div>
          <h2>No games yet</h2>
          <p className="muted">Propose a game and let the crew vote it up.</p>
          <button className="primary-btn" onClick={() => setProposing(true)}>
            + Propose game
          </button>
        </div>
      ) : (
        <motion.ul className="games-list" layout>
          <AnimatePresence initial={false}>
            {ranked.map((game, i) => (
              <GameCard
                key={game.id}
                game={game}
                rank={i + 1}
                memberCount={memberCount}
                mine={myVote(game, user.id)}
                canRemove={game.addedBy === user.id || canManage}
                onVote={handleVote}
                onRemove={handleRemove}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

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
