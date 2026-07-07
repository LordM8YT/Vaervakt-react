let websocket = null;
let pluginUUID = null;

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const ACTIONS = {
  weather: "no.vaervakt.streamdeck.now",
  bath: "no.vaervakt.streamdeck.bath",
  bathInfo: "no.vaervakt.streamdeck.bath-info",
  latest: "no.vaervakt.streamdeck.latest-report",
  report: "no.vaervakt.streamdeck.quick-report",
  open: "no.vaervakt.streamdeck.open",
};

const DEFAULT_SETTINGS = {
  apiBase: "https://www.xn--vrvakt-pua.no",
  placeName: "Kristiansand",
  lat: 58.1467,
  lon: 7.9956,
  reporterName: "Stream Deck",
  reportCondition: "Sol / Klart",
  openOnPress: true,
};

const contexts = new Map();
const timers = new Map();

function connectElgatoStreamDeckSocket(port, uuid, registerEvent) {
  pluginUUID = uuid;
  websocket = new WebSocket(`ws://127.0.0.1:${port}`);

  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }));
  };

  websocket.onmessage = (event) => {
    let message = null;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    const context = message.context;
    if (!context) return;

    if (message.event === "willAppear") {
      const action = message.action || message.payload?.action;
      const settings = normalizeSettings(message.payload?.settings);
      contexts.set(context, { action, settings });
      scheduleRefresh(context);
      void refreshContext(context);
      return;
    }

    if (message.event === "willDisappear") {
      clearRefresh(context);
      contexts.delete(context);
      return;
    }

    if (message.event === "didReceiveSettings") {
      const current = contexts.get(context);
      if (!current) return;
      current.settings = normalizeSettings(message.payload?.settings);
      contexts.set(context, current);
      scheduleRefresh(context);
      void refreshContext(context);
      return;
    }

    if (message.event === "keyDown") {
      void handleKeyDown(context);
    }
  };
}

function normalizeSettings(settings = {}) {
  const lat = Number(settings.lat ?? DEFAULT_SETTINGS.lat);
  const lon = Number(settings.lon ?? DEFAULT_SETTINGS.lon);

  return {
    apiBase: String(settings.apiBase || DEFAULT_SETTINGS.apiBase).replace(/\/+$/, ""),
    placeName: String(settings.placeName || DEFAULT_SETTINGS.placeName).trim(),
    lat: Number.isFinite(lat) ? lat : DEFAULT_SETTINGS.lat,
    lon: Number.isFinite(lon) ? lon : DEFAULT_SETTINGS.lon,
    reporterName: String(settings.reporterName || DEFAULT_SETTINGS.reporterName).trim(),
    reportCondition: String(settings.reportCondition || DEFAULT_SETTINGS.reportCondition).trim(),
    openOnPress: settings.openOnPress !== false,
  };
}

function scheduleRefresh(context) {
  clearRefresh(context);
  const timer = setInterval(() => {
    void refreshContext(context);
  }, REFRESH_INTERVAL_MS);
  timers.set(context, timer);
}

function clearRefresh(context) {
  const timer = timers.get(context);
  if (timer) {
    clearInterval(timer);
    timers.delete(context);
  }
}

async function handleKeyDown(context) {
  const state = contexts.get(context);
  if (!state) return;

  if (state.action === ACTIONS.open) {
    openUrl(state.settings.apiBase);
    return;
  }

  if (state.action === ACTIONS.report) {
    await submitReportAction(context, state.settings);
    return;
  }

  await refreshContext(context);

  if (state.settings.openOnPress && state.action === ACTIONS.latest) {
    openUrl(`${state.settings.apiBase}/lokalt/`);
  }
}

