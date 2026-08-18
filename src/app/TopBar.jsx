import { useRef } from "react";

import { useTheme, ACCENTS, BG_PRESETS } from "./theme.jsx";
import { Bell, MessageCircleMore } from "./icons.jsx";

function readAsDataURL(file, cb) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(file);
}

export default function TopBar({
  title,
  user,
  profileOpen,
  onToggleProfile,
  onOpenSettings,
  onSignOut,
  chatOpen,
  hasUnreadChat,
  onToggleChat,
  notifOpen,
  notifications,
  readNotifs,
  onToggleNotifs,
  onMarkAllRead,
  onOpenNotif
}) {
  const { theme, setTheme, accentKey, setAccentKey, bgKey, customBg, selectBg, setCustomBg } = useTheme();
  const fileRef = useRef(null);
  const initial = (user?.name || user?.email || "U").trim().charAt(0).toUpperCase();
  const hasUnreadNotif = notifications?.some((n) => !readNotifs.has(n.id));

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>

      <div className="topbar-right">
        <div className="topbar-notif-wrap">
          <button
            className={`topbar-icon-btn${notifOpen ? " active" : ""}`}
            onClick={onToggleNotifs}
            aria-label="Notifications"
          >
            <Bell />
            {hasUnreadNotif && <span className="topbar-icon-dot" />}
          </button>

          {notifOpen && (
            <div className="topbar-menu">
              <div className="notif-head">
                <span className="eyebrow">NOTIFICATIONS</span>
                <button className="notif-clear" onClick={onMarkAllRead}>
                  Mark all read
                </button>
              </div>
              {notifications.map((n) => {
                const unread = !readNotifs.has(n.id);
                return (
                  <button key={n.id} className="notif-row" onClick={() => onOpenNotif(n)}>
                    <span className={`notif-dot${unread ? " unread" : ""}`} />
                    <span className="col">
                      <span className={`notif-text${unread ? " unread" : ""}`}>{n.text}</span>
                      <span className="notif-time">{n.time}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          className={`topbar-icon-btn${chatOpen ? " active" : ""}`}
          onClick={onToggleChat}
          aria-label="Messages"
        >
          <MessageCircleMore />
          {hasUnreadChat && <span className="topbar-icon-dot" />}
        </button>

        <button className="topbar-avatar" onClick={onToggleProfile} aria-label="Profile">
          {user?.photo_url ? (
            <img src={user.photo_url} alt="" referrerPolicy="no-referrer" />
          ) : (
            initial
          )}
        </button>

        {profileOpen && (
          <div className="profile-menu">
            <div className="profile-head">
              <span className="profile-avatar">{initial}</span>
              <span className="col">
                <span className="profile-name">{user?.name || "You"}</span>
                <span className="profile-sub">{user?.email || ""}</span>
              </span>
            </div>

            <div className="eyebrow">THEME</div>
            <div className="segmented-2">
              <button className={theme === "light" ? "seg-on" : ""} onClick={() => setTheme("light")}>
                Light
              </button>
              <button className={theme === "dark" ? "seg-on" : ""} onClick={() => setTheme("dark")}>
                Dark
              </button>
            </div>

            <div className="eyebrow">ACCENT COLOR</div>
            <div className="swatch-row">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  className={`accent-swatch${accentKey === a.key ? " selected" : ""}`}
                  style={{ background: a.value }}
                  onClick={() => setAccentKey(a.key)}
                  title={a.name}
                  aria-label={a.name}
                />
              ))}
            </div>

            <div className="eyebrow">BACKGROUND</div>
            <div className="swatch-row">
              {BG_PRESETS.map((p) => {
                const selected = p.key === bgKey && !customBg;
                return (
                  <button
                    key={p.key}
                    className={`bg-chip${selected ? " selected" : ""}`}
                    style={{ backgroundImage: p.grad }}
                    onClick={() => selectBg(p.key)}
                    aria-label={`${p.key} background`}
                  >
                    {selected && <span className="bg-check">✓</span>}
                  </button>
                );
              })}
              <button
                className={`bg-upload${customBg ? " selected" : ""}`}
                style={customBg ? { backgroundImage: `url(${customBg})` } : undefined}
                onClick={() => fileRef.current?.click()}
                aria-label="Upload a background"
              >
                {!customBg && "+"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readAsDataURL(file, setCustomBg);
                }}
              />
            </div>

            <div className="menu-divider" />
            <button className="menu-row" onClick={onOpenSettings}>
              Profile settings
            </button>
            <button className="menu-row danger" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
