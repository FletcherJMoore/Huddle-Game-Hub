import {
  createElement,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Dices,
  Gamepad2,
  LogOut,
  Send,
  Settings,
  ChartColumn
} from "lucide";

// Functional UI glyphs only — board-personality emoji (EMOJI_OPTIONS) and
// decorative copy stay as emoji, these replace icon-shaped buttons/labels.
const ICONS = {
  bell: Bell,
  calendar: Calendar,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  dices: Dices,
  "gamepad-2": Gamepad2,
  "log-out": LogOut,
  send: Send,
  settings: Settings,
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
