import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "../auth/AuthProvider.jsx";
import { voteGame, removeGame } from "../lib/api.js";
import { voteCounts, sortByScore, isAgreed, myVote, majorityThreshold } from "../lib/games.js";
import CoverArt from "./CoverArt.jsx";
import GameDetail from "./GameDetail.jsx";
import ProposeGameModal from "./ProposeGameModal.jsx";

function GameBox({ game, memberCount, onOpen }) {
  const { score } = voteCounts(game);
  const agreed = isAgreed(game, memberCount);

  return (
    <motion.button
      layout
      className="game-box"
      onClick={onOpen}
      whileHover={{ y: -6, rotateX: 7, scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ layout: { type: "spring", stiffness: 520, damping: 42 }, duration: 0.2 }}
    >
      <div className="box-frame">
        <motion.div className="box-cover" layoutId={`cover-${game.id}`}>
          <CoverArt game={game} />
        </motion.div>
        <span className={`box-score${score > 0 ? " pos" : score < 0 ? " neg" : ""}`}>{score}</span>
        {agreed && (
          <span className="box-star" title="In rotation" aria-hidden="true">
            ★
          </span>
        )}
      </div>
    </motion.button>
  );
}

export default function GamesTab({ board }) {
  const { user } = useAuth();
  const [games, setGames] = useState(board.content?.games ?? []);
  const [selectedId, setSelectedId] = useState(null);
  const [proposing, setProposing] = useState(false);

  const memberCount = board.members.length;
  const canManage = board.role === "owner" || board.role === "editor";
  const ranked = useMemo(() => sortByScore(games), [games]);
  const selected = games.find((g) => g.id === selectedId) ?? null;

  async function handleVote(gameId, vote) {
    const game = games.find((g) => g.id === gameId);
    const next = myVote(game, user.id) === vote ? null : vote;

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
      /* keep optimistic; a reload reconciles */
    }
  }

  async function handleRemove(gameId) {
    setSelectedId(null);
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
        <motion.div className="game-shelf" layout>
          {ranked.map((game) => (
            <GameBox
              key={game.id}
              game={game}
              memberCount={memberCount}
              onOpen={() => setSelectedId(game.id)}
            />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {selected && (
          <GameDetail
            key={selected.id}
            game={selected}
            memberCount={memberCount}
            mine={myVote(selected, user.id)}
            canRemove={selected.addedBy === user.id || canManage}
            onVote={handleVote}
            onRemove={handleRemove}
            onClose={() => setSelectedId(null)}
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
