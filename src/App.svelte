<script>
  import { onMount } from "svelte";
  import {
    CloudSun,
    Code2,
    HeartHandshake,
    LocateFixed,
    MapPin,
    Moon,
    RefreshCw,
    Search as SearchIcon,
    ShieldCheck,
    Sun,
    TriangleAlert,
    Waves,
  } from "@lucide/svelte";
  import Logo from "./assets/logo3.png";
  import { fetchWeatherData, reverseGeocode } from "./api/OpenWeatherService";
  import { ALL_DESCRIPTIONS } from "./utilities/DateConstants";
  import { getTodayForecastWeather, getWeekForecastWeather } from "./utilities/DataUtils";
  import { getLocalDatetime } from "./utilities/DatetimeUtils";
  import LocalFeatures from "./components/svelte/LocalFeatures.svelte";
  import PrivacyNotice from "./components/svelte/PrivacyNotice.svelte";
  import Search from "./components/svelte/Search.svelte";
  import TodayWeather from "./components/svelte/TodayWeather.svelte";
  import WeeklyForecast from "./components/svelte/WeeklyForecast.svelte";

  const APP_TABS = [
    { value: "weather", label: "Vær", path: "/" },
    { value: "local", label: "Lokalt", path: "/lokalt/" },
    { value: "bath", label: "Bad", path: "/bad/" },
  ];
  const VIPPS_URL = "https://betal.vipps.no/opy01u";
  const PULL_TRIGGER_DISTANCE = 74;
  const PULL_MAX_DISTANCE = 96;
  const TARGET_ACCURACY_METERS = 150;
  const MAX_ACCEPTABLE_ACCURACY_METERS = 3000;
  const POSITION_ACQUISITION_TIMEOUT_MS = 26000;
  const THEME_STORAGE_KEY = "vaervakt_theme";
  const DEFAULT_LOCATION = {
    name: "Kristiansand, NO",
    lat: 58.1467,
    lon: 7.9956,
    source: "default",
  };

  function isBathSeason(date = new Date()) {
    const month = date.getMonth();
    return month >= 4 && month <= 8;
  }

  function getTabFromPath(pathname = window.location.pathname) {
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return APP_TABS.find((tab) => tab.path === normalizedPath)?.value || "weather";
  }

  function isKnownTabPath(pathname = window.location.pathname) {
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return APP_TABS.some((tab) => tab.path === normalizedPath);
  }

  function getInitialTheme() {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
    } catch {
      // Bruk systemtema når lokal lagring er blokkert.
    }
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function persistTheme(nextTheme) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Temaet fungerer fortsatt i denne fanen når lokal lagring er blokkert.
    }
  }

  function requestBestPosition({
    timeout = POSITION_ACQUISITION_TIMEOUT_MS,
    targetAccuracy = TARGET_ACCURACY_METERS,
    maxAcceptableAccuracy = MAX_ACCEPTABLE_ACCURACY_METERS,
  } = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("unsupported"));
        return;
      }

      let bestPosition = null;
      let lastError = null;
      let watchId = null;
      let timerId = null;
      let settled = false;

      const finish = (error, position) => {
        if (settled) return;
        settled = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        if (timerId !== null) window.clearTimeout(timerId);
        if (error) reject(error);
        else resolve(position);
      };

      const acceptPosition = (position) => {
        const latitude = Number(position.coords?.latitude);
        const longitude = Number(position.coords?.longitude);
        const accuracy = Number(position.coords?.accuracy);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        if (
          !bestPosition ||
          (Number.isFinite(accuracy) &&
            accuracy < Number(bestPosition.coords?.accuracy ?? Infinity))
        ) {
          bestPosition = position;
        }

        if (Number.isFinite(accuracy) && accuracy <= targetAccuracy) {
          finish(null, position);
        }
      };

      const handleError = (error) => {
        lastError = error;
        if (error?.code === 1 || error?.message === "unsupported") finish(error);
      };

      watchId = navigator.geolocation.watchPosition(acceptPosition, handleError, {
        enableHighAccuracy: true,
        timeout,
        maximumAge: 0,
      });

      timerId = window.setTimeout(() => {
        const accuracy = Number(bestPosition?.coords?.accuracy);
        if (bestPosition && Number.isFinite(accuracy) && accuracy <= maxAcceptableAccuracy) {
          finish(null, bestPosition);
          return;
        }

        const error = new Error(bestPosition ? "inaccurate" : "timeout");
        error.accuracy = Number.isFinite(accuracy) ? accuracy : null;
        finish(lastError?.code === 1 ? lastError : error);
      }, timeout);
    });
  }

  function getPositionStatusMessage(error) {
    if (error?.message === "unsupported") return "Nettleseren støtter ikke posisjon.";
    if (error?.code === 1) return "Posisjon er avslått. Søk etter sted i stedet.";
    if (error?.code === 2) return "Fant ikke posisjonen akkurat nå. Prøv igjen eller søk.";
    if (error?.code === 3 || error?.message === "timeout") {
      return "Posisjon brukte for lang tid. Prøv igjen eller søk.";
    }
    if (error?.message === "inaccurate") {
      const accuracy = Number(error.accuracy);
      const accuracyText = Number.isFinite(accuracy)
        ? ` (omtrent ${formatAccuracy(accuracy)})`
        : "";
      if (Number.isFinite(accuracy) && accuracy >= 10000) {
        return `Nettleseren ga bare en grov posisjon${accuracyText}, så bydelen kan ikke bestemmes sikkert. Slå på «Presis posisjon» og prøv igjen, eller velg riktig bydel i søket.`;
      }
      return `Posisjonen ble for unøyaktig${accuracyText} til å bestemme bydelen sikkert. Slå på presis posisjon/GPS, eller velg bydel i søket.`;
    }
    return "Kunne ikke hente posisjon. Søk etter sted i stedet.";
  }

  function formatAccuracy(accuracy) {
    if (!Number.isFinite(Number(accuracy))) return "ukjent nøyaktighet";
    const meters = Number(accuracy);
    if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
    return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
  }

  let activeTab = getTabFromPath();
  let todayWeather = null;
  let todayForecast = [];
  let weekForecast = null;
  let isLoading = true;
  let isLocating = false;
  let hasError = false;
  let locationStatus = "";
  let needsManualPlaceSelection = false;
  let communityRefreshKey = 0;
  let selectedLocation = DEFAULT_LOCATION;
  let theme = getInitialTheme();
  let isPrivacyOpen = false;
  let localDatetime = getLocalDatetime();
  let pullDistance = 0;
  let isRefreshing = false;
  let touchStartY = 0;
  let isTrackingPull = false;
  let placeSearch;

  $: visibleTabs = APP_TABS.filter(
    (tab) => tab.value !== "bath" || isBathSeason() || activeTab === "bath"
  );
  $: pullProgress = Math.min(1, pullDistance / PULL_TRIGGER_DISTANCE);
  $: communityHint = isBathSeason() ? "lokale rapporter og badetemperatur" : "lokale rapporter";
  $: selectedLocationSource =
    selectedLocation.source === "gps"
      ? Number.isFinite(Number(selectedLocation.accuracy))
        ? `GPS · ± ${formatAccuracy(selectedLocation.accuracy)}`
        : "GPS"
      : selectedLocation.source === "search"
        ? "Søk"
        : "Standard";
  $: document.documentElement.dataset.theme = theme;

  async function searchChangeHandler(
    enteredData,
    showLoading = true,
    source = "search",
    accuracy = null
  ) {
    if (!enteredData?.value) return;
    if (source !== "gps") locationStatus = "";
    const [latitude, longitude] = enteredData.value.split(" ");
    const nextLocation = {
      name: enteredData.label,
      lat: Number(latitude),
      lon: Number(longitude),
      accuracy,
      source,
    };

    hasError = false;
    if (showLoading) isLoading = true;
    const now = Math.floor(Date.now() / 1000);

    try {
      const [todayResponse, weekResponse] = await fetchWeatherData(latitude, longitude);
      todayForecast = getTodayForecastWeather(weekResponse, now);
      todayWeather = { city: enteredData.label, ...todayResponse };
      selectedLocation = nextLocation;
      weekForecast = {
        city: enteredData.label,
        list: getWeekForecastWeather(weekResponse, ALL_DESCRIPTIONS),
      };
      needsManualPlaceSelection = false;
    } catch {
      hasError = true;
    } finally {
      isLoading = false;
    }
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    persistTheme(theme);
  }

  function focusPlaceSearch() {
    placeSearch?.focus?.();
  }

  function changeTab(tabValue) {
    const tab = APP_TABS.find((item) => item.value === tabValue);
    if (!tab) return;
    window.navigator.vibrate?.(8);
    activeTab = tab.value;
    if (window.location.pathname !== tab.path) {
      window.history.pushState({ tab: tab.value }, "", tab.path);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function usePositionHandler() {
    if (isLocating) return;
    if (!navigator.geolocation) {
      locationStatus = "Nettleseren støtter ikke posisjon.";
      return;
    }
    if (!window.isSecureContext) {
      locationStatus = "Posisjon krever HTTPS. Søk etter sted i stedet.";
      return;
    }

    isLocating = true;
    locationStatus = "";
    needsManualPlaceSelection = false;
    try {
      const position = await requestBestPosition();
      const latitude = position.coords.latitude.toFixed(7);
      const longitude = position.coords.longitude.toFixed(7);
      const accuracy = Number(position.coords.accuracy);
      const label = await reverseGeocode(latitude, longitude).catch(() => "Din posisjon");
      await searchChangeHandler(
        { value: `${latitude} ${longitude}`, label },
        true,
        "gps",
        accuracy
      );
      locationStatus = `Bruker ${label} · nøyaktighet ca. ${formatAccuracy(accuracy)}. Posisjonen lagres ikke.`;
    } catch (error) {
      locationStatus = getPositionStatusMessage(error);
      needsManualPlaceSelection = error?.message === "inaccurate";
    } finally {
      isLocating = false;
    }
  }

  async function refreshActiveTab() {
    if (isLoading) return;
    if (selectedLocation?.lat && selectedLocation?.lon) {
      await searchChangeHandler(
        {
          value: `${selectedLocation.lat} ${selectedLocation.lon}`,
          label: selectedLocation.name,
        },
        true,
        selectedLocation.source || "refresh",
        selectedLocation.accuracy || null
      );
    }
    communityRefreshKey += 1;
  }

  onMount(() => {
    if (!isKnownTabPath()) {
      window.history.replaceState({ tab: "weather" }, "", "/");
      activeTab = "weather";
    }
    searchChangeHandler(
      {
        value: `${selectedLocation.lat} ${selectedLocation.lon}`,
        label: selectedLocation.name,
      },
      false,
      selectedLocation.source || "default",
      selectedLocation.accuracy || null
    );

    const dateTimer = window.setInterval(() => (localDatetime = getLocalDatetime()), 30000);
    const handlePopState = () => (activeTab = getTabFromPath());
    const handleTouchStart = (event) => {
      if (isLocating || isRefreshing || window.scrollY > 2 || event.touches.length !== 1) return;
      touchStartY = event.touches[0].clientY;
      isTrackingPull = true;
    };
    const handleTouchMove = (event) => {
      if (!isTrackingPull || event.touches.length !== 1) return;
      const dragDistance = event.touches[0].clientY - touchStartY;
      if (dragDistance <= 0 || window.scrollY > 2) {
        pullDistance = 0;
        return;
      }
      pullDistance = Math.min(PULL_MAX_DISTANCE, dragDistance * 0.56);
      if (event.cancelable && pullDistance > 8) event.preventDefault();
    };
    const handleTouchEnd = async () => {
      if (!isTrackingPull) return;
      isTrackingPull = false;
      if (pullDistance < PULL_TRIGGER_DISTANCE) {
        pullDistance = 0;
        return;
      }
      pullDistance = PULL_TRIGGER_DISTANCE;
      isRefreshing = true;
      try {
        window.navigator.vibrate?.(8);
        await refreshActiveTab();
      } finally {
        isRefreshing = false;
        pullDistance = 0;
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.clearInterval(dateTimer);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  });
</script>

<svelte:head>
  <meta property="og:title" content="Værvakt.no" />
  <meta
    property="og:description"
    content="Lokalt vær, værrapporter og badetemperatur."
  />
</svelte:head>

<div
  class="pull-indicator"
  class:visible={isRefreshing || pullDistance > 6}
  style={`--pull-offset: ${isRefreshing ? 0 : Math.max(-18, pullDistance - 56)}px; --pull-progress: ${pullProgress * 260}deg`}
  aria-hidden="true"
>
  <span class:spin={isRefreshing}></span>
  {isRefreshing ? "Oppdaterer…" : pullProgress >= 1 ? "Slipp for å oppdatere" : "Dra for å oppdatere"}
</div>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Værvakt.no">
      <img src={Logo} alt="Værvakt.no" />
    </a>
    <div class="topbar-actions">
      <a class="support-mini" href={VIPPS_URL} target="_blank" rel="noopener noreferrer">
        <HeartHandshake size={15} /> Støtt
      </a>
      <button
        class="theme-button"
        type="button"
        on:click={toggleTheme}
        aria-label={theme === "dark" ? "Bytt til lyst tema" : "Bytt til mørkt tema"}
        title={theme === "dark" ? "Lyst tema" : "Mørkt tema"}
      >
        {#if theme === "dark"}<Sun size={17} />{:else}<Moon size={17} />{/if}
      </button>
      <button class="location-button" type="button" on:click={usePositionHandler} disabled={isLocating}>
        <LocateFixed size={16} class={isLocating ? "locating" : ""} />
        <span>{isLocating ? "Finner…" : "Bruk posisjon"}</span>
      </button>
      <time class="current-time">{localDatetime}</time>
      <a
        class="github-link"
        href="https://github.com/LordM8YT/Vaervakt-svelte"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Værvakt på GitHub"
      >
        <Code2 size={22} />
      </a>
    </div>
  </header>

  <Search bind:this={placeSearch} onSelect={searchChangeHandler} />

  <div class="selected-location" aria-live="polite">
    <div class="selected-location-copy">
      <MapPin size={17} aria-hidden="true" />
      <span>Valgt sted</span>
      <strong title={selectedLocation.name}>{selectedLocation.name}</strong>
    </div>
    <span class="selected-location-source">{selectedLocationSource}</span>
  </div>

  {#if locationStatus}
    <div class="location-status" role="status">
      <TriangleAlert size={17} />
      <span>{locationStatus}</span>
      {#if needsManualPlaceSelection}
        <button class="manual-place-button" type="button" on:click={focusPlaceSearch}>
          <SearchIcon size={14} aria-hidden="true" />
          Velg bydel
        </button>
      {/if}
    </div>
  {/if}

  <main>
    {#if isLoading}
      <div class="loading-state">
        <RefreshCw class="spin" size={34} />
        <strong>Laster værdata…</strong>
      </div>
    {:else if hasError}
      <div class="error-state">
        <TriangleAlert size={28} />
        <div>
          <strong>Noe gikk galt</strong>
          <span>Værdataene kunne ikke hentes. Prøv igjen.</span>
        </div>
        <button class="secondary-button" type="button" on:click={refreshActiveTab}>Prøv igjen</button>
      </div>
    {:else if todayWeather && weekForecast}
      {#if activeTab === "weather"}
        <div class="forecast-layout">
          <TodayWeather data={todayWeather} forecastList={todayForecast} />
          <WeeklyForecast data={weekForecast} />
        </div>
        <div class="tab-hint">Bytt fane nederst for {communityHint}.</div>
      {:else}
        <LocalFeatures
          {selectedLocation}
          weather={todayWeather}
          {activeTab}
          refreshKey={communityRefreshKey}
          onOpenPrivacy={() => (isPrivacyOpen = true)}
        />
      {/if}
    {:else}
      <div class="loading-state">
        <CloudSun size={58} />
        <strong>Søk etter et sted for å se været.</strong>
      </div>
    {/if}
  </main>

  <footer class="privacy-footer">
    <div class="privacy-footer-main">
      <button type="button" on:click={() => (isPrivacyOpen = true)}>
        <ShieldCheck size={16} />
        Personvern
      </button>
      <span>Ingen annonser eller individuell besøksmåling.</span>
    </div>
    <span class="credits">Credits · Backend utviklet av Greve</span>
  </footer>

  <nav
    class="bottom-nav"
    style={`--tab-count: ${visibleTabs.length}`}
    aria-label="Hovedmeny"
  >
    {#each visibleTabs as tab}
      <button
        type="button"
        class:active={activeTab === tab.value}
        aria-pressed={activeTab === tab.value}
        on:click={() => changeTab(tab.value)}
      >
        {#if tab.value === "weather"}
          <CloudSun size={18} />
        {:else if tab.value === "local"}
          <MapPin size={18} />
        {:else if tab.value === "bath"}
          <Waves size={18} />
        {/if}
        <span>{tab.label}</span>
      </button>
    {/each}
  </nav>
</div>

{#if isPrivacyOpen}
  <PrivacyNotice onClose={() => (isPrivacyOpen = false)} />
{/if}
