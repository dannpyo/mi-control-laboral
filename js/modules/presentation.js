// Preferencias visuales y reloj del dispositivo. No modifica datos laborales.
export const THEME_KEY = "mi-control-laboral-theme";
export const EXPECTED_ZONE = "America/Asuncion";
export function clockText(date = new Date()) {
  return new Intl.DateTimeFormat("es-PY", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
export function defaultLink(links, date = new Date()) {
  return links.find((link) => link.day === date.getDay())?.id || "";
}
export function readTheme(storage) {
  try {
    return storage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
