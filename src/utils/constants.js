// Shared, framework-agnostic constants used across features.

export const PLATFORMS = ["PC", "Xbox", "PS5", "Switch", "Mobile"];

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

export const STORAGE_KEY = "huddle-state-v2";
