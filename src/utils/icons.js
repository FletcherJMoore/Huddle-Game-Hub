import {
  createElement,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  Dices,
  Gamepad2,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Settings,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  ChartColumn
} from "lucide";

// Functional UI glyphs only — board-personality emoji (EMOJI_OPTIONS) and
// decorative copy stay as emoji, these replace icon-shaped buttons/labels.
const ICONS = {
  bell: Bell,
  calendar: Calendar,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  check: Check,
  dices: Dices,
  "gamepad-2": Gamepad2,
  "log-out": LogOut,
  pencil: Pencil,
  plus: Plus,
  "rotate-ccw": RotateCcw,
  send: Send,
  settings: Settings,
  "thumbs-down": ThumbsDown,
  "thumbs-up": ThumbsUp,
  users: Users,
  x: X,
  "bar-chart": ChartColumn
};

// Returns an inline <svg> element for a named icon, ready to .append().
export function icon(name, { size = 18, className = "" } = {}) {
  const node = ICONS[name];
  if (!node) throw new Error(`Unknown icon: ${name}`);
  const el = createElement(node, { width: size, height: size });
  if (className) el.setAttribute("class", className);
  return el;
}

// Fills every static `<span class="ico" data-icon="...">` placeholder left
// in index.html with its icon. Run once at startup.
export function hydrateIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.replaceChildren(icon(el.dataset.icon, { size: Number(el.dataset.iconSize) || 18 }));
  });
}