async function refreshContext(context) {
  const state = contexts.get(context);
  if (!state) return;

  const mode = modeFromAction(state.action);
  const settings = state.settings;

  if (mode === "open") {
    setTitle(context, "Åpne");
    setImage(context, makeKeyImage({ mode: "open", placeName: settings.placeName }));
    return;
  }

  if (mode === "report") {
    setTitle(context, "Rapport");
    setImage(
      context,
      makeKeyImage({
        mode: "report",
        placeName: settings.placeName,
        reportCondition: settings.reportCondition,
      }),
    );
    return;
  }

  setTitle(context, "...");
  setImage(context, makeKeyImage({ mode, placeName: settings.placeName, status: "loading" }));

  try {
    if (mode === "latest") {
      const latestReport = await fetchLatestReport(settings);
      setTitle(context, latestReport ? `${latestReport.temp}°` : "Ingen");
      setImage(
        context,
        makeKeyImage({
          mode,
          placeName: settings.placeName,
          latestReport,
        }),
      );
      return;
    }

    const weather = await fetchWeather(settings);
    const nearestBath = weather.bathing?.nearby?.[0];
    const bathTemperature = nearestBath?.temperature ?? weather.bathing?.waterTemperature;
    const bathPlace = nearestBath?.name ?? weather.bathing?.waterTemperatureLocation;
    const bathDistanceKm = nearestBath?.distanceKm ?? weather.bathing?.waterTemperatureDistanceKm;
    const bathTime = nearestBath?.time ?? weather.bathing?.waterTemperatureTime;
    const title = mode === "weather"
      ? `${Math.round(Number(weather.current.temperature))}°`
      : Number.isFinite(Number(bathTemperature))
        ? `${Math.round(Number(bathTemperature))}°`
        : "--";

    setTitle(context, title);
    setImage(
      context,
      makeKeyImage({
        mode,
        placeName: settings.placeName,
        temperature: weather.current.temperature,
        condition: weather.current.condition,
        icon: weather.current.icon,
        bathTemperature,
        bathPlace,
        bathDistanceKm,
        bathTime,
      }),
    );
  } catch (error) {
    setTitle(context, "Feil");
    setImage(
      context,
      makeKeyImage({
        mode,
        placeName: settings.placeName,
        status: "error",
        message: error instanceof Error ? error.message : "Kunne ikke hente data",
      }),
    );
  }
}

async function submitReportAction(context, settings) {
  setTitle(context, "Sender");
  setImage(
    context,
    makeKeyImage({
      mode: "report",
      placeName: settings.placeName,
      reportCondition: settings.reportCondition,
      status: "loading",
    }),
  );

  try {
    const weather = await fetchWeather(settings);
    await submitQuickReport(settings, weather);
    setTitle(context, "Sendt");
    setImage(
      context,
      makeKeyImage({
        mode: "report",
        placeName: settings.placeName,
        reportCondition: settings.reportCondition,
        status: "success",
      }),
    );
    setTimeout(() => {
      void refreshContext(context);
    }, 1800);
  } catch (error) {
    setTitle(context, "Feil");
    setImage(
      context,
      makeKeyImage({
        mode: "report",
        placeName: settings.placeName,
        reportCondition: settings.reportCondition,
        status: "error",
        message: error instanceof Error ? error.message : "Kunne ikke sende",
      }),
    );
  }
}

function modeFromAction(action) {
  if (action === ACTIONS.bath) return "bath";
  if (action === ACTIONS.bathInfo) return "bathInfo";
  if (action === ACTIONS.latest) return "latest";
  if (action === ACTIONS.report) return "report";
  if (action === ACTIONS.open) return "open";
  return "weather";
}

async function fetchWeather(settings) {
  const params = new URLSearchParams({
    lat: String(settings.lat),
    lon: String(settings.lon),
  });
  const response = await fetch(`${settings.apiBase}/api/weather.php?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.success === false || !payload.current) {
    throw new Error(payload.message || "Mangler værdata");
  }

  return payload;
}

async function fetchLatestReport(settings) {
  const params = new URLSearchParams({
    limit: "1",
    lat: String(settings.lat),
    lon: String(settings.lon),
    radiusKm: "35",
    location: settings.placeName,
  });
  const response = await fetch(`${settings.apiBase}/api/reports.php?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.success === false) {
    throw new Error(payload.message || "Mangler rapport");
  }

  return payload.reports?.[0] || null;
}

