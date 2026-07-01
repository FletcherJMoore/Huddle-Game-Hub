import { store, activeBoard, saveState, saveLocal, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import {
  normalizeBoard,
  currentProfile,
  avatarColor,
  memberIdsOf,
  plainName,
  profileFor,
  unreadCount,
  isOwnerOf,
  canonicalRole
} from "./board-model.js";
import { initialsFor, formatShortDate, sortSchedule } from "../../utils/format.js";
import { EMOJI_OPTIONS, ACCENT_OPTIONS, ROLE_LABELS, ASSIGNABLE_ROLES } from "../../utils/constants.js";
import { deleteBoard } from "../../services/boards-repository.js";
import {
  updateMemberRole,
  transferBoardOwnership,
  removeBoardMember
} from "../../services/invites-repository.js";
import { openModal, closeModal, openBoard, goDashboard, showToast } from "../shell/shell.js";

// ---- shared avatar helper ----
function avatarEl(seed, name, className) {
  const el = document.createElement("div");
  el.className = className;
  el.style.background = avatarColor(seed);
  el.textContent = initialsFor(name);
  el.title = name;
  return el;
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
  store.editingBoardId = null;
  store.createDraft = { emoji: EMOJI_OPTIONS[0], accent: ACCENT_OPTIONS[0] };
  elements.cbName.value = "";
  elements.cbModalTitle.textContent = "New board";
  elements.cbSubmitButton.textContent = "Create board";
  elements.cbDeleteButton.classList.add("hidden");
  elements.cbMembersSection.classList.add("hidden");
  renderCreatePickers();
  openModal("createBoard");
  setTimeout(() => elements.cbName.focus(), 50);
}

export function openEditBoard() {
  const board = activeBoard();
  if (!board) return;
  store.editingBoardId = board.id;
  store.createDraft = { emoji: board.emoji, accent: board.accent };
  elements.cbName.value = board.name;
  elements.cbModalTitle.textContent = "Board settings";
  elements.cbSubmitButton.textContent = "Save changes";
  renderCreatePickers();
  renderBoardSettingsControls(board);
  openModal("createBoard");
}

// ---------- member manager (owner only) ----------
function renderBoardSettingsControls(board) {
  const owner = isOwnerOf(board);
  elements.cbDeleteButton.classList.toggle("hidden", !owner);
  elements.cbMembersSection.classList.toggle("hidden", !owner);
  if (owner) renderMembers(board);
  else elements.cbMembers.replaceChildren();
}

function renderMembers(board) {
  elements.cbMembers.replaceChildren(...memberIdsOf(board).map((uid) => memberRow(board, uid)));
}

function memberRow(board, uid) {
  const role = canonicalRole(board.members[uid]);
  const isSelf = uid === store.currentUser?.uid;
  const name = plainName(board, uid);

  const row = document.createElement("div");
  row.className = "member-row";
  const meta = document.createElement("div");
  meta.className = "member-meta";
  const strong = document.createElement("strong");
  strong.textContent = name + (isSelf ? " (you)" : "");
  const email = document.createElement("span");
  email.textContent = profileFor(board, uid)?.email || "";
  meta.append(strong, email);
  row.append(avatarEl(uid, name, "av"), meta);

  const controls = document.createElement("div");
  controls.className = "member-controls";

  if (role === "owner") {
    const badge = document.createElement("span");
    badge.className = "member-owner-badge";
    badge.textContent = "Owner";
    controls.append(badge);
  } else {
    const select = document.createElement("select");
    select.className = "role-select";
    ASSIGNABLE_ROLES.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = ROLE_LABELS[r];
      if (r === role) opt.selected = true;
      select.append(opt);
    });
    select.addEventListener("change", () => setMemberRole(board, uid, select.value));

    const makeOwner = document.createElement("button");
    makeOwner.type = "button";
    makeOwner.className = "link-btn";
    makeOwner.textContent = "Make owner";
    makeOwner.addEventListener("click", () => transferOwnership(board, uid, name));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-btn danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeMember(board, uid, name));

    controls.append(select, makeOwner, remove);
  }
  row.append(controls);
  return row;
}

// Role changes go through owner-validated Cloud Functions (admin SDK), not a
// direct members write. We optimistically reflect the change locally; realtime
// then confirms the authoritative state.
async function setMemberRole(board, uid, role) {
  try {
    await updateMemberRole(store.services.functions, board.id, uid, role);
    board.members[uid] = role;
    renderMembers(board);
    render();
    showToast(`Updated ${plainName(board, uid)} to ${ROLE_LABELS[role]}`);
  } catch (error) {
    console.error("setMemberRole failed", error);
    renderMembers(board); // reset the dropdown to the stored value
    showToast(error?.message || "Couldn't update that role.");
  }
}

async function removeMember(board, uid, name) {
  if (!window.confirm(`Remove ${name} from "${board.name}"? They'll lose access to this board.`)) {
    return;
  }
  try {
    await removeBoardMember(store.services.functions, board.id, uid);
    delete board.members[uid];
    if (board.memberProfiles) delete board.memberProfiles[uid];
    if (board.reads) delete board.reads[uid];
    board.memberIds = Object.keys(board.members);
    renderMembers(board);
    render();
    showToast(`Removed ${name}`);
  } catch (error) {
    console.error("removeMember failed", error);
    showToast(error?.message || "Couldn't remove that member.");
  }
}

async function transferOwnership(board, uid, name) {
  if (!window.confirm(`Make ${name} the owner? You'll become an editor — only they can undo this.`)) return;
  try {
    await transferBoardOwnership(store.services.functions, board.id, uid);
    board.members[store.currentUser.uid] = "editor";
    board.members[uid] = "owner";
    closeModal();
    render();
    showToast(`${name} is now the owner`);
  } catch (error) {
    console.error("transferOwnership failed", error);
    showToast(error?.message || "Couldn't transfer ownership.");
  }
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
    members: { [store.currentUser.uid]: "owner" },
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

function saveBoardEdits(name) {
  const board = store.state.boards.find((b) => b.id === store.editingBoardId);
  if (!board) return;
  board.name = name || board.name;
  board.emoji = store.createDraft.emoji;
  board.accent = store.createDraft.accent;
  saveState();
  closeModal();
  render();
  showToast("Board updated");
}

async function deleteCurrentBoard() {
  const board = store.state.boards.find((b) => b.id === store.editingBoardId) ?? activeBoard();
  if (!board) return;
  if (!window.confirm(`Delete "${board.name}"? This removes the board and its games, schedule, and chat for everyone.`)) {
    return;
  }

  store.state.boards = store.state.boards.filter((b) => b.id !== board.id);
  store.state.activeBoardId = store.state.boards[0]?.id ?? null;
  saveLocal();
  closeModal();
  goDashboard();
  showToast(`Deleted ${board.name}`);

  if (store.services && store.currentUser) {
    deleteBoard(store.services.db, store.currentUser.uid, board.id).catch((e) =>
      console.error("Delete board failed", e)
    );
  }
}

export function bindBoardEvents() {
  elements.newBoardButtonTop.addEventListener("click", openCreateBoard);
  elements.railCreate.addEventListener("click", openCreateBoard);
  elements.boardSettingsButton.addEventListener("click", openEditBoard);
  elements.cbDeleteButton.addEventListener("click", deleteCurrentBoard);

  elements.createBoardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.cbName.value.trim();
    if (store.editingBoardId) saveBoardEdits(name);
    else createBoard(name);
  });
}
