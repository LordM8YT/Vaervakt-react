const API_BASE = process.env.REACT_APP_VAERVAKT_API_BASE || "";

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

export function fetchReports({ lat, lon, name }, limit = 8) {
  const url = buildUrl("/api/reports.php", {
    limit,
    lat,
    lon,
    radiusKm: 35,
    location: name,
  });

  return requestJson(url);
}

export function fetchBathTemperatures({ lat, lon }) {
  const url = buildUrl("/api/weather.php", {
    lat,
    lon,
  });

  return requestJson(url, { cache: "no-store" });
}

export function submitReport(report) {
  return requestJson("/api/reports.php", {
    method: "POST",
    body: JSON.stringify(report),
  });
}

export function submitBathTemperature(report) {
  return requestJson("/api/bath-reports.php", {
    method: "POST",
    body: JSON.stringify(report),
  });
}

export function fetchHubPosts({ lat, lon, name }, sort = "new", limit = 8) {
  const url = buildUrl("/api/hub.php", {
    limit,
    lat,
    lon,
    radiusKm: 35,
    location: name,
    sort,
  });

  return requestJson(url);
}

export function fetchGlimpsePhotos({ lat, lon, name }, limit = 12) {
  const url = buildUrl("/api/glimpses.php", {
    limit,
    lat,
    lon,
    radiusKm: 35,
    location: name,
  });

  return requestJson(url);
}

export function loginHubProfile(displayName, pin, action = "login") {
  return requestJson("/api/hub.php", {
    method: "POST",
    body: JSON.stringify({ action, displayName, pin }),
  });
}

export function createHubPost(post) {
  return requestJson("/api/hub.php", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...post }),
  });
}

export function uploadGlimpsePhoto(formData) {
  return requestJson("/api/glimpses.php", {
    method: "POST",
    body: formData,
  });
}

export function voteHubPost(vote) {
  return requestJson("/api/hub.php", {
    method: "POST",
    body: JSON.stringify({ action: "vote", ...vote }),
  });
}

export function trackVisit(path = window.location.pathname) {
  try {
    const target = `${API_BASE}/api/track.php`;
    const payload = JSON.stringify({
      path,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        target,
        new Blob([payload], { type: "application/json" })
      );
      return;
    }

    fetch(target, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch (error) {
    // Tracking should never block the weather app.
  }
}