async function submitQuickReport(settings, weather) {
  const response = await fetch(`${settings.apiBase}/api/reports.php`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: settings.reporterName,
      condition: settings.reportCondition,
      location: settings.placeName,
      temperature: weather.current.temperature,
      lat: settings.lat,
      lon: settings.lon,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.success === false) {
    throw new Error(payload.message || "Rapport feilet");
  }

  return payload;
}

function setTitle(context, title) {
  sendToStreamDeck({
    event: "setTitle",
    context,
    payload: {
      target: 0,
      title,
    },
  });
}

function setImage(context, image) {
  sendToStreamDeck({
    event: "setImage",
    context,
    payload: {
      target: 0,
      image,
    },
  });
}

function openUrl(url) {
  sendToStreamDeck({
    event: "openUrl",
    payload: { url },
  });
}

function sendToStreamDeck(payload) {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
  websocket.send(JSON.stringify(payload));
}

function makeKeyImage(input) {
  const status = input.status || "ok";
  const place = text(input.placeName || "Værvakt", 10);
  const condition = text(input.condition || "Lokalt vær", 11);
  const icon = escapeXml(input.icon || conditionIcon(input.condition));
  const temp = escapeXml(formatTemperature(input.temperature));
  const bathTemp = escapeXml(formatTemperature(input.bathTemperature));
  const bathPlace = text(input.bathPlace || "Badeplass", 10);
  const bathDistance = escapeXml(formatDistance(input.bathDistanceKm) || "NÆR DEG");
  const bathTime = escapeXml(formatShortTime(input.bathTime));
  const message = text(input.message || "Oppdaterer", 11);
  const reportCondition = input.reportCondition || "Sol / Klart";
  const reportIcon = conditionIcon(reportCondition);
  const reportLabel = text(reportCondition, 11);

  if (status === "error") {
    return dataUri(shell(`
  <text x="16" y="31" fill="#fecdd3" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">VÆRVAKT</text>
  <text x="16" y="76" fill="#ffffff" font-family="Arial, sans-serif" font-size="48" font-weight="900">!</text>
  <text x="16" y="101" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="14" font-weight="900">FEIL</text>
  <text x="16" y="119" fill="#fecdd3" font-family="Arial, sans-serif" font-size="9.5" font-weight="800">${message}</text>
`, "#fb7185", 104, 38));
  }

  if (input.mode === "bathInfo") {
    return dataUri(shell(`
  <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">BADESTED</text>
  <text x="16" y="61" fill="#ffffff" font-family="Arial, sans-serif" font-size="17.5" font-weight="900">${status === "loading" ? "LASTER" : bathPlace}</text>
  <text x="16" y="84" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="15" font-weight="900">${status === "loading" ? "BADETEMP" : bathDistance}</text>
  <text x="16" y="105" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10" font-weight="800">${status === "loading" ? "YR" : `YR · ${bathTime}`}</text>
  <text x="113" y="120" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="32">🌊</text>
`, "#38bdf8"));
  }

  if (input.mode === "latest") {
    const report = input.latestReport;
    const latestIcon = escapeXml(report?.icon || "📍");
    const latestTemp = escapeXml(formatTemperature(report?.temp));
    const latestLocation = text(report?.location || input.placeName || "Lokalt", 10);
    const latestMeta = text(report ? `${report.condition} · ${report.time}` : "Ingen rapport", 13);

    return dataUri(shell(`
  <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">SISTE</text>
  <text x="15" y="72" fill="#ffffff" font-family="Arial, sans-serif" font-size="${latestTemp.length > 3 ? 42 : 53}" font-weight="900">${status === "loading" ? "--" : latestTemp}</text>
  <text x="16" y="97" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="12.5" font-weight="900">${latestLocation}</text>
  <text x="16" y="117" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="9.5" font-weight="800">${latestMeta}</text>
  <text x="113" y="116" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="32">${latestIcon}</text>
`, "#38bdf8", 108, 42));
  }

  if (input.mode === "report") {
    const label = status === "success" ? "SENDT" : status === "loading" ? "SENDER" : "RAPPORT";
    const sub = status === "success" ? "TAKK" : reportLabel;
    const mainIcon = status === "success" ? "✅" : reportIcon;

    return dataUri(shell(`
  <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">VÆRVAKT</text>
  <text x="72" y="74" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="42" filter="url(#softShadow)">${mainIcon}</text>
  <text x="16" y="101" fill="#ffffff" font-family="Arial, sans-serif" font-size="18" font-weight="900">${label}</text>
  <text x="16" y="119" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10" font-weight="800">${sub}</text>
`, status === "success" ? "#22c55e" : "#38bdf8", 100, 42));
  }

  if (input.mode === "open") {
    return dataUri(shell(`
  <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">ÅPNE</text>
  <text x="72" y="75" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="44" filter="url(#softShadow)">🌤️</text>
  <text x="16" y="104" fill="#ffffff" font-family="Arial, sans-serif" font-size="17" font-weight="900">VÆRVAKT</text>
  <text x="16" y="121" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10" font-weight="800">${place}</text>
`, "#38bdf8", 100, 40));
  }

  if (input.mode === "bath") {
    const mainTemp = status === "loading" ? "--" : bathTemp;

    return dataUri(shell(`
  <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">BADETEMP</text>
  <text x="15" y="72" fill="#ffffff" font-family="Arial, sans-serif" font-size="${mainTemp.length > 3 ? 44 : 56}" font-weight="900">${mainTemp}</text>
  <text x="16" y="97" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="12.5" font-weight="900">${bathPlace}</text>
  <text x="16" y="117" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="9.5" font-weight="800">YR · ${bathDistance}</text>
  <text x="113" y="116" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="32">🌊</text>
`, "#38bdf8", 108, 42));
  }

  const mainTemp = status === "loading" ? "--" : temp;

  return dataUri(shell(`
  <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">NÅ</text>
  <text x="15" y="72" fill="#ffffff" font-family="Arial, sans-serif" font-size="${mainTemp.length > 3 ? 44 : 56}" font-weight="900">${mainTemp}</text>
  <text x="16" y="97" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="12.5" font-weight="900">${place}</text>
  <text x="16" y="117" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="9.5" font-weight="800">${condition}</text>
  <text x="113" y="116" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="32">${icon}</text>
`, "#38bdf8", 108, 42));
}

