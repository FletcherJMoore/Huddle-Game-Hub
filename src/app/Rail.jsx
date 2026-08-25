import { useState } from "react";

import {
  LayoutDashboard,
  Gamepad2,
  Users,
  Calendar,
  Settings,
  MessageCircleMore,
  ChevronDown,
  Plus
} from "./icons.jsx";

// A nav button with its icon and a persistent text label stacked beneath, so the
// destination is legible at rest — no hover required, and nothing to get stuck
// over the content on touch. The visible label also names the button for screen
// readers, so no separate aria-label is needed.
function RailItem({ icon: Icon, label, active, onClick, dot }) {
  return (
    <button className={`rail-item${active ? " active" : ""}`} onClick={onClick}>
      <Icon />
      <span className="rail-label">{label}</span>
      {dot && <span className="rail-unread-dot" />}
    </button>
  );
}

export default function Rail({
  crews,
  activeBoard,
  crewTab,
  onChat,
  isBoardAdmin,
  switcherOpen,
  hasUnreadChat,
  onToggleSwitcher,
  onSelectCrew,
  onSetTab,
  onNewCrew,
  onGoChat
}) {
  const [brandHover, setBrandHover] = useState(false);

  return (
    <aside className="rail">
      {/* Top control — the crew badge + switcher, or a brand mark that starts a
          first crew when the user has none yet. */}
      <div className="rail-top">
        {activeBoard ? (
          <button
            className={`rail-switcher${switcherOpen ? " open" : ""}`}
            onClick={onToggleSwitcher}
            onMouseEnter={() => setBrandHover(true)}
            onMouseLeave={() => setBrandHover(false)}
            aria-label="Switch crew"
          >
            <span className="rail-badge">{activeBoard.emoji || "🎮"}</span>
            <span className="rail-chevron">
              <ChevronDown size={10} />
            </span>
          </button>
        ) : (
          <button
            className="rail-brand"
            onClick={onNewCrew}
            onMouseEnter={() => setBrandHover(true)}
            onMouseLeave={() => setBrandHover(false)}
            aria-label="New crew"
          >
            <span className="rail-badge glow">🎮</span>
          </button>
        )}
        {brandHover && !switcherOpen && (
          <span className="rail-tip rail-tip-top">{activeBoard ? activeBoard.name : "Huddle Game Hub"}</span>
        )}

        {switcherOpen && (
          <div className="rail-menu switcher-menu">
            <div className="eyebrow">YOUR CREWS</div>
            {crews.map((b) => (
              <button key={b.id} className="switcher-row" onClick={() => onSelectCrew(b.id)}>
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
            <button className="switcher-back" onClick={onNewCrew}>
              <Plus size={15} />
              <span>New crew</span>
            </button>
          </div>
        )}
      </div>

      {activeBoard && (
        <nav className="rail-nav">
          <RailItem icon={LayoutDashboard} label="Plan" active={!onChat && crewTab === "plan"} onClick={() => onSetTab("plan")} />
          <RailItem icon={Gamepad2} label="Games" active={!onChat && crewTab === "games"} onClick={() => onSetTab("games")} />
          <RailItem icon={Calendar} label="Calendar" active={!onChat && crewTab === "calendar"} onClick={() => onSetTab("calendar")} />
          <RailItem icon={Users} label="People" active={!onChat && crewTab === "people"} onClick={() => onSetTab("people")} />
          <RailItem icon={MessageCircleMore} label="Messages" active={onChat} onClick={onGoChat} dot={hasUnreadChat} />
        </nav>
      )}

      <div className="rail-spacer" />

      {/* Admin gear — only inside a crew, admins only */}
      {activeBoard && isBoardAdmin && (
        <div className="rail-admin-wrap">
          <RailItem icon={Settings} label="Admin" active={!onChat && crewTab === "admin"} onClick={() => onSetTab("admin")} />
        </div>
      )}
    </aside>
  );
}
