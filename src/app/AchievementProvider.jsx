import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const AchievementContext = createContext(null);

export function useAchievements() {
  return useContext(AchievementContext) ?? { unlock: () => {} };
}

// Xbox-360-style achievement toasts. Call unlock(text, points) on a milestone
// (a game entering the rotation, a night locking in) and a badge slides in.
export function AchievementProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const unlock = useCallback((text, points = 20) => {
    const id = (nextId.current += 1);
    setToasts((list) => [...list, { id, text, points }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <AchievementContext.Provider value={{ unlock }}>
      {children}
      <div className="achv-layer" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className="achv-toast"
              initial={{ y: -90, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -90, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
            >
              <div className="achv-badge">🏆</div>
              <div className="achv-text">
                <span className="achv-heading">Achievement unlocked</span>
                <span className="achv-desc">{t.text}</span>
              </div>
              <div className="achv-points">+{t.points} G</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AchievementContext.Provider>
  );
}
