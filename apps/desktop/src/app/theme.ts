import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The one place accent colors are defined. Surfaces, borders and text stay black and gray;
 * the chosen accent only replaces `--color-accent*` from tokens.css, so every `bg-accent`,
 * `text-accent`, `ring-accent/30`… follows it. Each `color` is bright enough to read as text
 * on black and to carry `fg` text as a button.
 */
export const ACCENTS = [
  { id: "emerald", name: "Emerald (original)", color: "#3ecf8e", hover: "#36b97e", fg: "#020202" },
  { id: "silver", name: "Silver", color: "#b8bcc4", hover: "#cdd0d6", fg: "#020202" },
  { id: "mono", name: "Mono White", color: "#fafafa", hover: "#d4d4d4", fg: "#020202" },
  { id: "maroon", name: "Maroon", color: "#c23a4e", hover: "#d24b5f", fg: "#ffffff" },
  { id: "burgundy", name: "Burgundy", color: "#b8325a", hover: "#c94469", fg: "#ffffff" },
  { id: "lavender", name: "Lavender", color: "#9d8cf7", hover: "#b2a5fa", fg: "#110c22" },
  { id: "amethyst", name: "Amethyst", color: "#9966cc", hover: "#aa7dd6", fg: "#ffffff" },
  { id: "plum", name: "Plum", color: "#a8559d", hover: "#b96aae", fg: "#ffffff" },
  { id: "bronze", name: "Bronze", color: "#b67a48", hover: "#c78c5a", fg: "#020202" },
  { id: "sand", name: "Sand", color: "#d8c3a5", hover: "#e4d3ba", fg: "#1a140c" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];
export type Accent = (typeof ACCENTS)[number];

/** Keep in sync with the `--color-accent*` defaults in packages/ui/src/styles/tokens.css. */
export const DEFAULT_ACCENT: AccentId = "silver";

export function getAccent(id: string): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS.find((a) => a.id === DEFAULT_ACCENT)!;
}

/** "r, g, b" for canvas code that builds `rgba(...)` strings. */
export function accentRgb(id: string = useAccent.getState().accent): string {
  const n = parseInt(getAccent(id).color.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function applyAccent(id: string) {
  const accent = getAccent(id);
  const style = document.documentElement.style;
  style.setProperty("--color-accent", accent.color);
  style.setProperty("--color-accent-hover", accent.hover);
  style.setProperty("--color-accent-fg", accent.fg);
  style.setProperty("--color-accent-muted", `rgb(${accentRgb(accent.id)} / 0.1)`);
}

interface AccentState {
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
}

/** The user's accent color, remembered across restarts. */
export const useAccent = create<AccentState>()(
  persist(
    (set) => ({
      accent: DEFAULT_ACCENT,
      setAccent: (accent) => set({ accent }),
    }),
    { name: "postcompass-theme", version: 1 },
  ),
);

// localStorage hydrates synchronously, so this paints the saved accent before the first render
applyAccent(useAccent.getState().accent);
useAccent.subscribe((s) => applyAccent(s.accent));
