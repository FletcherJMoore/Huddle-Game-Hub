// The board screen's "Tonight" decision panel: surfaces the top-voted game
// and session so the crew can answer "what are we playing" and "when" at a
// glance, without hunting through the Roster/Schedule tabs. Deliberately
// thin — it wraps existing roster/schedule mechanics rather than
// duplicating them (spin, session scoring, RSVP voting, calendar export).

import { store, activeBoard, updateActiveBoard, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { canEdit, memberIdsOf } from "../boards/board-model.js";
import { pickRandomRotationGame, cover } from "../games/games.js";
import { topSession, voteBtn, addToCalendar } from "../schedule/schedule.js";
import { emptyState } from "../../components/empty-state.js";
import { icon } from "../../utils/icons.js";
import { sessionTimeLabel, dowShort, dayNum } from "../../utils/format.js";
import { showToast } from "../shell/shell.js";

// A freshly spun candidate not yet confirmed/persisted. Cleared on confirm
// or when leaving the board. Not board state — purely local UI state.
let tonightSuggestion = null;
let tonightBoardId = null;

function isValidPick(board) {
  const pick = board.tonightPick;
  if (!pick) return false;
  return board.games.some((g) => g.id === pick.gameId && g.status === "rotation");
}

function renderPick(board) {
  const target = elements.tonightPick;

  if (tonightSuggestion) {
    const row = document.createElement("div");
    row.className = "tonight-pick-row";
    const strong = document.createElement("strong");
    strong.textContent = tonightSuggestion.title;
    row.append(cover(tonightSuggestion, "16px"), strong);
    target.replaceChildren(row);
    return;
  }

  if (!isValidPick(board)) {
    target.replaceChildren(emptyState("Nothing picked yet — spin to lock in tonight"));
    return;
  }

  const game = board.games.find((g) => g.id === board.tonightPick.gameId);
  const row = document.createElement("div");
  row.className = "tonight-pick-row";
  const strong = document.createElement("strong");
  strong.textContent = game.title;
  row.append(cover(game, "16px"), strong);

  const confirmedLine = document.createElement("div");
  confirmedLine.className = "tonight-pick-confirmed";
  const confirmedCount = board.tonightPick.confirmedBy?.length ?? 0;
  confirmedLine.textContent = `${confirmedCount} of ${memberIdsOf(board).length} confirmed`;

  target.replaceChildren(row, confirmedLine);
}

function renderSession(board) {
  const target = elements.tonightSession;
  const session = topSession(board);
  if (!session) {
    target.replaceChildren(emptyState("No times proposed yet"));
    return;
  }

  const row = document.createElement("div");
  row.className = "tonight-session-row";

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

  row.append(date, detail);

  const actions = document.createElement("div");
  actions.className = "tonight-actions";
  actions.append(voteBtn(session, "yes", "Yes"), voteBtn(session, "maybe", "Maybe"), voteBtn(session, "no", "No"));
  const cal = document.createElement("button");
  cal.type = "button";
  cal.className = "chip-btn";
  cal.append(icon("calendar", { size: 12 }), document.createTextNode("Add to calendar"));
  cal.addEventListener("click", () => addToCalendar(session));
  actions.append(cal);

  target.replaceChildren(row, actions);
}

function updateConfirmButton(board) {
  const btn = elements.tonightConfirmButton;
  if (!canEdit()) {
    btn.disabled = true;
    btn.textContent = "Confirm we're playing";
    return;
  }
  if (tonightSuggestion) {
    btn.disabled = false;
    btn.textContent = "Confirm we're playing";
    return;
  }
  if (!isValidPick(board)) {
    btn.disabled = true;
    btn.textContent = "Confirm we're playing";
    return;
  }
  const alreadyIn = board.tonightPick.confirmedBy?.includes(store.currentUser?.uid);
  btn.disabled = Boolean(alreadyIn);
  btn.textContent = alreadyIn ? "You're in" : "Confirm we're playing";
}

export function renderTonightPanel(board) {
  if (tonightBoardId !== board.id) {
    tonightBoardId = board.id;
    tonightSuggestion = null;
  }
  elements.tonightPanel.classList.toggle("collapsed", store.tonightCollapsed);
  elements.tonightCollapseButton.replaceChildren(icon(store.tonightCollapsed ? "chevron-right" : "chevron-left"));
  renderPick(board);
  renderSession(board);
  updateConfirmButton(board);
}

function confirmTonightPick(gameId) {
  updateActiveBoard((board) => {
    const uid = store.currentUser.uid;
    if (board.tonightPick?.gameId === gameId) {
      board.tonightPick.confirmedBy = [...new Set([...(board.tonightPick.confirmedBy ?? []), uid])];
    } else {
      board.tonightPick = { gameId, confirmedBy: [uid], confirmedAt: new Date().toISOString() };
    }
  });
  showToast("You're locked in for tonight");
}

export function bindTonightEvents() {
  elements.tonightCollapseButton.addEventListener("click", () => {
    store.tonightCollapsed = !store.tonightCollapsed;
    render();
  });

  elements.tonightSpinButton.addEventListener("click", () => {
    const pick = pickRandomRotationGame(activeBoard());
    if (!pick) {
      showToast("Nothing in rotation to spin");
      return;
    }
    tonightSuggestion = pick;
    render();
  });

  elements.tonightConfirmButton.addEventListener("click", () => {
    if (!canEdit()) return;
    const board = activeBoard();
    const gameId = tonightSuggestion?.id ?? (isValidPick(board) ? board.tonightPick.gameId : null);
    if (!gameId) return;
    tonightSuggestion = null;
    confirmTonightPick(gameId);
  });
}
