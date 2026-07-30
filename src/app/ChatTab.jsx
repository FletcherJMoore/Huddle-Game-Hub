import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "../auth/AuthProvider.jsx";

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ChatTab({ messages, onSend }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");
    try {
      await onSend(trimmed);
    } catch {
      setText(trimmed); // restore on failure
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-tab">
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-emoji">💬</div>
            <p className="muted">No messages yet. Say hi to the squad.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const mine = m.author?.id === user.id;
              const initial = (m.author?.name || "U").trim().charAt(0).toUpperCase();
              return (
                <motion.div
                  key={m.id}
                  className={`chat-msg${mine ? " mine" : ""}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  {!mine &&
                    (m.author?.photoUrl ? (
                      <img className="avatar avatar-sm" src={m.author.photoUrl} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="avatar avatar-sm avatar-fallback">{initial}</div>
                    ))}
                  <div className="chat-bubble-wrap">
                    {!mine && <span className="chat-author">{m.author?.name || "Someone"}</span>}
                    <div className="chat-bubble">{m.text}</div>
                    <span className="chat-time">{formatTime(m.createdAt)}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the squad…"
          maxLength={2000}
        />
        <button type="submit" className="primary-btn" disabled={!text.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  );
}
