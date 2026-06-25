// Shared, framework-agnostic constants used across features.

export const PLATFORMS = ["PC", "Xbox", "PS5", "Switch", "Mobile"];

export const BUCKETS = [
  { key: "rotation", listId: "rotationList", label: "🎲 Current Rotation 🎮" },
  { key: "maybe", listId: "maybeList", label: "😏 Hear Me Out Though 👀" },
  { key: "never", listId: "neverList", label: "🚫 Not in a Million Years 🚫" }
];

export const BUCKET_KEYS = BUCKETS.map((bucket) => bucket.key);

export const ROLE_LABELS = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer"
};

export const STORAGE_KEY = "huddle-state-v1";
