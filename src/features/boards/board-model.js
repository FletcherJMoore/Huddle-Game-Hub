// Board/account domain logic: normalization, roles, and member identity.

import { store, activeBoard } from "../../state/store.js";
import { PLATFORMS, BUCKET_KEYS } from "../../utils/constants.js";

export function displayName() {
  const user = store.currentUser;
  if (!user) return "User";
  if (user.displayName) return user.displayName;
  return user.email ? user.email.split("@")[0] : "User";
}

export function currentProfile() {
  return { name: displayName(), email: store.currentUser?.email ?? "" };
}

export function profileFor(board, uid) {
  return board.memberProfiles?.[uid] ?? null;
}

export function memberName(board, uid) {
  if (uid === store.currentUser?.uid) return `${displayName()} (you)`;
  return profileFor(board, uid)?.name || "Teammate";
}

export function normalizeRole(role) {
  return ["admin", "editor", "viewer"].includes(role) ? role : "viewer";
}

export function roleForBoard(board) {
  const role = board?.members?.[store.currentUser?.uid];
  if (role === true) return "admin";
  return normalizeRole(role);
}

export function canEditBoard(board) {
  return ["admin", "editor"].includes(roleForBoard(board));
}

export function currentRole() {
  return roleForBoard(activeBoard());
}

export function canEdit() {
  return canEditBoard(activeBoard());
}

export function isAdmin() {
  return currentRole() === "admin";
}

export function normalizeGame(raw) {
  const status = BUCKET_KEYS.includes(raw.status) ? raw.status : "maybe";
  const platforms = Array.isArray(raw.platforms)
    ? raw.platforms.filter((platform) => PLATFORMS.includes(platform))
    : [];
  return {
    id: raw.id ?? crypto.randomUUID(),
    title: raw.title ?? "Untitled game",
    genre: raw.genre ?? "",
    platforms,
    status,
    approvals: raw.approvals ?? {},
    addedBy: raw.addedBy ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString()
  };
}

export function normalizeBoard(board) {
  const members = board.members ?? {};
  Object.keys(members).forEach((uid) => {
    members[uid] = members[uid] === true ? "admin" : normalizeRole(members[uid]);
  });
  if (store.currentUser && !members[store.currentUser.uid]) members[store.currentUser.uid] = "admin";

  const memberProfiles = board.memberProfiles ?? {};
  if (store.currentUser) memberProfiles[store.currentUser.uid] = currentProfile();

  return {
    ...board,
    members,
    memberProfiles,
    memberIds: Object.keys(members),
    reads: board.reads ?? {},
    games: (board.games ?? []).map(normalizeGame),
    schedule: board.schedule ?? [],
    messages: board.messages ?? []
  };
}
