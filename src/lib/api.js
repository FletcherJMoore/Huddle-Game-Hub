// Thin fetch wrapper for the backend API. Same-origin in production (the Node
// server serves the SPA) and proxied in dev; always sends the session cookie.
//
// MOCK mode (VITE_MOCK=1) swaps the network for an in-memory board so the
// redesigned shell can be previewed without the Postgres backend running.

import { GAME_META } from "./game-meta.js";

export const MOCK = import.meta.env.VITE_MOCK === "1";

async function request(path, options = {}) {
  return fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
}

// Unwraps a JSON response, throwing the server's {error} message on failure.
async function json(res) {
  if (!res.ok) {
    let message = "Request failed.";
    try {
      message = (await res.json()).error || message;
    } catch {
      /* non-JSON body */
    }
    throw new Error(message);
  }
  return res.json();
}

// ---- Mock backend (VITE_MOCK=1) ----

export const MOCK_USER = { id: "me", name: "Fletcher Moore", email: "you@huddle.gg", photo_url: null };

const mockBoards = [
  { id: "b1", name: "Friday Night Crew", emoji: "🎮", role: "owner", memberCount: 6 },
  { id: "b2", name: "Board Game Nerds", emoji: "🎲", role: "editor", memberCount: 4 },
  { id: "b3", name: "Retro Arcade Club", emoji: "🕹️", role: "member", memberCount: 3 },
  { id: "b4", name: "Ranked Squad", emoji: "🏆", role: "owner", memberCount: 8 }
];

const mockMembers = [
  { userId: "me", name: "Fletcher Moore", photoUrl: null, role: "owner", online: true, since: "Feb 14, 2026" },
  { userId: "f1", name: "Jordan Reyes", photoUrl: null, role: "editor", online: true, since: "Feb 16, 2026" },
  { userId: "f2", name: "Sam Patel", photoUrl: null, role: "member", online: false, since: "Mar 3, 2026" },
  { userId: "f3", name: "Casey Kim", photoUrl: null, role: "member", online: true, since: "Apr 21, 2026" },
  { userId: "f4", name: "Morgan Lee", photoUrl: null, role: "editor", online: false, since: "May 9, 2026" },
  { userId: "f5", name: "Riley Chen", photoUrl: null, role: "member", online: true, since: "Jun 30, 2026" }
];

// Board games carry gameplay attrs (players/platforms/votes); descriptive
// metadata (genre, studio, blurb, hero art) is merged in from the shared map so
// every board tile renders as richly as the catalog.
const g = (id, title, players, platforms, approvals, owners) => ({
  id, title, kind: "video", players, platforms, coverImageUrl: null, approvals, addedBy: "f1", owners,
  ...GAME_META[title]
});

const mockContent = {
  games: [
    g("g1", "Overcooked 2", "2-4", ["Switch", "PC"], { me: "up", f1: "up", f2: "up", f4: "up" }, 5),
    g("g2", "Mario Kart 8 Deluxe", "2-8", ["Switch"], { me: "up", f1: "up", f3: "up", f5: "up" }, 6),
    g("g3", "Among Us", "4-15", ["PC", "Mobile"], { f1: "up", f4: "up" }, 6),
    g("g4", "It Takes Two", "2", ["PS5", "Xbox", "PC"], { f2: "up" }, 2),
    g("g7", "Lethal Company", "2-4", ["PC"], {}, 6),
    g("g8", "Rocket League", "2-8", ["PS5", "Xbox", "PC", "Switch"], {}, 6),
    g("g9", "Stardew Valley", "1-4", ["PC", "Switch"], {}, 5)
  ],
  schedule: [
    { id: "s1", date: "2026-08-07", start: "20:00", end: "23:00", activity: "Overcooked 2 night", gameId: "g1", rsvps: { me: "in", f1: "in", f3: "in", f5: "in" }, createdBy: "f1" },
    { id: "s2", date: "2026-08-09", start: "19:30", end: "22:00", activity: "Mario Kart tournament", gameId: "g2", rsvps: { f1: "in", f2: "in", f4: "in" }, createdBy: "f4" },
    { id: "s3", date: "2026-08-12", start: "21:00", end: "24:00", activity: "Rocket League night", gameId: "g8", rsvps: { f3: "in", f5: "in" }, createdBy: "f3" }
  ]
};

