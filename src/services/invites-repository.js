import { httpsCallable } from "firebase/functions";
import { onValue, ref, update } from "firebase/database";

import { emailKey } from "../utils/invite.js";

// Create a pending invite for a board. Writes both the admin-facing pending
// record and the reverse lookup the `claimMyInvites` function reads when the
// invited person signs in and is joined to the board.
export async function createInvite(db, board, email, role, inviter) {
  const key = emailKey(email);
  const lowerEmail = String(email).trim().toLowerCase();
  const createdAt = new Date().toISOString();

  await update(ref(db), {
    [`invites/${board.id}/${key}`]: {
      email: lowerEmail,
      role,
      boardName: board.name,
      invitedByUid: inviter.uid,
      invitedByName: inviter.name,
      status: "pending",
      createdAt
    },
    [`emailInvites/${key}/${board.id}`]: {
      boardName: board.name,
      role,
      invitedByName: inviter.name,
      createdAt
    }
  });
}

export async function revokeInvite(db, boardId, key) {
  await update(ref(db), {
    [`invites/${boardId}/${key}`]: null,
    [`emailInvites/${key}/${boardId}`]: null
  });
}

// Live list of pending invites for a board (admin only, per DB rules).
export function subscribeToInvites(db, boardId, onChange) {
  return onValue(ref(db, `invites/${boardId}`), (snapshot) => {
    const value = snapshot.val() ?? {};
    onChange(
      Object.entries(value).map(([key, data]) => ({ key, ...data }))
    );
  });
}

// Ask the backend to join any boards this (verified) user was invited to by
// email. Returns the list of boards that were just joined, if any.
export async function claimInvites(functions) {
  if (!functions) return [];
  const callable = httpsCallable(functions, "claimMyInvites");
  const result = await callable();
  return result.data?.joined ?? [];
}
