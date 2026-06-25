// Messenger-style chat drawer. Each huddle is one group conversation; the user
// switches between them in the right-hand drawer. Read state is tracked per
// member as the timestamp of the last message they've seen.

import { store, boardById, saveLocal, pushBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { canEditBoard, memberName, profileFor, displayName } from "../boards/board-model.js";
import { initialsFor, timeLabel } from "../../utils/format.js";
import { emptyState } from "../../components/empty-state.js";

let lastThreadBoardId = null;

function conversations() {
  return store.state.boards;
}

function activeConversation() {
  return boardById(store.chat.activeBoardId) ?? conversations()[0] ?? null;
}

function sortedMessages(board) {
  return [...(board.messages ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function latestMessageTime(board) {
  const messages = board.messages ?? [];
  return messages.length ? messages[messages.length - 1].createdAt : "";
}

function hasUnread(board) {
  const latest = latestMessageTime(board);
  if (!latest) return false;
  const lastRead = board.reads?.[store.currentUser?.uid] ?? "";
  return latest > lastRead;
}

function markRead(board) {
  if (!board || !store.currentUser) return;
  const latest = latestMessageTime(board);
  if (!latest) return;
  board.reads = board.reads ?? {};
  if (board.reads[store.currentUser.uid] === latest) return;
  board.reads[store.currentUser.uid] = latest;
  saveLocal();
  pushBoard(board);
}

export function openChat() {
  store.chat.open = true;
  if (!store.chat.activeBoardId) store.chat.activeBoardId = conversations()[0]?.id ?? null;
  elements.chatDrawer.classList.remove("hidden");
  elements.chatBackdrop.classList.remove("hidden");
  elements.chatToggleButton.setAttribute("aria-expanded", "true");
  renderChat();
  elements.chatMessage?.focus();
}

export function closeChat() {
  store.chat.open = false;
  elements.chatDrawer.classList.add("hidden");
  elements.chatBackdrop.classList.add("hidden");
  elements.chatToggleButton.setAttribute("aria-expanded", "false");
}

function selectConversation(boardId) {
  store.chat.activeBoardId = boardId;
  renderChat();
}

function sendMessage(text) {
  const board = activeConversation();
  if (!board || !canEditBoard(board)) return;
  const value = text.trim();
  if (!value) return;

  board.messages = board.messages ?? [];
  const now = new Date().toISOString();
  board.messages.push({
    id: crypto.randomUUID(),
    author: displayName(),
    authorUid: store.currentUser.uid,
    text: value,
    createdAt: now
  });
  board.reads = board.reads ?? {};
  board.reads[store.currentUser.uid] = now;
  saveLocal();
  pushBoard(board);
  renderChat();
}

export function renderChat() {
  if (!store.currentUser) return;
  renderBadge();
  renderConversationPills();

  const board = activeConversation();
  if (store.chat.open && board) markRead(board);

  renderConversationHeader(board);
  renderThread(board);
  renderComposer(board);
}

function renderBadge() {
  const unread = conversations().filter((board) => hasUnread(board)).length;
  elements.chatBadge.textContent = String(unread);
  elements.chatBadge.classList.toggle("hidden", unread === 0);
  elements.chatToggleButton.classList.toggle("has-unread", unread > 0);
}

function renderConversationPills() {
  elements.conversationList.replaceChildren(
    ...conversations().map((board) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `conversation-pill${board.id === store.chat.activeBoardId ? " active" : ""}`;
      const label = document.createElement("span");
      label.className = "conversation-name";
      label.textContent = board.name;
      pill.append(label);
      if (hasUnread(board)) {
        const dot = document.createElement("span");
        dot.className = "unread-dot";
        pill.append(dot);
      }
      pill.addEventListener("click", () => selectConversation(board.id));
      return pill;
    })
  );
}

function renderConversationHeader(board) {
  if (!board) {
    elements.conversationHeader.replaceChildren();
    return;
  }
  const title = document.createElement("strong");
  title.textContent = board.name;
  const sub = document.createElement("span");
  const count = board.memberIds?.length ?? Object.keys(board.members ?? {}).length;
  sub.textContent = `${count} ${count === 1 ? "member" : "members"}`;
  elements.conversationHeader.replaceChildren(title, sub);
}

function renderThread(board) {
  if (!board) {
    elements.chatLog.replaceChildren(emptyState("No conversations yet"));
    return;
  }

  const messages = sortedMessages(board);
  if (!messages.length) {
    elements.chatLog.replaceChildren(emptyState("No messages yet — say hi 👋"));
    return;
  }

  // For each member (other than me), find the last message they have read.
  const memberIds = board.memberIds ?? Object.keys(board.members ?? {});
  const receiptsByMessage = new Map();
  memberIds
    .filter((uid) => uid !== store.currentUser?.uid)
    .forEach((uid) => {
      const lastRead = board.reads?.[uid];
      if (!lastRead) return;
      let target = null;
      messages.forEach((message) => {
        if (message.createdAt <= lastRead) target = message;
      });
      if (!target) return;
      if (!receiptsByMessage.has(target.id)) receiptsByMessage.set(target.id, []);
      receiptsByMessage.get(target.id).push(uid);
    });

  const nodes = [];
  messages.forEach((message) => {
    nodes.push(messageBubble(board, message));
    const seenBy = receiptsByMessage.get(message.id);
    if (seenBy?.length) nodes.push(receiptRow(board, seenBy));
  });

  // Keep the user's scroll position on live updates, but snap to the newest
  // message when switching conversations or when already at the bottom.
  const log = elements.chatLog;
  const switchedConversation = lastThreadBoardId !== board.id;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.replaceChildren(...nodes);
  if (switchedConversation || nearBottom) log.scrollTop = log.scrollHeight;
  lastThreadBoardId = board.id;
}

function messageBubble(board, message) {
  const mine = message.authorUid && message.authorUid === store.currentUser?.uid;
  const bubble = document.createElement("div");
  bubble.className = `message${mine ? " mine" : ""}`;
  if (!mine) {
    const author = document.createElement("strong");
    author.textContent = message.authorUid ? memberName(board, message.authorUid).replace(/\s*\(you\)$/, "") : message.author;
    bubble.append(author);
  }
  const text = document.createElement("span");
  text.textContent = message.text;
  const meta = document.createElement("div");
  meta.className = "meta-line";
  meta.textContent = timeLabel(message.createdAt);
  bubble.append(text, meta);
  return bubble;
}

function receiptRow(board, uids) {
  const row = document.createElement("div");
  row.className = "read-receipts";
  uids.forEach((uid) => {
    const name = profileFor(board, uid)?.name || "Teammate";
    const avatar = document.createElement("span");
    avatar.className = "receipt-avatar";
    avatar.textContent = initialsFor(name);
    avatar.title = `Seen by ${name}`;
    row.append(avatar);
  });
  return row;
}

function renderComposer(board) {
  const editable = board ? canEditBoard(board) : false;
  elements.chatMessage.disabled = !editable;
  elements.chatMessage.placeholder = editable ? "Message" : "View only";
  elements.chatForm.querySelector("button")?.toggleAttribute("disabled", !editable);
}

export function bindChatEvents() {
  elements.chatToggleButton.addEventListener("click", () => {
    if (store.chat.open) closeChat();
    else openChat();
  });
  elements.chatDrawerClose.addEventListener("click", closeChat);
  elements.chatBackdrop.addEventListener("click", closeChat);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && store.chat.open) closeChat();
  });

  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(elements.chatMessage.value);
    elements.chatMessage.value = "";
    elements.chatMessage.focus();
  });
}
