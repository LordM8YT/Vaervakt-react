const SEARCH_CACHE_COORDINATE_DECIMALS = 5;

export function createCachedLocation(location, preserveTimestamp = false) {
  const name = String(location?.name || "").trim().slice(0, 160);
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  if (
    !name ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  const isGps = location.source === "gps";
  const accuracy =
    location.accuracy === null || location.accuracy === ""
      ? Number.NaN
      : Number(location.accuracy);
  const cachedAt = Number(location.cachedAt);
  return {
    name,
    // GPS beholdes urørt. Bare søketreff normaliseres for en stabil cacheverdi.
    lat: isGps ? lat : Number(lat.toFixed(SEARCH_CACHE_COORDINATE_DECIMALS)),
    lon: isGps ? lon : Number(lon.toFixed(SEARCH_CACHE_COORDINATE_DECIMALS)),
    accuracy: Number.isFinite(accuracy)
      ? Math.max(0, Math.round(accuracy))
      : null,
    source: isGps ? "gps" : "search",
    cachedAt:
      preserveTimestamp && Number.isFinite(cachedAt) && cachedAt > 0
        ? cachedAt
        : Date.now(),
  };
}
