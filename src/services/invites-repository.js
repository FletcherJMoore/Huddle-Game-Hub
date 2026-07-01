import { httpsCallable } from "firebase/functions";
import { onValue, ref, update } from "firebase/database";

import { emailKey } from "../utils/invite.js";

// Create a pending invite for a board. Writes both the admin-facing pending
// record and the reverse lookup the Cloud Functions read.
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

// Returns boards this user has been invited to without joining them.
export async function getPendingInvites(functions) {
  if (!functions) return [];
  const callable = httpsCallable(functions, "getPendingInvites");
  const result = await callable();
  return result.data?.pending ?? [];
}

// Accepts a single invite — grants membership and clears the invite record.
export async function acceptInvite(functions, boardId) {
  if (!functions) throw new Error("Firebase functions not initialised.");
  const callable = httpsCallable(functions, "acceptInvite");
  const result = await callable({ boardId });
  return result.data;
}

// ---------- owner-only member management (server-authoritative) ----------

export async function updateMemberRole(functions, boardId, targetUid, role) {
  if (!functions) throw new Error("Firebase functions not initialised.");
  const result = await httpsCallable(functions, "setMemberRole")({ boardId, targetUid, role });
  return result.data;
}

export async function transferBoardOwnership(functions, boardId, targetUid) {
  if (!functions) throw new Error("Firebase functions not initialised.");
  const result = await httpsCallable(functions, "transferOwnership")({ boardId, targetUid });
  return result.data;
}

export async function removeBoardMember(functions, boardId, targetUid) {
  if (!functions) throw new Error("Firebase functions not initialised.");
  const result = await httpsCallable(functions, "removeMember")({ boardId, targetUid });
  return result.data;
}
