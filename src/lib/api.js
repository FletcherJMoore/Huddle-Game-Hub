// Thin fetch wrapper for the backend API. Same-origin in production (the Node
// server serves the SPA) and proxied in dev; always sends the session cookie.
//
// MOCK mode (VITE_MOCK=1) swaps the network for an in-memory board so the
// redesigned shell can be previewed without the Postgres backend running.

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

const g = (id, title, kind, players, platforms, approvals, owners) => ({
  id, title, kind, genre: "", players, platforms, coverImageUrl: null, approvals, addedBy: "f1", owners
});

const mockContent = {
  games: [
    g("g1", "Overcooked 2", "video", "2-4", ["Switch", "PC"], { me: "up", f1: "up", f2: "up", f4: "up" }, 5),
    g("g2", "Mario Kart 8 Deluxe", "video", "2-8", ["Switch"], { me: "up", f1: "up", f3: "up", f5: "up" }, 6),
    g("g3", "Among Us", "video", "4-15", ["PC", "Mobile"], { f1: "up", f4: "up" }, 6),
    g("g4", "It Takes Two", "video", "2", ["PS5", "Xbox", "PC"], { f2: "up" }, 2),
    g("g5", "Jackbox Party Pack 10", "party", "4-10", ["PC"], { me: "up", f1: "up", f3: "up", f4: "up" }, 5),
    g("g6", "Catan", "party", "3-4", ["Board game"], { f1: "up", f5: "up" }, 3),
    g("g7", "Lethal Company", "video", "2-4", ["PC"], {}, 6),
    g("g8", "Rocket League", "video", "2-8", ["PS5", "Xbox", "PC", "Switch"], {}, 6),
    g("g9", "Stardew Valley", "video", "1-4", ["PC", "Switch"], {}, 5)
  ],
  schedule: [
    { id: "s1", date: "2026-08-07", start: "20:00", end: "23:00", activity: "Overcooked 2 night", gameId: "g1", rsvps: { me: "in", f1: "in", f3: "in", f5: "in" }, createdBy: "f1" },
    { id: "s2", date: "2026-08-09", start: "19:30", end: "22:00", activity: "Mario Kart tournament", gameId: "g2", rsvps: { f1: "in", f2: "in", f4: "in" }, createdBy: "f4" },
    { id: "s3", date: "2026-08-12", start: "21:00", end: "24:00", activity: "Jackbox party", gameId: "g5", rsvps: { f3: "in", f5: "in" }, createdBy: "f3" }
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

// Rich catalog used for the Steam-style launcher mockup. Each entry carries a
// genre (category), developer (studio), a short blurb, and a `hero` gradient
// that stands in for full-bleed key art until real images are wired up.
const CATALOG = [
  {
    title: "Overwatch 2", genre: "Shooter", developer: "Blizzard Entertainment",
    players: "1-10", platforms: ["PC", "PS5", "Xbox", "Switch"],
    description: "Team-based hero shooter where two squads of five clash across objective maps, each hero built around a distinct kit.",
    hero: "linear-gradient(135deg,#f97316,#b45309)"
  },
  {
    title: "World of Warcraft", genre: "MMORPG", developer: "Blizzard Entertainment",
    players: "1-40", platforms: ["PC"],
    description: "The sprawling online world of Azeroth — quest, raid, and explore with thousands of other players across decades of story.",
    hero: "linear-gradient(135deg,#1d4ed8,#1e3a8a)"
  },
  {
    title: "Diablo IV", genre: "Action RPG", developer: "Blizzard Entertainment",
    players: "1-4", platforms: ["PC", "PS5", "Xbox"],
    description: "A dark dungeon crawler through the world of Sanctuary — grind loot, master classes, and hunt Lilith across a shared open world.",
    hero: "linear-gradient(135deg,#b91c1c,#450a0a)"
  },
  {
    title: "Hearthstone", genre: "Card", developer: "Blizzard Entertainment",
    players: "1-2", platforms: ["PC", "Mobile"],
    description: "A fast, friendly digital card game — build decks from Warcraft heroes and duel opponents in quick tactical matches.",
    hero: "linear-gradient(135deg,#d97706,#78350f)"
  },
  {
    title: "League of Legends", genre: "MOBA", developer: "Riot Games",
    players: "1-10", platforms: ["PC"],
    description: "The definitive MOBA — pick a champion, push lanes, and destroy the enemy Nexus in five-on-five strategic team battles.",
    hero: "linear-gradient(135deg,#0891b2,#164e63)"
  },
  {
    title: "Valorant", genre: "Shooter", developer: "Riot Games",
    players: "1-10", platforms: ["PC"],
    description: "A tactical five-on-five shooter blending precise gunplay with agent abilities across tight, round-based rounds.",
    hero: "linear-gradient(135deg,#e11d48,#831843)"
  },
  {
    title: "Counter-Strike 2", genre: "Shooter", developer: "Valve",
    players: "1-10", platforms: ["PC"],
    description: "The legendary competitive shooter, rebuilt — plant, defuse, and out-aim the enemy team round after round.",
    hero: "linear-gradient(135deg,#ca8a04,#3f3f46)"
  },
  {
    title: "Dota 2", genre: "MOBA", developer: "Valve",
    players: "1-10", platforms: ["PC"],
    description: "A deep, high-skill MOBA with over a hundred heroes and endless strategic depth in five-on-five lane battles.",
    hero: "linear-gradient(135deg,#7c3aed,#312e81)"
  },
  {
    title: "Portal 2", genre: "Puzzle", developer: "Valve",
    players: "1-2", platforms: ["PC", "PS5", "Xbox"],
    description: "A mind-bending first-person puzzler — think with portals, solo or in co-op, through Aperture's test chambers.",
    hero: "linear-gradient(135deg,#2563eb,#1e293b)"
  },
  {
    title: "Elden Ring", genre: "Action RPG", developer: "FromSoftware",
    players: "1-4", platforms: ["PS5", "Xbox", "PC"],
    description: "An open-world dark fantasy epic — explore the Lands Between, face towering bosses, and forge your own path to the throne.",
    hero: "linear-gradient(135deg,#a16207,#1c1917)"
  },
  {
    title: "Sekiro: Shadows Die Twice", genre: "Action RPG", developer: "FromSoftware",
    players: "1", platforms: ["PS5", "Xbox", "PC"],
    description: "A punishing single-player action game of posture-breaking swordplay and stealth in a reimagined Sengoku-era Japan.",
    hero: "linear-gradient(135deg,#dc2626,#292524)"
  },
  {
    title: "Baldur's Gate 3", genre: "RPG", developer: "Larian Studios",
    players: "1-4", platforms: ["PS5", "PC", "Xbox"],
    description: "A sweeping party-based RPG built on D&D — every choice matters across a richly reactive world, solo or in co-op.",
    hero: "linear-gradient(135deg,#b45309,#7c2d12)"
  },
  {
    title: "Mario Kart 8 Deluxe", genre: "Racing", developer: "Nintendo",
    players: "1-8", platforms: ["Switch"],
    description: "The definitive kart racer — drift, boost, and sling shells across wild tracks with up to eight players.",
    hero: "linear-gradient(135deg,#dc2626,#c2410c)"
  },
  {
    title: "Splatoon 3", genre: "Shooter", developer: "Nintendo",
    players: "2-8", platforms: ["Switch"],
    description: "A colorful team shooter about covering turf in ink — splat rivals and out-splash them in four-on-four matches.",
    hero: "linear-gradient(135deg,#7c3aed,#0d9488)"
  },
  {
    title: "Fortnite", genre: "Battle Royale", developer: "Epic Games",
    players: "1-100", platforms: ["PS5", "Xbox", "PC", "Switch"],
    description: "Build, battle, and be the last one standing — a hundred players drop onto a shrinking island in a fight to survive.",
    hero: "linear-gradient(135deg,#6d28d9,#1e40af)"
  },
  {
    title: "Among Us", genre: "Party", developer: "Innersloth",
    players: "4-15", platforms: ["PC", "Mobile", "Switch"],
    description: "Work together to prep your ship — but one of you is an impostor. Deceive, deduce, and vote to survive.",
    hero: "linear-gradient(135deg,#dc2626,#1e3a8a)"
  }
].map((game, i) => ({
  catalogId: `cat-${i}`, kind: "video", coverImageUrl: null, ...game
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

export async function searchCatalog(query, kind) {
  if (MOCK) {
    const q = (query || "").toLowerCase();
    return CATALOG.filter((c) => (!kind || c.kind === kind) && (!q || c.title.toLowerCase().includes(q)));
  }
  const params = new URLSearchParams({ q: query, type: kind === "party" ? "party" : "video" });
  return (await json(await request(`/api/catalog/search?${params}`))).results;
}

// ---- Steam library ----

// The link flow is a full-page redirect to Steam's OpenID, so it's a URL, not a
// fetch. Steam returns to /?steam=linked.
export const STEAM_LOGIN_URL = "/api/auth/steam";

const MOCK_STEAM = [
  { steamAppId: 1245620, title: "Elden Ring", playtimeForever: 5400 },
  { steamAppId: 1145360, title: "Hades", playtimeForever: 2100 },
  { steamAppId: 413150, title: "Stardew Valley", playtimeForever: 1800 },
  { steamAppId: 319510, title: "Five Nights at Freddy's", playtimeForever: 1600 }, // no portrait capsule → header fallback
  { steamAppId: 105600, title: "Terraria", playtimeForever: 1500 },
  { steamAppId: 620, title: "Portal 2", playtimeForever: 900 },
  { steamAppId: 730, title: "Counter-Strike 2", playtimeForever: 600 },
  // No predictable CDN capsule — the server resolves its real header via Steam's
  // appdetails API; hardcoded here so the mock preview shows the resolved result.
  {
    steamAppId: 3527290,
    title: "PEAK",
    playtimeForever: 300,
    cover: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3527290/31bac6b2eccf09b368f5e95ce510bae2baf3cfcd/header.jpg"
  }
].map((g) => ({
  ...g,
  catalogId: null,
  kind: "video",
  platforms: ["PC"],
  players: "",
  coverImageUrl: g.cover || `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.steamAppId}/library_600x900.jpg`
}));

export async function getSteamLibrary() {
  if (MOCK) return { linked: true, persona: "you", count: MOCK_STEAM.length, games: MOCK_STEAM };
  return json(await request("/api/steam/games"));
}

export async function unlinkSteam() {
  if (MOCK) return { ok: true };
  return json(await request("/api/steam", { method: "DELETE" }));
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
