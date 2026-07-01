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
      const ratio = intensity[i] / max;
      const isBest = i === bestDay && intensity[i];

      const col = document.createElement("div");
      col.style.cssText = "flex:1;text-align:center;";
      const cell = document.createElement("div");
      cell.style.cssText = `height:64px;border-radius:8px;background:${
        intensity[i] ? `rgba(124,92,255,${0.15 + ratio * 0.6})` : "rgba(255,255,255,0.03)"
      };border:1px solid ${isBest ? "rgba(124,92,255,0.6)" : "transparent"};display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;`;
      const num = document.createElement("span");
      num.style.cssText = `font-size:11px;font-weight:700;color:${ratio > 0.5 ? "#fff" : "#8b8da3"};`;
      num.textContent = intensity[i] ? String(intensity[i]) : "";
      cell.append(num);
      const lbl = document.createElement("div");
      lbl.style.cssText = "font-size:11px;color:#8b8da3;margin-top:6px;font-weight:600;";
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
  card.style.cssText = `background:#13141d;border:1px solid ${isBest ? "#56d36450" : "#23253560"};border-radius:14px;padding:16px 18px;position:relative;`;

  if (isBest) {
    const badge = document.createElement("span");
    badge.style.cssText =
      "position:absolute;top:-9px;left:16px;background:#56d364;color:#0b0c12;font-size:10.5px;font-weight:800;letter-spacing:.04em;padding:3px 9px;border-radius:999px;";
    badge.textContent = "★ TOP CONSENSUS";
    card.append(badge);
  }

  const row = document.createElement("div");
  row.style.cssText = "display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;";

  const left = document.createElement("div");
  left.style.cssText = "display:flex;align-items:center;gap:14px;";
  const dateBox = document.createElement("div");
  dateBox.style.cssText = "text-align:center;background:#0b0c12;border-radius:11px;padding:8px 13px;min-width:58px;";
  const dow = document.createElement("div");
  dow.style.cssText = "font-size:11px;font-weight:700;color:var(--accent,#7c5cff);text-transform:uppercase;letter-spacing:.05em;";
  dow.textContent = dowShort(session.date);
  const day = document.createElement("div");
  day.style.cssText = "font-family:'Space Grotesk';font-weight:700;font-size:19px;line-height:1;margin-top:2px;";
  day.textContent = dayNum(session.date);
  dateBox.append(dow, day);
  const detail = document.createElement("div");
  const time = document.createElement("div");
  time.style.cssText = "font-weight:700;font-size:15.5px;";
  time.textContent = sessionTimeLabel(session.start, session.end);
  const label = document.createElement("div");
  label.style.cssText = "font-size:12px;color:#8b8da3;margin-top:3px;";
  label.textContent = session.activity || "Game night";
  detail.append(time, label);
  left.append(dateBox, detail);

  const right = document.createElement("div");
  right.style.cssText = "display:flex;align-items:center;gap:16px;";
  const t = tally(session);
  const total = Math.max(1, t.yes + t.maybe + t.no);
  const tallyBox = document.createElement("div");
  tallyBox.style.cssText = "text-align:right;";
  const txt = document.createElement("div");
  txt.style.cssText = "font-size:12.5px;color:#c9cbe0;font-weight:600;";
  txt.textContent = `${t.yes} yes · ${t.maybe} maybe · ${t.no} no`;
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;height:6px;width:130px;border-radius:4px;overflow:hidden;margin-top:6px;background:#0b0c12;";
  [["yes", "#56d364"], ["maybe", "#ffb13d"], ["no", "#ff5c7c"]].forEach(([k, color]) => {
    const seg = document.createElement("div");
    seg.style.cssText = `width:${(t[k] / total) * 100}%;background:${color};`;
    bar.append(seg);
  });
  tallyBox.append(txt, bar);

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;gap:5px;";
  buttons.append(
    voteBtn(session, "yes", "Yes", "#56d364"),
    voteBtn(session, "maybe", "Maybe", "#ffb13d"),
    voteBtn(session, "no", "No", "#ff5c7c")
  );
  right.append(tallyBox, buttons);

  row.append(left, right);
  card.append(row);

  if (isBest) {
    const confirm = document.createElement("div");
    confirm.style.cssText =
      "margin-top:13px;padding-top:13px;border-top:1px solid #ffffff0a;display:flex;align-items:center;justify-content:space-between;";
    const note = document.createElement("span");
    note.style.cssText = "font-size:12px;color:#a3a5bb;";
    note.textContent = `${t.yes} of the crew are in for ${formatShortDate(session.date)}.`;
    const cal = document.createElement("button");
    cal.type = "button";
    cal.style.cssText =
      "font-size:12px;font-weight:600;color:var(--accent,#7c5cff);background:#7c5cff14;border:1px solid #7c5cff33;border-radius:8px;padding:6px 12px;cursor:pointer;";
    cal.textContent = "＋ Add to calendar";
    cal.addEventListener("click", () => addToCalendar(session));
    confirm.append(note, cal);
    card.append(confirm);
  }

  return card;
}

function voteBtn(session, kind, label, color) {
  const btn = document.createElement("button");
  btn.type = "button";
  const mine = session.votes?.[store.currentUser?.uid] === kind;
  const tone = mine
    ? `background:${color}22;border:1px solid ${color}55;color:${color};`
    : "background:#15161f;border:1px solid #2a2c3d;color:#8b8da3;";
  btn.style.cssText = `border-radius:8px;padding:7px 11px;font-size:12.5px;font-weight:700;cursor:pointer;${tone}`;
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
    `&text=${encodeURIComponent(`Huddle Game Hub: ${session.activity || "Game night"}`)}` +
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
