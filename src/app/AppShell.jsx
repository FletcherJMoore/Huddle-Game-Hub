import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthProvider.jsx";
import { listBoards, createBoard } from "../lib/api.js";
import { NOTIFICATIONS } from "../lib/social.js";
import Rail from "./Rail.jsx";
import TopBar from "./TopBar.jsx";
import BoardView from "./BoardView.jsx";
import ChatDrawer from "./ChatDrawer.jsx";
import ProfileSettingsModal from "./ProfileSettingsModal.jsx";
import { OverviewScreen, BoardsScreen, FriendsScreen, CatalogScreen } from "./TopScreens.jsx";
import { BOARD_EMOJI } from "./theme.jsx";

const TOP_TITLES = { overview: "Overview", boards: "Boards", friends: "Friends", catalog: "Game Catalog" };
const BOARD_TITLES = { catalog: "Game Catalog", people: "People", calendar: "Calendar", admin: "Admin settings" };

function NewBoardModal({ onClose, onCreated }) {
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
      setError(err.message || "Couldn't create the board.");
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onClick={() => !busy && onClose()}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2>New board</h2>
        </div>
        <div className="modal-body">
          <label className="field-col">
            <span className="field-label">Name</span>
            <input className="text-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Game Night" maxLength={60} />
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
            {busy ? "Creating…" : "Create board"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AppShell() {
  const { user, signOut } = useAuth();
  const [boards, setBoards] = useState([]);
  const [nav, setNav] = useState("overview");
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [boardTab, setBoardTab] = useState("overview");

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [readNotifs, setReadNotifs] = useState(new Set());
  const [chatOpened, setChatOpened] = useState(false);

  useEffect(() => {
    listBoards().then(setBoards).catch(() => setBoards([]));
  }, []);

  const onBoard = nav === "board";
  const activeBoard = boards.find((b) => b.id === activeBoardId) || null;
  const isBoardAdmin = activeBoard?.role === "owner" || activeBoard?.role === "editor";

  const closeMenus = () => {
    setSwitcherOpen(false);
    setProfileOpen(false);
    setNotifOpen(false);
  };

  const go = (next) => {
    setNav(next);
    closeMenus();
    setChatOpen(false);
  };
  const selectBoard = (id) => {
    setNav("board");
    setActiveBoardId(id);
    setBoardTab("overview");
    closeMenus();
  };
  const setTab = (t) => {
    setBoardTab(t);
    closeMenus();
  };

  const toggle = (which) => {
    setSwitcherOpen(which === "switcher" ? (v) => !v : false);
    setProfileOpen(which === "profile" ? (v) => !v : false);
    setNotifOpen(which === "notif" ? (v) => !v : false);
    if (which !== "chat") {
      if (which === "switcher" || which === "profile") setChatOpen(false);
    }
  };
  const toggleChat = () => {
    setChatOpen((v) => !v);
    setChatOpened(true);
    setSwitcherOpen(false);
    setProfileOpen(false);
    setNotifOpen(false);
  };

  function openNotif(n) {
    setReadNotifs((prev) => new Set(prev).add(n.id));
    setNotifOpen(false);
    if (n.route === "chat") {
      toggleChat();
    } else if (n.route === "catalog" || n.route === "calendar") {
      if (!onBoard) {
        if (boards[0]) selectBoard(boards[0].id);
      }
      setBoardTab(n.route);
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
    if (onBoard) {
      if (boardTab === "overview") return `${activeBoard?.emoji || "🎮"}  ${activeBoard?.name || "Board"}`;
      return BOARD_TITLES[boardTab] || "Board";
    }
    return TOP_TITLES[nav] || "Overview";
  }, [onBoard, boardTab, nav, activeBoard]);

  return (
    <div className="app-shell">
      <Rail
        nav={nav}
        onBoard={onBoard}
        boardTab={boardTab}
        activeBoard={activeBoard}
        boards={boards}
        isBoardAdmin={isBoardAdmin}
        switcherOpen={switcherOpen}
        notifOpen={notifOpen}
        notifications={NOTIFICATIONS}
        readNotifs={readNotifs}
        chatOpen={chatOpen}
        hasUnreadChat={!chatOpened}
        onToggleChat={toggleChat}
        onToggleSwitcher={() => toggle("switcher")}
        onToggleNotifs={() => toggle("notif")}
        onMarkAllRead={() => setReadNotifs(new Set(NOTIFICATIONS.map((n) => n.id)))}
        onOpenNotif={openNotif}
        onGo={go}
        onSelectBoard={selectBoard}
        onSetBoardTab={setTab}
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
        />

        <section className="content">
          {onBoard && activeBoardId ? (
            <BoardView
              boardId={activeBoardId}
              boardTab={boardTab}
              onExit={() => go("overview")}
              onSetTab={setTab}
              onMetaChange={onMetaChange}
            />
          ) : nav === "boards" ? (
            <BoardsScreen boards={boards} onOpenBoard={selectBoard} onNewBoard={() => setCreating(true)} />
          ) : nav === "friends" ? (
            <FriendsScreen />
          ) : nav === "catalog" ? (
            <CatalogScreen boards={boards} />
          ) : (
            <OverviewScreen user={user} boards={boards} onOpenBoard={selectBoard} />
          )}
        </section>
      </main>

      {(switcherOpen || profileOpen || notifOpen) && <div className="menu-backdrop" onClick={closeMenus} />}

      {chatOpen && <ChatDrawer boards={boards} user={user} activeBoardId={activeBoardId} onClose={() => setChatOpen(false)} />}

      {settingsOpen && <ProfileSettingsModal user={user} onClose={() => setSettingsOpen(false)} />}

      {creating && (
        <NewBoardModal
          onClose={() => setCreating(false)}
          onCreated={(board) => {
            setBoards((bs) => [board, ...bs]);
            setCreating(false);
            selectBoard(board.id);
          }}
        />
      )}
    </div>
  );
}
