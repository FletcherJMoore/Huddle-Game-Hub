import { store, activeBoard, updateActiveBoard, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { canEdit, plainName } from "../boards/board-model.js";
import { emptyState } from "../../components/empty-state.js";
import { dowShort, dayNum, sessionTimeLabel, formatShortDate } from "../../utils/format.js";
import { openModal, closeModal, showToast } from "../shell/shell.js";
import { icon } from "../../utils/icons.js";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRESETS = [
  { key: "friday", label: "I'm free Friday night", sub: "Proposes next Friday at 8 PM" },
  { key: "weekends", label: "Weekends only", sub: "Yes Sat/Sun, no weekdays" },
  { key: "after8", label: "After 8 PM", sub: "Yes for later sessions" },
  { key: "cant", label: "Can't this week", sub: "No for the next 7 days" }
];

// A session is one proposed time slot; it can hold multiple game "options"
// (counter-offers), each independently votable. These helpers all operate on
// a single option unless noted otherwise.
function tally(option) {
  const v = Object.values(option?.votes ?? {});
  return {
    yes: v.filter((x) => x === "yes").length,
    maybe: v.filter((x) => x === "maybe").length,
    no: v.filter((x) => x === "no").length
  };
}

function optionScore(option) {
  const t = tally(option);
  return t.yes * 2 + t.maybe - t.no;
}

export function topOption(session) {
  return [...(session.options ?? [])].sort((a, b) => optionScore(b) - optionScore(a))[0];
}

function sessionScore(session) {
  const top = topOption(session);
  return top ? optionScore(top) : 0;
}

function gameTitleFor(board, gameId) {
  if (!gameId) return null;
  return board.games?.find((g) => g.id === gameId)?.title ?? null;
}

// What to call this session anywhere outside this module (chat share,
// dashboard upcoming list, etc.) — the winning option's game, else the
// session's own note, else a generic fallback.
export function sessionLabel(board, session) {
  return gameTitleFor(board, topOption(session)?.gameId) || session.activity || "Game night";
}

// Distinct people who said yes to ANY option at this time slot — used for the
// heatmap, which is about interest in the day, not which game wins.
function sessionYesUids(session) {
  const uids = new Set();
  (session.options ?? []).forEach((option) => {
    Object.entries(option.votes ?? {}).forEach(([uid, vote]) => {
      if (vote === "yes") uids.add(uid);
    });
  });
  return uids;
}

function availableGames(board) {
  return [...(board.games ?? [])].filter((g) => g.status !== "never").sort((a, b) => a.title.localeCompare(b.title));
}

export function renderSchedule(board) {
  renderAvailabilityPresets();
  renderHeatmap(board);

  const sessions = [...(board.schedule ?? [])].sort(
    (a, b) => sessionScore(b) - sessionScore(a) || `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`)
  );

  if (!sessions.length) {
    elements.sessionList.replaceChildren(
      emptyState("No times proposed yet", [
        { label: "Propose a time", variant: "primary", onClick: openProposeTime },
        { label: "Friday night", onClick: () => applyAvailabilityPreset("friday") }
      ])
    );
    return;
  }

  const bestId = sessionScore(sessions[0]) > 0 ? sessions[0].id : null;
  elements.sessionList.replaceChildren(...sessions.map((s) => sessionCard(board, s, s.id === bestId)));
}

function renderAvailabilityPresets() {
  elements.availabilityPresets.replaceChildren(
    ...PRESETS.map((preset) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn";
      const title = document.createElement("strong");
      title.textContent = preset.label;
      const sub = document.createElement("span");
      sub.textContent = preset.sub;
      btn.append(title, sub);
      btn.addEventListener("click", () => applyAvailabilityPreset(preset.key));
      return btn;
    })
  );
}

