import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { useAuth } from "./AuthProvider.jsx";
import { getInvite, acceptInvite } from "../lib/api.js";

// Google's "G" mark, inlined (matches LoginScreen).
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Card({ children }) {
  return (
    <motion.main className="auth-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        className="auth-card invite-card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        {children}
      </motion.div>
    </motion.main>
  );
}

const UNAVAILABLE = {
  not_found: "This invite link isn't valid anymore.",
  expired: "This invite has expired. Ask an admin to send a new one.",
  accepted: "This invite has already been accepted — you can sign in to Huddle.",
  revoked: "This invite was revoked."
};

// The /invite/:token landing page. Renders the invite, then walks the visitor
// through Google sign-in (carrying the token back via returnTo) and accepting.
export default function InviteAccept({ token }) {
  const { user, loading, signOut } = useAuth();
  const [invite, setInvite] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getInvite(token)
      .then((r) => alive && (setInvite(r), setPhase("ready")))
      .catch(() => alive && setPhase("error"));
    return () => {
      alive = false;
    };
  }, [token]);

  async function join() {
    setJoining(true);
    setError("");
    try {
      await acceptInvite(token);
      window.location.assign("/"); // into the app, now a crew member
    } catch (err) {
      setError(err.message || "Couldn't accept this invite.");
      setJoining(false);
    }
  }

  async function switchAccount() {
    await signOut();
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(`/invite/${token}`)}`);
  }

  if (phase === "loading" || loading) {
    return (
      <Card>
        <div className="auth-logo">🎮</div>
        <p className="auth-tagline">Loading your invite…</p>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card>
        <div className="auth-logo">🎮</div>
        <h1 className="gradient-text">Something went wrong</h1>
        <p className="auth-tagline">We couldn't load this invite. Try the link again.</p>
        <a className="google-btn" href="/"><span>Go to Huddle</span></a>
      </Card>
    );
  }

  if (invite.status !== "pending") {
    return (
      <Card>
        <div className="auth-logo">🎮</div>
        <h1 className="gradient-text">Invite unavailable</h1>
        <p className="auth-tagline">{UNAVAILABLE[invite.status] || "This invite isn't available."}</p>
        <a className="google-btn" href="/"><span>Go to Huddle</span></a>
      </Card>
    );
  }

  const crew = invite.crew?.name || "a crew";
  const emoji = invite.crew?.emoji || "🎮";
  const invitedLine = invite.inviterName ? `${invite.inviterName} invited you` : "You've been invited";

  // Signed out — send them through Google, carrying the token back.
  if (!user) {
    return (
      <Card>
        <div className="auth-logo">{emoji}</div>
        <h1 className="gradient-text">Join {crew}</h1>
        <p className="auth-tagline">{invitedLine} to plan game nights on Huddle.</p>
        <a className="google-btn" href={`/api/auth/google?returnTo=${encodeURIComponent(`/invite/${token}`)}`}>
          <GoogleG />
          <span>Continue with Google</span>
        </a>
        <p className="invite-hint">Sign in with {invite.email} to accept.</p>
      </Card>
    );
  }

  // Signed in as the wrong account.
  if (user.email && invite.email && user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Card>
        <div className="auth-logo">{emoji}</div>
        <h1 className="gradient-text">Different account</h1>
        <p className="auth-tagline">
          This invite was sent to <b>{invite.email}</b>, but you're signed in as <b>{user.email}</b>.
        </p>
        <button className="google-btn" onClick={switchAccount}>
          <GoogleG />
          <span>Switch account</span>
        </button>
      </Card>
    );
  }

  // Signed in, email matches — one tap to join.
  return (
    <Card>
      <div className="auth-logo">{emoji}</div>
      <h1 className="gradient-text">Join {crew}</h1>
      <p className="auth-tagline">{invitedLine} as {invite.role === "editor" ? "an editor" : "a member"}.</p>
      {error && <p className="form-error">{error}</p>}
      <button className="google-btn accept-btn" onClick={join} disabled={joining}>
        <span>{joining ? "Joining…" : `Join ${crew}`}</span>
      </button>
    </Card>
  );
}
