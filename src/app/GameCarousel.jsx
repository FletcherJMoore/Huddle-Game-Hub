import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import CoverArt from "./CoverArt.jsx";
import { voteCounts, isAgreed } from "../lib/games.js";

const RADIUS = 250; // px the cases sit out from the cylinder axis
const STEP = 44; // degrees between neighbouring cases
const WINDOW = 108; // cull cases angled further back than this

function Case({ game, angle, memberCount, isCenter, onClick }) {
  const facing = Math.abs(angle);
  const hidden = facing > WINDOW;
  return (
    <motion.button
      type="button"
      className={`game-case${isCenter ? " center" : ""}${isCenter && isAgreed(game, memberCount) ? " agreed" : ""}`}
      onClick={onClick}
      initial={false}
      animate={{ rotateY: angle, opacity: hidden ? 0 : facing > 60 ? 0.5 : 1 }}
      transformTemplate={({ rotateY }) => `rotateY(${rotateY}) translateZ(${RADIUS}px)`}
      transition={{ type: "spring", stiffness: 130, damping: 20 }}
      style={{ pointerEvents: hidden ? "none" : "auto", zIndex: Math.round(200 - facing) }}
      aria-hidden={hidden}
      aria-label={game.title}
    >
      <div className="case-cover">
        <CoverArt game={game} />
        <span className="case-score">{voteCounts(game).score}</span>
      </div>
    </motion.button>
  );
}

// A revolving shelf: the focused case faces the viewer (always centered), the
// rest angle back. Flip with the arrows, by dragging, or by clicking a side
// case. Stops at the first/last case rather than spinning into empty space.
export default function GameCarousel({ games, onActiveChange, onOpenDetail, memberCount }) {
  const count = games.length;
  const [active, setActive] = useState(0);

  // Keep the index in range when the filtered set changes.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, count - 1)));
  }, [count]);

  useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);

  const go = (dir) => setActive((a) => Math.max(0, Math.min(count - 1, a + dir)));

  return (
    <div className="carousel">
      <button className="carousel-arrow" onClick={() => go(-1)} disabled={active === 0} aria-label="Previous game">
        ‹
      </button>

      <motion.div
        className="carousel-stage"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        onDragEnd={(_e, info) => {
          if (info.offset.x < -55) go(1);
          else if (info.offset.x > 55) go(-1);
        }}
      >
        <div className="carousel-ring">
          {games.map((game, i) => (
            <Case
              key={game.id}
              game={game}
              angle={(i - active) * STEP}
              memberCount={memberCount}
              isCenter={i === active}
              onClick={() => (i === active ? onOpenDetail() : setActive(i))}
            />
          ))}
        </div>
      </motion.div>

      <button
        className="carousel-arrow"
        onClick={() => go(1)}
        disabled={active >= count - 1}
        aria-label="Next game"
      >
        ›
      </button>
    </div>
  );
}
