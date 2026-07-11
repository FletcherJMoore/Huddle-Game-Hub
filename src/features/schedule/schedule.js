import { store, activeBoard, updateActiveBoard, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { canEdit, plainName } from "../boards/board-model.js";
import { emptyState } from "../../components/empty-state.js";
import { dowShort, dayNum, sessionTimeLabel, formatShortDate, formatTime12 } from "../../utils/format.js";
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
// calendar's day-cell shading, which is about interest in the day, not which
// specific game wins.
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

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayInterest(board, dateStr) {
  return (board.schedule ?? [])
    .filter((s) => s.date === dateStr)
    .reduce((sum, s) => sum + 1 + sessionYesUids(s).size, 0);
}

function formatLongDate(dateStr) {
  return new Date(`${dateStr}T00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// Which month/week is showing, and which single day is selected — purely
// local UI navigation state, not persisted.
let calendarView = "month";
let viewDate = new Date();
let selectedDate = toDateStr(new Date());

export function renderSchedule(board) {
  renderAvailabilityPresets();
  renderCalendarHeader();
  if (calendarView === "week") {
    elements.calWeekdays.classList.add("hidden");
    elements.calGrid.classList.add("hidden");
    elements.hourGrid.classList.remove("hidden");
    renderHourGrid(board);
  } else {
    ghost = null;
    elements.hourGrid.classList.add("hidden");
    elements.calWeekdays.classList.remove("hidden");
    elements.calGrid.classList.remove("hidden");
    renderMonthGrid(board);
  }
  renderSelectedDayPanel(board);
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

function renderCalendarHeader() {
  elements.calLabel.textContent = calendarView === "week" ? weekRangeLabel(viewDate) : monthLabel(viewDate);
  elements.calViewToggle.querySelectorAll(".view-opt").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.view === calendarView);
  });
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function weekRangeLabel(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function renderWeekdayHeaders() {
  elements.calWeekdays.replaceChildren(
    ...DAY_LABELS.map((label) => {
      const el = document.createElement("div");
      el.className = "cal-weekday";
      el.textContent = label;
      return el;
    })
  );
}

function renderMonthGrid(board) {
  renderWeekdayHeaders();
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const gridStart = startOfWeek(first);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    cells.push(dayCell(board, date, date.getMonth() !== viewDate.getMonth()));
  }
  elements.calGrid.className = "calendar-grid month";
  elements.calGrid.replaceChildren(...cells);
}

function weekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// ============ HOUR GRID (week view) ============
// Tap an empty slot to drop a draggable ghost block (with two resize
// handles), tap the block to open "Propose a time" pre-filled with the
// exact date + time range — the Google-Calendar-style alternative to the
// flat day-cell grid, for picking an exact time instead of just a day.

const HOURS_IN_DAY = 24;
const HOUR_PX = 56;
const SNAP_MIN = 15;
const DAY_MIN = 24 * 60;

function hhmmToMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToHHMM(total) {
  const clamped = Math.max(0, Math.min(Math.round(total), DAY_MIN));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function snapMinutes(min) {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

function clampMinutes(min) {
  return Math.max(0, Math.min(min, DAY_MIN));
}

function hourLabel(h) {
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour} ${period}`;
}

// Pending drag-to-create selection on the hour grid — { dateStr, startMin,
// endMin } while the user is placing/resizing it, else null.
let ghost = null;

function renderHourGrid(board) {
  const days = weekDays(viewDate);
  renderHourGridHead(board, days);
  renderHourGridBody(board, days);
}

function renderHourGridHead(board, days) {
  const todayStr = toDateStr(new Date());
  const corner = document.createElement("div");
  corner.className = "hour-grid-corner";

  const cells = days.map((date) => {
    const dateStr = toDateStr(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "hour-grid-day-header";
    if (dateStr === todayStr) cell.classList.add("today");
    if (dateStr === selectedDate) cell.classList.add("selected");
    if (dayInterest(board, dateStr) > 0) cell.classList.add("has-sessions");

    const dow = document.createElement("div");
    dow.className = "dow";
    dow.textContent = DAY_LABELS[date.getDay()];
    const num = document.createElement("div");
    num.className = "num";
    num.textContent = String(date.getDate());
    cell.append(dow, num);

    cell.addEventListener("click", () => {
      selectedDate = dateStr;
      render();
    });
    return cell;
  });

  elements.hourGridHead.replaceChildren(corner, ...cells);
}

// Simple greedy lane assignment so overlapping sessions on the same day sit
// side by side instead of stacking on top of each other.
function layoutSessionsForDay(sessions) {
  const items = sessions
    .filter((s) => s.start)
    .map((s) => {
      const startMin = hhmmToMinutes(s.start);
      const endMin = Math.max(hhmmToMinutes(s.end), startMin + SNAP_MIN);
      return { session: s, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const laneEnds = [];
  items.forEach((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    item.lane = lane;
  });
  const totalLanes = laneEnds.length || 1;
  items.forEach((item) => (item.totalLanes = totalLanes));
  return items;
}

function sessionBlock(board, item) {
  const { session, startMin, endMin, lane, totalLanes } = item;
  const block = document.createElement("div");
  block.className = "hg-event";
  block.style.top = `${(startMin / DAY_MIN) * 100}%`;
  block.style.height = `${((endMin - startMin) / DAY_MIN) * 100}%`;
  block.style.left = `${(lane / totalLanes) * 100}%`;
  block.style.width = `${100 / totalLanes}%`;

  const title = document.createElement("div");
  title.className = "hg-event-title";
  title.textContent = sessionLabel(board, session);
  const time = document.createElement("div");
  time.className = "hg-event-time";
  time.textContent = sessionTimeLabel(session.start, session.end);
  block.append(title, time);
  return block;
}

function ghostBlock() {
  const block = document.createElement("div");
  block.className = "hg-ghost";
  block.style.top = `${(ghost.startMin / DAY_MIN) * 100}%`;
  block.style.height = `${((ghost.endMin - ghost.startMin) / DAY_MIN) * 100}%`;

  const label = document.createElement("div");
  label.className = "hg-ghost-label";
  label.textContent = `${formatTime12(minutesToHHMM(ghost.startMin))} – ${formatTime12(minutesToHHMM(ghost.endMin))}`;
  block.append(label);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "hg-ghost-cancel";
  cancelBtn.textContent = "✕";
  cancelBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    ghost = null;
    render();
  });
  block.append(cancelBtn);

  block.addEventListener("click", (event) => {
    if (event.target.closest(".hg-handle, .hg-ghost-cancel")) return;
    event.stopPropagation();
    const { dateStr, startMin, endMin } = ghost;
    ghost = null;
    render();
    openProposeTime(dateStr, minutesToHHMM(startMin), minutesToHHMM(endMin));
  });

  const topHandle = document.createElement("div");
  topHandle.className = "hg-handle hg-handle-top";
  const bottomHandle = document.createElement("div");
  bottomHandle.className = "hg-handle hg-handle-bottom";
  block.append(topHandle, bottomHandle);

  bindHandleDrag(topHandle, "start", block, label);
  bindHandleDrag(bottomHandle, "end", block, label);

  return block;
}

// Handle dragging mutates the ghost block's own styles directly rather than
// re-rendering the grid on every pointermove — re-rendering would replace
// the column element mid-gesture and break the getBoundingClientRect() the
// drag math depends on.
function bindHandleDrag(handleEl, edge, block, label) {
  handleEl.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    const col = handleEl.closest(".hour-grid-col");
    if (!col) return;

    const move = (moveEvent) => {
      const rect = col.getBoundingClientRect();
      const ratio = (moveEvent.clientY - rect.top) / rect.height;
      const min = clampMinutes(snapMinutes(ratio * DAY_MIN));
      if (edge === "start") ghost.startMin = Math.min(min, ghost.endMin - SNAP_MIN);
      else ghost.endMin = Math.max(min, ghost.startMin + SNAP_MIN);
      block.style.top = `${(ghost.startMin / DAY_MIN) * 100}%`;
      block.style.height = `${((ghost.endMin - ghost.startMin) / DAY_MIN) * 100}%`;
      label.textContent = `${formatTime12(minutesToHHMM(ghost.startMin))} – ${formatTime12(minutesToHHMM(ghost.endMin))}`;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function renderHourGridBody(board, days) {
  const scrollEl = elements.hourGridBodyScroll;
  const prevScrollTop = scrollEl.scrollTop;
  const prevScrollLeft = scrollEl.scrollLeft;
  const alreadyInitialized = scrollEl.dataset.initialized === "true";

  const gutter = document.createElement("div");
  gutter.className = "hour-grid-gutter";
  for (let h = 0; h < HOURS_IN_DAY; h++) {
    const label = document.createElement("div");
    label.className = "hour-grid-hour-label";
    label.textContent = hourLabel(h);
    gutter.append(label);
  }

  const columns = document.createElement("div");
  columns.className = "hour-grid-columns";

  const todayStr = toDateStr(new Date());
  const now = new Date();

  days.forEach((date) => {
    const dateStr = toDateStr(date);
    const col = document.createElement("div");
    col.className = "hour-grid-col";
    col.style.height = `${HOURS_IN_DAY * HOUR_PX}px`;

    for (let h = 0; h < HOURS_IN_DAY; h++) {
      const line = document.createElement("div");
      line.className = "hour-grid-hourline";
      col.append(line);
    }

    const sessions = (board.schedule ?? []).filter((s) => s.date === dateStr);
    layoutSessionsForDay(sessions).forEach((item) => col.append(sessionBlock(board, item)));

    if (dateStr === todayStr) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const nowLine = document.createElement("div");
      nowLine.className = "hour-grid-now";
      nowLine.style.top = `${(nowMin / DAY_MIN) * 100}%`;
      col.append(nowLine);
    }

    if (ghost && ghost.dateStr === dateStr) col.append(ghostBlock());

    col.addEventListener("click", (event) => {
      if (event.target.closest(".hg-event, .hg-ghost, .hg-handle")) return;
      const rect = col.getBoundingClientRect();
      const ratio = (event.clientY - rect.top) / rect.height;
      const startMin = Math.min(clampMinutes(snapMinutes(ratio * DAY_MIN)), DAY_MIN - 60);
      ghost = { dateStr, startMin, endMin: startMin + 60 };
      selectedDate = dateStr;
      render();
    });

    columns.append(col);
  });

  elements.hourGridBody.replaceChildren(gutter, columns);

  if (alreadyInitialized) {
    scrollEl.scrollTop = prevScrollTop;
    scrollEl.scrollLeft = prevScrollLeft;
  } else {
    const anchorHour = days.some((d) => toDateStr(d) === todayStr) ? Math.max(now.getHours() - 1, 0) : 8;
    scrollEl.scrollTop = anchorHour * HOUR_PX;
    scrollEl.dataset.initialized = "true";
  }
}

function dayCell(board, date, dimmed) {
  const dateStr = toDateStr(date);
  const interest = dayInterest(board, dateStr);

  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "cal-day";
  if (dimmed) cell.classList.add("dimmed");
  if (dateStr === toDateStr(new Date())) cell.classList.add("today");
  if (dateStr === selectedDate) cell.classList.add("selected");
  if (interest > 0) {
    cell.classList.add("has-sessions");
    const ratio = Math.min(1, interest / 4);
    cell.style.background = `rgba(124,92,255,${0.15 + ratio * 0.55})`;
  }

  const num = document.createElement("span");
  num.className = "cal-day-num";
  num.textContent = String(date.getDate());
  cell.append(num);

  cell.addEventListener("click", () => {
    selectedDate = dateStr;
    viewDate = date;
    // Jump into the hourly grid to pick the exact time, rather than opening
    // the modal straight off a whole-day click.
    calendarView = "week";
    render();
  });

  return cell;
}

function stepView(direction) {
  const next = new Date(viewDate);
  if (calendarView === "week") next.setDate(next.getDate() + direction * 7);
  else next.setMonth(next.getMonth() + direction);
  viewDate = next;
  ghost = null;
  render();
}

function goToday() {
  viewDate = new Date();
  selectedDate = toDateStr(viewDate);
  ghost = null;
  render();
}

function renderSelectedDayPanel(board) {
  const sessions = (board.schedule ?? []).filter((s) => s.date === selectedDate);
  const sortedByScore = [...(board.schedule ?? [])].sort((a, b) => sessionScore(b) - sessionScore(a));
  const overallBestId = sortedByScore.length && sessionScore(sortedByScore[0]) > 0 ? sortedByScore[0].id : null;

  const header = document.createElement("div");
  header.className = "selected-day-header";
  const label = document.createElement("h3");
  label.textContent = formatLongDate(selectedDate);
  header.append(label);
  if (canEdit()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-accent";
    btn.append(icon("plus", { size: 14 }), document.createTextNode("Propose a time"));
    btn.addEventListener("click", () => openProposeTime(selectedDate));
    header.append(btn);
  }

  const list = document.createElement("div");
  list.className = "session-list";
  if (!sessions.length) {
    list.append(
      emptyState(
        "No times proposed for this day yet",
        canEdit() ? [{ label: "Propose a time", variant: "primary", onClick: () => openProposeTime(selectedDate) }] : []
      )
    );
  } else {
    list.append(...sessions.map((s) => sessionCard(board, s, s.id === overallBestId)));
  }

  elements.selectedDayPanel.replaceChildren(header, list);
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

export function openProposeTime(prefillDate, prefillStart, prefillEnd) {
  if (!canEdit()) {
    showToast("You don't have edit access on this board");
    return;
  }
  elements.proposeTimeForm.reset();
  renderProposeTimeGameOptions();
  if (prefillDate) elements.ptDate.value = prefillDate;
  elements.ptStart.value = prefillStart || "19:00";
  elements.ptEnd.value = prefillEnd || "21:00";
  openModal("proposeTime");
  setTimeout(() => elements.ptDate.focus(), 50);
}

export function bindScheduleEvents() {
  elements.proposeTimeButton.addEventListener("click", () => openProposeTime(selectedDate));
  elements.calPrevButton.addEventListener("click", () => stepView(-1));
  elements.calNextButton.addEventListener("click", () => stepView(1));
  elements.calTodayButton.addEventListener("click", goToday);
  elements.calViewToggle.addEventListener("click", (event) => {
    const btn = event.target.closest(".view-opt");
    if (!btn || btn.dataset.view === calendarView) return;
    calendarView = btn.dataset.view;
    render();
  });
  elements.hourGridBodyScroll.addEventListener("scroll", () => {
    elements.hourGridHeadScroll.scrollLeft = elements.hourGridBodyScroll.scrollLeft;
  });

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
