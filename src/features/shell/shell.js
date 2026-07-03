// App chrome: screen routing, board tabs, chat collapse, modal + menu plumbing,
// and the toast. Pure UI state — feature modules call these to drive navigation.

import { store, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { enablePush, pushSupported, currentPermission } from "../../services/push-service.js";
import { icon } from "../../utils/icons.js";

const MODALS = {
  proposeGame: elements.modalProposeGame,
  invite: elements.modalInvite,
  proposeTime: elements.modalProposeTime,
  createBoard: elements.modalCreateBoard
};

export function setView(view) {
  store.view = view;
  closeMenus();
  render();
}

export function openBoard(boardId) {
  store.state.activeBoardId = boardId;
  store.view = "board";
  store.boardTab = "roster";
  closeMenus();
  render();
}

export function goDashboard() {
  store.view = "dashboard";
  closeMenus();
  render();
}

export function setTab(tab) {
  store.boardTab = tab;
  render();
}

export function toggleChat() {
  store.chatCollapsed = !store.chatCollapsed;
  applyChatState();
}

function applyChatState() {
  elements.chatPanel.classList.toggle("collapsed", store.chatCollapsed);
  elements.chatToggle.replaceChildren(icon(store.chatCollapsed ? "chevron-right" : "chevron-left"));
}

export function openModal(name) {
  store.modal = name;
  closeMenus();
  elements.modalRoot.classList.remove("hidden");
  Object.entries(MODALS).forEach(([key, node]) => node.classList.toggle("hidden", key !== name));
}

export function closeModal() {
  store.modal = null;
  elements.modalRoot.classList.add("hidden");
}

export function closeMenus() {
  store.notifOpen = false;
  store.profileOpen = false;
  elements.notifMenu.classList.add("hidden");
  elements.profileMenu.classList.add("hidden");
  elements.notifButton.setAttribute("aria-expanded", "false");
  elements.profileButton.setAttribute("aria-expanded", "false");
}

function toggleNotif() {
  store.notifOpen = !store.notifOpen;
  store.profileOpen = false;
  elements.notifMenu.classList.toggle("hidden", !store.notifOpen);
  elements.profileMenu.classList.add("hidden");
}

function toggleProfile() {
  store.profileOpen = !store.profileOpen;
  store.notifOpen = false;
  elements.profileMenu.classList.toggle("hidden", !store.profileOpen);
  elements.notifMenu.classList.add("hidden");
}

// Render board tab active state + active view.
export function renderTabs() {
  const roster = store.boardTab === "roster";
  elements.tabRoster.classList.toggle("active", roster);
  elements.tabSchedule.classList.toggle("active", !roster);
  elements.rosterView.classList.toggle("hidden", !roster);
  elements.scheduleView.classList.toggle("hidden", roster);
}

// ---------- invite notifications ----------

export function showInviteNotifications(invites, onAccept) {
  if (!invites.length) return;

  invites.forEach((invite) => {
    const item = document.createElement("div");
    item.className = "notif-item";
    item.dataset.boardId = invite.boardId;

    const msg = document.createElement("p");
    msg.className = "notif-msg";
    msg.textContent = `${invite.invitedByName} invited you to ${invite.boardName}`;

    const actions = document.createElement("div");
    actions.className = "notif-actions";

    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = "btn-primary btn-sm";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", () => {
      acceptBtn.disabled = true;
      acceptBtn.textContent = "Joining…";
      onAccept(invite).then(() => item.remove()).catch(() => {
        acceptBtn.disabled = false;
        acceptBtn.textContent = "Accept";
      });
      updateNotifBadge();
    });

    const declineBtn = document.createElement("button");
    declineBtn.type = "button";
    declineBtn.className = "link-btn";
    declineBtn.textContent = "Decline";
    declineBtn.addEventListener("click", () => {
      item.remove();
      updateNotifBadge();
    });

    actions.append(acceptBtn, declineBtn);
    item.append(msg, actions);
    elements.notifList.prepend(item);
  });

  updateNotifBadge();
}

export function updateNotifBadge() {
  const count = elements.notifList.querySelectorAll(".notif-item").length;
  elements.notifBadge.textContent = count;
  elements.notifBadge.classList.toggle("hidden", count === 0);
}

// ---------- push notification toggle ----------

function setPushButtonLabel(btn, text) {
  btn.replaceChildren(icon("bell"), document.createTextNode(text));
}

export function updatePushButton() {
  const btn = elements.enablePushButton;
  if (!btn) return;
  if (!pushSupported()) {
    setPushButtonLabel(btn, "Notifications unsupported");
    btn.disabled = true;
    return;
  }
  const perm = currentPermission();
  if (perm === "granted") {
    setPushButtonLabel(btn, "Notifications on");
    btn.disabled = true;
  } else if (perm === "denied") {
    setPushButtonLabel(btn, "Notifications blocked");
    btn.disabled = true;
  } else {
    setPushButtonLabel(btn, "Enable notifications");
    btn.disabled = false;
  }
}

const PUSH_ERRORS = {
  denied: "Notifications blocked — enable them in your browser settings.",
  "missing-vapid": "Push isn't configured yet (missing VAPID key).",
  unsupported: "This browser doesn't support push notifications.",
  "no-token": "Couldn't register this device for notifications."
};

async function handleEnablePush() {
  elements.enablePushButton.disabled = true;
  elements.enablePushButton.textContent = "🔔 Enabling…";
  try {
    await enablePush(store.services, store.currentUser.uid);
    showToast("🔔 Notifications enabled");
  } catch (error) {
    showToast(PUSH_ERRORS[error.message] || "Couldn't enable notifications.");
    console.error("enablePush failed", error);
  } finally {
    updatePushButton();
  }
}

let toastTimer = null;
export function showToast(message) {
  document.querySelectorAll(".app-toast").forEach((t) => t.remove());
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement("div");
  toast.className = "app-toast";
  const spark = document.createElement("span");
  spark.className = "spark";
  spark.textContent = "✦";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(spark, text);
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

export function bindShellEvents() {
  elements.tabRoster.addEventListener("click", () => setTab("roster"));
  elements.tabSchedule.addEventListener("click", () => setTab("schedule"));
  elements.railLogo.addEventListener("click", goDashboard);
  elements.chatToggle.addEventListener("click", toggleChat);

  elements.notifButton.addEventListener("click", toggleNotif);
  elements.profileButton.addEventListener("click", toggleProfile);
  elements.enablePushButton.addEventListener("click", handleEnablePush);
  updatePushButton();
  elements.clearNotifsButton.addEventListener("click", () => {
    elements.notifList.replaceChildren();
    elements.notifBadge.classList.add("hidden");
  });

  // Close menus / modal on outside click + Escape.
  document.addEventListener("click", (event) => {
    const inMenu = event.target.closest(".menu-anchor");
    if (!inMenu && (store.notifOpen || store.profileOpen)) closeMenus();
  });

  elements.modalRoot.addEventListener("click", (event) => {
    if (event.target === elements.modalRoot) closeModal();
  });
  document.querySelectorAll(".modal-cancel").forEach((btn) =>
    btn.addEventListener("click", closeModal)
  );
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (store.modal) closeModal();
    else closeMenus();
  });

  applyChatState();
}
