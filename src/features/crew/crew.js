import { store, activeBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { isAdmin, memberIdsOf, avatarColor, plainName, displayName } from "../boards/board-model.js";
import { initialsFor } from "../../utils/format.js";
import { isValidEmail } from "../../utils/invite.js";
import { createInvite, revokeInvite, subscribeToInvites } from "../../services/invites-repository.js";
import { openModal, showToast } from "../shell/shell.js";

let unsubscribeInvites = null;
let pendingInvites = [];

// Member-avatar cluster shown in the board header.
export function renderHeaderAvatars(board) {
  const ids = memberIdsOf(board);
  const avs = ids.slice(0, 5).map((uid) => {
    const av = document.createElement("div");
    av.className = "av";
    av.style.background = avatarColor(uid);
    av.textContent = initialsFor(plainName(board, uid));
    av.title = plainName(board, uid);
    const dot = document.createElement("span");
    dot.className = "av-status";
    dot.style.background = uid === store.currentUser?.uid ? "#56d364" : "#3a3c52";
    av.append(dot);
    return av;
  });

  const more = document.createElement("span");
  more.className = "more";
  more.textContent = `${ids.length} ${ids.length === 1 ? "member" : "members"}`;

  elements.headerAvatars.replaceChildren(...avs, more);
}

// ---------- invite modal ----------
export function openInvite() {
  const board = activeBoard();
  elements.inviteBoardName.textContent = board.name;
  setFeedback("");
  elements.inviteEmail.value = "";

  if (unsubscribeInvites) {
    unsubscribeInvites();
    unsubscribeInvites = null;
  }
  pendingInvites = [];
  renderPending();

  if (store.services && isAdmin()) {
    unsubscribeInvites = subscribeToInvites(store.services.db, board.id, (invites) => {
      pendingInvites = invites;
      renderPending();
    });
  }

  openModal("invite");
  setTimeout(() => elements.inviteEmail.focus(), 50);
}

function renderPending() {
  if (!isAdmin() || !pendingInvites.length) {
    elements.pendingInvites.replaceChildren();
    return;
  }
  elements.pendingInvites.replaceChildren(
    ...pendingInvites
      .slice()
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
      .map((invite) => {
        const row = document.createElement("div");
        row.className = "pending-invite";
        const email = document.createElement("span");
        email.className = "email";
        email.textContent = invite.email;
        const revoke = document.createElement("button");
        revoke.type = "button";
        revoke.className = "link-btn";
        revoke.textContent = "Revoke";
        revoke.addEventListener("click", () => {
          revokeInvite(store.services.db, activeBoard().id, invite.key).catch((e) =>
            console.error("Revoke failed", e)
          );
        });
        row.append(email, revoke);
        return row;
      })
  );
}

function setFeedback(message, isError = false) {
  elements.inviteFeedback.textContent = message;
  elements.inviteFeedback.classList.toggle("hidden", !message);
  elements.inviteFeedback.classList.toggle("error", Boolean(isError));
}

async function handleInvite(rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return;
  if (!isValidEmail(email)) return setFeedback("That doesn't look like a valid email.", true);

  const board = activeBoard();
  if (!isAdmin()) return setFeedback("Only admins can invite people.", true);
  if (email === store.currentUser?.email?.toLowerCase()) return setFeedback("That's you 🙂", true);
  if (Object.values(board.memberProfiles ?? {}).some((p) => p.email?.toLowerCase() === email)) {
    return setFeedback("They're already in this board.", true);
  }

  setFeedback("Inviting…");
  try {
    await createInvite(store.services.db, board, email, "editor", {
      uid: store.currentUser.uid,
      name: displayName()
    });
    setFeedback(`Invited ${email} — they'll join when they next sign in.`);
    elements.inviteEmail.value = "";
  } catch (error) {
    console.error("Invite failed", error);
    setFeedback("Couldn't create that invite — try again.", true);
  }
}

export function bindCrewEvents() {
  elements.inviteButton.addEventListener("click", openInvite);
  elements.inviteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleInvite(elements.inviteEmail.value);
  });
}
