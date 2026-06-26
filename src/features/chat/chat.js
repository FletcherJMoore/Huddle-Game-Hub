// Persistent right-hand chat panel. Each board is one #general conversation.
// Read state is tracked per member as the timestamp of the last message seen.

import { store, activeBoard, saveLocal, pushBoard, updateActiveBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { canEditBoard, memberIdsOf, plainName, avatarColor, displayName } from "../boards/board-model.js";
import { initialsFor, timeLabel, sessionTimeLabel, formatShortDate } from "../../utils/format.js";
import { sortSchedule } from "../../utils/format.js";
import { emptyState } from "../../components/empty-state.js";

let lastThreadBoardId = null;

function sortedMessages(board) {
  return [...(board.messages ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function markRead(board) {
  if (!board || !store.currentUser) return;
  const msgs = board.messages ?? [];
  if (!msgs.length) return;
  const latest = msgs[msgs.length - 1].createdAt;
  board.reads = board.reads ?? {};
  if (board.reads[store.currentUser.uid] === latest) return;
  board.reads[store.currentUser.uid] = latest;
  saveLocal();
  pushBoard(board);
}

export function renderChat(board = activeBoard()) {
  if (!board || !store.currentUser) return;

  const count = memberIdsOf(board).length;
  elements.chatOnline.textContent = `${count} ${count === 1 ? "member" : "members"}`;

  if (!store.chatCollapsed) markRead(board);
  renderThread(board);

  const editable = canEditBoard(board);
  elements.chatMessage.disabled = !editable;
  elements.chatMessage.placeholder = editable ? "Message # general…" : "View only";
}

function renderThread(board) {
  const messages = sortedMessages(board);
  if (!messages.length) {
    elements.chatLog.replaceChildren(emptyState("No messages yet — say hi 👋"));
    return;
  }

  const log = elements.chatLog;
  const switched = lastThreadBoardId !== board.id;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
  log.replaceChildren(...messages.map((m) => messageEl(board, m)));
  if (switched || nearBottom) log.scrollTop = log.scrollHeight;
  lastThreadBoardId = board.id;
}

function messageEl(board, message) {
  // System messages (nudges, polls, shares) render centered.
  if (!message.authorUid) {
    const sys = document.createElement("div");
    sys.className = "chat-system";
    sys.textContent = message.text;
    return sys;
  }

  const mine = message.authorUid === store.currentUser?.uid;
  const wrap = document.createElement("div");
  wrap.className = `msg${mine ? " mine" : ""}`;

  const name = plainName(board, message.authorUid) || message.author || "Teammate";

  if (!mine) {
    const av = document.createElement("div");
    av.className = "av";
    av.style.background = avatarColor(message.authorUid);
    av.textContent = initialsFor(name);
    wrap.append(av);
  }

  const body = document.createElement("div");
  body.className = "msg-body";
  const meta = document.createElement("div");
  meta.className = "msg-meta";
  const nm = document.createElement("span");
  nm.className = "name";
  nm.style.color = mine ? "var(--accent)" : avatarColor(message.authorUid);
  nm.textContent = mine ? "You" : name;
  const time = document.createElement("span");
  time.className = "time";
  time.textContent = timeLabel(message.createdAt);
  meta.append(nm, time);

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = message.text;

  body.append(meta, bubble);
  wrap.append(body);
  return wrap;
}

function postMessage(text, { system = false } = {}) {
  const board = activeBoard();
  if (!board) return;
  if (!system && !canEditBoard(board)) return;
  const value = text.trim();
  if (!value) return;

  updateActiveBoard((b) => {
    b.messages = b.messages ?? [];
    b.messages.push({
      id: crypto.randomUUID(),
      author: system ? "Huddle" : displayName(),
      authorUid: system ? null : store.currentUser.uid,
      text: value,
      createdAt: new Date().toISOString()
    });
    if (!system) {
      b.reads = b.reads ?? {};
      b.reads[store.currentUser.uid] = new Date().toISOString();
    }
  });
}

export function bindChatEvents() {
  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    postMessage(elements.chatMessage.value);
    elements.chatMessage.value = "";
    elements.chatMessage.focus();
  });

  elements.quickPollButton.addEventListener("click", () => {
    postMessage("📊 Quick poll: what should we play tonight? Drop your pick 👇", { system: true });
  });

  elements.shareSessionButton.addEventListener("click", () => {
    const board = activeBoard();
    const next = sortSchedule(board?.schedule ?? [])[0];
    const text = next
      ? `📅 Next session: ${formatShortDate(next.date)} · ${sessionTimeLabel(next.start, next.end)} — ${next.activity || "Game night"}`
      : "📅 No session scheduled yet — propose a time!";
    postMessage(text, { system: true });
  });
}