const mockExtraMembers = {}; // boardId -> [members added this session]

function mockBoard(id) {
  const summary = mockBoards.find((b) => b.id === id) || mockBoards[0];
  return {
    id: summary.id,
    name: summary.name,
    emoji: summary.emoji,
    role: summary.role,
    members: [...mockMembers.slice(0, summary.memberCount), ...(mockExtraMembers[id] || [])],
    content: mockContent
  };
}

// Mock store catalog (video games only) used when VITE_MOCK=1. Gameplay attrs
// live here; the descriptive metadata (genre, studio, blurb, hero art) is
// merged in from the shared map — the same shape the IGDB proxy returns in
// production.
const CATALOG = [
  ["Overwatch 2", "1-10", ["PC", "PS5", "Xbox", "Switch"]],
  ["World of Warcraft", "1-40", ["PC"]],
  ["Diablo IV", "1-4", ["PC", "PS5", "Xbox"]],
  ["Hearthstone", "1-2", ["PC", "Mobile"]],
  ["League of Legends", "1-10", ["PC"]],
  ["Valorant", "1-10", ["PC"]],
  ["Counter-Strike 2", "1-10", ["PC"]],
  ["Dota 2", "1-10", ["PC"]],
  ["Portal 2", "1-2", ["PC", "PS5", "Xbox"]],
  ["Elden Ring", "1-4", ["PS5", "Xbox", "PC"]],
  ["Sekiro: Shadows Die Twice", "1", ["PS5", "Xbox", "PC"]],
  ["Baldur's Gate 3", "1-4", ["PS5", "PC", "Xbox"]],
  ["Mario Kart 8 Deluxe", "1-8", ["Switch"]],
  ["Splatoon 3", "2-8", ["Switch"]],
  ["Fortnite", "1-100", ["PS5", "Xbox", "PC", "Switch"]],
  ["Among Us", "4-15", ["PC", "Mobile", "Switch"]]
].map(([title, players, platforms], i) => ({
  catalogId: `cat-${i}`, kind: "video", coverImageUrl: null, title, players, platforms, ...GAME_META[title]
}));

