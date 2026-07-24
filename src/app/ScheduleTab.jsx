import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "../auth/AuthProvider.jsx";
import { rsvpSession, removeSession } from "../lib/api.js";
import { rsvpCounts, myRsvp, sortSessions, isPast, formatSessionDate, formatTimeRange } from "../lib/schedule.js";
import ProposeSessionModal from "./ProposeSessionModal.jsx";

const RSVP_OPTIONS = [
  { key: "in", label: "In" },
  { key: "maybe", label: "Maybe" },
  { key: "out", label: "Out" }
];

function SessionCard({ session, mine, canRemove, onRsvp, onRemove }) {
  const counts = rsvpCounts(session);
  return (
    <motion.li
      layout
      className={`session-card${isPast(session) ? " past" : ""}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ layout: { type: "spring", stiffness: 520, damping: 42 }, duration: 0.2 }}
    >
      <div className="session-when">
        <span className="session-date">{formatSessionDate(session.date)}</span>
        {session.start && <span className="session-time">{formatTimeRange(session.start, session.end)}</span>}
      </div>

      <div className="session-body">
        {session.activity && <p className="session-activity">{session.activity}</p>}
        <div className="rsvp-row">
          {RSVP_OPTIONS.map((o) => (
            <button
              key={o.key}
              className={`rsvp-btn ${o.key}${mine === o.key ? " active" : ""}`}
              onClick={() => onRsvp(session.id, o.key)}
            >
              {o.label}
            </button>
          ))}
          <span className="rsvp-counts">
            {counts.in} in{counts.maybe ? ` · ${counts.maybe} maybe` : ""}
          </span>
        </div>
      </div>

      {canRemove && (
        <button className="session-remove" onClick={() => onRemove(session.id)} aria-label="Remove night">
          ×
        </button>
      )}
    </motion.li>
  );
}

export default function ScheduleTab({ board }) {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState(board.content?.schedule ?? []);
  const [proposing, setProposing] = useState(false);

  const canManage = board.role === "owner" || board.role === "editor";
  const sorted = useMemo(() => sortSessions(schedule), [schedule]);

  async function handleRsvp(sessionId, rsvp) {
    const session = schedule.find((s) => s.id === sessionId);
    const next = myRsvp(session, user.id) === rsvp ? null : rsvp;

    setSchedule((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const rsvps = { ...(s.rsvps ?? {}) };
        if (next === null) delete rsvps[user.id];
        else rsvps[user.id] = next;
        return { ...s, rsvps };
      })
    );

    try {
      setSchedule(await rsvpSession(board.id, sessionId, next));
    } catch {
      /* keep optimistic */
    }
  }

  async function handleRemove(sessionId) {
    try {
      setSchedule(await removeSession(board.id, sessionId));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="schedule-tab">
      <div className="games-head">
        <span className="muted">
          {schedule.length} {schedule.length === 1 ? "night" : "nights"} planned
        </span>
        <button className="primary-btn" onClick={() => setProposing(true)}>
          + Propose a night
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">📅</div>
          <h2>Nothing planned yet</h2>
          <p className="muted">Propose a night and rally the crew.</p>
          <button className="primary-btn" onClick={() => setProposing(true)}>
            + Propose a night
          </button>
        </div>
      ) : (
        <motion.ul className="session-list" layout>
          <AnimatePresence initial={false}>
            {sorted.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                mine={myRsvp(s, user.id)}
                canRemove={s.createdBy === user.id || canManage}
                onRsvp={handleRsvp}
                onRemove={handleRemove}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <AnimatePresence>
        {proposing && (
          <ProposeSessionModal
            boardId={board.id}
            onClose={() => setProposing(false)}
            onAdded={(updated) => {
              setSchedule(updated);
              setProposing(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
