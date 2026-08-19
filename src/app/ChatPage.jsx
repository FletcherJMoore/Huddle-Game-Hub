import { useEffect, useRef, useState } from "react";

import {
  getMessages,
  sendMessage,
  deleteMessage,
  listDmThreads,
  listDmContacts,
  getDmMessages,
  sendDm,
  deleteDm,
  MOCK
} from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { SEED_REACTIONS, REACTION_EMOJI } from "../lib/social.js";
import { Avatar } from "./ui.jsx";
import { ChevronLeft, MoreHorizontal, MessageCircleMore, Plus, X } from "./icons.jsx";

function timeLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Conversations the user has removed from their list, remembered across reloads.
const REMOVED_KEY = "huddle.removedChats";
function loadRemoved() {
  try {
    return new Set(JSON.parse(localStorage.getItem(REMOVED_KEY)) || []);
  } catch {
    return new Set();
  }
}

// Instagram-style Messages page: a conversation list on the left, the open
// thread on the right. Direct messages (1:1) and board/group chats share one
// list; DMs are real and delivered live, group chats ride the board room.
export default function ChatPage({ boards, user, activeBoardId }) {
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState("");
  const [dmThreads, setDmThreads] = useState([]);
  const [dmContacts, setDmContacts] = useState([]);
  const [dmMessages, setDmMessages] = useState({}); // userId -> messages[]
  const [boardMessages, setBoardMessages] = useState([]);
  const [reactions, setReactions] = useState(SEED_REACTIONS);
  const [menuFor, setMenuFor] = useState(null);
  const [emojiFor, setEmojiFor] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [removed, setRemoved] = useState(loadRemoved);
  const [newOpen, setNewOpen] = useState(false);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  threadRef.current = thread;

  const isBoard = thread?.startsWith("board-");
  const isDm = thread?.startsWith("dm-");
  const boardId = isBoard ? thread.slice("board-".length) : null;
  const dmUserId = isDm ? thread.slice("dm-".length) : null;

  // Load the DM conversation list and contact directory once when the page opens.
  useEffect(() => {
    let alive = true;
    listDmThreads().then((t) => alive && setDmThreads(t)).catch(() => {});
    listDmContacts().then((c) => alive && setDmContacts(c)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Anyone the user can talk to, by id — merges existing threads and contacts so
  // an open thread always has a name/avatar even before its first message.
  const directory = new Map();
  [...dmThreads, ...dmContacts].forEach((p) => directory.set(p.userId, { name: p.name, photoUrl: p.photoUrl }));

  const dmConvs = dmThreads.map((t) => ({
    id: `dm-${t.userId}`,
    userId: t.userId,
    name: t.name,
    photoUrl: t.photoUrl,
    type: "dm",
    preview: t.lastMessage,
    time: t.lastAt,
    incoming: !t.lastFromMe
  }));
  // Keep a freshly-started DM visible in the list before any message is sent.
  if (isDm && !dmThreads.some((t) => t.userId === dmUserId)) {
    const p = directory.get(dmUserId);
    dmConvs.unshift({ id: thread, userId: dmUserId, name: p?.name || "New message", photoUrl: p?.photoUrl, type: "dm", preview: "", time: null, incoming: false });
  }
  const conversations = [
    ...dmConvs,
    ...boards.map((b) => ({ id: `board-${b.id}`, name: b.name, emoji: b.emoji, type: "group" }))
  ].filter((c) => !removed.has(c.id));

  const activeConv =
    conversations.find((c) => c.id === thread) ||
    (isDm ? { type: "dm", name: directory.get(dmUserId)?.name || "Message", photoUrl: directory.get(dmUserId)?.photoUrl } : null);

  // Load the open board's message history.
  useEffect(() => {
    if (!isBoard) return undefined;
    let alive = true;
    getMessages(boardId)
      .then((m) => alive && setBoardMessages(m))
      .catch(() => alive && setBoardMessages([]));
    return () => {
      alive = false;
    };
  }, [thread]);

  // Load the open DM's history (once per partner).
  useEffect(() => {
    if (!isDm || dmMessages[dmUserId]) return undefined;
    let alive = true;
    getDmMessages(dmUserId)
      .then((m) => alive && setDmMessages((prev) => ({ ...prev, [dmUserId]: m })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [thread]);

  // Live board messages for the active board.
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

  // Live direct messages — delivered to this user's personal room.
  useEffect(() => {
    if (MOCK) return undefined;
    const socket = getSocket();
    const onDm = ({ from, to, message }) => {
      const partner = from === user?.id ? to : from;
      setDmMessages((prev) => {
        const list = prev[partner] || [];
        if (list.some((m) => m.id === message.id)) return prev;
        return { ...prev, [partner]: [...list, message] };
      });
      bumpThread(partner, message, from === user?.id);
    };
    const onDmDelete = ({ from, to, id }) => {
      const partner = from === user?.id ? to : from;
      setDmMessages((prev) => (prev[partner] ? { ...prev, [partner]: prev[partner].filter((m) => m.id !== id) } : prev));
    };
    socket.on("dm:message", onDm);
    socket.on("dm:message:delete", onDmDelete);
    return () => {
      socket.off("dm:message", onDm);
      socket.off("dm:message:delete", onDmDelete);
    };
  }, [user?.id]);

  // Move a partner to the top of the DM list with the latest message (adding the
  // thread if it's brand new), resolving their name/avatar from the directory.
  function bumpThread(partner, message, fromMe) {
    setDmThreads((prev) => {
      const who = directory.get(partner) || prev.find((t) => t.userId === partner) || { name: message.author?.name, photoUrl: message.author?.photoUrl };
      const rest = prev.filter((t) => t.userId !== partner);
      return [
        { userId: partner, name: who.name, photoUrl: who.photoUrl, lastMessage: message.text, lastAt: message.createdAt, lastFromMe: fromMe },
        ...rest
      ];
    });
  }

  function closeMenus() {
    setMenuFor(null);
    setEmojiFor(null);
  }

  function removeConversation(id) {
    setRemoved((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(REMOVED_KEY, JSON.stringify([...next]));
      } catch {
        /* non-fatal — it just won't persist across reloads */
      }
      return next;
    });
    if (threadRef.current === id) setThread(null);
  }

  function openDm(userId) {
    setNewOpen(false);
    setRemoved((prev) => {
      if (!prev.has(`dm-${userId}`)) return prev;
      const next = new Set(prev);
      next.delete(`dm-${userId}`);
      try {
        localStorage.setItem(REMOVED_KEY, JSON.stringify([...next]));
      } catch {
        /* non-fatal */
      }
      return next;
    });
    setThread(`dm-${userId}`);
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

  async function handleDelete(bubble) {
    closeMenus();
    if (isBoard) {
      setBoardMessages((prev) => prev.filter((m) => m.id !== bubble.id));
      try {
        await deleteMessage(boardId, bubble.id);
      } catch {
        /* best effort — the broadcast keeps other clients in sync */
      }
    } else if (isDm) {
      setDmMessages((prev) => ({ ...prev, [dmUserId]: (prev[dmUserId] || []).filter((m) => m.id !== bubble.id) }));
      try {
        await deleteDm(dmUserId, bubble.id);
      } catch {
        /* best effort */
      }
    }
  }

  async function send() {
    const bodyText = draft.trim();
    if (!bodyText || !thread) return;
    const quote = replyingTo ? `↪ ${replyingTo.text.slice(0, 80)}\n` : "";
    const text = quote + bodyText;
    setDraft("");
    setReplyingTo(null);
    if (isBoard) {
      try {
        const m = await sendMessage(boardId, text);
        setBoardMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      } catch {
        setDraft(bodyText);
      }
    } else if (isDm) {
      try {
        const m = await sendDm(dmUserId, text);
        setDmMessages((prev) => ({
          ...prev,
          [dmUserId]: (prev[dmUserId] || []).some((x) => x.id === m.id) ? prev[dmUserId] : [...(prev[dmUserId] || []), m]
        }));
        bumpThread(dmUserId, m, true);
      } catch {
        setDraft(bodyText);
      }
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
    : (dmMessages[dmUserId] || []).map((m) => ({
        id: m.id,
        me: m.author?.id === user?.id,
        text: m.text,
        meta: `${m.author?.id === user?.id ? "You" : m.author?.name || "Them"} · ${timeLabel(m.createdAt)}`,
        reactable: true
      }));

  return (
    <div className={`chat-page${thread ? " has-thread" : ""}`}>
      <div className="chat-pane-list">
        <div className="chat-list-head">
          <h2>Messages</h2>
          <div className="new-dm-wrap">
            <button className="new-dm-btn" onClick={() => setNewOpen((o) => !o)} aria-label="New message" title="New message">
              <Plus size={18} />
            </button>
            {newOpen && (
              <>
                <div className="add-board-backdrop" onClick={() => setNewOpen(false)} />
                <div className="new-dm-menu">
                  <div className="eyebrow">NEW MESSAGE</div>
                  {dmContacts.length === 0 ? (
                    <span className="hint">No one to message yet — join a board with other members.</span>
                  ) : (
                    dmContacts.map((c) => (
                      <button key={c.userId} className="switcher-row" onClick={() => openDm(c.userId)}>
                        <Avatar name={c.name} photoUrl={c.photoUrl} className="sm" />
                        <span className="switcher-name">{c.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="chat-list">
          {conversations.length === 0 && <div className="chat-empty muted">No conversations.</div>}
          {conversations.map((c) => (
            <div key={c.id} className="chat-row-wrap">
              <button className={`chat-row${thread === c.id ? " active" : ""}`} onClick={() => setThread(c.id)}>
                {c.type === "dm" ? (
                  <Avatar name={c.name} photoUrl={c.photoUrl} className="md" />
                ) : (
                  <span className="chat-board-tile">{c.emoji || "🎮"}</span>
                )}
                <span className="col">
                  <span className="chat-row-top">
                    <span className="row-name">{c.name}</span>
                    <span className="chat-time">{c.type === "dm" && c.time ? timeLabel(c.time) : ""}</span>
                  </span>
                  <span className={`chat-preview${c.type === "dm" && c.incoming ? " incoming" : ""}`}>
                    {c.type === "dm" ? c.preview || "No messages yet" : "Group chat"}
                  </span>
                </span>
              </button>
              <button
                className="chat-row-remove"
                onClick={() => removeConversation(c.id)}
                aria-label={`Remove ${c.name} from your chats`}
                title="Remove from list"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-pane-thread">
        {!thread ? (
          <div className="chat-empty-pane">
            <MessageCircleMore size={56} />
            <h3>Your messages</h3>
            <p className="muted">Select a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="chat-thread-head">
              <button className="modal-close chat-back" onClick={() => setThread(null)} aria-label="Back">
                <ChevronLeft size={18} />
              </button>
              {activeConv?.type === "group" ? (
                <span className="chat-board-tile sm">{activeConv.emoji || "🎮"}</span>
              ) : (
                <Avatar name={activeConv?.name || "?"} photoUrl={activeConv?.photoUrl} className="sm" />
              )}
              <h2>{activeConv?.name || "Messages"}</h2>
            </div>

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
              {bubbles.length === 0 && (
                <div className="chat-empty muted">
                  {isBoard ? "No messages yet. Say hi to the squad." : "No messages yet. Say hi 👋"}
                </div>
              )}
            </div>

            {replyingTo && (
              <div className="reply-bar">
                <span className="reply-quote">Replying to “{replyingTo.text.slice(0, 60)}”</span>
                <button className="modal-close" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
                  <ChevronLeft size={14} />
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
    </div>
  );
}
