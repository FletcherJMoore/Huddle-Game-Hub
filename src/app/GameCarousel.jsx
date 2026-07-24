import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import CoverArt from "./CoverArt.jsx";
import { voteCounts, isAgreed } from "../lib/games.js";

const RADIUS = 250; // px the cases sit out from the cylinder axis

// Normalize an angle to (-180, 180] to judge how front/back-facing a case is.
function normalize(angle) {
  return (((angle % 360) + 540) % 360) - 180;
}

function Case({ game, angle, memberCount, isCenter, onClick }) {
  const facing = Math.abs(normalize(angle));
  const hidden = facing > 108;
  return (
    <motion.button
      type="button"
      className={`game-case${isCenter ? " center" : ""}${isCenter && isAgreed(game, memberCount) ? " agreed" : ""}`}
      onClick={onClick}
      initial={false}
      animate={{ rotateY: angle, opacity: hidden ? 0 : facing > 62 ? 0.5 : 1 }}
      transformTemplate={({ rotateY }) => `rotateY(${rotateY}) translateZ(${RADIUS}px)`}
      transition={{ type: "spring", stiffness: 110, damping: 20 }}
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

// A revolving door: the cases sit evenly around a cylinder and rotate so each
// comes full circle to the front. `rotation` is an unbounded step counter so
// advancing always animates one short step, even across the seam.
// Fixed angular step so a few games still fan out nicely and a full roster
// wraps all the way around the cylinder.
const STEP = 46;

export default function GameCarousel({ games, onActiveChange, onOpenDetail, memberCount }) {
  const count = games.length;
  const step = STEP;
  const [rotation, setRotation] = useState(0);

  const activeIndex = count ? ((rotation % count) + count) % count : 0;

  useEffect(() => {
    onActiveChange(activeIndex);
  }, [activeIndex, onActiveChange]);

  const go = (dir) => setRotation((r) => r + dir);

  const bringToFront = (i) => {
    let diff = (((i - activeIndex) % count) + count) % count;
    if (diff > count / 2) diff -= count; // spin the short way
    setRotation((r) => r + diff);
  };

  return (
    <div className="carousel">
      <button className="carousel-arrow" onClick={() => go(-1)} aria-label="Previous game" disabled={count < 2}>
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
              angle={(i - rotation) * step}
              memberCount={memberCount}
              isCenter={i === activeIndex}
              onClick={() => (i === activeIndex ? onOpenDetail() : bringToFront(i))}
            />
          ))}
        </div>
      </motion.div>

      <button className="carousel-arrow" onClick={() => go(1)} aria-label="Next game" disabled={count < 2}>
        ›
      </button>
    </div>
  );
}
