import { store, updateActiveBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { canEdit } from "../boards/board-model.js";
import { emptyState } from "../../components/empty-state.js";
import { dowShort, dayNum, sessionTimeLabel, formatShortDate } from "../../utils/format.js";
import { openModal, closeModal, showToast } from "../shell/shell.js";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function votesOf(session) {
  return Object.values(session.votes ?? {});
}

function tally(session) {
  const v = votesOf(session);
  return {
    yes: v.filter((x) => x === "yes").length,
    maybe: v.filter((x) => x === "maybe").length,
    no: v.filter((x) => x === "no").length
  };
}

// Consensus score: yes weighed heaviest, maybe partial, no penalised.
function score(session) {
  const t = tally(session);
  return t.yes * 2 + t.maybe - t.no;
}

export function renderSchedule(board) {
  renderHeatmap(board);

  const sessions = [...(board.schedule ?? [])].sort(
    (a, b) => score(b) - score(a) || `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`)
  );

  if (!sessions.length) {
    elements.sessionList.replaceChildren(emptyState("No times proposed yet"));
    return;
  }

  const bestId = score(sessions[0]) > 0 ? sessions[0].id : null;
  elements.sessionList.replaceChildren(...sessions.map((s) => sessionCard(s, s.id === bestId)));
}

function renderHeatmap(board) {
  const intensity = new Array(7).fill(0);
  (board.schedule ?? []).forEach((s) => {
    if (!s.date) return;
    const d = new Date(`${s.date}T00:00`).getDay();
    intensity[d] += 1 + tally(s).yes;
  });
  const max = Math.max(1, ...intensity);
  let bestDay = -1;
  intensity.forEach((v, i) => {
    if (v > (intensity[bestDay] ?? -1)) bestDay = i;
  });

  elements.heatmap.replaceChildren(
    ...DAY_LABELS.map((label, i) => {
      const col = document.createElement("div");
      col.className = "heat-day";
      const cell = document.createElement("div");
      cell.className = "heat-cell";
      const ratio = intensity[i] / max;
      cell.style.background = intensity[i]
        ? `rgba(124, 92, 255, ${0.15 + ratio * 0.6})`
        : "rgba(255,255,255,0.03)";
      cell.style.borderColor = i === bestDay && intensity[i] ? "rgba(124,92,255,0.6)" : "transparent";
      const num = document.createElement("span");
      num.textContent = intensity[i] ? String(intensity[i]) : "";
      num.style.color = ratio > 0.5 ? "#fff" : "#8b8da3";
      cell.append(num);
      const lbl = document.createElement("div");
      lbl.className = "heat-label";
      lbl.textContent = label;
      col.append(cell, lbl);
      return col;
    })
  );

  elements.bestDayLabel.textContent =
    bestDay >= 0 && intensity[bestDay] ? `${DAY_LABELS[bestDay]} looks strongest.` : "";
}

function sessionCard(session, isBest) {
  const card = document.createElement("div");
  card.className = `session-card${isBest ? " best" : ""}`;

  if (isBest) {
    const badge = document.createElement("span");
    badge.className = "session-badge";
    badge.textContent = "★ TOP CONSENSUS";
    card.append(badge);
  }

  const row = document.createElement("div");
  row.className = "session-row";

  const when = document.createElement("div");
  when.className = "session-when";
  const date = document.createElement("div");
  date.className = "session-date";
  const dow = document.createElement("div");
  dow.className = "dow";
  dow.textContent = dowShort(session.date);
  const day = document.createElement("div");
  day.className = "day";
  day.textContent = dayNum(session.date);
  date.append(dow, day);
  const detail = document.createElement("div");
  const time = document.createElement("div");
  time.className = "session-time";
  time.textContent = sessionTimeLabel(session.start, session.end);
  const label = document.createElement("div");
  label.className = "session-label";
  label.textContent = session.activity || "Game night";
  detail.append(time, label);
  when.append(date, detail);

  const vote = document.createElement("div");
  vote.className = "session-vote";
  const t = tally(session);
  const total = Math.max(1, t.yes + t.maybe + t.no);
  const tallyBox = document.createElement("div");
  tallyBox.className = "session-tally";
  const txt = document.createElement("div");
  txt.className = "txt";
  txt.textContent = `${t.yes} yes · ${t.maybe} maybe · ${t.no} no`;
  const bar = document.createElement("div");
  bar.className = "tally-bar";
  ["yes", "maybe", "no"].forEach((k) => {
    const seg = document.createElement("div");
    seg.className = k;
    seg.style.width = `${(t[k] / total) * 100}%`;
    bar.append(seg);
  });
  tallyBox.append(txt, bar);

  const buttons = document.createElement("div");
  buttons.className = "session-buttons";
  buttons.append(
    voteBtn(session, "yes", "Yes"),
    voteBtn(session, "maybe", "Maybe"),
    voteBtn(session, "no", "No")
  );
  vote.append(tallyBox, buttons);

  row.append(when, vote);
  card.append(row);

  if (isBest) {
    const confirm = document.createElement("div");
    confirm.className = "session-confirm";
    const note = document.createElement("span");
    note.textContent = `${t.yes} of the crew are in for ${formatShortDate(session.date)}.`;
    const cal = document.createElement("button");
    cal.className = "cal";
    cal.type = "button";
    cal.textContent = "＋ Add to calendar";
    cal.addEventListener("click", () => addToCalendar(session));
    confirm.append(note, cal);
    card.append(confirm);
  }

  return card;
}

function voteBtn(session, kind, label) {
  const btn = document.createElement("button");
  const mine = session.votes?.[store.currentUser?.uid] === kind;
  btn.className = `sv-btn ${kind}${mine ? " on" : ""}`;
  btn.type = "button";
  btn.textContent = label;
  if (canEdit()) btn.addEventListener("click", () => setSessionVote(session.id, kind));
  else btn.disabled = true;
  return btn;
}

function setSessionVote(sessionId, kind) {
  updateActiveBoard((board) => {
    const session = board.schedule.find((s) => s.id === sessionId);
    if (!session) return;
    session.votes = session.votes ?? {};
    const uid = store.currentUser.uid;
    if (session.votes[uid] === kind) delete session.votes[uid];
    else session.votes[uid] = kind;
  });
}

function addToCalendar(session) {
  const fmt = (date, time) => `${date.replace(/-/g, "")}T${(time || "20:00").replace(":", "")}00`;
  const start = fmt(session.date, session.start);
  const end = fmt(session.date, session.end || session.start);
  const url =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(`Huddle: ${session.activity || "Game night"}`)}` +
    `&dates=${start}/${end}`;
  window.open(url, "_blank", "noopener");
}

export function openProposeTime() {
  if (!canEdit()) {
    showToast("You don't have edit access on this board");
    return;
  }
  elements.proposeTimeForm.reset();
  openModal("proposeTime");
  setTimeout(() => elements.ptDate.focus(), 50);
}

export function bindScheduleEvents() {
  elements.proposeTimeButton.addEventListener("click", openProposeTime);

  elements.proposeTimeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    updateActiveBoard((board) => {
      board.schedule.push({
        id: crypto.randomUUID(),
        date: elements.ptDate.value,
        start: elements.ptStart.value,
        end: elements.ptEnd.value,
        activity: elements.ptLabel.value.trim() || "Game night",
        votes: { [store.currentUser.uid]: "yes" }
      });
    });
    closeModal();
    showToast("Time proposed — vote's open");
  });
}