// Current signed-in user, or null.
export async function fetchCurrentUser() {
  if (MOCK) return MOCK_USER;
  try {
    const res = await request("/api/auth/me");
    if (res.status !== 200) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function logout() {
  if (MOCK) return;
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch {
    /* best effort — the UI clears local state regardless */
  }
}

export async function listBoards() {
  if (MOCK) return mockBoards;
  return (await json(await request("/api/boards"))).boards;
}

export async function createBoard(data) {
  if (MOCK) {
    const board = { id: `b${mockBoards.length + 1}`, name: data.name, emoji: data.emoji || "🎮", role: "owner", memberCount: 1 };
    mockBoards.unshift(board);
    return board;
  }
  return (await json(await request("/api/boards", { method: "POST", body: JSON.stringify(data) }))).board;
}

export async function getBoard(id) {
  if (MOCK) return mockBoard(id);
  return (await json(await request(`/api/boards/${id}`))).board;
}

export async function updateBoard(id, patch) {
  if (MOCK) {
    const b = mockBoards.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    return { ok: true };
  }
  return json(await request(`/api/boards/${id}`, { method: "PATCH", body: JSON.stringify(patch) }));
}

// Add an existing Huddle user to a board by email (no invite step). Returns the
// updated member list.
export async function addMember(boardId, email) {
  if (MOCK) {
    const clean = email.trim().toLowerCase();
    const known = mockMembers.find((m) => m.name.toLowerCase().replace(/\s+/g, ".") + "@huddle.gg" === clean);
    const member = known || { userId: `u${Date.now()}`, name: clean.split("@")[0], photoUrl: null, role: "member", online: false, since: "Just now" };
    mockExtraMembers[boardId] = [...(mockExtraMembers[boardId] || []), { ...member, role: "member" }];
    const summary = mockBoards.find((b) => b.id === boardId);
    if (summary) summary.memberCount += 1;
    return mockBoard(boardId).members;
  }
  const res = await request(`/api/boards/${boardId}/members`, { method: "POST", body: JSON.stringify({ email }) });
  return (await json(res)).members;
}

export async function deleteBoard(id) {
  if (MOCK) {
    const i = mockBoards.findIndex((x) => x.id === id);
    if (i >= 0) mockBoards.splice(i, 1);
    return { ok: true };
  }
  return json(await request(`/api/boards/${id}`, { method: "DELETE" }));
}

// Searches the video-game catalog. In production this hits the IGDB proxy on
// the server; an empty query returns a default browse set of popular games.
export async function searchCatalog(query = "") {
  if (MOCK) {
    const q = (query || "").toLowerCase();
    return CATALOG.filter((c) => !q || c.title.toLowerCase().includes(q));
  }
  const params = new URLSearchParams({ q: query });
  return (await json(await request(`/api/catalog/search?${params}`))).results;
}

export async function addGame(boardId, game) {
  if (MOCK) {
    mockContent.games.push({ id: `g${Date.now()}`, approvals: { me: "up" }, addedBy: "me", owners: 1, ...game });
    return mockContent.games;
  }
  const res = await request(`/api/boards/${boardId}/games`, { method: "POST", body: JSON.stringify(game) });
  return (await json(res)).games;
}

export async function voteGame(boardId, gameId, vote) {
  if (MOCK) {
    const game = mockContent.games.find((x) => x.id === gameId);
    if (game) {
      game.approvals = { ...game.approvals };
      if (vote === null) delete game.approvals.me;
      else game.approvals.me = vote;
    }
    return mockContent.games;
  }
  const res = await request(`/api/boards/${boardId}/games/${gameId}/vote`, {
    method: "POST",
    body: JSON.stringify({ vote })
  });
  return (await json(res)).games;
}

export async function removeGame(boardId, gameId) {
  if (MOCK) {
    mockContent.games = mockContent.games.filter((x) => x.id !== gameId);
    return mockContent.games;
  }
  const res = await request(`/api/boards/${boardId}/games/${gameId}`, { method: "DELETE" });
  return (await json(res)).games;
}

export async function createSession(boardId, session) {
  if (MOCK) {
    mockContent.schedule.push({ id: `s${Date.now()}`, rsvps: { me: "in" }, createdBy: "me", ...session });
    return mockContent.schedule;
  }
  const res = await request(`/api/boards/${boardId}/sessions`, { method: "POST", body: JSON.stringify(session) });
  return (await json(res)).schedule;
}

export async function rsvpSession(boardId, sessionId, rsvp) {
  if (MOCK) {
    const s = mockContent.schedule.find((x) => x.id === sessionId);
    if (s) {
      s.rsvps = { ...s.rsvps };
      if (rsvp === null) delete s.rsvps.me;
      else s.rsvps.me = rsvp;
    }
    return mockContent.schedule;
  }
  const res = await request(`/api/boards/${boardId}/sessions/${sessionId}/rsvp`, {
    method: "POST",
    body: JSON.stringify({ rsvp })
  });
  return (await json(res)).schedule;
}

export async function removeSession(boardId, sessionId) {
  if (MOCK) {
    mockContent.schedule = mockContent.schedule.filter((x) => x.id !== sessionId);
    return mockContent.schedule;
  }
  const res = await request(`/api/boards/${boardId}/sessions/${sessionId}`, { method: "DELETE" });
  return (await json(res)).schedule;
}

// Board chat is realtime (Socket.IO broadcasts board:message); these back the
// history fetch and the send. In MOCK mode they run against an in-memory log.
const mockMessages = {
  b1: [
    { id: "m1", text: "Voted yes on Among Us", createdAt: "2026-08-06T13:12:00Z", author: { id: "f4", name: "Morgan Lee", photoUrl: null } },
    { id: "m2", text: "Who's bringing snacks?", createdAt: "2026-08-06T13:15:00Z", author: { id: "f2", name: "Sam Patel", photoUrl: null } }
  ]
};

export async function getMessages(boardId) {
  if (MOCK) return mockMessages[boardId] ? [...mockMessages[boardId]] : [];
  return (await json(await request(`/api/boards/${boardId}/messages`))).messages;
}

export async function sendMessage(boardId, text) {
  if (MOCK) {
    const message = { id: `m${Date.now()}`, text, createdAt: new Date().toISOString(), author: MOCK_USER };
    mockMessages[boardId] = [...(mockMessages[boardId] || []), message];
    return message;
  }
  const res = await request(`/api/boards/${boardId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
  return (await json(res)).message;
}

export async function deleteMessage(boardId, messageId) {
  if (MOCK) {
    mockMessages[boardId] = (mockMessages[boardId] || []).filter((m) => m.id !== messageId);
    return { ok: true };
  }
  return json(await request(`/api/boards/${boardId}/messages/${messageId}`, { method: "DELETE" }));
}

// ---- Direct messages (1:1) ----

const dmAuthor = (id) => {
  const m = mockMembers.find((x) => x.userId === id);
  return { id, name: m?.name || "Someone", photoUrl: m?.photoUrl || null };
};

// Mock DM threads keyed by the partner's user id.
const mockDms = {
  f1: [
    { id: "d1", text: "Are we still on for Friday?", createdAt: "2026-08-19T14:04:00Z", author: dmAuthor("f1") },
    { id: "d2", text: "Yep — 8pm, Overcooked 2", createdAt: "2026-08-19T14:07:00Z", author: MOCK_USER }
  ],
  f3: [{ id: "d3", text: "Added Stardew to my catalog", createdAt: "2026-08-19T11:20:00Z", author: dmAuthor("f3") }],
  f5: [{ id: "d4", text: "gg last night", createdAt: "2026-08-18T22:30:00Z", author: dmAuthor("f5") }]
};

export async function listDmContacts() {
  if (MOCK) return mockMembers.filter((m) => m.userId !== MOCK_USER.id).map((m) => ({ userId: m.userId, name: m.name, photoUrl: m.photoUrl }));
  return (await json(await request("/api/dm/contacts"))).contacts;
}

export async function listDmThreads() {
  if (MOCK) {
    return Object.entries(mockDms)
      .map(([userId, msgs]) => {
        const last = msgs[msgs.length - 1];
        const who = dmAuthor(userId);
        return {
          userId,
          name: who.name,
          photoUrl: who.photoUrl,
          lastMessage: last?.text || "",
          lastAt: last?.createdAt || null,
          lastFromMe: last?.author?.id === MOCK_USER.id
        };
      })
      .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  }
  return (await json(await request("/api/dm"))).conversations;
}

export async function getDmMessages(userId) {
  if (MOCK) return mockDms[userId] ? [...mockDms[userId]] : [];
  return (await json(await request(`/api/dm/${userId}`))).messages;
}

export async function sendDm(userId, text) {
  if (MOCK) {
    const message = { id: `d${Date.now()}`, text, createdAt: new Date().toISOString(), author: MOCK_USER };
    mockDms[userId] = [...(mockDms[userId] || []), message];
    return message;
  }
  const res = await request(`/api/dm/${userId}`, { method: "POST", body: JSON.stringify({ text }) });
  return (await json(res)).message;
}

export async function deleteDm(userId, messageId) {
  if (MOCK) {
    mockDms[userId] = (mockDms[userId] || []).filter((m) => m.id !== messageId);
    return { ok: true };
  }
  return json(await request(`/api/dm/${userId}/${messageId}`, { method: "DELETE" }));
}
