// Runtime theming: light/dark, accent color, and background image are all
// user-selectable from the profile dropdown and persist across sessions. The
// provider writes the choices onto <html> as a data attribute + CSS custom
// properties, so the rest of the UI styles itself from tokens in app.css.

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const ACCENTS = [
  { key: "blue", name: "Blue", value: "oklch(0.62 0.19 258)" },
  { key: "violet", name: "Violet", value: "oklch(0.62 0.19 305)" },
  { key: "teal", name: "Teal", value: "oklch(0.62 0.19 195)" },
  { key: "rose", name: "Rose", value: "oklch(0.62 0.19 15)" }
];

export const BG_PRESETS = [
  { key: "default", grad: "linear-gradient(135deg,#3b82f6,#22d3ee)" },
  { key: "sunset", grad: "linear-gradient(135deg,#f97316,#db2777)" },
  { key: "forest", grad: "linear-gradient(135deg,#22c55e,#0f766e)" },
  { key: "midnight", grad: "linear-gradient(135deg,#4f46e5,#1e1b4b)" }
];

// A few brand-family gradients used for board tiles and cover-art placeholders.
export const TILE_GRADS = [
  "linear-gradient(150deg,#2563eb,#1e3a8a)",
  "linear-gradient(150deg,#0891b2,#155e75)",
  "linear-gradient(150deg,#4f46e5,#3730a3)",
  "linear-gradient(150deg,#0ea5e9,#0369a1)"
];

export const BOARD_EMOJI = ["🎮", "🎲", "🕹️", "🃏", "🏆", "🎯", "👾", "🍕"];

// Stable gradient pick from a seed string, so a given board/game keeps its color.
export function gradFor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TILE_GRADS[hash % TILE_GRADS.length];
}

export function initialsOf(title = "") {
  return title
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const STORE_KEY = "huddle.theme";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const saved = load();
  const [theme, setTheme] = useState(saved.theme || "dark");
  const [accentKey, setAccentKey] = useState(saved.accentKey || "blue");
  const [bgKey, setBgKey] = useState(saved.bgKey || "default");
  const [customBg, setCustomBg] = useState(saved.customBg || null); // data URL or null

  const accent = useMemo(
    () => ACCENTS.find((a) => a.key === accentKey) || ACCENTS[0],
    [accentKey]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.setProperty("--accent", accent.value);
    const preset = BG_PRESETS.find((p) => p.key === bgKey) || BG_PRESETS[0];
    root.style.setProperty("--app-bg-layer", customBg ? `url(${customBg})` : preset.grad);
    localStorage.setItem(STORE_KEY, JSON.stringify({ theme, accentKey, bgKey, customBg }));
  }, [theme, accent, accentKey, bgKey, customBg]);

  const value = useMemo(
    () => ({
      theme,
      accentKey,
      accent,
      bgKey,
      customBg,
      setTheme,
      setAccentKey,
      selectBg: (key) => {
        setBgKey(key);
        setCustomBg(null);
      },
      setCustomBg
    }),
    [theme, accentKey, accent, bgKey, customBg]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
