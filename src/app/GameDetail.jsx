import { motion } from "framer-motion";

import CoverArt from "./CoverArt.jsx";
import { voteCounts, isAgreed } from "../lib/games.js";

// The game "pulled off the shelf": the cover shares a layoutId with its shelf
// box, so framer-motion morphs it from the grid slot into this panel while the
// details fade in around it.
export default function GameDetail({ game, memberCount, mine, canRemove, onVote, onRemove, onClose }) {
  const { up, down, score } = voteCounts(game);
  const agreed = isAgreed(game, memberCount);
  const meta = [game.genre, game.players && `${game.players} players`, ...(game.platforms ?? [])]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      className="detail-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <motion.div className="detail-cover" layoutId={`cover-${game.id}`}>
          <CoverArt game={game} />
        </motion.div>

        <motion.div
          className="detail-body"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.25 }}
        >
          <div className="detail-title-row">
            <h2>{game.title}</h2>
            {agreed && <span className="agreed-badge">In rotation</span>}
          </div>
          <p className="detail-kind">{game.kind === "party" ? "Party / board game" : "Video game"}</p>
          {meta && <p className="detail-meta">{meta}</p>}

          <div className="detail-vote">
            <button
              className={`vote-big${mine === "up" ? " active-up" : ""}`}
              onClick={() => onVote(game.id, "up")}
              aria-label="Upvote"
            >
              ▲
            </button>
            <motion.span key={score} className="detail-score" initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
              {score}
            </motion.span>
            <button
              className={`vote-big${mine === "down" ? " active-down" : ""}`}
              onClick={() => onVote(game.id, "down")}
              aria-label="Downvote"
            >
              ▼
            </button>
            <span className="detail-tally">
              {up} up · {down} down
            </span>
          </div>

          {canRemove && (
            <div className="detail-actions">
              <button className="ghost-btn danger" onClick={() => onRemove(game.id)}>
                Remove game
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
