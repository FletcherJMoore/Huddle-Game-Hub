import { useEffect, useRef, useState } from "react";

import { getMessages, sendMessage, deleteMessage, MOCK } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { FRIENDS, SEED_MESSAGES, SEED_REACTIONS, REACTION_EMOJI } from "../lib/social.js";
import { Avatar } from "./ui.jsx";
import { ChevronLeft, X, MoreHorizontal } from "./icons.jsx";

function timeLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ChatDrawer({ boards, user, activeBoardId, onClose }) {
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState("");
  const [dmMessages, setDmMessages] = useState(SEED_MESSAGES);
  const [reactions, setReactions] = useState(SEED_REACTIONS);
  const [boardMessages, setBoardMessages] = useState([]);
  const [menuFor, setMenuFor] = useState(null); // message key with an open ⋯ dropdown
  const [emojiFor, setEmojiFor] = useState(null); // message key with an open reaction picker
  const [replyingTo, setReplyingTo] = useState(null); // { text }
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  threadRef.current = thread;

  const isBoard = thread?.startsWith("board-");
  const boardId = isBoard ? thread.slice("board-".length) : null;

  const conversations = [
    ...FRIENDS.map((f) => ({ id: `dm-${f.id}`, name: f.name, type: "dm" })),
    ...boards.map((b) => ({ id: `board-${b.id}`, name: b.name, emoji: b.emoji, type: "group" }))
  ];
  const activeConv = conversations.find((c) => c.id === thread);

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

  useEffect(() => {
    if (MOCK) return undefined;
    const socket = getSocket();
    const forActiveThread = () => threadRef.current === `board-${activeBoardId}`;
    const onMessage = (m) => {
      if (forActiveThread()) setBoardMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    };
    const onDelete = ({ id }) => {
      if (forActiveThread()) setBoardMessages((prev) => prev.filter((x) => x.id !== id));
    };
    socket.on("board:message", onMessage);
    socket.on("board:message:delete", onDelete);
    return () => {
      socket.off("board:message", onMessage);
      socket.off("board:message:delete", onDelete);
    };
  }, [activeBoardId]);

  function closeMenus() {
    setMenuFor(null);
    setEmojiFor(null);
  }

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
    closeMenus();
  }

  function startReply(m) {
    setReplyingTo({ text: m.text });
    closeMenus();
    inputRef.current?.focus();
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text).catch(() => {});
    closeMenus();
  }

  // Unsend your own message (the server also enforces authorship for boards).
  async function handleDelete(bubble) {
    closeMenus();
    if (isBoard) {
      setBoardMessages((prev) => prev.filter((m) => m.id !== bubble.id));
      try {
        await deleteMessage(boardId, bubble.id);
      } catch {
        /* best effort — the broadcast keeps other clients in sync */
      }
    } else {
      setDmMessages((prev) => ({ ...prev, [thread]: (prev[thread] || []).filter((_, i) => i !== bubble.dmIndex) }));
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || !thread) return;
    const quote = replyingTo ? `↪ ${replyingTo.text.slice(0, 80)}\n` : "";
    const text = quote + body;
    setDraft("");
    setReplyingTo(null);
    if (isBoard) {
      try {
        const m = await sendMessage(boardId, text);
        setBoardMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      } catch {
        setDraft(body);
      }
    } else {
      setDmMessages((prev) => ({ ...prev, [thread]: [...(prev[thread] || []), { me: true, text, meta: "You · now" }] }));
    }
  }

  const bubbles = !thread
    ? []
    : isBoard
    ? boardMessages.map((m) => ({
        id: m.id,
        me: m.author?.id === user?.id,
        text: m.text,
        meta: `${m.author?.name || "Someone"} · ${timeLabel(m.createdAt)}`,
        reactable: false
      }))
    : (dmMessages[thread] || []).map((m, i) => ({ dmIndex: i, me: m.me, text: m.text, meta: m.meta, reactable: true }));

  return (
    <div className="chat-drawer">
      <div className="chat-head">
        {thread && (
          <button className="modal-close" onClick={() => setThread(null)} aria-label="Back">
            <ChevronLeft size={16} />
          </button>
        )}
        <h2>{thread ? activeConv?.name || "Messages" : "Messages"}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {!thread ? (
        <div className="chat-list">
          {conversations.map((c) => {
            const msgs = c.type === "dm" ? dmMessages[c.id] || [] : [];
            const last = msgs[msgs.length - 1];
            return (
              <button key={c.id} className="chat-row" onClick={() => setThread(c.id)}>
                {c.type === "dm" ? (
                  <Avatar name={c.name} className="md" />
                ) : (
                  <span className="chat-board-tile">{c.emoji || "🎮"}</span>
                )}
                <span className="col">
                  <span className="chat-row-top">
                    <span className="row-name">{c.name}</span>
                    <span className="chat-time">{last ? last.meta.split(" · ")[1] || "" : ""}</span>
                  </span>
                  <span className={`chat-preview${last && !last.me ? " incoming" : ""}`}>
                    {c.type === "dm" ? (last ? last.text : "No messages yet") : "Group chat"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="chat-thread" onClick={closeMenus}>
            {bubbles.map((m, i) => {
              const key = `${thread}:${i}`;
              const rs = m.reactable ? reactions[key] || [] : [];
              return (
                <div key={key} className={`chat-msg-row${m.me ? " me" : ""}`}>
                  <div className="chat-bubble-line">
                    <span
                      className={`chat-bubble${m.me ? " me" : ""}`}
                      onDoubleClick={m.reactable ? () => toggleReaction(key, "❤️") : undefined}
                    >
                      {m.text}
                    </span>
                    <div className={`msg-controls${menuFor === key ? " open" : ""}`} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="msg-more"
                        onClick={() => setMenuFor(menuFor === key ? null : key)}
                        aria-label="Message options"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {menuFor === key && (
                        <div className="msg-menu">
                          <button onClick={() => startReply(m)}>Reply</button>
                          {m.reactable && (
                            <button
                              onClick={() => {
                                setEmojiFor(key);
                                setMenuFor(null);
                              }}
                            >
                              React
                            </button>
                          )}
                          <button onClick={() => copyText(m.text)}>Copy</button>
                          {m.me && (
                            <button className="danger" onClick={() => handleDelete(m)}>
                              Unsend
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {emojiFor === key && (
                    <span className="react-picker" onClick={(e) => e.stopPropagation()}>
                      {REACTION_EMOJI.map((emoji) => (
                        <button key={emoji} onClick={() => toggleReaction(key, emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </span>
                  )}

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
                  <span className="chat-meta">{m.meta}</span>
                </div>
              );
            })}
            {isBoard && bubbles.length === 0 && <div className="chat-empty muted">No messages yet. Say hi to the squad.</div>}
          </div>

          {replyingTo && (
            <div className="reply-bar">
              <span className="reply-quote">Replying to “{replyingTo.text.slice(0, 60)}”</span>
              <button className="modal-close" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="chat-composer">
            <input
              ref={inputRef}
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
