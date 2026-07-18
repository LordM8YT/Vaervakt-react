<script>
  import { onMount } from "svelte";
  import {
    AlertCircle,
    Check,
    Clock3,
    CloudSun,
    ExternalLink,
    LocateFixed,
    MapPin,
    RefreshCw,
    Save,
    Search,
    Send,
    Settings2,
    UserRound,
    Waves,
  } from "@lucide/svelte";
  import { ACTIONS, DEFAULT_SETTINGS, modeFromAction } from "./shared.js";
  import {
    saveInspectorSettings,
    subscribeToInspector,
  } from "./inspector-bridge.js";

  const ACTION_META = {
    weather: { title: "Værvakt nå", description: "Lokalt vær fra MET", icon: CloudSun },
    bath: { title: "Badetemp", description: "Nærmeste bademåling", icon: Waves },
    bathInfo: { title: "Badetemp info", description: "Sted, avstand og tidspunkt", icon: MapPin },
    latest: { title: "Siste rapport", description: "Lokale værrapporter", icon: MapPin },
    report: { title: "Send rapport", description: "Hurtigrapport fra knappen", icon: Send },
    open: { title: "Åpne Værvakt", description: "Snarvei til nettsiden", icon: ExternalLink },
  };

  let action = ACTIONS.weather;
  let connected = false;
  let settings = { ...DEFAULT_SETTINGS };
  let bathPlaces = [];
  let positionStatus = { message: "", tone: "" };
  let bathStatus = { message: "", tone: "" };
  let saveStatus = "";
  let isLocating = false;
  let isSearching = false;
  let isLoadingBaths = false;
  let saveTimer = null;

  $: mode = modeFromAction(action);
  $: meta = ACTION_META[mode] || ACTION_META.weather;
  $: ActionIcon = meta.icon;
  $: isBathAction = mode === "bath" || mode === "bathInfo";
  $: isReportAction = mode === "report";
  $: canOpenOnPress = !isReportAction && mode !== "open";
  $: bathOptions = withSelectedBathPlace(bathPlaces);

  onMount(() => {
    const unsubscribe = subscribeToInspector((state) => {
      action = state.action || ACTIONS.weather;
      connected = state.connected;
      settings = { ...state.settings };
    });
    return () => {
      unsubscribe();
      if (saveTimer) window.clearTimeout(saveTimer);
    };
  });

  function withSelectedBathPlace(places) {
    const values = Array.isArray(places) ? [...places] : [];
    if (
      settings.bathLocationId &&
      !values.some(
        (place) =>
          String(place.locationId || place.id) ===
          String(settings.bathLocationId),
      )
    ) {
      values.unshift({
        locationId: settings.bathLocationId,
        name: settings.bathLocationName || settings.bathLocationId,
        distanceKm: null,
      });
    }
    return values;
  }

  function save(message = "Innstillingene er lagret") {
    const saved = saveInspectorSettings(settings);
    saveStatus = saved ? message : "Venter på Stream Deck…";
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => (saveStatus = ""), 2_400);
  }

  function handleSubmit(event) {
    event.preventDefault();
    save();
  }

  function setPositionStatus(message, tone = "") {
    positionStatus = { message, tone };
  }

  function setBathStatus(message, tone = "") {
    bathStatus = { message, tone };
  }

  function formatDistance(value) {
    const distance = Number(value);
    if (!Number.isFinite(distance)) return "";
    return distance < 1
      ? `${Math.max(1, Math.round(distance * 1000))} m`
      : `${distance.toFixed(1).replace(".", ",")} km`;
  }

  function placeLabel(place) {
    const distance = formatDistance(place.distanceKm);
    return distance ? `${place.name} · ${distance}` : place.name;
  }

  function selectedBathName() {
    if (!settings.bathLocationId) return "";
    return (
      bathOptions.find(
        (place) =>
          String(place.locationId || place.id) ===
          String(settings.bathLocationId),
      )?.name ||
      settings.bathLocationName ||
      ""
    );
  }

  function chooseBathPlace() {
    settings = {
      ...settings,
      bathLocationName: selectedBathName(),
    };
    const name = selectedBathName();
    setBathStatus(
      name ? `Bruker ${name}.` : "Bruker nærmeste badeplass automatisk.",
      name ? "ok" : "",
    );
    save("Badeplassen er lagret");
  }

  async function requestJson(url, timeoutMs = 10_000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Forespørselen brukte for lang tid.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function locationName(place) {
    const address = place.address || {};
    const local =
      address.suburb ||
      address.city_district ||
      address.borough ||
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      place.name ||
      place.display_name?.split(",")[0] ||
      "Valgt sted";
    const region =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      "";
    return region &&
      local.localeCompare(region, "nb", { sensitivity: "base" }) !== 0
      ? `${local}, ${region}`
      : local;
  }

  async function applyPlace(result, message) {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error("Fant ikke gyldige koordinater.");
    }
    settings = {
      ...settings,
      placeName: result.name || settings.placeName || DEFAULT_SETTINGS.placeName,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      bathLocationId: "",
      bathLocationName: "",
    };
    bathPlaces = [];
    save("Stedet er lagret");
    setPositionStatus(message || `Bruker ${settings.placeName}.`, "ok");
    if (isBathAction) await loadBathPlaces(false);
  }

  async function findPlaceFromName(prefix = "") {
    const query = String(settings.placeName || "").trim();
    if (query.length < 2) throw new Error("Skriv inn et stedsnavn først.");

    isSearching = true;
    setPositionStatus(prefix ? `${prefix} Søker etter stedet…` : "Søker etter stedet…");
    try {
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        addressdetails: "1",
        limit: "1",
        "accept-language": "nb",
      });
      const results = await requestJson(
        `https://nominatim.openstreetmap.org/search?${params}`,
      );
      const result = results?.[0];
      if (!result) throw new Error(`Fant ikke «${query}».`);
      await applyPlace(
        { name: locationName(result), lat: result.lat, lon: result.lon },
        `Bruker ${locationName(result)}.`,
      );
    } finally {
      isSearching = false;
    }
  }

  async function reverseGeocode(lat, lon) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: "jsonv2",
      addressdetails: "1",
      zoom: "14",
      "accept-language": "nb",
    });
    const result = await requestJson(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
    );
    return locationName(result);
  }

  function readablePositionError(error) {
    if (error?.code === 1) return "GPS-tilgang ble nektet.";
    if (error?.code === 2) return "GPS-posisjon var utilgjengelig.";
    if (error?.code === 3) return "GPS brukte for lang tid.";
    return "GPS er ikke tilgjengelig i Stream Deck-panelet.";
  }

  async function useCurrentPosition() {
    if (!navigator.geolocation) {
      try {
        await findPlaceFromName("GPS støttes ikke her.");
      } catch (error) {
        setPositionStatus(error?.message || "GPS er ikke tilgjengelig.", "error");
      }
      return;
    }

    isLocating = true;
    setPositionStatus("Henter posisjon…");
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 60_000,
        });
      });
      const lat = Number(position.coords.latitude).toFixed(5);
      const lon = Number(position.coords.longitude).toFixed(5);
      const name = await reverseGeocode(lat, lon).catch(() => "Din posisjon");
      await applyPlace({ name, lat, lon }, `Posisjonen er satt til ${name}.`);
    } catch (error) {
      try {
        await findPlaceFromName(readablePositionError(error));
      } catch (fallbackError) {
        setPositionStatus(
          fallbackError?.message || error?.message || "Kunne ikke hente posisjon.",
          "error",
        );
      }
    } finally {
      isLocating = false;
    }
  }

  async function loadBathPlaces(shouldSave = true) {
    isLoadingBaths = true;
    setBathStatus("Henter badeplasser…");
    try {
      const params = new URLSearchParams({
        lat: String(settings.lat),
        lon: String(settings.lon),
      });
      const payload = await requestJson(
        `${String(settings.apiBase).replace(/\/+$/, "")}/api/weather.php?${params}`,
      );
      bathPlaces = Array.isArray(payload.bathing?.nearby)
        ? payload.bathing.nearby
        : [];

      if (!bathPlaces.length) {
        setBathStatus("Fant ingen ferske badeplasser nær dette stedet.", "error");
        return;
      }

      const currentStillExists = bathPlaces.some(
        (place) =>
          String(place.locationId || place.id) ===
          String(settings.bathLocationId),
      );
      if (settings.bathLocationId && !currentStillExists) {
        settings = {
          ...settings,
          bathLocationId: "",
          bathLocationName: "",
        };
      }
      if (shouldSave) save("Badeplassene er oppdatert");
      setBathStatus(`Fant ${bathPlaces.length} badeplasser nær stedet.`, "ok");
    } catch (error) {
      setBathStatus(
        error?.message || "Kunne ikke hente badeplasser.",
        "error",
      );
    } finally {
      isLoadingBaths = false;
    }
  }
