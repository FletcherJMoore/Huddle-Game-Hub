import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { getBoard, getMessages, sendMessage } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import GamesTab from "./GamesTab.jsx";
import ScheduleTab from "./ScheduleTab.jsx";
import ChatTab from "./ChatTab.jsx";

const TABS = [
  { id: "games", label: "Games" },
  { id: "schedule", label: "Schedule" },
  { id: "chat", label: "Chat" }
];

function MemberChip({ member }) {
  const initial = (member.name || member.email || "U").trim().charAt(0).toUpperCase();
  return (
    <div className="member-chip" title={`${member.name || member.email} · ${member.role}`}>
      {member.photoUrl ? (
        <img className="avatar avatar-sm" src={member.photoUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <div className="avatar avatar-sm avatar-fallback">{initial}</div>
      )}
    </div>
  );
}

export default function BoardView({ boardId, onBack }) {
  const [board, setBoard] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("games");

  // Live board content, kept in sync via the board's socket room.
  const [games, setGames] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let alive = true;
    setBoard(null);
    setError("");

    getBoard(boardId)
      .then((b) => {
        if (!alive) return;
        setBoard(b);
        setGames(b.content?.games ?? []);
        setSchedule(b.content?.schedule ?? []);
      })
      .catch((err) => alive && setError(err.message || "Couldn't load this board."));
    getMessages(boardId)
      .then((m) => alive && setMessages(m))
      .catch(() => {});

    const socket = getSocket();
    socket.emit("join", boardId);
    const onContent = (c) => {
      setGames(c.games ?? []);
      setSchedule(c.schedule ?? []);
    };
    const onMessage = (m) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    socket.on("board:content", onContent);
    socket.on("board:message", onMessage);

    return () => {
      alive = false;
      socket.emit("leave", boardId);
      socket.off("board:content", onContent);
      socket.off("board:message", onMessage);
    };
  }, [boardId]);

  async function handleSend(text) {
    const message = await sendMessage(boardId, text);
    setMessages((prev) => (prev.some((x) => x.id === message.id) ? prev : [...prev, message]));
  }

  if (error) {
    return (
      <main className="board-view">
        <button className="ghost-btn" onClick={onBack}>
          ← Back
        </button>
        <p className="form-error">{error}</p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="board-view">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <motion.main
      className="board-view"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button className="ghost-btn back-btn" onClick={onBack}>
        ← All boards
      </button>

      <header className="board-header">
        <span className="board-header-emoji">{board.emoji || "🎮"}</span>
        <div>
          <h1 className="gradient-text">{board.name}</h1>
          <div className="member-chips">
            {board.members.map((m) => (
              <MemberChip key={m.userId} member={m} />
            ))}
          </div>
        </div>
      </header>

      <div className="board-tabs">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            className={`board-tab blade-${i}${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "games" ? (
        <GamesTab board={board} serverGames={games} />
      ) : tab === "schedule" ? (
        <ScheduleTab board={board} serverSchedule={schedule} />
      ) : (
        <ChatTab messages={messages} onSend={handleSend} />
      )}
    </motion.main>
  );
}
