import { makeKeyImage } from "./key-image.js";
import { ACTIONS, DEFAULT_SETTINGS, modeFromAction, normalizeSettings } from "./shared.js";

const MET_API_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_VALID_BATH_TEMPERATURE = 1;
const MAX_VALID_BATH_TEMPERATURE = 40;

let websocket = null;
let pluginUUID = null;

const contexts = new Map();
const refreshTimers = new Map();
const startupTimers = new Map();
const retryTimers = new Map();

window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent) => {
  pluginUUID = uuid;
  websocket = new WebSocket(`ws://127.0.0.1:${port}`);

  websocket.onopen = () => {
    websocket.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }));
  };

  websocket.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    const context = message.context;
    if (!context) return;

    if (message.event === "willAppear") {
      const action = message.action || message.payload?.action;
      const settings = normalizeContextSettings(
        context,
        message.payload?.settings,
      );
      contexts.set(context, { action, settings, requestId: 0, lastGood: null });
      scheduleRefresh(context);
      scheduleStartupRefresh(context);
      void refreshContext(context);
      return;
    }

    if (message.event === "willDisappear") {
      clearRefresh(context);
      clearStartupRefresh(context);
      clearRetry(context);
      contexts.delete(context);
      return;
    }

    if (message.event === "didReceiveSettings") {
      const current = contexts.get(context);
      if (!current) return;
      current.settings = normalizeContextSettings(
        context,
        message.payload?.settings,
      );
      current.lastGood = null;
      current.requestId += 1;
      scheduleRefresh(context);
      scheduleStartupRefresh(context);
      void refreshContext(context);
      return;
    }

    if (message.event === "keyDown") {
      void handleKeyDown(context);
    }
  };
};

function normalizeContextSettings(context, rawSettings) {
  const settings = normalizeSettings(rawSettings);
  if (Number(rawSettings?.refreshMinutes) !== settings.refreshMinutes) {
    sendToStreamDeck({
      event: "setSettings",
      context,
      payload: settings,
    });
  }
  return settings;
}

function scheduleRefresh(context) {
  clearRefresh(context);
  const state = contexts.get(context);
  const minutes = state?.settings?.refreshMinutes || DEFAULT_SETTINGS.refreshMinutes;
  refreshTimers.set(
    context,
    setInterval(() => void refreshContext(context), minutes * 60 * 1000),
  );
}

function clearRefresh(context) {
  const timer = refreshTimers.get(context);
  if (timer) clearInterval(timer);
  refreshTimers.delete(context);
}

function scheduleStartupRefresh(context) {
  clearStartupRefresh(context);
  const timers = [1_200, 5_000, 15_000].map((delay, index) =>
    setTimeout(() => {
      const state = contexts.get(context);
      if (state && (index === 0 || !state.lastGood)) {
        void refreshContext(context);
      }
    }, delay),
  );
  startupTimers.set(context, timers);
}

function clearStartupRefresh(context) {
  startupTimers.get(context)?.forEach(clearTimeout);
  startupTimers.delete(context);
}

function scheduleRetry(context, delay = 10_000) {
  clearRetry(context);
  retryTimers.set(
    context,
    setTimeout(() => {
      retryTimers.delete(context);
      if (contexts.has(context)) void refreshContext(context);
    }, delay),
  );
}

function clearRetry(context) {
  const timer = retryTimers.get(context);
  if (timer) clearTimeout(timer);
  retryTimers.delete(context);
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

  if (!state.settings.openOnPress) return;

  const mode = modeFromAction(state.action);
  if (mode === "latest") openUrl(`${state.settings.apiBase}/lokalt/`);
  else if (mode === "bath" || mode === "bathInfo") {
    openUrl(`${state.settings.apiBase}/bad/`);
  } else {
    openUrl(state.settings.apiBase);
  }
}

