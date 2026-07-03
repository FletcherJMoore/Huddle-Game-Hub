// Notifications activity feed for the topbar popover. Items are derived from the
// current board state (votes you owe, times to RSVP, @mentions) and rendered
// below any pending board invites (which keep their own accept/decline flow).
//
// Also handles in-app chat notifications: an unread count in the browser tab
// title, and a toast when a new message arrives from someone else that you
// aren't looking at. Rides on the existing realtime sync — no push/FCM
// infrastructure involved.

import { store, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { displayName, unreadCount, plainName } from "../boards/board-model.js";
import { formatShortDate } from "../../utils/format.js";
import { openBoard, showToast, updateNotifBadge } from "../shell/shell.js";

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

function relativeTime(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function buildActivity() {
  const uid = store.currentUser?.uid;
  if (!uid) return [];
  const name = displayName();
  const mention = new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  const items = [];

  store.state.boards.forEach((board) => {
    (board.games ?? [])
      .filter((g) => g.status === "maybe" && g.approvals?.[uid] === undefined)
      .forEach((g) =>
        items.push({
          icon: "🗳",
          text: `Vote needed: ${g.title} in ${board.name}`,
          boardId: board.id,
          tab: "roster",
          time: g.createdAt
        })
      );

    (board.schedule ?? [])
      .filter((s) => s.date && s.votes?.[uid] === undefined)
      .forEach((s) =>
        items.push({
          icon: "📅",
          text: `RSVP: ${formatShortDate(s.date)} in ${board.name}`,
          boardId: board.id,
          tab: "schedule",
          time: s.date
        })
      );

    (board.messages ?? [])
      .filter((m) => m.authorUid && m.authorUid !== uid && mention.test(m.text || ""))
      .forEach((m) =>
        items.push({
          icon: "💬",
          text: `${m.author || "Someone"} mentioned you in # general`,
          boardId: board.id,
          tab: "roster",
          time: m.createdAt
        })
      );
  });

  return items.sort((a, b) => String(b.time).localeCompare(String(a.time))).slice(0, 12);
}

export function renderNotifications() {
  const list = elements.notifList;
  if (!list) return;

  // Clear previously-derived rows, leave invite items (.notif-item) untouched.
  list.querySelectorAll(".notif-activity, .notif-empty").forEach((n) => n.remove());

  const items = buildActivity();
  const hasInvites = Boolean(list.querySelector(".notif-item"));

  if (!items.length && !hasInvites) {
    const empty = document.createElement("div");
    empty.className = "notif-empty";
    empty.style.cssText = "padding:36px 16px;text-align:center;color:#6b6d85;font-size:13px;";
    empty.textContent = "You're all caught up";
    list.append(empty);
    updateNotifBadge();
    return;
  }

  items.forEach((it) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "notif-activity";
    row.style.cssText =
      "display:flex;gap:11px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #ffffff07;padding:12px 15px;cursor:pointer;";

    const icon = document.createElement("span");
    icon.style.cssText = "font-size:16px;line-height:1.3;";
    icon.textContent = it.icon;

    const body = document.createElement("div");
    body.style.cssText = "flex:1;min-width:0;";
    const text = document.createElement("div");
    text.style.cssText = "font-size:13px;color:#dcdde8;line-height:1.42;";
    text.textContent = it.text;
    const time = document.createElement("div");
    time.style.cssText = "font-size:11px;color:#6b6d85;margin-top:3px;";
    time.textContent = relativeTime(it.time);
    body.append(text, time);

    row.append(icon, body);
    row.addEventListener("click", () => {
      store.boardTab = it.tab;
      openBoard(it.boardId);
    });
    list.append(row);
  });

  updateNotifBadge();
}
