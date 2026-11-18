export function resolveAppearance(appearance) {
  if (appearance === "light" || appearance === "dark") return appearance;
  if (typeof document !== "undefined") {
    return document.documentElement.dataset.appearance === "light" ? "light" : "dark";
  }
  return "dark";
}