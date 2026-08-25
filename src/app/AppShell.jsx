import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthProvider.jsx";
import { listBoards, createBoard } from "../lib/api.js";
import { NOTIFICATIONS } from "../lib/social.js";
import Rail from "./Rail.jsx";
import TopBar from "./TopBar.jsx";
import BoardView from "./BoardView.jsx";
import ChatPage from "./ChatPage.jsx";
import ProfileSettingsModal from "./ProfileSettingsModal.jsx";
import { BOARD_EMOJI } from "./theme.jsx";
import { Plus } from "./icons.jsx";

// Titles for the crew sub-nav. The Plan tab shows the crew's own name (built in
// the title memo below), so it isn't listed here.
const CREW_TITLES = { games: "Games", people: "People", calendar: "Calendar", admin: "Admin settings" };

function NewCrewModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎮");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      onCreated(await createBoard({ name: name.trim(), emoji }));
    } catch (err) {
      setError(err.message || "Couldn't create the crew.");
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onClick={() => !busy && onClose()}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2>New crew</h2>
        </div>
        <div className="modal-body">
          <label className="field-col">
            <span className="field-label">Name</span>
            <input className="text-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Night Crew" maxLength={60} />
          </label>
          <div className="field-col">
            <span className="field-label">Icon</span>
            <div className="emoji-row">
              {BOARD_EMOJI.map((e) => (
                <button type="button" key={e} className={`emoji-chip${e === emoji ? " selected" : ""}`} onClick={() => setEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create crew"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Shown when the user has no crews yet — a focused invitation to start one, in
// place of any dashboard.
function EmptyCrewState({ onNewCrew }) {
  return (
    <div className="empty-crew">
      <span className="empty-crew-badge">🎮</span>
      <h2>Start your first crew</h2>
      <p className="muted">
        A crew is your group of friends. Add games, vote on what to play, and plan game nights together.
      </p>
      <button className="primary-btn" onClick={onNewCrew}>
        <Plus size={14} /> New crew
      </button>
    </div>
  );
}

export default function AppShell() {
  const { user, signOut } = useAuth();
  const [boards, setBoards] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // The app is always crew-scoped. `view` swaps the crew workspace for the
  // (cross-crew) Messages surface; `crewTab` is the section within a crew.
  const [view, setView] = useState("crew");
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [crewTab, setCrewTab] = useState("plan");

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [readNotifs, setReadNotifs] = useState(new Set());
  const [chatVisited, setChatVisited] = useState(false);

  useEffect(() => {
    listBoards()
      .then((bs) => {
        setBoards(bs);
        setActiveBoardId((id) => id ?? bs[0]?.id ?? null);
      })
      .catch(() => setBoards([]))
      .finally(() => setLoaded(true));
  }, []);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || null;
  const isBoardAdmin = activeBoard?.role === "owner" || activeBoard?.role === "editor";
  const onChat = view === "chat";

  const closeMenus = () => {
    setSwitcherOpen(false);
    setProfileOpen(false);
    setNotifOpen(false);
  };

  const selectCrew = (id) => {
    setActiveBoardId(id);
    setView("crew");
    setCrewTab("plan");
    closeMenus();
  };
  const setTab = (t) => {
    setCrewTab(t);
    setView("crew");
    closeMenus();
  };
  const goChat = () => {
    setView("chat");
    setChatVisited(true);
    closeMenus();
  };

  const toggle = (which) => {
    setSwitcherOpen(which === "switcher" ? (v) => !v : false);
    setProfileOpen(which === "profile" ? (v) => !v : false);
    setNotifOpen(which === "notif" ? (v) => !v : false);
  };

  function openNotif(n) {
    setReadNotifs((prev) => new Set(prev).add(n.id));
    setNotifOpen(false);
    if (n.route === "chat") {
      goChat();
    } else if (n.route === "catalog") {
      setTab("games");
    } else if (n.route === "calendar") {
      setTab("calendar");
    }
  }

  function onMetaChange(boardId, patch) {
    const clean = {};
    if (patch.name !== undefined) clean.name = patch.name;
    if (patch.emoji !== undefined) clean.emoji = patch.emoji;
    if (Object.keys(clean).length) {
      setBoards((bs) => bs.map((b) => (b.id === boardId ? { ...b, ...clean } : b)));
    }
  }

  const title = useMemo(() => {
    if (onChat) return "Messages";
    if (!activeBoard) return "Huddle";
    if (crewTab === "plan") return `${activeBoard.emoji || "🎮"}  ${activeBoard.name}`;
    return CREW_TITLES[crewTab] || activeBoard.name;
  }, [onChat, crewTab, activeBoard]);

  const hasCrews = boards.length > 0;

  return (
    <div className="app-shell">
      <Rail
        crews={boards}
        activeBoard={activeBoard}
        crewTab={crewTab}
        onChat={onChat}
        isBoardAdmin={isBoardAdmin}
        switcherOpen={switcherOpen}
        hasUnreadChat={!chatVisited}
        onToggleSwitcher={() => toggle("switcher")}
        onSelectCrew={selectCrew}
        onSetTab={setTab}
        onNewCrew={() => {
          setCreating(true);
          closeMenus();
        }}
        onGoChat={goChat}
      />

      <main className="app-main">
        <TopBar
          title={title}
          user={user}
          profileOpen={profileOpen}
          onToggleProfile={() => toggle("profile")}
          onOpenSettings={() => {
            setSettingsOpen(true);
            closeMenus();
          }}
          onSignOut={signOut}
          notifOpen={notifOpen}
          notifications={NOTIFICATIONS}
          readNotifs={readNotifs}
          onToggleNotifs={() => toggle("notif")}
          onMarkAllRead={() => setReadNotifs(new Set(NOTIFICATIONS.map((n) => n.id)))}
          onOpenNotif={openNotif}
        />

        <section className={`content${onChat ? " flush" : ""}`}>
          {!hasCrews ? (
            loaded && <EmptyCrewState onNewCrew={() => setCreating(true)} />
          ) : onChat ? (
            <ChatPage boards={boards} user={user} activeBoardId={activeBoardId} />
          ) : activeBoardId ? (
            <BoardView
              boardId={activeBoardId}
              boardTab={crewTab}
              onExit={() => setTab("plan")}
              onSetTab={setTab}
              onMetaChange={onMetaChange}
            />
          ) : null}
        </section>
      </main>

      {(switcherOpen || profileOpen || notifOpen) && <div className="menu-backdrop" onClick={closeMenus} />}

      {settingsOpen && <ProfileSettingsModal user={user} onClose={() => setSettingsOpen(false)} />}

      {creating && (
        <NewCrewModal
          onClose={() => setCreating(false)}
          onCreated={(board) => {
            setBoards((bs) => [board, ...bs]);
            setCreating(false);
            selectCrew(board.id);
          }}
        />
      )}
    </div>
  );
}