async function refreshContext(context) {
  const state = contexts.get(context);
  if (!state) return;

  const mode = modeFromAction(state.action);
  const settings = state.settings;
  const requestId = startRequest(context);

  if (mode === "open") {
    updateKey(context, "Åpne", { mode, placeName: settings.placeName });
    return;
  }

  if (mode === "report") {
    updateKey(context, "Rapport", {
      mode,
      placeName: settings.placeName,
      reportCondition: settings.reportCondition,
    });
    return;
  }

  if (!state.lastGood) {
    updateKey(context, "...", {
      mode,
      placeName: settings.placeName,
      status: "loading",
    });
  }

  try {
    if (mode === "latest") {
      const latestReport = await fetchLatestReport(settings);
      if (!isCurrentRequest(context, requestId)) return;
      const result = {
        title: latestReport ? formatTemperature(latestReport.temp) : "Ingen",
        image: makeKeyImage({
          mode,
          placeName: settings.placeName,
          latestReport,
        }),
      };
      applyGoodResult(context, state, result);
      return;
    }

    if (mode === "bath" || mode === "bathInfo") {
      const bathing = await fetchBathing(settings);
      if (!isCurrentRequest(context, requestId)) return;
      const reading = resolveBathReading(bathing, settings);
      if (!Number.isFinite(reading.temperature)) {
        throw new Error("Ingen badetemp");
      }
      const result = {
        title: formatTemperature(reading.temperature),
        image: makeKeyImage({
          mode,
          placeName: settings.placeName,
          bathTemperature: reading.temperature,
          bathPlace: reading.name,
          bathDistanceKm: reading.distanceKm,
          bathTime: reading.time,
        }),
      };
      applyGoodResult(context, state, result);
      return;
    }

    const weather = await fetchCurrentWeather(settings);
    if (!isCurrentRequest(context, requestId)) return;

    const result = {
      title: formatTemperature(weather.temperature),
      image: makeKeyImage({
        mode,
        placeName: settings.placeName,
        temperature: weather.temperature,
        condition: weather.condition,
      }),
    };
    applyGoodResult(context, state, result);
  } catch (error) {
    if (!isCurrentRequest(context, requestId)) return;
    if (state.lastGood) {
      scheduleRetry(context);
      return;
    }
    updateKey(context, "Feil", {
      mode,
      placeName: settings.placeName,
      status: "error",
      message: readableError(error),
    });
    scheduleRetry(context);
  }
}

function applyGoodResult(context, state, result) {
  state.lastGood = result;
  setTitle(context, result.title);
  setImage(context, result.image);
  clearRetry(context);
}

function startRequest(context) {
  const state = contexts.get(context);
  if (!state) return 0;
  state.requestId += 1;
  return state.requestId;
}

function isCurrentRequest(context, requestId) {
  return contexts.get(context)?.requestId === requestId;
}

async function submitReportAction(context, settings) {
  updateKey(context, "Sender", {
    mode: "report",
    placeName: settings.placeName,
    reportCondition: settings.reportCondition,
    status: "loading",
  });

  try {
    const weather = await fetchCurrentWeather(settings);
    await submitQuickReport(settings, weather);
    updateKey(context, "Sendt", {
      mode: "report",
      placeName: settings.placeName,
      reportCondition: settings.reportCondition,
      status: "success",
    });
    setTimeout(() => void refreshContext(context), 1_800);
  } catch (error) {
    updateKey(context, "Feil", {
      mode: "report",
      placeName: settings.placeName,
      reportCondition: settings.reportCondition,
      status: "error",
      message: readableError(error),
    });
    showAlert(context);
  }
}

async function fetchCurrentWeather(settings) {
  const params = new URLSearchParams({
    lat: String(settings.lat),
    lon: String(settings.lon),
  });
  const payload = await requestJson(`${MET_API_URL}?${params}`, {
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  const point = payload?.properties?.timeseries?.[0];
  const details = point?.data?.instant?.details;
  const forecast = point?.data?.next_1_hours || point?.data?.next_6_hours;
  const symbolCode = forecast?.summary?.symbol_code || "cloudy";
  const temperature = Number(details?.air_temperature);

  if (!Number.isFinite(temperature)) {
    throw new Error("Mangler værdata");
  }

  return {
    temperature,
    condition: symbolToNorwegian(symbolCode),
    symbolCode,
  };
}

async function fetchBathing(settings, timeoutMs = REQUEST_TIMEOUT_MS) {
  const params = new URLSearchParams({
    lat: String(settings.lat),
    lon: String(settings.lon),
  });
  const payload = await requestJson(
    `${settings.apiBase}/api/weather.php?${params}`,
    { timeoutMs },
  );
  if (payload.success === false || !payload.bathing) {
    throw new Error(payload.message || "Mangler badetemp");
  }
  return payload.bathing;
}

async function fetchLatestReport(settings) {
  const params = new URLSearchParams({
    limit: "1",
    lat: String(settings.lat),
    lon: String(settings.lon),
    radiusKm: "35",
    location: settings.placeName,
  });
  const payload = await requestJson(
    `${settings.apiBase}/api/reports.php?${params}`,
    { timeoutMs: REQUEST_TIMEOUT_MS },
  );
  if (payload.success === false) {
    throw new Error(payload.message || "Mangler rapport");
  }
  return payload.reports?.[0] || null;
}

async function submitQuickReport(settings, weather) {
  const payload = await requestJson(`${settings.apiBase}/api/reports.php`, {
    method: "POST",
    timeoutMs: REQUEST_TIMEOUT_MS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: settings.reporterName,
      condition: settings.reportCondition,
      location: settings.placeName,
      temperature: weather.temperature,
      lat: settings.lat,
      lon: settings.lon,
    }),
  });
  if (payload.success === false) {
    throw new Error(payload.message || "Rapport feilet");
  }
  return payload;
}

