// Shared, framework-agnostic constants used across features.

export const PLATFORMS = ["PC", "Xbox", "PS5", "Switch", "Mobile"];

// Gameplay tags offered when proposing a game.
export const GAME_TAGS = ["Co-op", "PvP", "Quick", "Campaign", "Free", "Game Pass"];

// status -> roster section. rotation = agreed/in-rotation, maybe = pending vote,
// never = rejected.
export const BUCKET_KEYS = ["rotation", "maybe", "never"];

// Board accent colors offered in the create-board modal.
export const ACCENT_OPTIONS = ["#7c5cff", "#00e0b8", "#ff5c7c", "#3da5ff", "#ffb13d"];

// Board icons offered in the create-board modal.
export const EMOJI_OPTIONS = ["🎮", "🕹", "👾", "🎲", "🍕", "🔥", "🏆", "⚔️", "🚀", "🐉"];

// Palette used to color member + game avatars deterministically.
export const AVATAR_COLORS = [
  "#ffd24c",
  "#ff7eb6",
  "#56d364",
  "#7c5cff",
  "#3da5ff",
  "#ff9f40",
  "#00e0b8",
  "#ff5c7c"
];

// Board roles. Owner is assigned at creation / via transfer; the rest are
// assignable in the member manager.
export const ROLE_LABELS = { owner: "Owner", editor: "Editor", member: "Member" };
export const ASSIGNABLE_ROLES = ["editor", "member"];

export const STORAGE_KEY = "huddle-state-v2";

// Personal "best days/times to play" preference options (Profile & status tab).
export const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const TIME_OF_DAY = ["Morning", "Afternoon", "Evening", "Late Night"];

