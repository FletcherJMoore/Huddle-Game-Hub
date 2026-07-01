// In-app chat notifications: an unread count in the browser tab title, and a
// toast when a new message arrives from someone else that you aren't looking at.
// Rides on the existing realtime sync — no push/FCM infrastructure involved.

import { store, render } from "../../state/store.js";
import { unreadCount, plainName } from "../boards/board-model.js";
import { showToast } from "../shell/shell.js";

const BASE_TITLE = document.title || "Huddle";

// boardId -> createdAt of the newest message we've already accounted for, so we
// only toast messages that are genuinely new since the last cloud update.
const lastSeen = new Map();

// Reflect total unread chat across all boards in the tab title, e.g. "(3) Huddle".
export function updateTitleBadge() {
  if (!store.currentUser) {
    document.title = BASE_TITLE;
    return;
  }
  const total = store.state.boards.reduce((sum, board) => sum + unreadCount(board), 0);
  document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;
}

function isViewing(boardId) {
  return (
    store.view === "board" &&
    store.state.activeBoardId === boardId &&
    !store.chatCollapsed &&
    document.hasFocus()
  );
}

// Called after each batch of cloud boards is applied. Toasts new messages from
// other members in boards the user isn't actively watching.
export function notifyIncoming() {
  const uid = store.currentUser?.uid;
  store.state.boards.forEach((board) => {
    const msgs = board.messages ?? [];
    const latest = msgs.length ? msgs[msgs.length - 1] : null;
    const prev = lastSeen.get(board.id);
    lastSeen.set(board.id, latest?.createdAt ?? "");

    if (prev === undefined) return; // first sight of this board — prime, don't toast history
    if (!latest || latest.createdAt <= prev) return; // nothing new
    if (!latest.authorUid || latest.authorUid === uid) return; // system or own message
    if (isViewing(board.id)) return; // they're already reading it

    const who = plainName(board, latest.authorUid) || latest.author || "Someone";
    const preview = latest.text.length > 60 ? `${latest.text.slice(0, 57)}…` : latest.text;
    showToast(`💬 ${who} in ${board.name}: ${preview}`);
  });
}

// Returning to the tab while a chat is open should clear its unread badge — a
// re-render runs the chat's markRead and refreshes the title.
export function bindNotificationEvents() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && store.currentUser) render();
  });
}
