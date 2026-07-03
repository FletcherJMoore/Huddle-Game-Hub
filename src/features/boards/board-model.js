// Board/account domain logic: normalization, roles, member identity, and the
// small derived helpers the redesigned views need (avatar colors, majority).

import { store, activeBoard } from "../../state/store.js";
import { PLATFORMS, GAME_TAGS, BUCKET_KEYS, AVATAR_COLORS, ACCENT_OPTIONS, EMOJI_OPTIONS } from "../../utils/constants.js";

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

// Chat messages posted after the current user last read the board, excluding
// their own. Shared by the board badges and the tab-title notification count.
export function unreadCount(board) {
  const msgs = board?.messages ?? [];
  if (!msgs.length) return 0;
  const lastRead = board.reads?.[store.currentUser?.uid] ?? "";
  return msgs.filter((m) => m.createdAt > lastRead && m.authorUid !== store.currentUser?.uid).length;
}

// Roles: owner (board creator) > editor > member. Legacy data used
// admin/editor/viewer (and `true`); we interpret those on read via
// canonicalRole and never rewrite stored values (which would trip the
// "members unchanged" write rule for non-owners).
export function canonicalRole(role) {
  if (role === true || role === "admin" || role === "owner") return "owner";
  if (role === "editor") return "editor";
  return "member";
}

// Canonical role of the current user on a board, or null if not a member.
export function roleForBoard(board) {
  const raw = board?.members?.[store.currentUser?.uid];
  return raw === undefined || raw === null ? null : canonicalRole(raw);
}

export function isMemberOf(board) {
  return roleForBoard(board) !== null;
}

export function isOwnerOf(board) {
  return roleForBoard(board) === "owner";
}

// Editors + owner can invite people and edit board settings.
export function canManageBoard(board) {
  const role = roleForBoard(board);
  return role === "owner" || role === "editor";
}

// Any member can use the board (vote, propose, chat, spin).
export function canEditBoard(board) {
  return isMemberOf(board);
}

export function currentRole() {
  return roleForBoard(activeBoard());
}

export function canEdit() {
  return isMemberOf(activeBoard());
}

// Editors + owner: manage settings and invites.
export function canManage() {
  return canManageBoard(activeBoard());
}

// Owner only: manage roles, transfer ownership, delete the board.
export function isOwner() {
  return isOwnerOf(activeBoard());
}

export function normalizeGame(raw) {
  const status = BUCKET_KEYS.includes(raw.status) ? raw.status : "maybe";
  const platforms = Array.isArray(raw.platforms)
    ? raw.platforms.filter((p) => PLATFORMS.includes(p))
    : [];
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t) => GAME_TAGS.includes(t)) : [];
  return {
    id: raw.id ?? crypto.randomUUID(),
    title: raw.title ?? "Untitled game",
    genre: raw.genre ?? "",
    variant: raw.variant ?? "",
    players: raw.players ?? "",
    platforms,
    tags,
    steamAppId: raw.steamAppId ?? null,
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
  // Seed the creator as owner for a brand-new local board. Existing members keep
  // their stored role string (legacy admin/viewer are interpreted, not rewritten).
  if (store.currentUser && !members[store.currentUser.uid]) members[store.currentUser.uid] = "owner";

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
    games: (board.games ?? []).map(normalizeGame),
    schedule: (board.schedule ?? []).map(normalizeSession),
    messages: board.messages ?? []
  };
}
