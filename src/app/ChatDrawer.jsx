import { useEffect, useRef, useState } from "react";

import { getMessages, sendMessage, MOCK } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { FRIENDS, SEED_MESSAGES, SEED_REACTIONS, REACTION_EMOJI } from "../lib/social.js";
import { Avatar } from "./ui.jsx";
import { ChevronLeft, X } from "./icons.jsx";

function timeLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ChatDrawer({ boards, user, activeBoardId, onClose }) {
  const [tab, setTab] = useState("dms");
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState("");
  // DMs have no backend yet, so they live in local state.
  const [dmMessages, setDmMessages] = useState(SEED_MESSAGES);
  const [reactions, setReactions] = useState(SEED_REACTIONS);
  const [picker, setPicker] = useState(null);
  // Board chat is realtime (REST history + socket board:message).
  const [boardMessages, setBoardMessages] = useState([]);
  const holdTimer = useRef(null);
  const threadRef = useRef(null);
  threadRef.current = thread;

  const isBoard = thread?.startsWith("board-");
  const boardId = isBoard ? thread.slice("board-".length) : null;

  const threadSources =
    tab === "dms"
      ? FRIENDS.map((f) => ({ id: `dm-${f.id}`, name: f.name }))
      : boards.map((b) => ({ id: `board-${b.id}`, name: b.name, emoji: b.emoji }));

  const threadName =
    tab === "dms"
      ? FRIENDS.find((f) => `dm-${f.id}` === thread)?.name
      : boards.find((b) => `board-${b.id}` === thread)?.name;

  // Load history when a board thread opens.
  useEffect(() => {
    if (!isBoard) return;
    let alive = true;
    getMessages(boardId)
      .then((m) => alive && setBoardMessages(m))
      .catch(() => alive && setBoardMessages([]));
    return () => {
      alive = false;
    };
  }, [thread]);

  // Live incoming board messages. The socket is joined to the active board's
  // room by BoardView, so messages that arrive are for that board.
  useEffect(() => {
    if (MOCK) return undefined;
    const socket = getSocket();
    const onMessage = (m) => {
      if (threadRef.current === `board-${activeBoardId}`) {
        setBoardMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    };
    socket.on("board:message", onMessage);
    return () => socket.off("board:message", onMessage);
  }, [activeBoardId]);

  function toggleReaction(key, emoji) {
    setReactions((prev) => {
      const list = (prev[key] || []).slice();
      const i = list.findIndex((r) => r.emoji === emoji);
      if (i === -1) list.push({ emoji, count: 1, mine: true });
      else if (list[i].mine) {
        if (list[i].count <= 1) list.splice(i, 1);
        else list[i] = { ...list[i], count: list[i].count - 1, mine: false };
      } else list[i] = { ...list[i], count: list[i].count + 1, mine: true };
      return { ...prev, [key]: list };
    });
    setPicker(null);
  }

  const startHold = (key) => () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setPicker(key), 420);
  };
  const endHold = () => clearTimeout(holdTimer.current);

  async function send() {
    const text = draft.trim();
    if (!text || !thread) return;
    setDraft("");
    if (isBoard) {
      try {
        const m = await sendMessage(boardId, text);
        setBoardMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      } catch {
        setDraft(text); // restore on failure
      }
    } else {
      setDmMessages((prev) => ({ ...prev, [thread]: [...(prev[thread] || []), { me: true, text, meta: "You · now" }] }));
    }
  }

  // Normalize both shapes to a common bubble descriptor for rendering.
  const bubbles = !thread
    ? []
    : isBoard
    ? boardMessages.map((m) => ({
        me: m.author?.id === user?.id,
        text: m.text,
        meta: `${m.author?.name || "Someone"} · ${timeLabel(m.createdAt)}`,
        reactable: false
      }))
    : (dmMessages[thread] || []).map((m) => ({ me: m.me, text: m.text, meta: m.meta, reactable: true }));

  return (
    <div className="chat-drawer">
      <div className="chat-head">
        {thread && (
          <button className="modal-close" onClick={() => setThread(null)} aria-label="Back">
            <ChevronLeft size={16} />
          </button>
        )}
        <h2>{thread ? threadName || "Messages" : "Messages"}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {!thread ? (
        <div className="chat-list">
          <div className="segmented-2 chat-seg">
            <button className={tab === "dms" ? "seg-on" : ""} onClick={() => setTab("dms")}>
              Direct
            </button>
            <button className={tab === "boards" ? "seg-on" : ""} onClick={() => setTab("boards")}>
              Boards
            </button>
          </div>
          {threadSources.map((t) => {
            const msgs = tab === "dms" ? dmMessages[t.id] || [] : [];
            const last = msgs[msgs.length - 1];
            return (
              <button key={t.id} className="chat-row" onClick={() => setThread(t.id)}>
                {tab === "dms" ? (
                  <Avatar name={t.name} className="md" />
                ) : (
                  <span className="chat-board-tile">{t.emoji || "🎮"}</span>
                )}
                <span className="col">
                  <span className="chat-row-top">
                    <span className="row-name">{t.name}</span>
                    <span className="chat-time">{last ? last.meta.split(" · ")[1] || "" : ""}</span>
                  </span>
                  <span className={`chat-preview${last && !last.me ? " incoming" : ""}`}>
                    {tab === "dms" ? (last ? last.text : "No messages yet") : "Open board chat"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="chat-thread" onClick={() => setPicker(null)}>
            {bubbles.map((m, i) => {
              const key = `${thread}:${i}`;
              const rs = m.reactable ? reactions[key] || [] : [];
              return (
                <div key={key} className={`chat-msg-row${m.me ? " me" : ""}`}>
                  <span
                    className={`chat-bubble${m.me ? " me" : ""}`}
                    onDoubleClick={m.reactable ? () => toggleReaction(key, "❤️") : undefined}
                    onMouseDown={m.reactable ? startHold(key) : undefined}
                    onMouseUp={endHold}
                    onMouseLeave={endHold}
                    onTouchStart={m.reactable ? startHold(key) : undefined}
                    onTouchEnd={endHold}
                  >
                    {m.text}
                  </span>
                  {rs.length > 0 && (
                    <span className="react-row">
                      {rs.map((r) => (
                        <button
                          key={r.emoji}
                          className={`react-chip${r.mine ? " mine" : ""}`}
                          onClick={() => toggleReaction(key, r.emoji)}
                        >
                          {r.count > 1 ? `${r.emoji} ${r.count}` : r.emoji}
                        </button>
                      ))}
                    </span>
                  )}
                  {picker === key && (
                    <span className="react-picker" onClick={(e) => e.stopPropagation()}>
                      {REACTION_EMOJI.map((emoji) => (
                        <button key={emoji} onClick={() => toggleReaction(key, emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </span>
                  )}
                  <span className="chat-meta">{m.meta}</span>
                </div>
              );
            })}
            {isBoard && bubbles.length === 0 && <div className="chat-empty muted">No messages yet. Say hi to the squad.</div>}
          </div>
          <div className="chat-composer">
            <input
              className="text-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message"
            />
            <button className="primary-btn" onClick={send}>
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
