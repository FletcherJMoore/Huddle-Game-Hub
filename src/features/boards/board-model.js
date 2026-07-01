// Board/account domain logic: normalization, roles, member identity, and the
// small derived helpers the redesigned views need (avatar colors, majority).

import { store, activeBoard } from "../../state/store.js";
import { PLATFORMS, BUCKET_KEYS, AVATAR_COLORS, ACCENT_OPTIONS, EMOJI_OPTIONS } from "../../utils/constants.js";

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
  return board?.memberProfiles?.[uid] ?? null;
}

export function memberIdsOf(board) {
  return board?.memberIds ?? Object.keys(board?.members ?? {});
}

export function memberName(board, uid) {
  if (uid === store.currentUser?.uid) return `${displayName()} (you)`;
  return profileFor(board, uid)?.name || "Teammate";
}

export function plainName(board, uid) {
  if (uid === store.currentUser?.uid) return displayName();
  return profileFor(board, uid)?.name || "Teammate";
}

// Deterministic avatar color from a seed (uid or name) so a person/game keeps
// the same color everywhere.
export function avatarColor(seed) {
  const text = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Majority needed for a game to be "agreed" by the crew.
export function majority(board) {
  return Math.floor(memberIdsOf(board).length / 2) + 1;
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
    ? raw.platforms.filter((p) => PLATFORMS.includes(p))
    : [];
  return {
    id: raw.id ?? crypto.randomUUID(),
    title: raw.title ?? "Untitled game",
    genre: raw.genre ?? "",
    variant: raw.variant ?? "",
    players: raw.players ?? "",
    platforms,
    status,
    approvals: raw.approvals ?? {},
    addedBy: raw.addedBy ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString()
  };
}

export function normalizeSession(raw) {
  return {
    id: raw.id ?? crypto.randomUUID(),
    date: raw.date ?? "",
    start: raw.start ?? "",
    end: raw.end ?? "",
    activity: raw.activity ?? "",
    votes: raw.votes ?? {}
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
    name: board.name ?? "Untitled board",
    emoji: EMOJI_OPTIONS.includes(board.emoji) ? board.emoji : board.emoji || "🎮",
    accent: ACCENT_OPTIONS.includes(board.accent) ? board.accent : board.accent || "#7c5cff",
    members,
    memberProfiles,
    memberIds: Object.keys(members),
    reads: board.reads ?? {},
    downToPlay: board.downToPlay ?? {},
    games: (board.games ?? []).map(normalizeGame),
    schedule: (board.schedule ?? []).map(normalizeSession),
    messages: board.messages ?? []
  };
}
