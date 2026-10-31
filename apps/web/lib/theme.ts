// Per-viewer light/dark theme, persisted in localStorage and applied as a
// data-theme attribute on the document element (see app/console/theme.css).

export type Theme = "dark" | "light";
const KEY = "dg.theme";

export function loadTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "dark";
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {}
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}
