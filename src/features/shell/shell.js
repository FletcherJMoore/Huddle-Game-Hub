// App chrome: view switching, permission gating, and the nav/profile menu.

import { store, activeBoard, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { ROLE_LABELS } from "../../utils/constants.js";
import { currentRole, canEdit, isAdmin } from "../boards/board-model.js";

export function setView(view) {
  store.currentView = view;
  closeProfileMenu();
  render();
}

function closeProfileMenu() {
  elements.profileMenu.classList.add("hidden");
  elements.profileButton.setAttribute("aria-expanded", "false");
}

export function renderView() {
  const isSettings = store.currentView === "settings";
  elements.boardView.classList.toggle("hidden", isSettings);
  elements.settingsView.classList.toggle("hidden", !isSettings);
  elements.boardsNavButton.classList.toggle("active", !isSettings);
  elements.settingsNavButton.classList.toggle("active", isSettings);
  elements.viewEyebrow.textContent = isSettings ? "Settings" : "Huddle";
  elements.viewTitle.textContent = isSettings ? "Account settings" : activeBoard().name;
}

export function renderPermissions() {
  const roleLabel = ROLE_LABELS[currentRole()];

  elements.roleBadge.textContent = roleLabel;
  elements.settingsRoleBadge.textContent = roleLabel;
  elements.adminSettingsPanel.classList.toggle("hidden", !isAdmin());
  elements.activeBoardName.disabled = !isAdmin();
  elements.deleteBoardButton.classList.toggle("hidden", !isAdmin());
  document.querySelectorAll(".editor-control").forEach((control) => {
    control.classList.toggle("hidden", !canEdit());
  });
  document.querySelectorAll(".admin-control").forEach((control) => {
    control.classList.toggle("hidden", !isAdmin());
  });
}

export function bindShellEvents() {
  elements.boardsNavButton.addEventListener("click", () => setView("boards"));
  elements.settingsNavButton.addEventListener("click", () => setView("settings"));
  elements.profileSettingsButton.addEventListener("click", () => setView("settings"));
  elements.themeToggleButton.addEventListener("click", closeProfileMenu);
  elements.settingsThemeButton.addEventListener("click", () => {});

  elements.profileButton.addEventListener("click", () => {
    const isOpen = elements.profileMenu.classList.toggle("hidden") === false;
    elements.profileButton.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!elements.profileMenu.contains(event.target) && !elements.profileButton.contains(event.target)) {
      closeProfileMenu();
    }
  });
}
