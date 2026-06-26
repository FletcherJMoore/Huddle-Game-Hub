import { store, activeBoard, saveState, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import {
  normalizeBoard,
  currentProfile,
  avatarColor,
  memberIdsOf,
  plainName
} from "./board-model.js";
import { initialsFor, formatShortDate, sortSchedule } from "../../utils/format.js";
import { EMOJI_OPTIONS, ACCENT_OPTIONS } from "../../utils/constants.js";
import { openModal, closeModal, openBoard, showToast } from "../shell/shell.js";

// ---- shared avatar helper ----
function avatarEl(seed, name, className) {
  const el = document.createElement("div");
  el.className = className;
  el.style.background = avatarColor(seed);
  el.textContent = initialsFor(name);
  el.title = name;
  return el;
}

function unreadCount(board) {
  const msgs = board.messages ?? [];
  if (!msgs.length) return 0;
  const lastRead = board.reads?.[store.currentUser?.uid] ?? "";
  return msgs.filter((m) => m.createdAt > lastRead && m.authorUid !== store.currentUser?.uid).length;
}

function counts(board) {
  const games = board.games ?? [];
  return {
    rotation: games.filter((g) => g.status === "rotation").length,
    pending: games.filter((g) => g.status === "maybe").length
  };
}

function nextSessionLabel(board) {
  const next = sortSchedule(board.schedule ?? []).find((s) => `${s.date}` >= new Date().toISOString().slice(0, 10));
  if (!next) return "No game night yet";
  return `Next: ${formatShortDate(next.date)}`;
}

// ---------- RAIL ----------
export function renderRail() {
  const items = store.state.boards.map((board) => {
    const item = document.createElement("div");
    item.className = `rail-item${board.id === store.state.activeBoardId ? " active" : ""}`;

    const bar = document.createElement("span");
    bar.className = "bar";

    const ic = document.createElement("div");
    ic.className = "ic";
    ic.style.background = board.accent;
    ic.textContent = board.emoji;
    ic.title = board.name;

    item.append(bar, ic);

    const unread = unreadCount(board);
    if (unread) {
      const badge = document.createElement("span");
      badge.className = "unread";
      badge.textContent = unread > 9 ? "9+" : String(unread);
      item.append(badge);
    }

    item.addEventListener("click", () => openBoard(board.id));
    return item;
  });
  elements.railBoards.replaceChildren(...items);
}

// ---------- DASHBOARD ----------
export function renderDashboard() {
  elements.dashBoardCount.textContent = `${store.state.boards.length} ${
    store.state.boards.length === 1 ? "board" : "boards"
  }`;

  renderNeeds();

  const cards = store.state.boards.map((board) => boardCard(board));
  cards.push(createCard());
  elements.boardCards.replaceChildren(...cards);
}

function boardCard(board) {
  const card = document.createElement("div");
  card.className = "board-card";
  card.addEventListener("click", () => openBoard(board.id));

  const header = document.createElement("div");
  header.className = "board-card-header";
  header.style.background = `linear-gradient(135deg, ${board.accent}55, ${board.accent}18)`;
  const emoji = document.createElement("div");
  emoji.className = "board-card-emoji";
  emoji.textContent = board.emoji;
  header.append(emoji);
  const unread = unreadCount(board);
  if (unread) {
    const badge = document.createElement("span");
    badge.className = "board-card-new";
    badge.textContent = `${unread} new`;
    header.append(badge);
  }

  const body = document.createElement("div");
  body.className = "board-card-body";

  const name = document.createElement("div");
  name.className = "board-card-name";
  name.textContent = board.name;

  const ids = memberIdsOf(board);
  const sub = document.createElement("div");
  sub.className = "board-card-sub";
  sub.textContent = `${ids.length} ${ids.length === 1 ? "member" : "members"}`;

  const members = document.createElement("div");
  members.className = "board-card-members";
  ids.slice(0, 4).forEach((uid) => members.append(avatarEl(uid, plainName(board, uid), "av")));
  if (ids.length > 4) {
    const more = document.createElement("span");
    more.className = "more";
    more.textContent = `+${ids.length - 4}`;
    members.append(more);
  }

  const tags = document.createElement("div");
  tags.className = "board-card-tags";
  const c = counts(board);
  const rot = document.createElement("span");
  rot.className = "tag tag-green";
  rot.textContent = `${c.rotation} in rotation`;
  tags.append(rot);
  if (c.pending) {
    const pend = document.createElement("span");
    pend.className = "tag tag-amber";
    pend.textContent = `${c.pending} to vote`;
    tags.append(pend);
  }

  const next = document.createElement("div");
  next.className = "board-card-next";
  const cal = document.createElement("span");
  cal.className = "ico";
  cal.textContent = "📅";
  next.append(cal, document.createTextNode(nextSessionLabel(board)));

  body.append(name, sub, members, tags, next);
  card.append(header, body);
  return card;
}

function createCard() {
  const card = document.createElement("div");
  card.className = "board-card create";
  card.addEventListener("click", openCreateBoard);
  const plus = document.createElement("div");
  plus.className = "plus";
  plus.textContent = "+";
  const label = document.createElement("div");
  label.textContent = "New board";
  card.append(plus, label);
  return card;
}

function renderNeeds() {
  const uid = store.currentUser?.uid;
  const actions = [];
  store.state.boards.forEach((board) => {
    (board.games ?? [])
      .filter((g) => g.status === "maybe" && !g.approvals?.[uid])
      .forEach((g) => actions.push({ icon: "🎮", title: `Vote: ${g.title}`, sub: board.name, boardId: board.id, tab: "roster" }));
    (board.schedule ?? [])
      .filter((s) => s.votes?.[uid] === undefined)
      .forEach((s) => actions.push({ icon: "📅", title: `Vote on a time`, sub: board.name, boardId: board.id, tab: "schedule" }));
  });

  const top = actions.slice(0, 4);
  elements.needsStrip.classList.toggle("hidden", top.length === 0);
  elements.needsCount.textContent = String(actions.length);

  elements.needsActions.replaceChildren(
    ...top.map((a) => {
      const btn = document.createElement("button");
      btn.className = "need-action";
      btn.type = "button";
      const ico = document.createElement("span");
      ico.className = "ico";
      ico.textContent = a.icon;
      const meta = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = a.title;
      const sub = document.createElement("span");
      sub.textContent = a.sub;
      meta.append(title, sub);
      btn.append(ico, meta);
      btn.addEventListener("click", () => {
        store.boardTab = a.tab;
        openBoard(a.boardId);
      });
      return btn;
    })
  );
}

// ---------- CREATE BOARD ----------
export function openCreateBoard() {
  store.createDraft = { emoji: EMOJI_OPTIONS[0], accent: ACCENT_OPTIONS[0] };
  elements.cbName.value = "";
  renderCreatePickers();
  openModal("createBoard");
  setTimeout(() => elements.cbName.focus(), 50);
}

function renderCreatePickers() {
  elements.cbEmoji.replaceChildren(
    ...EMOJI_OPTIONS.map((glyph) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `emoji-opt${glyph === store.createDraft.emoji ? " selected" : ""}`;
      b.textContent = glyph;
      b.addEventListener("click", () => {
        store.createDraft.emoji = glyph;
        renderCreatePickers();
      });
      return b;
    })
  );
  elements.cbAccent.replaceChildren(
    ...ACCENT_OPTIONS.map((hex) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `accent-opt${hex === store.createDraft.accent ? " selected" : ""}`;
      b.style.background = hex;
      b.addEventListener("click", () => {
        store.createDraft.accent = hex;
        renderCreatePickers();
      });
      return b;
    })
  );
}

function createBoard(name) {
  const board = normalizeBoard({
    id: crypto.randomUUID(),
    name: name || "New board",
    emoji: store.createDraft.emoji,
    accent: store.createDraft.accent,
    createdAt: new Date().toISOString(),
    members: { [store.currentUser.uid]: "admin" },
    memberProfiles: { [store.currentUser.uid]: currentProfile() },
    reads: {},
    games: [],
    schedule: [],
    messages: []
  });
  store.state.boards.unshift(board);
  store.state.activeBoardId = board.id;
  saveState();
  closeModal();
  openBoard(board.id);
  showToast(`Created ${board.name}`);
}

export function bindBoardEvents() {
  elements.newBoardButtonTop.addEventListener("click", openCreateBoard);
  elements.railCreate.addEventListener("click", openCreateBoard);

  elements.createBoardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createBoard(elements.cbName.value.trim());
  });
}
