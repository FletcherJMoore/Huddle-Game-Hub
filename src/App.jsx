import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "./auth/AuthProvider.jsx";
import LoginScreen from "./auth/LoginScreen.jsx";
import AppShell from "./app/AppShell.jsx";

function Splash() {
  return (
    <motion.div
      key="splash"
      className="splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="splash-mark"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        🎮
      </motion.div>
    </motion.div>
  );
}

// Top-level route: splash while we resolve the session, then login or home.
// AnimatePresence cross-fades between the three so state changes feel smooth.
export default function App() {
  const { user, loading } = useAuth();

  return (
    <AnimatePresence mode="wait">
      {loading ? <Splash key="splash" /> : user ? <AppShell key="app" /> : <LoginScreen key="login" />}
    </AnimatePresence>
  );
}