function renderHeatmap(board) {
  const intensity = new Array(7).fill(0);
  (board.schedule ?? []).forEach((s) => {
    if (!s.date) return;
    const d = new Date(`${s.date}T00:00`).getDay();
    intensity[d] += 1 + sessionYesUids(s).size;
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
      col.className = "heat-day";
      const cell = document.createElement("div");
      cell.className = "heat-cell";
      cell.style.background = intensity[i] ? `rgba(124,92,255,${0.15 + ratio * 0.6})` : "rgba(255,255,255,0.03)";
      cell.style.borderColor = isBest ? "rgba(124,92,255,0.6)" : "transparent";
      const num = document.createElement("span");
      num.style.color = ratio > 0.5 ? "#fff" : "#8b8da3";
      num.textContent = intensity[i] ? String(intensity[i]) : "";
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

function sessionCard(board, session, isBest) {
  const card = document.createElement("div");
  card.className = `session-card ${isBest ? "best" : ""}`;

  if (isBest) {
    const badge = document.createElement("span");
    badge.className = "session-badge";
    badge.textContent = "Top consensus";
    card.append(badge);
  }

  const header = document.createElement("div");
  header.className = "session-when";
  const dateBox = document.createElement("div");
  dateBox.className = "session-date";
  const dow = document.createElement("div");
  dow.className = "dow";
  dow.textContent = dowShort(session.date);
  const day = document.createElement("div");
  day.className = "day";
  day.textContent = dayNum(session.date);
  dateBox.append(dow, day);
  const detail = document.createElement("div");
  const time = document.createElement("div");
  time.className = "session-time";
  time.textContent = sessionTimeLabel(session.start, session.end);
  detail.append(time);
  if (session.activity) {
    const label = document.createElement("div");
    label.className = "session-label";
    label.textContent = session.activity;
    detail.append(label);
  }
  header.append(dateBox, detail);
  card.append(header);

  const top = topOption(session);
  const options = document.createElement("div");
  options.className = "session-options";
  (session.options ?? []).forEach((option) => {
    options.append(optionRow(board, session, option, option.id === top?.id));
  });
  card.append(options);

  if (canEdit()) card.append(counterOfferControl(board, session));

  if (isBest) {
    const t = tally(top);
    const confirm = document.createElement("div");
    confirm.className = "session-confirm";
    const note = document.createElement("span");
    note.textContent = `${t.yes} of the crew are in for ${formatShortDate(session.date)}.`;
    const cal = document.createElement("button");
    cal.type = "button";
    cal.className = "cal";
    cal.append(icon("calendar", { size: 13 }), document.createTextNode("Add to calendar"));
    cal.addEventListener("click", () => addToCalendar(board, session));
    confirm.append(note, cal);
    card.append(confirm);
  }

  return card;
}

function optionRow(board, session, option, isTop) {
  const row = document.createElement("div");
  row.className = `session-option ${isTop ? "top" : ""}`;

  const info = document.createElement("div");
  info.className = "session-option-info";
  const title = document.createElement("div");
  title.className = "session-option-title";
  title.textContent = gameTitleFor(board, option.gameId) || "No game picked yet";
  info.append(title);
  if (option.addedBy && option.addedBy !== store.currentUser?.uid) {
    const by = document.createElement("span");
    by.className = "session-option-by";
    by.textContent = `proposed by ${plainName(board, option.addedBy)}`;
    info.append(by);
  }

  const right = document.createElement("div");
  right.className = "session-vote";
  const t = tally(option);
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
    voteBtn(session, option, "yes", "Yes"),
    voteBtn(session, option, "maybe", "Maybe"),
    voteBtn(session, option, "no", "No")
  );
  right.append(tallyBox, buttons);

  row.append(info, right);
  return row;
}

function voteBtn(session, option, kind, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  const mine = option.votes?.[store.currentUser?.uid] === kind;
  btn.className = `sv-btn ${kind} ${mine ? "on" : ""}`;
  btn.textContent = label;
  if (canEdit()) btn.addEventListener("click", () => setOptionVote(session.id, option.id, kind));
  else btn.disabled = true;
  return btn;
}

function setOptionVote(sessionId, optionId, kind) {
  updateActiveBoard((board) => {
    const session = board.schedule.find((s) => s.id === sessionId);
    const option = session?.options?.find((o) => o.id === optionId);
    if (!option) return;
    option.votes = option.votes ?? {};
    const uid = store.currentUser.uid;
    if (option.votes[uid] === kind) delete option.votes[uid];
    else option.votes[uid] = kind;
  });
}

// Which session currently has its "counter with a different game" picker
// expanded — purely local UI state, not persisted.
let counterOfferSessionId = null;

function counterOfferControl(board, session) {
  const wrap = document.createElement("div");
  wrap.className = "session-counter";

  if (counterOfferSessionId !== session.id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "link-btn";
    btn.textContent = "+ Counter with a different game";
    btn.addEventListener("click", () => {
      counterOfferSessionId = session.id;
      render();
    });
    wrap.append(btn);
    return wrap;
  }

  const usedGameIds = new Set((session.options ?? []).map((o) => o.gameId).filter(Boolean));
  const available = availableGames(board).filter((g) => !usedGameIds.has(g.id));

  const select = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = available.length ? "Pick a game…" : "No other roster games to counter with";
  select.append(blank);
  available.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.title;
    select.append(opt);
  });

  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "btn btn-surface";
  confirm.textContent = "Add option";
  confirm.disabled = !available.length;
  confirm.addEventListener("click", () => {
    if (!select.value) return;
    counterOfferSessionId = null;
    addCounterOffer(session.id, select.value);
  });

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "link-btn";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => {
    counterOfferSessionId = null;
    render();
  });

  wrap.append(select, confirm, cancel);
  return wrap;
}

