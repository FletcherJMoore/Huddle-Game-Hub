import { useState } from "react";
import { motion } from "framer-motion";

import { createSession } from "../lib/api.js";

export default function ProposeSessionModal({ boardId, onClose, onAdded }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("22:00");
  const [activity, setActivity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!date || busy) return;
    setBusy(true);
    setError("");
    try {
      onAdded(await createSession(boardId, { date, start, end, activity: activity.trim() }));
    } catch (err) {
      setError(err.message || "Couldn't create the night.");
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
    >
      <motion.form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        <h2>Propose a night</h2>

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Start</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>End</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>Activity (optional)</span>
          <input
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="Game night, tournament…"
            maxLength={120}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={busy || !date}>
            {busy ? "Creating…" : "Create night"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
