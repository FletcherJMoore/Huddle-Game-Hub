import { store, activeBoard, saveState, saveLocal, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import {
  normalizeBoard,
  currentProfile,
  avatarColor,
  memberIdsOf,
  plainName,
  profileFor,
  photoURLFor,
  unreadCount,
  isOwnerOf,
  canonicalRole
} from "./board-model.js";
import { initialsFor, formatShortDate, sortSchedule, dowShort, dayNum, sessionTimeLabel } from "../../utils/format.js";
import { EMOJI_OPTIONS, ACCENT_OPTIONS, ROLE_LABELS, ASSIGNABLE_ROLES } from "../../utils/constants.js";
import { deleteBoard } from "../../services/boards-repository.js";
import {
  updateMemberRole,
  transferBoardOwnership,
  removeBoardMember
} from "../../services/invites-repository.js";
import { openModal, closeModal, openBoard, goDashboard, showToast } from "../shell/shell.js";
import { icon } from "../../utils/icons.js";
import { emptyState } from "../../components/empty-state.js";

// ---- shared avatar helper ----
export function avatarEl(seed, name, className, photoURL) {
  const el = document.createElement("div");
  el.className = className;
  el.title = name;
  if (photoURL) {
    const img = document.createElement("img");
    img.src = photoURL;
    img.alt = "";
    img.loading = "lazy";
    el.append(img);
    return el;
  }
  el.style.background = avatarColor(seed);
  el.textContent = initialsFor(name);
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
  const today = new Date().toISOString().slice(0, 10);
  const next = sortSchedule(board.schedule ?? []).find((s) => `${s.date}` >= today);
  if (!next) return "No game night yet";
  return `Next: ${formatShortDate(next.date)}`;
}

// ---------- RAIL ----------
export function renderRail() {
  const items = store.state.boards.map((board) => {
    const active = board.id === store.state.activeBoardId && store.view === "board";

    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0;";

    const bar = document.createElement("span");
    bar.style.cssText = `position:absolute;left:-14px;width:4px;border-radius:0 3px 3px 0;background:var(--accent,#7c5cff);height:${active ? "30px" : "10px"};transition:height .15s;`;

    const ic = document.createElement("div");
    ic.title = board.name;
    ic.style.cssText = `width:46px;height:46px;border-radius:${active ? "14px" : "50%"};background:${board.accent};display:flex;align-items:center;justify-content:center;font-size:21px;cursor:pointer;border:${active ? "2px solid rgba(255,255,255,0.28)" : "2px solid transparent"};transition:border-radius .15s;`;
    ic.textContent = board.emoji;

    wrap.append(bar, ic);
    wrap.addEventListener("click", () => openBoard(board.id));
    return wrap;
  });
  elements.railBoards.replaceChildren(...items);
}

// ---------- DASHBOARD ----------
export function renderDashboard() {
  elements.dashBoardCount.textContent = `${store.state.boards.length} ${
    store.state.boards.length === 1 ? "board" : "boards"
  }`;

  renderNeeds();
  renderUpcoming();

  const cards = store.state.boards.map((board) => boardCard(board));
  cards.push(createCard());
  elements.boardCards.replaceChildren(...cards);
}

function boardCard(board) {
  const ids = memberIdsOf(board);
  const c = counts(board);
  const unread = unreadCount(board);

  const card = document.createElement("div");
  card.className = "board-card";
  card.addEventListener("click", () => openBoard(board.id));

  const header = document.createElement("div");
  header.className = "board-card-header";
  header.style.background = `linear-gradient(135deg,${board.accent}aa,${board.accent}22)`;
  const emoji = document.createElement("div");
  emoji.className = "board-card-emoji";
  emoji.textContent = board.emoji;
  header.append(emoji);
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

  const sub = document.createElement("div");
  sub.className = "board-card-sub";
  sub.textContent = board.subtitle || `${ids.length} ${ids.length === 1 ? "member" : "members"}`;

  const memberRow = document.createElement("div");
  memberRow.className = "board-card-members";
  const avatars = document.createElement("div");
  ids.slice(0, 4).forEach((uid) => {
    avatars.append(avatarEl(uid, plainName(board, uid), "av", photoURLFor(board, uid)));
  });
  const memberLabel = document.createElement("span");
  memberLabel.className = "more";
  memberLabel.textContent = `${ids.length} ${ids.length === 1 ? "member" : "members"}`;
  avatars.append(memberLabel);
  memberRow.append(avatars);

  const tags = document.createElement("div");
  tags.className = "board-card-tags";
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
  const cal = icon("calendar", { size: 14, className: "ico" });
  next.append(cal, document.createTextNode(nextSessionLabel(board)));

  body.append(name, sub, memberRow, tags, next);
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
      .forEach((g) => actions.push({ icon: "gamepad-2", title: `Vote: ${g.title}`, sub: board.name, boardId: board.id, tab: "roster" }));
    (board.schedule ?? [])
      .filter((s) => s.votes?.[uid] === undefined)
      .forEach((s) => actions.push({ icon: "calendar", title: `Vote on a time`, sub: board.name, boardId: board.id, tab: "schedule" }));
  });

  const top = actions.slice(0, 4);
  elements.needsSection.classList.toggle("hidden", top.length === 0);
  elements.needsCount.textContent = String(actions.length);

  elements.needsActions.replaceChildren(
    ...top.map((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "need-action";
      const ico = icon(a.icon, { size: 19 });
      const meta = document.createElement("span");
      const title = document.createElement("span");
      title.style.cssText = "display:block;font-size:13.5px;font-weight:700;color:#edeef5;";
      title.textContent = a.title;
      const sub = document.createElement("span");
      sub.style.cssText = "display:block;font-size:12px;color:#8b8da3;margin-top:2px;";
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

// Cross-board glanceable list of the soonest scheduled sessions — a summary,
// not a voting surface (that's still the board's own Schedule tab).
function renderUpcoming() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  store.state.boards.forEach((board) => {
    sortSchedule(board.schedule ?? [])
      .filter((s) => s.date >= today)
      .forEach((s) => rows.push({ session: s, boardId: board.id, boardName: board.name, boardEmoji: board.emoji }));
  });
  rows.sort((a, b) => `${a.session.date}T${a.session.start}`.localeCompare(`${b.session.date}T${b.session.start}`));
  const top = rows.slice(0, 5);

  if (!top.length) {
    const actions = store.state.boards.length
      ? [{
          label: "Propose a time",
          variant: "primary",
          onClick: () => {
            store.boardTab = "schedule";
            openBoard(store.state.boards[0].id);
          }
        }]
      : [{ label: "Create a board", variant: "primary", onClick: openCreateBoard }];
    elements.upcomingList.replaceChildren(emptyState("No game nights on the calendar yet", actions));
    return;
  }

  elements.upcomingList.replaceChildren(
    ...top.map(({ session, boardId, boardName, boardEmoji }) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "upcoming-row";

      const date = document.createElement("div");
      date.className = "upcoming-date";
      const dow = document.createElement("span");
      dow.className = "dow";
      dow.textContent = dowShort(session.date);
      const day = document.createElement("span");
      day.className = "day";
      day.textContent = dayNum(session.date);
      date.append(dow, day);

      const meta = document.createElement("div");
      meta.className = "upcoming-meta";
      const title = document.createElement("strong");
      title.textContent = session.activity || "Game night";
      const sub = document.createElement("span");
      sub.textContent = `${boardEmoji} ${boardName} · ${sessionTimeLabel(session.start, session.end)}`;
      meta.append(title, sub);

      row.append(date, meta);
      row.addEventListener("click", () => {
        store.boardTab = "schedule";
        openBoard(boardId);
      });
      return row;
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
  row.append(avatarEl(uid, name, "av", photoURLFor(board, uid)), meta);

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
      const sel = glyph === store.createDraft.emoji;
      b.style.cssText = `width:44px;height:44px;border-radius:12px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:${sel ? "#7c5cff1a" : "#15161f"};border:1px solid ${sel ? "var(--accent,#7c5cff)" : "#2a2c3d"};`;
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
      const sel = hex === store.createDraft.accent;
      b.style.cssText = `width:32px;height:32px;border-radius:50%;cursor:pointer;background:${hex};border:${sel ? "2px solid #fff" : "2px solid transparent"};box-shadow:${sel ? `0 0 14px -2px ${hex}` : "none"};`;
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
