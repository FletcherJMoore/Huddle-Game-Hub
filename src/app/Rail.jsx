import { useState } from "react";

import {
  LayoutDashboard,
  CircuitBoard,
  Users,
  Gamepad2,
  Calendar,
  Settings,
  ChevronDown,
  ArrowLeft
} from "./icons.jsx";

// A nav button with its icon and a persistent text label stacked beneath, so the
// destination is legible at rest — no hover required, and nothing to get stuck
// over the content on touch. The visible label also names the button for screen
// readers, so no separate aria-label is needed.
function RailItem({ icon: Icon, label, active, onClick }) {
  return (
    <button className={`rail-item${active ? " active" : ""}`} onClick={onClick}>
      <Icon />
      <span className="rail-label">{label}</span>
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
  onToggleSwitcher,
  onGo,
  onSelectBoard,
  onSetBoardTab
}) {
  const [brandHover, setBrandHover] = useState(false);

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
          <RailItem icon={Gamepad2} label="Catalog" active={boardTab === "catalog"} onClick={() => onSetBoardTab("catalog")} />
          <RailItem icon={Users} label="People" active={boardTab === "people"} onClick={() => onSetBoardTab("people")} />
          <RailItem icon={Calendar} label="Calendar" active={boardTab === "calendar"} onClick={() => onSetBoardTab("calendar")} />
        </nav>
      ) : (
        <nav className="rail-nav">
          <RailItem icon={LayoutDashboard} label="Overview" active={nav === "overview"} onClick={() => onGo("overview")} />
          <RailItem icon={CircuitBoard} label="Boards" active={nav === "boards"} onClick={() => onGo("boards")} />
          <RailItem icon={Users} label="Friends" active={nav === "friends"} onClick={() => onGo("friends")} />
          <RailItem icon={Gamepad2} label="Catalog" active={nav === "catalog"} onClick={() => onGo("catalog")} />
        </nav>
      )}

      <div className="rail-spacer" />

      {/* Admin gear — only inside a board, admins only */}
      {onBoard && isBoardAdmin && (
        <div className="rail-admin-wrap">
          <RailItem icon={Settings} label="Admin" active={boardTab === "admin"} onClick={() => onSetBoardTab("admin")} />
        </div>
      )}
    </aside>
  );
}