function selectBathLocation(bathing, settings) {
  const nearby = Array.isArray(bathing?.nearby) ? bathing.nearby : [];
  if (!nearby.length || (!settings.bathLocationId && !settings.bathLocationName)) {
    return null;
  }
  return (
    nearby.find((place) => {
      const idMatches =
        settings.bathLocationId &&
        String(place.locationId || "") === settings.bathLocationId;
      const nameMatches =
        settings.bathLocationName &&
        String(place.name || "").toLowerCase() ===
          settings.bathLocationName.toLowerCase();
      return idMatches || nameMatches;
    }) || null
  );
}

function resolveBathReading(bathing, settings) {
  const nearby = Array.isArray(bathing?.nearby) ? bathing.nearby : [];
  const selected = selectBathLocation(bathing, settings);
  const fallback = nearby[0] || {
    temperature: bathing?.waterTemperature,
    name: bathing?.waterTemperatureLocation,
    distanceKm: bathing?.waterTemperatureDistanceKm,
    time: bathing?.waterTemperatureTime,
  };
  const source = selected || fallback || {};

  return {
    temperature: normalizeBathTemperature(
      source.temperature ?? bathing?.waterTemperature,
    ),
    name: firstText(
      source.name,
      settings.bathLocationName,
      bathing?.waterTemperatureLocation,
      "Ingen måling",
    ),
    distanceKm: normalizeDistance(
      source.distanceKm ?? bathing?.waterTemperatureDistanceKm,
    ),
    time: source.time ?? bathing?.waterTemperatureTime ?? "",
  };
}

function normalizeBathTemperature(value) {
  const temperature = Number(value);
  return Number.isFinite(temperature) &&
    temperature >= MIN_VALID_BATH_TEMPERATURE &&
    temperature <= MAX_VALID_BATH_TEMPERATURE
    ? temperature
    : null;
}

function normalizeDistance(value) {
  const distance = Number(value);
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function symbolToNorwegian(symbolCode = "") {
  const symbol = symbolCode.toLowerCase();
  if (symbol.includes("thunder")) return "Torden";
  if (symbol.includes("snow")) return "Snø";
  if (symbol.includes("sleet")) return "Sludd";
  if (symbol.includes("fog")) return "Tåke";
  if (symbol.includes("rain")) {
    return symbol.includes("showers") ? "Regnbyger" : "Regn";
  }
  if (symbol.includes("partlycloudy")) return "Delvis skyet";
  if (symbol.includes("cloudy")) return "Skyet";
  if (symbol.includes("fair")) return "Lettskyet";
  if (symbol.includes("clearsky")) return "Klart";
  return "Skiftende vær";
}

function readableError(error) {
  if (error?.name === "AbortError" || error?.message === "Timeout") return "Timeout";
  if (/HTTP \d+/.test(error?.message || "")) return error.message;
  return error?.message || "Kunne ikke hente";
}

async function requestJson(url, options = {}) {
  if (typeof fetch !== "function") {
    return requestJsonWithXhr(url, options);
  }

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
      body: options.body,
      signal: controller?.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Timeout");
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function requestJsonWithXhr(url, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || "GET", url, true);
    xhr.timeout = options.timeoutMs || REQUEST_TIMEOUT_MS;
    xhr.setRequestHeader("Accept", "application/json");
    Object.entries(options.headers || {}).forEach(([key, value]) =>
      xhr.setRequestHeader(key, value),
    );
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`HTTP ${xhr.status}`));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error("Ugyldig JSON"));
      }
    };
    xhr.onerror = () => reject(new Error("Nettverksfeil"));
    xhr.ontimeout = () => reject(new Error("Timeout"));
    xhr.send(options.body || null);
  });
}

function updateKey(context, title, input) {
  setTitle(context, title);
  setImage(context, makeKeyImage(input));
}

function formatTemperature(value) {
  const temperature = Number(value);
  return Number.isFinite(temperature)
    ? `${temperature.toFixed(1).replace(".", ",")}°`
    : "--";
}

function setTitle(context, title) {
  sendToStreamDeck({
    event: "setTitle",
    context,
    payload: { target: 0, title },
  });
}

function setImage(context, image) {
  sendToStreamDeck({
    event: "setImage",
    context,
    payload: { target: 0, image },
  });
}

function showAlert(context) {
  sendToStreamDeck({ event: "showAlert", context });
}

function openUrl(url) {
  sendToStreamDeck({ event: "openUrl", payload: { url } });
}

function sendToStreamDeck(payload) {
  if (websocket?.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(payload));
  }
}