function shell(content, accent = "#38bdf8", glowX = 106, glowY = 106) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs>
    <linearGradient id="bg" x1="10" y1="0" x2="134" y2="144" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#16386e"/>
      <stop offset="0.45" stop-color="#07162d"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${glowX} ${glowY}) rotate(120) scale(76)">
      <stop stop-color="${accent}" stop-opacity="0.66"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity="0.34"/>
    </filter>
  </defs>
  <rect width="144" height="144" rx="26" fill="url(#bg)"/>
  <rect width="144" height="144" rx="26" fill="url(#glow)"/>
  <path d="M0 0h25L0 25Z" fill="${accent}" opacity=".78"/>
  <path d="M144 144h-25l25-25Z" fill="#2563eb" opacity=".78"/>
  <rect x="7" y="7" width="130" height="130" rx="22" fill="rgba(255,255,255,.035)" stroke="rgba(186,230,253,.18)" stroke-width="1"/>
  ${content}
</svg>`;
}

function dataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTemperature(value) {
  if (!Number.isFinite(Number(value))) {
    return "--";
  }
  return `${Math.round(Number(value))}°`;
}

function formatDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) {
    return "";
  }
  if (distance < 1) {
    return `${Math.max(1, Math.round(distance * 1000))} M`;
  }
  return `${distance.toFixed(1).replace(".", ",")} KM`;
}

function formatShortTime(value) {
  if (!value) return "NÅ";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "NÅ";
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function truncate(value, maxLength) {
  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function text(value, maxLength) {
  return escapeXml(truncate(String(value).toUpperCase(), maxLength));
}

function conditionIcon(condition = "") {
  const lower = String(condition).toLowerCase();
  if (lower.includes("snø") || lower.includes("sludd")) return "❄️";
  if (lower.includes("regn") || lower.includes("byge")) return "🌧️";
  if (lower.includes("torden") || lower.includes("storm") || lower.includes("vind")) return "⛈️";
  if (lower.includes("tåke")) return "🌫️";
  if (lower.includes("sky")) return "☁️";
  return "☀️";
}
