import { useState } from "react";

import { rsvpCounts, myRsvp } from "../lib/schedule.js";
import { Clock, Users, Gamepad2, MapPin, ChevronLeft, ChevronRight, ChevronDown, X } from "./icons.jsx";

const START_HOUR = 8;
const END_HOUR = 24;
const ROW_H = 46;
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const addDays = (date, k) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + k);
const sameDay = (d, e) => d.getFullYear() === e.getFullYear() && d.getMonth() === e.getMonth() && d.getDate() === e.getDate();
const pad = (n) => String(n).padStart(2, "0");
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseHM = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
};
const toHM = (f) => `${pad(Math.floor(f) % 24)}:${pad(Math.round((f - Math.floor(f)) * 60))}`;

function hourLabel(h) {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 === 0 ? 12 : hh % 12} ${hh >= 12 ? "PM" : "AM"}`;
}
function tLabel(h) {
  const hh = Math.floor(h) % 24;
  const mins = Math.round((h - Math.floor(h)) * 60);
  const disp = hh % 12 === 0 ? 12 : hh % 12;
  const ap = hh >= 12 && hh < 24 ? "pm" : "am";
  return mins ? `${disp}:${pad(mins)}${ap}` : `${disp}${ap}`;
}

// Map persisted sessions (+ ephemeral suggested times) to calendar events.
function toEvent(s) {
  const start = parseHM(s.start) ?? 20;
  return {
    id: s.id,
    date: s.date,
    start,
    end: parseHM(s.end) ?? start + 2,
    title: s.activity || "Game night",
    going: rsvpCounts(s).in,
    session: s
  };
}

export default function Calendar({ board, games, schedule, user, onCreate, onRsvp }) {
  const [view, setView] = useState("week");
  const [offset, setOffset] = useState(0);
  const [viewMenu, setViewMenu] = useState(false);
  const [pending, setPending] = useState([]); // suggested (dashed) times, not persisted
  const [slot, setSlot] = useState(null);

  const today = new Date();
  const events = [...schedule.map(toEvent), ...pending];
  const eventsOn = (d) => events.filter((e) => e.date === dateStr(d));

  const openSlot = (date, hour) =>
    setSlot({ date: dateStr(date), start: hour, end: hour + 2, title: "", gameId: "", place: "", email: "" });
  const openEvent = (ev) =>
    setSlot({ date: ev.date, start: ev.start, end: ev.end, eventId: ev.id, going: ev.going, title: ev.title, session: ev.session });

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  // Range label + the set of day columns to render.
  let label = "";
  let days = [];
  if (view === "month") {
    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    label = `${MONTHS[first.getMonth()]} ${first.getFullYear()}`;
  } else if (view === "day") {
    const d = addDays(today, offset);
    label = `${DOW_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    days = [d];
  } else {
    const weekStart = addDays(addDays(today, -today.getDay()), offset * 7);
    const weekEnd = addDays(weekStart, 6);
    label =
      weekStart.getMonth() === weekEnd.getMonth()
        ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
        : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
    days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }

  return (
    <div>
      <div className="cal-bar">
        <div className="cal-bar-left">
          <button className="ghost-btn" onClick={() => setOffset(0)}>
            Today
          </button>
          <button className="icon-btn" onClick={() => setOffset((o) => o - 1)} aria-label="Previous">
            <ChevronLeft size={15} />
          </button>
          <button className="icon-btn" onClick={() => setOffset((o) => o + 1)} aria-label="Next">
            <ChevronRight size={15} />
          </button>
          <h2 className="cal-label">{label}</h2>
        </div>
        <div className="cal-view-wrap">
          <button className="cal-view-btn" onClick={() => setViewMenu((v) => !v)}>
            <span>{view === "day" ? "Day" : view === "month" ? "Month" : "Week"}</span>
            <ChevronDown size={13} />
          </button>
          {viewMenu && (
            <div className="cal-view-menu">
              {["day", "week", "month"].map((v) => (
                <button
                  key={v}
                  className={v === view ? "on" : ""}
                  onClick={() => {
                    setView(v);
                    setOffset(0);
                    setViewMenu(false);
                  }}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid today={today} offset={offset} eventsOn={eventsOn} onOpenSlot={openSlot} onOpenEvent={openEvent} />
      ) : (
        <div className="cal-card">
          <div className="cal-head-row">
            <div className="cal-gutter-head" />
            {days.map((d) => (
              <div key={d} className="cal-day-head">
                <span className="cal-dow">{DOW[d.getDay()]}</span>
                <span className={`cal-daynum${sameDay(d, today) ? " today" : ""}`}>{d.getDate()}</span>
              </div>
            ))}
          </div>
          <div className="cal-scroll">
            <div className="cal-grid">
              <div className="cal-gutter">
                {hours.map((h) => (
                  <div key={h} className="cal-hour-label">
                    {hourLabel(h)}
                  </div>
                ))}
              </div>
              {days.map((d) => (
                <div key={d} className="cal-day-col" style={{ height: hours.length * ROW_H }}>
                  {hours.map((h) => (
                    <button key={h} className="cal-slot" style={{ height: ROW_H }} onClick={() => openSlot(d, h)} aria-label="Add" />
                  ))}
                  {eventsOn(d).map((ev) => (
                    <button
                      key={ev.id}
                      className={`cal-event${ev.pending ? " pending" : ""}`}
                      style={{ top: (ev.start - START_HOUR) * ROW_H, height: (ev.end - ev.start) * ROW_H - 4 }}
                      onClick={() => (ev.pending ? null : openEvent(ev))}
                    >
                      <span className="cal-ev-title">{ev.title}</span>
                      <span className="cal-ev-time">
                        {tLabel(ev.start)} – {tLabel(ev.end)}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {slot && (
        <BookingModal
          slot={slot}
          board={board}
          games={games}
          user={user}
          onClose={() => setSlot(null)}
          onBook={() => {
            if (slot.eventId) {
              onRsvp(slot.eventId, "in");
            } else {
              const game = games.find((g) => g.id === slot.gameId);
              onCreate({
                date: slot.date,
                start: toHM(slot.start),
                end: toHM(slot.end),
                activity: slot.title.trim() || game?.title || "Game night",
                gameId: slot.gameId || null
              });
            }
            setSlot(null);
          }}
          onSuggest={() => {
            const game = games.find((g) => g.id === slot.gameId);
            setPending((p) => [
              ...p,
              { id: `p${p.length + 1}`, date: slot.date, start: slot.start, end: slot.end, title: slot.title.trim() || game?.title || "Suggested time", pending: true }
            ]);
            setSlot(null);
          }}
          onRsvpOut={() => {
            if (slot.eventId) onRsvp(slot.eventId, "out");
            setSlot(null);
          }}
          onChange={(patch) => setSlot((s) => ({ ...s, ...patch }))}
        />
      )}
    </div>
  );
}

function MonthGrid({ today, offset, eventsOn, onOpenSlot, onOpenEvent }) {
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const gridStart = addDays(first, -first.getDay());
  const cells = Array.from({ length: 35 }, (_, i) => addDays(gridStart, i));
  return (
    <div className="cal-card">
      <div className="cal-month-head">
        {DOW.map((d) => (
          <div key={d} className="cal-dow-cell">
            {d}
          </div>
        ))}
      </div>
      <div className="cal-month-grid">
        {cells.map((d) => {
          const inMonth = d.getMonth() === first.getMonth();
          return (
            <button key={d} className={`cal-month-cell${inMonth ? "" : " out"}`} onClick={() => onOpenSlot(d, 20)}>
              <span className={`cal-month-num${sameDay(d, today) ? " today" : ""}`}>{d.getDate()}</span>
              {eventsOn(d).map((ev) => (
                <span
                  key={ev.id}
                  className={`cal-month-chip${ev.pending ? " pending" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!ev.pending) onOpenEvent(ev);
                  }}
                >
                  {tLabel(ev.start)} {ev.title}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BookingModal({ slot, board, games, onClose, onBook, onSuggest, onRsvpOut, onChange }) {
  const isNew = !slot.eventId;
  const going = slot.eventId ? slot.going || 0 : 1;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="booking-card" onClick={(e) => e.stopPropagation()}>
        <div className="booking-head">
          {isNew ? (
            <input
              className="booking-title-input"
              value={slot.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Add a game night title"
              autoFocus
            />
          ) : (
            <h2>{slot.title}</h2>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="booking-body">
          <div className="booking-line">
            <span className="booking-icon">
              <Clock size={17} />
            </span>
            <span className="col">
              <span className="field-label">{slot.date}</span>
              <span className="hint">
                {tLabel(slot.start)} – {tLabel(slot.end)}
              </span>
            </span>
          </div>

          <div className="booking-line">
            <span className="booking-icon">
              <Users size={17} />
            </span>
            <span className="col">
              <span className="field-label">
                {slot.eventId ? `${going} going of ${board.members.length}` : `Invite all ${board.members.length} members`}
              </span>
              <span className="hint">Everyone on {board.name} gets a notification.</span>
            </span>
          </div>

          {isNew && (
            <>
              <div className="booking-line">
                <span className="booking-icon">
                  <Gamepad2 size={17} />
                </span>
                <span className="col">
                  <span className="field-label">Game</span>
                  <select className="select-input" value={slot.gameId} onChange={(e) => onChange({ gameId: e.target.value })}>
                    <option value="">Pick a game</option>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </span>
              </div>

              <div className="booking-line">
                <span className="booking-icon">
                  <MapPin size={17} />
                </span>
                <span className="col">
                  <span className="field-label">Meeting place</span>
                  <input
                    className="text-input"
                    value={slot.place}
                    onChange={(e) => onChange({ place: e.target.value })}
                    placeholder="e.g. Jordan's apartment or Discord"
                  />
                </span>
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          {isNew ? (
            <button className="ghost-btn" onClick={onSuggest}>
              Suggest a time
            </button>
          ) : (
            <button className="ghost-btn" onClick={onRsvpOut}>
              Can't make it
            </button>
          )}
          <button className="primary-btn" onClick={onBook}>
            {slot.eventId ? "I'm in" : "Book it"}
          </button>
        </div>
      </div>
    </div>
  );
}
