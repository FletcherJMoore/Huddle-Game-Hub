import { useAuth } from "../auth/AuthProvider.jsx";

export default function TopBar({ onHome, showHome }) {
  const { user, signOut } = useAuth();
  const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <button className="topbar-brand" onClick={onHome} aria-label="Home">
        <span className="topbar-logo">🎮</span>
        <span className="topbar-title">Huddle</span>
        {showHome && <span className="topbar-crumb">/ board</span>}
      </button>

      <div className="topbar-user">
        {user.photo_url ? (
          <img className="avatar avatar-sm" src={user.photo_url} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="avatar avatar-sm avatar-fallback">{initial}</div>
        )}
        <button className="ghost-btn" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
