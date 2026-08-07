// Social layer — friends, notifications, and chat. The backend for these hasn't
// been built yet (boards/games/sessions/catalog are the live slices), so these
// are seed data the UI owns in local state. Each export is the seam a future
// API call slots into; shapes mirror what the server will return.

export const FRIENDS = [
  { id: "f1", name: "Jordan Reyes", online: true, mutual: 3 },
  { id: "f2", name: "Sam Patel", online: false, mutual: 2 },
  { id: "f3", name: "Casey Kim", online: true, mutual: 1 },
  { id: "f4", name: "Morgan Lee", online: false, mutual: 4 },
  { id: "f5", name: "Riley Chen", online: true, mutual: 2 }
];

// route: which surface a notification opens when clicked.
export const NOTIFICATIONS = [
  { id: "n1", text: "Morgan tagged you in Friday Night Crew", time: "12m ago", route: "chat" },
  { id: "n2", text: "2 games are waiting on your vote", time: "1h ago", route: "catalog" },
  { id: "n3", text: "You haven't RSVP'd to Friday, 8:00 PM", time: "5h ago", route: "calendar" },
  { id: "n4", text: "Casey Kim accepted your invite to Board Game Nerds", time: "Yesterday", route: null }
];

// Seed chat threads keyed by "dm-<friendId>" and "board-<boardId>".
export const SEED_MESSAGES = {
  "dm-f1": [
    { me: false, text: "Are we still on for Friday?", meta: "Jordan · 2:04 PM" },
    { me: true, text: "Yep — 8pm, Overcooked 2", meta: "You · 2:07 PM" }
  ],
  "dm-f3": [{ me: false, text: "Added Stardew to my catalog", meta: "Casey · 11:20 AM" }],
  "dm-f5": [{ me: false, text: "gg last night", meta: "Riley · Yesterday" }],
  "board-b1": [
    { me: false, text: "Voted yes on Among Us", meta: "Morgan · 1:12 PM" },
    { me: false, text: "Who's bringing snacks?", meta: "Sam · 1:15 PM" }
  ],
  "board-b2": [{ me: false, text: "Catan night moved to Sunday", meta: "Jordan · Tue" }],
  "board-b4": [{ me: false, text: "Ranked grind at 9?", meta: "Riley · Mon" }]
};

export const SEED_REACTIONS = {
  "dm-f1:0": [{ emoji: "🎮", count: 1, mine: false }],
  "board-b1:1": [
    { emoji: "😂", count: 2, mine: false },
    { emoji: "👍", count: 1, mine: false }
  ]
};

export const REACTION_EMOJI = ["❤️", "😂", "👍", "🎮", "🔥", "😮", "🎲", "👏"];

// board_members roles map onto the design's Owner / Admin / Viewer badges.
export function roleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "editor" || role === "admin") return "Admin";
  return "Viewer";
}
