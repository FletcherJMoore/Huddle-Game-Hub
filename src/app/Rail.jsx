import { useState } from "react";

import {
  LayoutDashboard,
  Columns3,
  Users,
  Gamepad2,
  Calendar,
  Settings,
  Bell,
  ChevronDown,
  ArrowLeft
} from "./icons.jsx";

// A single icon-only nav button with a JS-driven tooltip that escapes the
// button box (so it can sit in the content area, not be clipped by the rail).
function RailItem({ icon: Icon, label, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      className={`rail-item${active ? " active" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label}
    >
      <Icon />
      {hover && <span className="rail-tip">{label}</span>}
    </button>
  );
}

export default function Rail({
  nav,
  onBoard,
  boardTab,
  activeBoard,
  boards,
  isBoardAdmin,
  switcherOpen,
  notifOpen,
  notifications,
  readNotifs,
  onToggleSwitcher,
  onToggleNotifs,
  onMarkAllRead,
  onOpenNotif,
  onGo,
  onSelectBoard,
  onSetBoardTab
}) {
  const [brandHover, setBrandHover] = useState(false);
  const hasUnread = notifications.some((n) => !readNotifs.has(n.id));

  return (
    <aside className="rail">
      {/* Top control — brand mark, or the board badge + switcher when in a board */}
      <div className="rail-top">
        {onBoard ? (
          <button
            className={`rail-switcher${switcherOpen ? " open" : ""}`}
            onClick={onToggleSwitcher}
            onMouseEnter={() => setBrandHover(true)}
            onMouseLeave={() => setBrandHover(false)}
            aria-label="Switch board"
          >
            <span className="rail-badge">{activeBoard?.emoji || "🎮"}</span>
            <span className="rail-chevron">
              <ChevronDown size={10} />
            </span>
          </button>
        ) : (
          <button
            className="rail-brand"
            onClick={() => onGo("overview")}
            onMouseEnter={() => setBrandHover(true)}
            onMouseLeave={() => setBrandHover(false)}
            aria-label="Overview"
          >
            <span className="rail-badge glow">🎮</span>
          </button>
        )}
        {brandHover && !switcherOpen && (
          <span className="rail-tip rail-tip-top">{onBoard ? activeBoard?.name : "Huddle Game Hub"}</span>
        )}

        {switcherOpen && (
          <div className="rail-menu switcher-menu">
            <div className="eyebrow">YOUR BOARDS</div>
            {boards.map((b) => (
              <button key={b.id} className="switcher-row" onClick={() => onSelectBoard(b.id)}>
                <span className="switcher-emoji">{b.emoji || "🎮"}</span>
                <span className="col">
                  <span className="switcher-name">{b.name}</span>
                  <span className="switcher-sub">
                    {b.memberCount} member{b.memberCount === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))}
            <div className="menu-divider" />
            <button className="switcher-back" onClick={() => onGo("overview")}>
              <ArrowLeft size={15} />
              <span>Back to Overview</span>
            </button>
          </div>
        )}
      </div>

      {/* Nav set swaps with context */}
      {onBoard ? (
        <nav className="rail-nav">
          <RailItem icon={LayoutDashboard} label="Overview" active={boardTab === "overview"} onClick={() => onSetBoardTab("overview")} />
          <RailItem icon={Gamepad2} label="Game Catalog" active={boardTab === "catalog"} onClick={() => onSetBoardTab("catalog")} />
          <RailItem icon={Users} label="People" active={boardTab === "people"} onClick={() => onSetBoardTab("people")} />
          <RailItem icon={Calendar} label="Calendar" active={boardTab === "calendar"} onClick={() => onSetBoardTab("calendar")} />
        </nav>
      ) : (
        <nav className="rail-nav">
          <RailItem icon={LayoutDashboard} label="Overview" active={nav === "overview"} onClick={() => onGo("overview")} />
          <RailItem icon={Columns3} label="Boards" active={nav === "boards"} onClick={() => onGo("boards")} />
          <RailItem icon={Users} label="Friends" active={nav === "friends"} onClick={() => onGo("friends")} />
          <RailItem icon={Gamepad2} label="Game Catalog" active={nav === "catalog"} onClick={() => onGo("catalog")} />
        </nav>
      )}

      <div className="rail-spacer" />

      {/* Notifications bell (always present) */}
      <div className="rail-bell-wrap">
        <button
          className={`rail-item${notifOpen ? " active" : ""}`}
          onClick={onToggleNotifs}
          aria-label="Notifications"
        >
          <Bell />
          {hasUnread && <span className="rail-bell-dot" />}
        </button>

        {notifOpen && (
          <div className="rail-menu notif-menu">
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

      {/* Admin gear — only inside a board, admins only */}
      {onBoard && isBoardAdmin && (
        <div className="rail-admin-wrap">
          <RailItem icon={Settings} label="Admin settings" active={boardTab === "admin"} onClick={() => onSetBoardTab("admin")} />
        </div>
      )}
    </aside>
  );
}
