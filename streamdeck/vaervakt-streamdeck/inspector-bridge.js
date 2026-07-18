import { DEFAULT_SETTINGS, normalizeSettings } from "./shared.js";

let websocket = null;
let context = null;
let action = "";
let connected = false;
let settings = { ...DEFAULT_SETTINGS };
const subscribers = new Set();

function snapshot() {
  return {
    action,
    connected,
    settings: { ...settings },
  };
}

function publish() {
  const value = snapshot();
  subscribers.forEach((subscriber) => subscriber(value));
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

window.connectElgatoStreamDeckSocket = (
  port,
  uuid,
  registerEvent,
  _info,
  actionInfo,
) => {
  context = uuid;
  const parsedActionInfo = parseJson(actionInfo);
  action = parsedActionInfo.action || "";
  settings = normalizeSettings(parsedActionInfo.payload?.settings);
  publish();

  websocket = new WebSocket(`ws://127.0.0.1:${port}`);
  websocket.onopen = () => {
    connected = true;
    websocket.send(JSON.stringify({ event: registerEvent, uuid }));
    publish();
  };
  websocket.onclose = () => {
    connected = false;
    publish();
  };
  websocket.onmessage = (event) => {
    const message = parseJson(event.data);
    if (message.event === "didReceiveSettings") {
      settings = normalizeSettings(message.payload?.settings);
      publish();
    }
  };
};

export function subscribeToInspector(callback) {
  subscribers.add(callback);
  callback(snapshot());
  return () => subscribers.delete(callback);
}

export function saveInspectorSettings(nextSettings) {
  if (!context || websocket?.readyState !== WebSocket.OPEN) return false;
  settings = normalizeSettings(nextSettings);
  websocket.send(
    JSON.stringify({
      event: "setSettings",
      context,
      payload: settings,
    }),
  );
  publish();
  return true;
}
