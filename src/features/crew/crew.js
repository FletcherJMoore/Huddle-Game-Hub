import { store, activeBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { ROLE_LABELS } from "../../utils/constants.js";
import { normalizeRole, profileFor, displayName, isAdmin } from "../boards/board-model.js";
import { initialsFor } from "../../utils/format.js";
import { isValidEmail } from "../../utils/invite.js";
import { emptyState } from "../../components/empty-state.js";
import { createInvite, revokeInvite, subscribeToInvites } from "../../services/invites-repository.js";

// Live pending invites for whichever board is currently shown. We keep a single
// subscription and swap it when the active board changes.
let invitesBoardId = null;
let unsubscribeInvites = null;
let pendingInvites = [];

export function renderCrew(board) {
  watchInvitesFor(board);

  const memberIds = board.memberIds ?? Object.keys(board.members ?? {});
  const rows = memberIds.map((uid) => {
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

  renderPendingInvites();
}

// (Re)subscribe to the active board's pending invites. Only admins can read the
// invites node under the DB rules, so non-admins just clear the list.
function watchInvitesFor(board) {
  if (invitesBoardId === board.id) return;
  invitesBoardId = board.id;
  if (unsubscribeInvites) {
    unsubscribeInvites();
    unsubscribeInvites = null;
  }
  pendingInvites = [];

  if (!store.services || !isAdmin()) {
    renderPendingInvites();
    return;
  }

  unsubscribeInvites = subscribeToInvites(store.services.db, board.id, (invites) => {
    pendingInvites = invites;
    renderPendingInvites();
  });
}

function renderPendingInvites() {
  if (!elements.pendingInvites) return;

  if (!isAdmin() || !pendingInvites.length) {
    elements.pendingInvites.replaceChildren();
    return;
  }

  const heading = document.createElement("p");
  heading.className = "pending-heading";
  heading.textContent = "Pending invites";

  const rows = pendingInvites
    .slice()
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
    .map((invite) => {
      const row = document.createElement("div");
      row.className = "pending-invite";

      const email = document.createElement("span");
      email.className = "pending-email";
      email.textContent = invite.email;

      const revoke = document.createElement("button");
      revoke.type = "button";
      revoke.className = "text-button subtle small";
      revoke.textContent = "Revoke";
      revoke.addEventListener("click", () => {
        revokeInvite(store.services.db, invitesBoardId, invite.key).catch((error) => {
          console.error("Failed to revoke invite", error);
        });
      });

      row.append(email, revoke);
      return row;
    });

  elements.pendingInvites.replaceChildren(heading, ...rows);
}

function setInviteFeedback(message = "", isError = false) {
  elements.inviteFeedback.textContent = message;
  elements.inviteFeedback.classList.toggle("hidden", !message);
  elements.inviteFeedback.classList.toggle("error", Boolean(isError));
}

async function handleInvite(rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return;
  if (!isValidEmail(email)) {
    setInviteFeedback("That doesn't look like a valid email.", true);
    return;
  }

  const board = activeBoard();
  if (!isAdmin()) {
    setInviteFeedback("Only admins can invite people.", true);
    return;
  }
  if (email === store.currentUser?.email?.toLowerCase()) {
    setInviteFeedback("That's you — you're already in this huddle.", true);
    return;
  }
  if (board.memberProfiles && Object.values(board.memberProfiles).some((p) => p.email?.toLowerCase() === email)) {
    setInviteFeedback("They're already in this huddle.", true);
    return;
  }

  setInviteFeedback("Inviting…");
  try {
    await createInvite(store.services.db, board, email, "editor", {
      uid: store.currentUser.uid,
      name: displayName()
    });
    setInviteFeedback(`Invited ${email} — they'll join when they next sign in.`);
    elements.inviteForm.reset();
  } catch (error) {
    console.error("Invite failed", error);
    setInviteFeedback("Couldn't create that invite — please try again.", true);
  }
}

export function bindCrewEvents() {
  elements.inviteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleInvite(elements.inviteEmail.value);
  });
}
