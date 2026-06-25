import { store } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { ROLE_LABELS } from "../../utils/constants.js";
import { normalizeRole, profileFor, displayName } from "../boards/board-model.js";
import { initialsFor } from "../../utils/format.js";
import { emptyState } from "../../components/empty-state.js";

export function renderCrew(board) {
  elements.inviteCode.value = board.id;

  const rows = board.memberIds.map((uid) => {
    const role = board.members[uid] === true ? "admin" : normalizeRole(board.members[uid]);
    const isSelf = uid === store.currentUser?.uid;
    const name = profileFor(board, uid)?.name || (isSelf ? displayName() : "Teammate");

    const row = document.createElement("div");
    row.className = "crew-member";
    const avatar = document.createElement("span");
    avatar.className = "crew-avatar";
    avatar.textContent = initialsFor(name);
    const meta = document.createElement("div");
    meta.className = "crew-meta";
    const strong = document.createElement("strong");
    strong.textContent = name + (isSelf ? " (you)" : "");
    const span = document.createElement("span");
    span.textContent = profileFor(board, uid)?.email || "Member";
    meta.append(strong, span);
    const badge = document.createElement("span");
    badge.className = "role-badge";
    badge.textContent = ROLE_LABELS[role];
    row.append(avatar, meta, badge);
    return row;
  });
  elements.peopleList.replaceChildren(...(rows.length ? rows : [emptyState("No crew yet")]));
}

export function bindCrewEvents() {
  elements.copyInviteButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.inviteCode.value);
      const original = elements.copyInviteButton.textContent;
      elements.copyInviteButton.textContent = "Copied!";
      setTimeout(() => {
        elements.copyInviteButton.textContent = original;
      }, 1400);
    } catch {
      elements.inviteCode.select();
    }
  });
}
