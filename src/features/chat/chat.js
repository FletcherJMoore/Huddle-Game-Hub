// Persistent right-hand chat panel. Each board is one #general conversation.
// Read state is tracked per member as the timestamp of the last message seen.

import { store, activeBoard, saveLocal, pushBoard, updateActiveBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { canEditBoard, memberIdsOf, plainName, avatarColor, photoURLFor, displayName } from "../boards/board-model.js";
import { initialsFor, timeLabel, sessionTimeLabel, formatShortDate, sortSchedule } from "../../utils/format.js";
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
  elements.chatOnline.textContent = `${count} online now`;

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
  // System messages render centered.
  if (!message.authorUid) {
    const sys = document.createElement("div");
    sys.style.cssText = "text-align:center;font-size:11.5px;color:#6b6d85;padding:2px 8px;";
    sys.textContent = message.text;
    return sys;
  }

  const mine = message.authorUid === store.currentUser?.uid;
  const name = mine ? "You" : plainName(board, message.authorUid) || message.author || "Teammate";
  const color = mine ? "var(--accent,#7c5cff)" : avatarColor(message.authorUid);

  const wrap = document.createElement("div");
  wrap.style.cssText = `display:flex;gap:10px;${mine ? "flex-direction:row-reverse;" : ""}`;

  if (!mine) {
    const photoURL = photoURLFor(board, message.authorUid);
    const av = document.createElement("div");
    av.style.cssText = `width:30px;height:30px;border-radius:50%;background:${avatarColor(message.authorUid)};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0b0c12;overflow:hidden;`;
    if (photoURL) {
      const img = document.createElement("img");
      img.src = photoURL;
      img.alt = "";
      img.style.cssText = "width:100%;height:100%;object-fit:cover;";
      av.append(img);
    } else {
      av.textContent = initialsFor(name === "You" ? displayName() : name);
    }
    wrap.append(av);
  }

  const body = document.createElement("div");
  body.style.cssText = `min-width:0;${mine ? "display:flex;flex-direction:column;align-items:flex-end;" : ""}`;
  const meta = document.createElement("div");
  meta.style.cssText = "display:flex;align-items:baseline;gap:7px;margin-bottom:3px;";
  const nm = document.createElement("span");
  nm.style.cssText = `font-size:12.5px;font-weight:700;color:${color};`;
  nm.textContent = name;
  const time = document.createElement("span");
  time.style.cssText = "font-size:10.5px;color:#5a5c72;";
  time.textContent = timeLabel(message.createdAt);
  meta.append(nm, time);

  const bubble = document.createElement("div");
  bubble.style.cssText = `font-size:13.5px;line-height:1.45;color:#d7d8e6;background:${mine ? "#7c5cff22" : "#15161f"};border:1px solid ${mine ? "#7c5cff44" : "#23253560"};padding:8px 11px;border-radius:${mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px"};display:inline-block;`;
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
      author: system ? "Huddle Game Hub" : displayName(),
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
