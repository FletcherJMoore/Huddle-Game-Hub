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

  const cards = store.state.boards.map((board) => boardCard(board));
  cards.push(createCard());
  elements.boardCards.replaceChildren(...cards);
}

function boardCard(board) {
  const ids = memberIdsOf(board);
  const c = counts(board);
  const unread = unreadCount(board);

  const card = document.createElement("div");
  card.style.cssText =
    "background:#14151e;border:1px solid #23253560;border-radius:18px;overflow:hidden;cursor:pointer;transition:transform .14s,border-color .14s;";
  card.addEventListener("click", () => openBoard(board.id));
  card.addEventListener("mouseenter", () => {
    card.style.transform = "translateY(-3px)";
    card.style.borderColor = "#3a3c52";
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "";
    card.style.borderColor = "#23253560";
  });

  const header = document.createElement("div");
  header.style.cssText = `height:88px;background:linear-gradient(135deg,${board.accent}aa,${board.accent}22);position:relative;display:flex;align-items:center;padding:0 20px;`;
  const emoji = document.createElement("div");
  emoji.style.cssText =
    "width:50px;height:50px;border-radius:14px;background:#0b0c12cc;display:flex;align-items:center;justify-content:center;font-size:25px;backdrop-filter:blur(4px);";
  emoji.textContent = board.emoji;
  header.append(emoji);
  if (unread) {
    const badge = document.createElement("span");
    badge.style.cssText =
      "position:absolute;top:12px;right:14px;background:#ff5c7c;color:#fff;font-size:11px;font-weight:700;border-radius:999px;padding:3px 8px;";
    badge.textContent = `${unread} new`;
    header.append(badge);
  }

  const body = document.createElement("div");
  body.style.cssText = "padding:16px 18px 18px;";

  const name = document.createElement("div");
  name.style.cssText = "font-family:'Space Grotesk';font-weight:600;font-size:17px;margin-bottom:3px;";
  name.textContent = board.name;

  const sub = document.createElement("div");
  sub.style.cssText = "font-size:12.5px;color:#6b6d85;margin-bottom:14px;";
  sub.textContent = board.subtitle || `${ids.length} ${ids.length === 1 ? "member" : "members"}`;

  const memberRow = document.createElement("div");
  memberRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;";
  const avatars = document.createElement("div");
  avatars.style.cssText = "display:flex;align-items:center;";
  ids.slice(0, 4).forEach((uid) => {
    const av = document.createElement("div");
    av.style.cssText = `width:28px;height:28px;border-radius:50%;background:${avatarColor(uid)};border:2px solid #14151e;margin-left:-7px;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;color:#0b0c12;`;
    av.textContent = initialsFor(plainName(board, uid));
    avatars.append(av);
  });
  const memberLabel = document.createElement("span");
  memberLabel.style.cssText = "margin-left:8px;font-size:12px;color:#8b8da3;";
  memberLabel.textContent = `${ids.length} ${ids.length === 1 ? "member" : "members"}`;
  avatars.append(memberLabel);
  memberRow.append(avatars);

  const tags = document.createElement("div");
  tags.style.cssText = "display:flex;gap:7px;margin-top:15px;flex-wrap:wrap;";
  const rot = document.createElement("span");
  rot.style.cssText =
    "font-size:11.5px;font-weight:600;color:#56d364;background:#56d36412;border:1px solid #56d36430;padding:4px 9px;border-radius:8px;";
  rot.textContent = `${c.rotation} in rotation`;
  tags.append(rot);
  if (c.pending) {
    const pend = document.createElement("span");
    pend.style.cssText =
      "font-size:11.5px;font-weight:600;color:#ffb13d;background:#ffb13d12;border:1px solid #ffb13d30;padding:4px 9px;border-radius:8px;";
    pend.textContent = `${c.pending} to vote`;
    tags.append(pend);
  }

  const next = document.createElement("div");
  next.style.cssText =
    "margin-top:13px;padding-top:13px;border-top:1px solid #ffffff0a;font-size:12.5px;color:#a3a5bb;display:flex;align-items:center;gap:7px;";
  const cal = document.createElement("span");
  cal.style.color = "var(--accent,#7c5cff)";
  cal.textContent = "📅";
  next.append(cal, document.createTextNode(nextSessionLabel(board)));

  body.append(name, sub, memberRow, tags, next);
  card.append(header, body);
  return card;
}

function createCard() {
  const card = document.createElement("div");
  card.style.cssText =
    "border:1.5px dashed #2f3145;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:240px;cursor:pointer;color:#6b6d85;transition:border-color .15s,color .15s;";
  card.addEventListener("click", openCreateBoard);
  const plus = document.createElement("div");
  plus.style.cssText = "font-size:32px;font-weight:300;margin-bottom:6px;";
  plus.textContent = "+";
  const label = document.createElement("div");
  label.style.cssText = "font-size:14px;font-weight:600;";
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
      .forEach((g) => actions.push({ icon: "🗳", title: `Vote: ${g.title}`, sub: board.name, boardId: board.id, tab: "roster" }));
    (board.schedule ?? [])
      .filter((s) => s.votes?.[uid] === undefined)
      .forEach(() => actions.push({ icon: "📅", title: "Vote on a time", sub: board.name, boardId: board.id, tab: "schedule" }));
  });

  const top = actions.slice(0, 4);
  elements.needsStrip.classList.toggle("hidden", top.length === 0);
  elements.needsCount.textContent = String(actions.length);

  elements.needsActions.replaceChildren(
    ...top.map((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText =
        "display:flex;align-items:center;gap:11px;background:#0e0f17;border:1px solid #23253580;border-radius:13px;padding:12px 14px;cursor:pointer;text-align:left;transition:border-color .15s;";
      const ico = document.createElement("span");
      ico.style.fontSize = "19px";
      ico.textContent = a.icon;
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
