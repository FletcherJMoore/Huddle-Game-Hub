// Settings modal: Profile & status, Account (password + connected accounts),
// Notifications preferences, and Help. All visuals match the Huddle Game Hub
// design (inline styles).

import { store } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { displayName } from "../boards/board-model.js";
import { initialsFor, paintAvatar } from "../../utils/format.js";
import { closeMenus, showToast } from "../shell/shell.js";
import { render } from "../../state/store.js";
import {
  setDisplayName,
  setPhotoURL,
  updateUserPassword,
  linkGoogle,
  linkedProviders
} from "../../services/auth-service.js";
import { uploadAvatar } from "../../services/storage-service.js";
import { getPrefs, savePrefs, NOTIF_PREFS } from "../../utils/prefs.js";
import { PLATFORMS, ACCENT_OPTIONS } from "../../utils/constants.js";

const NAV = [
  { tab: "profile", icon: "👤", label: "Profile & status", title: "Profile & status", sub: "How the rest of your crew sees you." },
  { tab: "appearance", icon: "🎨", label: "Appearance", title: "Appearance", sub: "Make Huddle Game Hub feel like yours." },
  { tab: "account", icon: "⚙️", label: "Account settings", title: "Account settings", sub: "Sign-in, security, and connected accounts." },
  { tab: "notif", icon: "🔔", label: "Notifications", title: "Notifications", sub: "Choose what Huddle Game Hub pings you about." },
  { tab: "help", icon: "❓", label: "Help & feedback", title: "Help & feedback", sub: "Guides, shortcuts, and a line to the team." }
];

// ---------- open / close ----------
export function openSettings(tab) {
  store.settingsTab = tab || "profile";
  store.settingsOpen = true;
  closeMenus();
  render();
}

function closeSettings() {
  store.settingsOpen = false;
  elements.settingsModal.classList.add("hidden");
}

function setSettingsTab(tab) {
  store.settingsTab = tab;
  applyTab();
}

function applyTab() {
  const tab = store.settingsTab;
  const def = NAV.find((n) => n.tab === tab) ?? NAV[0];
  elements.settingsTitle.textContent = def.title;
  elements.settingsSub.textContent = def.sub;
  elements.paneProfile.classList.toggle("hidden", tab !== "profile");
  elements.paneAppearance.classList.toggle("hidden", tab !== "appearance");
  elements.paneAccount.classList.toggle("hidden", tab !== "account");
  elements.paneNotif.classList.toggle("hidden", tab !== "notif");
  elements.paneHelp.classList.toggle("hidden", tab !== "help");
  renderNav();
}

function renderNav() {
  elements.settingsNav.replaceChildren(
    ...NAV.map((n) => {
      const active = store.settingsTab === n.tab;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText = `display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:10px;cursor:pointer;border:none;text-align:left;white-space:nowrap;font-size:13.5px;font-weight:600;background:${active ? "#7c5cff1a" : "transparent"};color:${active ? "#edeef5" : "#8b8da3"};`;
      const ico = document.createElement("span");
      ico.style.cssText = "font-size:15px;width:18px;text-align:center;";
      ico.textContent = n.icon;
      btn.append(ico, document.createTextNode(n.label));
      btn.addEventListener("click", () => setSettingsTab(n.tab));
      return btn;
    })
  );
}

function feedback(el, message, kind) {
  el.textContent = message;
  el.classList.remove("hidden");
  el.style.color = kind === "err" ? "#ff9aac" : "#8be59a";
}

// ---------- render ----------
export function renderProfile() {
  if (!store.settingsOpen) {
    elements.settingsModal.classList.add("hidden");
    return;
  }
  const user = store.currentUser;
  if (!user) return;

  elements.settingsModal.classList.remove("hidden");

  paintAvatar(elements.settingsAvatar, user.photoURL, initialsFor(displayName()));
  elements.settingsName.textContent = displayName();
  elements.settingsEmail.textContent = user.email || "";

  renderProfileTab();
  renderAccountTab();
  renderNotifPrefs();
  renderPlatformPrefs();
  renderAccentPicker();
  applyTab();
}

