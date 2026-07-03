// App chrome: screen routing, board tabs, chat collapse, modal + dropdown
// plumbing, and the toast. Pure UI state — feature modules call these to drive
// navigation. All visuals match the Huddle Game Hub design (inline styles).

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
  elements.dropdownBackdrop.classList.add("hidden");
}

function syncDropdownBackdrop() {
  const open = store.notifOpen || store.profileOpen;
  elements.dropdownBackdrop.classList.toggle("hidden", !open);
}

function toggleNotif() {
  store.notifOpen = !store.notifOpen;
  store.profileOpen = false;
  elements.notifMenu.classList.toggle("hidden", !store.notifOpen);
  elements.profileMenu.classList.add("hidden");
  syncDropdownBackdrop();
}

function toggleProfile() {
  store.profileOpen = !store.profileOpen;
  store.notifOpen = false;
  elements.profileMenu.classList.toggle("hidden", !store.profileOpen);
  elements.notifMenu.classList.add("hidden");
  syncDropdownBackdrop();
}

// Render board tab active state + active view (inline styling to match design).
export function renderTabs() {
  const roster = store.boardTab === "roster";
  elements.tabRoster.style.color = roster ? "#edeef5" : "#8b8da3";
  elements.tabRoster.style.borderBottomColor = roster ? "var(--accent,#7c5cff)" : "transparent";
  elements.tabSchedule.style.color = roster ? "#8b8da3" : "#edeef5";
  elements.tabSchedule.style.borderBottomColor = roster ? "transparent" : "var(--accent,#7c5cff)";
  elements.rosterView.classList.toggle("hidden", !roster);
  elements.scheduleView.classList.toggle("hidden", roster);
}

// ---------- invite notifications (board invites, accept/decline) ----------
export function showInviteNotifications(invites, onAccept) {
  if (!invites.length) return;

  invites.forEach((invite) => {
    const item = document.createElement("div");
    item.className = "notif-item";
    item.dataset.boardId = invite.boardId;
    item.style.cssText = "padding:12px 15px;border-bottom:1px solid #ffffff0d;";

    const msg = document.createElement("p");
    msg.style.cssText = "font-size:13px;color:#dcdde8;margin:0 0 9px;line-height:1.42;";
    msg.textContent = `${invite.invitedByName} invited you to ${invite.boardName}`;

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:10px;align-items:center;";

    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.style.cssText =
      "background:var(--accent,#7c5cff);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", () => {
      acceptBtn.disabled = true;
      acceptBtn.textContent = "Joining…";
      onAccept(invite)
        .then(() => {
          item.remove();
          updateNotifBadge();
        })
        .catch(() => {
          acceptBtn.disabled = false;
          acceptBtn.textContent = "Accept";
        });
    });

    const declineBtn = document.createElement("button");
    declineBtn.type = "button";
    declineBtn.style.cssText = "background:none;border:none;color:#8b8da3;font-size:12px;font-weight:600;cursor:pointer;";
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
  const count = elements.notifList.querySelectorAll(".notif-item, .notif-activity").length;
  elements.notifBadge.textContent = count;
  elements.notifBadge.classList.toggle("hidden", count === 0);
}

// ---------- push notification toggle ----------

function setPushButtonLabel(btn, text) {
  btn.replaceChildren(icon("bell"), document.createTextNode(text));
}

export function updatePushButton() {
  const btn = elements.enablePushButton;
  const settingsBtn = elements.enablePushButtonSettings;
  if (!btn) return;

  const apply = (text, disabled) => {
    setPushButtonLabel(btn, text);
    btn.disabled = disabled;
    if (settingsBtn) {
      settingsBtn.textContent = text;
      settingsBtn.disabled = disabled;
    }
  };

  if (!pushSupported()) {
    apply("Notifications unsupported", true);
    return;
  }
  const perm = currentPermission();
  if (perm === "granted") {
    apply("Notifications on", true);
  } else if (perm === "denied") {
    apply("Notifications blocked", true);
  } else {
    apply("Enable notifications", false);
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
  toast.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:60;background:#1b1c28;border:1px solid #2a2c3d;border-radius:12px;padding:13px 20px;font-size:13.5px;font-weight:600;box-shadow:0 20px 50px -15px #000;animation:hb-toast 2.6s ease forwards;display:flex;align-items:center;gap:9px;";
  const spark = document.createElement("span");
  spark.style.color = "var(--accent,#7c5cff)";
  spark.textContent = "✦";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(spark, text);
  document.body.append(toast);
  toastTimer = setTimeout(() => toast.remove(), 2600);
}

export function bindShellEvents() {
  elements.tabRoster.addEventListener("click", () => setTab("roster"));
  elements.tabSchedule.addEventListener("click", () => setTab("schedule"));
  elements.railLogo.addEventListener("click", goDashboard);
  elements.chatToggle.addEventListener("click", toggleChat);

  elements.notifButton.addEventListener("click", toggleNotif);
  elements.profileButton.addEventListener("click", toggleProfile);
  elements.dropdownBackdrop.addEventListener("click", closeMenus);
  elements.enablePushButton.addEventListener("click", handleEnablePush);
  elements.enablePushButtonSettings?.addEventListener("click", handleEnablePush);
  updatePushButton();
  elements.clearNotifsButton.addEventListener("click", () => {
    elements.notifList.replaceChildren();
    elements.notifBadge.classList.add("hidden");
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
