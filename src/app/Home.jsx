import { motion } from "framer-motion";

import { useAuth } from "../auth/AuthProvider.jsx";

export default function Home() {
  const { user, signOut } = useAuth();
  const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();

  return (
    <motion.main
      className="home"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <header className="home-header">
        <div className="home-user">
          {user.photo_url ? (
            <img className="avatar" src={user.photo_url} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="avatar avatar-fallback">{initial}</div>
          )}
          <div className="home-user-text">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
        </div>
        <button className="ghost-btn" onClick={signOut}>
          Sign out
        </button>
      </header>

      <section className="home-body">
        <motion.div
          className="signed-in-card"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05, type: "spring", stiffness: 240, damping: 22 }}
        >
          <div className="signed-in-emoji">🎉</div>
          <h2>You're signed in with Google</h2>
          <p>
            Auth is running on the new Railway backend — no Firebase involved. Boards, schedule,
            and chat arrive in the next migration slices.
          </p>
        </motion.div>
      </section>
    </motion.main>
  );
}