function renderProfileTab() {
  const uid = store.currentUser?.uid;
  elements.profileNameInput.value = displayName();
  elements.profileStatusInput.value = uid ? getPrefs(uid).status : "";
}

function renderAccountTab() {
  const user = store.currentUser;
  if (!user) return;
  elements.accountEmail.value = user.email || "";
  const hasGoogle = linkedProviders(user).includes("google.com");
  elements.googleStatus.textContent = hasGoogle ? "Connected" : "Not connected";
  elements.googleStatus.style.color = hasGoogle ? "#56d364" : "#6b6d85";
  elements.googleLinkButton.textContent = hasGoogle ? "Linked" : "Link";
  elements.googleLinkButton.disabled = hasGoogle;
}

function renderNotifPrefs() {
  const uid = store.currentUser?.uid;
  if (!uid) return;
  const prefs = getPrefs(uid);
  elements.notifPrefs.replaceChildren(
    ...NOTIF_PREFS.map((p) => {
      const on = Boolean(prefs.notif[p.key]);
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid #ffffff08;";
      const meta = document.createElement("div");
      meta.style.cssText = "min-width:0;";
      const title = document.createElement("div");
      title.style.cssText = "font-size:14px;font-weight:600;color:#edeef5;";
      title.textContent = p.label;
      const sub = document.createElement("div");
      sub.style.cssText = "font-size:12px;color:#6b6d85;margin-top:2px;";
      sub.textContent = p.sub;
      meta.append(title, sub);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.style.cssText = `position:relative;width:40px;height:23px;border-radius:999px;border:none;cursor:pointer;flex-shrink:0;background:${on ? "var(--accent,#7c5cff)" : "#2a2c3d"};transition:background .15s;`;
      const knob = document.createElement("span");
      knob.style.cssText = `position:absolute;top:2px;left:${on ? "19px" : "2px"};width:19px;height:19px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 3px #0006;`;
      toggle.append(knob);
      toggle.addEventListener("click", () => {
        const cur = getPrefs(uid);
        cur.notif[p.key] = !cur.notif[p.key];
        savePrefs(uid, { notif: cur.notif });
        renderNotifPrefs();
      });

      row.append(meta, toggle);
      return row;
    })
  );
}

function renderPlatformPrefs() {
  const uid = store.currentUser?.uid;
  if (!uid) return;
  const prefs = getPrefs(uid);
  elements.prefPlatforms.replaceChildren(
    ...PLATFORMS.map((p) => {
      const sel = prefs.platforms.includes(p);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText = `font-size:13px;font-weight:600;padding:8px 14px;border-radius:9px;cursor:pointer;background:${sel ? "#7c5cff1a" : "#15161f"};border:1px solid ${sel ? "var(--accent,#7c5cff)" : "#2a2c3d"};color:${sel ? "var(--accent,#7c5cff)" : "#8b8da3"};`;
      btn.textContent = p;
      btn.addEventListener("click", () => {
        const cur = getPrefs(uid);
        const platforms = cur.platforms.includes(p)
          ? cur.platforms.filter((x) => x !== p)
          : [...cur.platforms, p];
        savePrefs(uid, { platforms });
        renderPlatformPrefs();
      });
      return btn;
    })
  );
}

// Personal accent color: overrides the current board's accent everywhere in
// this user's own view. "Auto" clears the override and follows the board.
function renderAccentPicker() {
  const uid = store.currentUser?.uid;
  if (!uid) return;
  const current = getPrefs(uid).accentOverride;

  const pick = (hex) => {
    savePrefs(uid, { accentOverride: hex });
    renderAccentPicker();
    render();
  };

  const autoBtn = document.createElement("button");
  autoBtn.type = "button";
  autoBtn.title = "Auto — match each board's color";
  const autoSelected = !current;
  autoBtn.style.cssText = `width:32px;height:32px;border-radius:50%;cursor:pointer;background:#15161f;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#8b8da3;border:${autoSelected ? "2px solid #fff" : "2px solid #2a2c3d"};box-shadow:${autoSelected ? "0 0 14px -2px var(--accent,#7c5cff)" : "none"};`;
  autoBtn.textContent = "A";
  autoBtn.addEventListener("click", () => pick(null));

  const swatches = ACCENT_OPTIONS.map((hex) => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = hex;
    const sel = hex === current;
    b.style.cssText = `width:32px;height:32px;border-radius:50%;cursor:pointer;background:${hex};border:${sel ? "2px solid #fff" : "2px solid transparent"};box-shadow:${sel ? `0 0 14px -2px ${hex}` : "none"};`;
    b.addEventListener("click", () => pick(hex));
    return b;
  });

  elements.accentPicker.replaceChildren(autoBtn, ...swatches);
}

