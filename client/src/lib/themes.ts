// Appearance perks for verified accounts. Each theme is a set of CSS variable overrides in
// index.css under html[data-theme="..."]; "party" resolves to the voter's own party colors.
// Palettes are named by color only: no team names or logos (trademarks).

export type ThemeId =
  | "classic" | "party" | "crimson-gold" | "navy-orange" | "forest-silver"
  | "purple-gold" | "teal-black" | "scarlet-gray";
export type NumberStyle = "flat" | "3d";
export interface Preferences { theme: ThemeId; numbers: NumberStyle }

export const DEFAULT_PREFERENCES: Preferences = { theme: "classic", numbers: "flat" };

export const THEMES: { id: ThemeId; label: string; swatch: [string, string] }[] = [
  { id: "classic", label: "Classic", swatch: ["#2563eb", "#f8fafc"] },
  { id: "party", label: "My party colors", swatch: ["#b91c1c", "#1d4ed8"] },
  { id: "crimson-gold", label: "Crimson & Gold", swatch: ["#a1162f", "#f2c14e"] },
  { id: "navy-orange", label: "Navy & Orange", swatch: ["#1b2a4a", "#f2802e"] },
  { id: "forest-silver", label: "Forest & Silver", swatch: ["#1c5e3c", "#c3c8ce"] },
  { id: "purple-gold", label: "Purple & Gold", swatch: ["#4b2a83", "#f2c14e"] },
  { id: "teal-black", label: "Teal & Black", swatch: ["#0f7c7c", "#1a1a1a"] },
  { id: "scarlet-gray", label: "Scarlet & Gray", swatch: ["#b3171d", "#9aa1a8"] },
];

const PARTY_THEME: Record<string, string> = {
  red: "party-red",
  blue: "party-blue",
  independent: "party-independent",
  undecided: "party-undecided",
};

/** Applies (or clears) the theme on <html>. Unverified visitors always get the default look. */
export function applyAppearance(prefs: Preferences | null | undefined, verified: boolean, intent?: string | null) {
  const root = document.documentElement;
  const p = verified && prefs ? prefs : DEFAULT_PREFERENCES;
  const theme = p.theme === "party" ? (intent && PARTY_THEME[intent]) || "classic" : p.theme;
  if (theme === "classic") delete root.dataset.theme;
  else root.dataset.theme = theme;
  if (p.numbers === "3d") root.dataset.numbers = "3d";
  else delete root.dataset.numbers;
}
