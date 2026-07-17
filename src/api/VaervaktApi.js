const API_BASE = (import.meta.env.VITE_VAERVAKT_API_BASE || "").replace(/\/$/, "");

function buildUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const query = url.searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function roundedCoordinate(value, decimals = 2) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate.toFixed(decimals) : value;
}

async function requestJson(path, options = {}) {
  const target = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(target, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Værvakt-API-et svarte ikke med gyldig JSON.");
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || "Noe gikk galt hos Værvakt.");
  }

  return payload;
}

export function fetchReports(
  { lat, lon, name },
  { limit = 12, maxAgeHours = 24 } = {}
) {
  const url = buildUrl("/api/reports.php", {
    limit,
    lat: roundedCoordinate(lat),
    lon: roundedCoordinate(lon),
    radiusKm: 35,
    location: name,
    maxAgeHours,
  });

  return requestJson(url);
}

export function fetchBathTemperatures({ lat, lon }) {
  const url = buildUrl("/api/weather.php", {
    lat: roundedCoordinate(lat, 3),
    lon: roundedCoordinate(lon, 3),
  });

  return requestJson(url, { cache: "no-store" });
}

export function submitReport(report) {
  return requestJson("/api/reports.php", {
    method: "POST",
    body: JSON.stringify({
      ...report,
      lat: roundedCoordinate(report.lat),
      lon: roundedCoordinate(report.lon),
    }),
  });
}

export function submitBathTemperature(report) {
  return requestJson("/api/bath-reports.php", {
    method: "POST",
    body: JSON.stringify(report),
  });
}