// ---------- actions ----------
async function uploadAvatarPhoto(file) {
  const user = store.currentUser;
  if (!user || !store.services) return;
  if (!store.services.storage) {
    feedback(elements.avatarFeedback, "Photo uploads aren't available right now — try again later", "err");
    return;
  }
  feedback(elements.avatarFeedback, "Uploading…", "ok");
  try {
    const photoURL = await uploadAvatar(store.services.storage, user.uid, file);
    await setPhotoURL(user, photoURL);
    feedback(elements.avatarFeedback, "Photo updated", "ok");
    render();
  } catch (error) {
    console.error("Avatar upload failed", error);
    feedback(elements.avatarFeedback, error.message || "Couldn't upload that photo — try again", "err");
  }
}

async function saveProfile() {
  const uid = store.currentUser?.uid;
  const name = elements.profileNameInput.value.trim();
  if (uid) savePrefs(uid, { status: elements.profileStatusInput.value.trim() });
  try {
    if (name && name !== displayName() && store.currentUser) {
      await setDisplayName(store.currentUser, name);
    }
    feedback(elements.profileFeedback, "Profile saved", "ok");
    render();
  } catch (error) {
    console.error("Save profile failed", error);
    feedback(elements.profileFeedback, "Couldn't update your name — try again", "err");
  }
}

async function changePassword() {
  const a = elements.newPass.value;
  const b = elements.confirmPass.value;
  if (a.length < 6) {
    feedback(elements.passFeedback, "Password must be at least 6 characters", "err");
    return;
  }
  if (a !== b) {
    feedback(elements.passFeedback, "Passwords don't match", "err");
    return;
  }
  try {
    await updateUserPassword(store.currentUser, a);
    elements.newPass.value = "";
    elements.confirmPass.value = "";
    feedback(elements.passFeedback, "Password updated", "ok");
  } catch (error) {
    console.error("Password update failed", error);
    feedback(
      elements.passFeedback,
      error.code === "auth/requires-recent-login"
        ? "For security, log out and back in, then try again"
        : "Couldn't update password — try again",
      "err"
    );
  }
}

async function connectGoogle() {
  try {
    await linkGoogle(store.currentUser);
    renderAccountTab();
    showToast("Google connected");
  } catch (error) {
    console.error("Google link failed", error);
    showToast(
      error.code === "auth/credential-already-in-use" ? "That Google account is already in use" : "Couldn't connect Google"
    );
  }
}

export function bindProfileEvents() {
  elements.menuProfile.addEventListener("click", () => openSettings("profile"));
  elements.menuAccount.addEventListener("click", () => openSettings("account"));
  elements.menuNotif.addEventListener("click", () => openSettings("notif"));
  elements.menuHelp.addEventListener("click", () => openSettings("help"));

  elements.settingsBackButton.addEventListener("click", closeSettings);
  elements.settingsModal.addEventListener("click", (event) => {
    if (event.target === elements.settingsModal) closeSettings();
  });

  elements.saveProfileButton.addEventListener("click", saveProfile);
  elements.changePhotoButton.addEventListener("click", () => elements.avatarFileInput.click());
  elements.avatarFileInput.addEventListener("change", () => {
    const file = elements.avatarFileInput.files?.[0];
    elements.avatarFileInput.value = "";
    if (file) uploadAvatarPhoto(file);
  });
  elements.updatePassButton.addEventListener("click", changePassword);
  elements.googleLinkButton.addEventListener("click", connectGoogle);
  elements.sendFeedbackButton.addEventListener("click", () => {
    const text = (elements.feedbackText.value || "").trim();
    if (!text) {
      showToast("Write a little something first");
      return;
    }
    elements.feedbackText.value = "";
    showToast("Thanks for the feedback ✦");
  });
}
