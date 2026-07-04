// Client-only preferences (notification toggles, status, platforms) kept in
// localStorage and keyed per user. These never touch shared board data.

const KEY = "huddle-prefs-v1";

export const NOTIF_PREFS = [
  { key: "sessionProposed", label: "New session proposed", sub: "A new play time is suggested" },
  { key: "voteNeeded", label: "Votes you owe", sub: "A game or time is waiting on your vote" },
  { key: "mentions", label: "Mentions", sub: "Someone @mentions you in chat" },
  { key: "rotation", label: "Rotation changes", sub: "A game moves in or out of rotation" }
];

const DEFAULTS = {
  notif: { sessionProposed: true, voteNeeded: true, mentions: true, rotation: false },
  platforms: [],
  status: "",
  accentOverride: null,
  bestDays: [],
  bestTimes: []
};

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export function getPrefs(uid) {
  const all = readAll();
  const mine = all[uid] ?? {};
  return {
    notif: { ...DEFAULTS.notif, ...(mine.notif ?? {}) },
    platforms: Array.isArray(mine.platforms) ? mine.platforms : [],
    status: typeof mine.status === "string" ? mine.status : "",
    accentOverride: typeof mine.accentOverride === "string" ? mine.accentOverride : null,
    bestDays: Array.isArray(mine.bestDays) ? mine.bestDays : [],
    bestTimes: Array.isArray(mine.bestTimes) ? mine.bestTimes : []
  };
}

export function savePrefs(uid, prefs) {
  const all = readAll();
  all[uid] = { ...getPrefs(uid), ...prefs };
  localStorage.setItem(KEY, JSON.stringify(all));
}
