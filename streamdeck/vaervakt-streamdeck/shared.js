export const ACTIONS = {
  weather: "no.vaervakt.streamdeck.now",
  bath: "no.vaervakt.streamdeck.bath",
  bathInfo: "no.vaervakt.streamdeck.bath-info",
  latest: "no.vaervakt.streamdeck.latest-report",
  report: "no.vaervakt.streamdeck.quick-report",
  open: "no.vaervakt.streamdeck.open",
};

export const DEFAULT_SETTINGS = {
  apiBase: "https://www.xn--vrvakt-pua.no",
  placeName: "Kristiansand",
  lat: 58.1467,
  lon: 7.9956,
  refreshMinutes: 5,
  bathLocationId: "",
  bathLocationName: "",
  reporterName: "Stream Deck",
  reportCondition: "Sol / Klart",
  openOnPress: true,
};

export function normalizeSettings(settings = {}) {
  const lat = Number(settings.lat ?? DEFAULT_SETTINGS.lat);
  const lon = Number(settings.lon ?? DEFAULT_SETTINGS.lon);
  const refreshMinutes = Number(
    settings.refreshMinutes ?? DEFAULT_SETTINGS.refreshMinutes,
  );
  const normalizedRefreshMinutes = [5, 10].includes(refreshMinutes)
    ? refreshMinutes
    : DEFAULT_SETTINGS.refreshMinutes;

  return {
    apiBase: String(settings.apiBase || DEFAULT_SETTINGS.apiBase).replace(/\/+$/, ""),
    placeName: String(settings.placeName || DEFAULT_SETTINGS.placeName).trim(),
    lat: Number.isFinite(lat) ? lat : DEFAULT_SETTINGS.lat,
    lon: Number.isFinite(lon) ? lon : DEFAULT_SETTINGS.lon,
    refreshMinutes: normalizedRefreshMinutes,
    bathLocationId: String(
      settings.bathLocationId || DEFAULT_SETTINGS.bathLocationId,
    ).trim(),
    bathLocationName: String(
      settings.bathLocationName || DEFAULT_SETTINGS.bathLocationName,
    ).trim(),
    reporterName: String(
      settings.reporterName || DEFAULT_SETTINGS.reporterName,
    ).trim(),
    reportCondition: String(
      settings.reportCondition || DEFAULT_SETTINGS.reportCondition,
    ).trim(),
    openOnPress: settings.openOnPress !== false,
  };
}

export function modeFromAction(action) {
  if (action === ACTIONS.bath) return "bath";
  if (action === ACTIONS.bathInfo) return "bathInfo";
  if (action === ACTIONS.latest) return "latest";
  if (action === ACTIONS.report) return "report";
  if (action === ACTIONS.open) return "open";
  return "weather";
}