function addCounterOffer(sessionId, gameId) {
  const uid = store.currentUser?.uid;
  if (!uid) return;
  updateActiveBoard((board) => {
    const session = board.schedule.find((s) => s.id === sessionId);
    if (!session) return;
    session.options = session.options ?? [];
    session.options.push({ id: crypto.randomUUID(), gameId, addedBy: uid, votes: { [uid]: "yes" } });
  });
  showToast("Counter-offer added — vote's open");
}

export function addToCalendar(board, session) {
  const title = sessionLabel(board, session);
  const fmt = (date, time) => `${date.replace(/-/g, "")}T${(time || "20:00").replace(":", "")}00`;
  const start = fmt(session.date, session.start);
  const end = fmt(session.date, session.end || session.start);
  const url =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(`Huddle Game Hub: ${title}`)}` +
    `&dates=${start}/${end}`;
  window.open(url, "_blank", "noopener");
}

function applyAvailabilityPreset(key) {
  if (!canEdit()) {
    showToast("You don't have edit access on this board");
    return;
  }
  const uid = store.currentUser?.uid;
  if (!uid) return;

  if (key === "friday") {
    const nextFriday = nextWeekdayDate(5);
    updateActiveBoard((board) => {
      const existing = board.schedule.find((session) => session.date === nextFriday && session.start === "20:00");
      if (existing) {
        (existing.options ?? []).forEach((option) => {
          option.votes = { ...(option.votes ?? {}), [uid]: "yes" };
        });
        return;
      }
      board.schedule.push({
        id: crypto.randomUUID(),
        date: nextFriday,
        start: "20:00",
        end: "23:00",
        activity: "",
        options: [{ id: crypto.randomUUID(), gameId: null, addedBy: uid, votes: { [uid]: "yes" } }]
      });
    });
    showToast("Friday night added");
    return;
  }

  let changed = 0;
  updateActiveBoard((board) => {
    (board.schedule ?? []).forEach((session) => {
      const vote = presetVote(key, session);
      if (!vote) return;
      (session.options ?? []).forEach((option) => {
        option.votes = option.votes ?? {};
        if (option.votes[uid] !== vote) {
          option.votes[uid] = vote;
          changed += 1;
        }
      });
    });
  });
  showToast(changed ? "Availability updated" : "No matching sessions yet");
}

function presetVote(key, session) {
  if (key === "weekends") {
    const day = new Date(`${session.date}T00:00`).getDay();
    return day === 0 || day === 6 ? "yes" : "no";
  }
  if (key === "after8") return (session.start || "") >= "20:00" ? "yes" : "no";
  if (key === "cant") return isWithinNextDays(session.date, 7) ? "no" : null;
  return null;
}

function nextWeekdayDate(dayIndex) {
  const date = new Date();
  const diff = (dayIndex - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function isWithinNextDays(dateString, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00`);
  const end = new Date(today);
  end.setDate(today.getDate() + days);
  return target >= today && target <= end;
}

function renderProposeTimeGameOptions() {
  const board = activeBoard();
  elements.ptGame.replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "No specific game yet";
  elements.ptGame.append(blank);
  availableGames(board).forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.title;
    elements.ptGame.append(opt);
  });
}

export function openProposeTime() {
  if (!canEdit()) {
    showToast("You don't have edit access on this board");
    return;
  }
  elements.proposeTimeForm.reset();
  renderProposeTimeGameOptions();
  openModal("proposeTime");
  setTimeout(() => elements.ptDate.focus(), 50);
}

export function bindScheduleEvents() {
  elements.proposeTimeButton.addEventListener("click", openProposeTime);

  elements.proposeTimeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    const uid = store.currentUser.uid;
    updateActiveBoard((board) => {
      board.schedule.push({
        id: crypto.randomUUID(),
        date: elements.ptDate.value,
        start: elements.ptStart.value,
        end: elements.ptEnd.value,
        activity: elements.ptLabel.value.trim(),
        options: [{ id: crypto.randomUUID(), gameId: elements.ptGame.value || null, addedBy: uid, votes: { [uid]: "yes" } }]
      });
    });
    closeModal();
    showToast("Time proposed - vote's open");
  });
}