</script>

<main class="inspector-shell">
  <header class="hero">
    <div class="hero-icon">
      <ActionIcon size={25} strokeWidth={2.35} />
    </div>
    <div class="hero-copy">
      <span>Værvakt · Stream Deck</span>
      <h1>{meta.title}</h1>
      <p>{meta.description}</p>
    </div>
    <span class:connected class="connection-dot" title={connected ? "Tilkoblet" : "Venter på Stream Deck"}></span>
  </header>

  <form on:submit={handleSubmit}>
    <section class="card">
      <div class="section-title">
        <MapPin size={17} />
        <div>
          <h2>Sted</h2>
          <p>Brukes av denne knappen</p>
        </div>
      </div>

      <label class="field">
        <span>Stedsnavn</span>
        <div class="input-with-icon">
          <MapPin size={15} />
          <input bind:value={settings.placeName} placeholder="Kristiansand" autocomplete="off" />
        </div>
      </label>

      <div class="coordinate-grid">
        <label class="field">
          <span>Breddegrad</span>
          <input bind:value={settings.lat} inputmode="decimal" aria-label="Breddegrad" />
        </label>
        <label class="field">
          <span>Lengdegrad</span>
          <input bind:value={settings.lon} inputmode="decimal" aria-label="Lengdegrad" />
        </label>
      </div>

      <div class="button-grid">
        <button class="secondary-button" type="button" on:click={useCurrentPosition} disabled={isLocating}>
          {#if isLocating}<RefreshCw class="spin" size={15} />{:else}<LocateFixed size={15} />{/if}
          {isLocating ? "Finner…" : "Bruk posisjon"}
        </button>
        <button
          class="secondary-button"
          type="button"
          on:click={() =>
            findPlaceFromName().catch((error) =>
              setPositionStatus(error?.message || "Kunne ikke finne stedet.", "error"),
            )}
          disabled={isSearching}
        >
          {#if isSearching}<RefreshCw class="spin" size={15} />{:else}<Search size={15} />{/if}
          {isSearching ? "Søker…" : "Finn sted"}
        </button>
      </div>

      {#if positionStatus.message}
        <div class:ok={positionStatus.tone === "ok"} class:error={positionStatus.tone === "error"} class="status">
          {#if positionStatus.tone === "ok"}<Check size={14} />{:else if positionStatus.tone === "error"}<AlertCircle size={14} />{/if}
          <span>{positionStatus.message}</span>
        </div>
      {/if}

      {#if mode !== "open"}
        <label class="field">
          <span><Clock3 size={13} /> Oppdateringsintervall</span>
          <select bind:value={settings.refreshMinutes}>
            <option value={5}>Hvert 5. minutt</option>
            <option value={10}>Hvert 10. minutt</option>
          </select>
        </label>
      {/if}
    </section>

    {#if isBathAction}
      <section class="card">
        <div class="section-title">
          <Waves size={17} />
          <div>
            <h2>Badetemperatur</h2>
            <p>Velg målepunkt eller bruk det nærmeste</p>
          </div>
        </div>

        <label class="field">
          <span>Badeplass</span>
          <select bind:value={settings.bathLocationId} on:change={chooseBathPlace}>
            <option value="">Nærmeste automatisk</option>
            {#each bathOptions as place}
              <option value={String(place.locationId || place.id)}>{placeLabel(place)}</option>
            {/each}
          </select>
        </label>

        <button class="secondary-button full-width" type="button" on:click={() => loadBathPlaces()} disabled={isLoadingBaths}>
          <RefreshCw class={isLoadingBaths ? "spin" : ""} size={15} />
          {isLoadingBaths ? "Henter…" : "Hent badeplasser nær stedet"}
        </button>

        {#if bathStatus.message}
          <div class:ok={bathStatus.tone === "ok"} class:error={bathStatus.tone === "error"} class="status">
            {#if bathStatus.tone === "ok"}<Check size={14} />{:else if bathStatus.tone === "error"}<AlertCircle size={14} />{/if}
            <span>{bathStatus.message}</span>
          </div>
        {/if}
      </section>
    {/if}

    {#if isReportAction}
      <section class="card">
        <div class="section-title">
          <Send size={17} />
          <div>
            <h2>Hurtigrapport</h2>
            <p>Sendes når du trykker på knappen</p>
          </div>
        </div>

        <label class="field">
          <span><UserRound size={13} /> Rapportørnavn</span>
          <input bind:value={settings.reporterName} placeholder="Stream Deck" />
        </label>

        <label class="field">
          <span>Værtype</span>
          <select bind:value={settings.reportCondition}>
            <option value="Sol / Klart">Sol / Klart</option>
            <option value="Delvis skyet">Delvis skyet</option>
            <option value="Skyet">Skyet</option>
            <option value="Regn">Regn</option>
            <option value="Snø">Snø</option>
            <option value="Torden">Torden</option>
          </select>
        </label>
      </section>
    {/if}

    <section class="card compact-card">
      <details>
        <summary>
          <span><Settings2 size={16} /> Avansert</span>
          <span class="summary-hint">API og trykk</span>
        </summary>
        <div class="advanced-content">
          <label class="field">
            <span>Værvakt API-base</span>
            <input bind:value={settings.apiBase} inputmode="url" spellcheck="false" />
          </label>

          {#if canOpenOnPress}
            <label class="toggle-row">
              <span>
                <strong>Åpne Værvakt ved trykk</strong>
                <small>Åpner riktig side uten å hente data på nytt</small>
              </span>
              <input bind:checked={settings.openOnPress} type="checkbox" />
            </label>
          {/if}
        </div>
      </details>
    </section>

    <div class="save-bar">
      <div class="save-message" aria-live="polite">
        {#if saveStatus}<Check size={14} /> {saveStatus}{/if}
      </div>
      <button class="primary-button" type="submit" disabled={!connected}>
        <Save size={16} />
        Lagre
      </button>
    </div>
  </form>
</main>
