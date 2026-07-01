import { store, activeBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { isAdmin, memberIdsOf, avatarColor, plainName, displayName } from "../boards/board-model.js";
import { initialsFor } from "../../utils/format.js";
import { isValidEmail } from "../../utils/invite.js";
import { createInvite, revokeInvite, subscribeToInvites, removeMember } from "../../services/invites-repository.js";
import { openModal, showToast } from "../shell/shell.js";

let unsubscribeInvites = null;
let pendingInvites = [];

// Member-avatar cluster shown in the board header.
export function renderHeaderAvatars(board) {
  const ids = memberIdsOf(board);
  const avs = ids.slice(0, 5).map((uid) => {
    const av = document.createElement("div");
    av.title = plainName(board, uid);
    av.style.cssText = `width:32px;height:32px;border-radius:50%;background:${avatarColor(uid)};border:2px solid #0d0e16;margin-left:-8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0b0c12;position:relative;`;
    av.textContent = initialsFor(plainName(board, uid));
    const dot = document.createElement("span");
    dot.style.cssText = `position:absolute;bottom:-1px;right:-1px;width:9px;height:9px;border-radius:50%;background:${uid === store.currentUser?.uid ? "#56d364" : "#3a3c52"};border:2px solid #0d0e16;`;
    av.append(dot);
    return av;
  });

  elements.headerAvatars.replaceChildren(...avs);
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
  renderMembers();

  if (store.services && isAdmin()) {
    unsubscribeInvites = subscribeToInvites(store.services.db, board.id, (invites) => {
      pendingInvites = invites;
      renderPending();
    });
  }

  openModal("invite");
  setTimeout(() => elements.inviteEmail.focus(), 50);
}

// Current members with a Remove control (admins only). Removal runs server-side
// so the board drops out of the removed member's app live. Re-run from the app
// render loop while the invite modal is open so joins/leaves show in real time.
export function renderMembers() {
  const board = activeBoard();
  if (!board || !isAdmin()) {
    elements.memberList.replaceChildren();
    return;
  }

  const uid = store.currentUser?.uid;
  const ids = memberIdsOf(board);

  const heading = document.createElement("div");
  heading.style.cssText = "font-size:12.5px;font-weight:600;color:#a3a5bb;margin-bottom:8px;";
  heading.textContent = `Members · ${ids.length}`;

  const rows = ids.map((memberUid) => {
    const role = board.members?.[memberUid] || "editor";
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff08;";

    const av = document.createElement("div");
    av.style.cssText = `width:28px;height:28px;border-radius:50%;background:${avatarColor(memberUid)};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0b0c12;flex-shrink:0;`;
    av.textContent = initialsFor(plainName(board, memberUid));

    const info = document.createElement("div");
    info.style.cssText = "flex:1;min-width:0;";
    const name = document.createElement("div");
    name.style.cssText =
      "font-size:13px;color:#c9cbe0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    name.textContent =
      memberUid === uid ? `${plainName(board, memberUid)} (you)` : plainName(board, memberUid);
    const roleLbl = document.createElement("div");
    roleLbl.style.cssText = "font-size:11px;color:#6b6d85;text-transform:capitalize;";
    roleLbl.textContent = role;
    info.append(name, roleLbl);

    row.append(av, info);

    if (memberUid !== uid) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.style.cssText =
        "background:none;border:none;color:#ff8095;font-size:12px;font-weight:600;cursor:pointer;";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        const label = plainName(board, memberUid);
        if (!window.confirm(`Remove ${label} from this board?`)) return;
        remove.disabled = true;
        remove.textContent = "Removing…";
        removeMember(store.services.functions, board.id, memberUid)
          .then(() => {
            row.remove();
            heading.textContent = `Members · ${elements.memberList.querySelectorAll(".member-row").length}`;
            showToast(`Removed ${label}`);
          })
          .catch((err) => {
            console.error("Remove member failed", err);
            remove.disabled = false;
            remove.textContent = "Remove";
            setFeedback(`Couldn't remove ${label} — try again.`, true);
          });
      });
      row.append(remove);
    }

    row.className = "member-row";
    return row;
  });

  elements.memberList.replaceChildren(heading, ...rows);
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
        row.style.cssText =
          "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #ffffff08;";
        const email = document.createElement("span");
        email.style.cssText = "font-size:13px;color:#c9cbe0;";
        email.textContent = invite.email;
        const revoke = document.createElement("button");
        revoke.type = "button";
        revoke.style.cssText = "background:none;border:none;color:#8b8da3;font-size:12px;font-weight:600;cursor:pointer;";
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
  elements.inviteFeedback.style.color = isError ? "#ff9aac" : "#8be59a";
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
    setFeedback(`Invited ${email} — they'll join automatically.`);
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
