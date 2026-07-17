import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";

const PERSISTED_LOCAL_KEYS = new Set(["vaervakt_theme"]);

const app = mount(App, {
  target: document.getElementById("app"),
});

function removeLegacyClientData() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("vaervakt_") && !PERSISTED_LOCAL_KEYS.has(key))
      .forEach((key) => window.localStorage.removeItem(key));
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith("vaervakt_"))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Opprydding kan være blokkert i strenge/private nettlesermoduser.
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((item) => item.unregister())))
      .catch(() => {});
  }

  if ("caches" in window) {
    window.caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.toLowerCase().includes("vaervakt"))
            .map((key) => window.caches.delete(key))
        )
      )
      .catch(() => {});
  }
}

removeLegacyClientData();

export default app;
