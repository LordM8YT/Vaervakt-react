<script>
  import { onMount, onDestroy } from "svelte";
  import {
    ChevronRight,
    Code2,
    HeartHandshake,
    MapPin,
    Moon,
    Search as SearchIcon,
    ShieldCheck,
    Sun,
    TriangleAlert,
    WifiOff,
  } from "@lucide/svelte";
  import Logo from "./assets/logo3.png";
  import { fetchWeatherData, reverseGeocode } from "./api/OpenWeatherService";
  import { ALL_DESCRIPTIONS } from "./utilities/DateConstants";
  import { getTodayForecastWeather, getWeekForecastWeather } from "./utilities/DataUtils";
  import { getLocalDatetime } from "./utilities/DatetimeUtils";
  import { createCachedLocation } from "./utilities/LocationCache";
  import AppToast from "./components/svelte/AppToast.svelte";
  import BottomNav from "./components/svelte/BottomNav.svelte";
  import ForecastSkeleton from "./components/svelte/ForecastSkeleton.svelte";
  import LocalFeatures from "./components/svelte/LocalFeatures.svelte";
  import LocationPanel from "./components/svelte/LocationPanel.svelte";
  import PrivacyNotice from "./components/svelte/PrivacyNotice.svelte";
  import Search from "./components/svelte/Search.svelte";
  import StartExperience from "./components/svelte/StartExperience.svelte";
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
  const TARGET_ACCURACY_METERS = 25;
  const MAX_ACCEPTABLE_ACCURACY_METERS = 3000;
  const POSITION_ACQUISITION_TIMEOUT_MS = 12000;
  const POSITION_TOAST_DURATION_MS = 5000;
  const THEME_STORAGE_KEY = "vaervakt_theme";
  const SELECTED_LOCATION_KEY = "vaervakt_selected_location";
  const BATH_POI_CACHE_KEY = "vaervakt_bath_poi_cache_v1";

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

  function loadSelectedLocation() {
    try {
      const raw = window.localStorage.getItem(SELECTED_LOCATION_KEY);
      if (!raw) return null;
      const cachedLocation = createCachedLocation(JSON.parse(raw), true);
      if (!cachedLocation) {
        window.localStorage.removeItem(SELECTED_LOCATION_KEY);
        return null;
      }
      // Også eldre cacheverdier blir straks skrevet tilbake i minimert format.
      window.localStorage.setItem(
        SELECTED_LOCATION_KEY,
        JSON.stringify(cachedLocation)
      );
      return { ...cachedLocation, cached: true };
    } catch {
      return null;
    }
  }

  function persistSelectedLocation(location) {
    try {
      if (!location) {
        window.localStorage.removeItem(SELECTED_LOCATION_KEY);
        return;
      }
      const cachedLocation = createCachedLocation(location);
      if (!cachedLocation) return;
      window.localStorage.setItem(
        SELECTED_LOCATION_KEY,
        JSON.stringify(cachedLocation)
      );
    } catch {
      // Stedsvalget fungerer fortsatt i denne fanen når lokal lagring er blokkert.
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

  function formatLocationAge(timestamp) {
    const storedAt = Number(timestamp);
    if (!Number.isFinite(storedAt) || storedAt <= 0) return "";
    const ageMinutes = Math.max(0, Math.floor((Date.now() - storedAt) / 60000));
    if (ageMinutes < 1) return "lagret akkurat nå";
    if (ageMinutes < 60) return `lagret for ${ageMinutes} min siden`;
    const ageHours = Math.floor(ageMinutes / 60);
    if (ageHours < 24) return `lagret for ${ageHours} t siden`;
    return `lagret ${new Intl.DateTimeFormat("nb-NO", {
      day: "numeric",
      month: "short",
    }).format(new Date(storedAt))}`;
  }

  function showToast(message, type = "info", duration = 3500) {
    if (!message) return;
    toastMessage = message;
    toastType = type;
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastMessage = "";
      toastTimer = null;
    }, duration);
  }

  onDestroy(() => {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
  });

  let activeTab = getTabFromPath();
  let todayWeather = null;
  let todayForecast = [];
  let weekForecast = null;
  let isLoading = false;
  let isLocating = false;
  let hasError = false;
  let locationStatus = "";
  let needsManualPlaceSelection = false;
  let toastMessage = "";
  let toastType = "info";
  let toastTimer = null;
  let communityRefreshKey = 0;
  let selectedLocation = null;
  let theme = getInitialTheme();
  let isPrivacyOpen = false;
  let isLocationPanelOpen = false;
  let localDatetime = getLocalDatetime();
  let pullDistance = 0;
  let isRefreshing = false;
  let touchStartY = 0;
  let isTrackingPull = false;
  let locationLoadSequence = 0;
  let placeSearch;

  $: visibleTabs = APP_TABS.filter(
    (tab) => tab.value !== "bath" || isBathSeason() || activeTab === "bath"
  );
  $: pullProgress = Math.min(1, pullDistance / PULL_TRIGGER_DISTANCE);
  $: communityHint = isBathSeason() ? "lokale rapporter og badetemperatur" : "lokale rapporter";
  $: selectedLocationSource =
    selectedLocation?.source === "gps"
      ? Number.isFinite(Number(selectedLocation.accuracy))
        ? `${selectedLocation.cached ? "Lagret GPS" : "GPS"} · ± ${formatAccuracy(selectedLocation.accuracy)}`
        : selectedLocation.cached
          ? "Lagret GPS"
          : "GPS"
      : selectedLocation?.source === "search"
        ? selectedLocation.cached
          ? "Lagret søk"
          : "Søk"
        : "";
  $: selectedLocationAge = formatLocationAge(selectedLocation?.cachedAt);
  $: isLocationMismatch =
    Boolean(todayWeather?.city) &&
    Boolean(selectedLocation?.name) &&
    todayWeather.city !== selectedLocation.name;
  $: shouldShowSkeleton = isLoading && (!todayWeather || isLocationMismatch);
  $: document.documentElement.dataset.theme = theme;

  async function searchChangeHandler(
    enteredData,
    showLoading = true,
    source = "search",
    accuracy = null,
    cached = false
  ) {
    if (!enteredData?.value) return false;
    const loadId = ++locationLoadSequence;
    if (source !== "gps") locationStatus = "";
    const [latitude, longitude] = enteredData.value.split(" ");
    const nextLocation = {
      name: enteredData.label,
      lat: Number(latitude),
      lon: Number(longitude),
      accuracy,
      source,
      cached,
      cachedAt: Date.now(),
    };

    selectedLocation = nextLocation;
    persistSelectedLocation(nextLocation);
    hasError = false;
    if (showLoading) isLoading = true;
    const now = Math.floor(Date.now() / 1000);

    try {
      const [todayResponse, weekResponse] = await fetchWeatherData(latitude, longitude);
      if (loadId !== locationLoadSequence) return false;
      todayForecast = getTodayForecastWeather(weekResponse, now);
      todayWeather = { city: enteredData.label, ...todayResponse };
      weekForecast = {
        city: enteredData.label,
        list: getWeekForecastWeather(weekResponse, ALL_DESCRIPTIONS),
      };
      needsManualPlaceSelection = false;
    } catch {
      if (loadId === locationLoadSequence) hasError = true;
    } finally {
      if (loadId === locationLoadSequence) isLoading = false;
    }
    return loadId === locationLoadSequence;
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    persistTheme(theme);
  }

  function focusPlaceSearch() {
    placeSearch?.focus?.();
  }

  function searchFromLocationPanel() {
    isLocationPanelOpen = false;
    window.setTimeout(() => focusPlaceSearch(), 180);
  }

  async function locateFromLocationPanel() {
    isLocationPanelOpen = false;
    await usePositionHandler();
  }

  function forgetSelectedLocation() {
    locationLoadSequence += 1;
    persistSelectedLocation(null);
    try {
      window.localStorage.removeItem(BATH_POI_CACHE_KEY);
    } catch {
      // Stedet fjernes fortsatt fra denne fanen.
    }
    selectedLocation = null;
    todayWeather = null;
    todayForecast = [];
    weekForecast = null;
    hasError = false;
    locationStatus = "";
    needsManualPlaceSelection = false;
    communityRefreshKey += 1;
    isLocationPanelOpen = false;
    placeSearch?.clear?.();
    if (window.location.pathname !== "/") {
      window.history.pushState({ tab: "weather" }, "", "/");
    }
    activeTab = "weather";
    showToast("Det lagrede stedet er fjernet.", "info");
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
    const locationSequenceAtStart = locationLoadSequence;
    locationStatus = "";
    needsManualPlaceSelection = false;
    try {
      const position = await requestBestPosition();
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy);
      const label = await reverseGeocode(latitude, longitude).catch(() => "Din posisjon");
      if (locationLoadSequence !== locationSequenceAtStart) return;
      const isCurrentLocation = await searchChangeHandler(
        { value: `${latitude} ${longitude}`, label },
        true,
        "gps",
        accuracy
      );
      if (!isCurrentLocation) return;
      locationStatus = "";
      showToast(
        `Bruker ${label} · GPS ± ${formatAccuracy(accuracy)}.`,
        "success",
        POSITION_TOAST_DURATION_MS
      );
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
        selectedLocation.accuracy || null,
        Boolean(selectedLocation.cached)
      );
    }
    communityRefreshKey += 1;
  }

  onMount(() => {
    if (!isKnownTabPath()) {
      window.history.replaceState({ tab: "weather" }, "", "/");
      activeTab = "weather";
    }

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

    const storedLocation = loadSelectedLocation();
    if (storedLocation) {
      searchChangeHandler(
        {
          value: `${storedLocation.lat} ${storedLocation.lon}`,
          label: storedLocation.name,
        },
        true,
        storedLocation.source || "refresh",
        storedLocation.accuracy || null,
        true
      );
    }

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
      <button
        class="location-button"
        type="button"
        on:click={() => (isLocationPanelOpen = true)}
        aria-haspopup="dialog"
        aria-label={selectedLocation ? `Administrer sted: ${selectedLocation.name}` : "Velg sted"}
      >
        <MapPin size={16} />
        <span>{selectedLocation ? "Bytt sted" : "Velg sted"}</span>
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

  {#if selectedLocation}
    <button
      class="selected-location"
      type="button"
      on:click={() => (isLocationPanelOpen = true)}
      aria-haspopup="dialog"
      aria-label={`Administrer valgt sted: ${selectedLocation.name}`}
    >
      <div class="selected-location-copy">
        <MapPin size={17} aria-hidden="true" />
        <div>
          <span>Valgt sted</span>
          <strong title={selectedLocation.name}>{selectedLocation.name}</strong>
        </div>
      </div>
      <div class="selected-location-action">
        <span class="selected-location-source">{selectedLocationSource}</span>
        <ChevronRight size={17} aria-hidden="true" />
      </div>
    </button>
  {/if}

  <AppToast message={toastMessage} type={toastType} />

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

  {#if hasError && todayWeather && !isLocationMismatch}
    <div class="refresh-warning" role="status">
      <WifiOff size={17} aria-hidden="true" />
      <span>Kunne ikke oppdatere akkurat nå. Du ser sist hentede værdata.</span>
      <button class="text-button" type="button" on:click={refreshActiveTab}>Prøv igjen</button>
    </div>
  {/if}

  <main>
    {#if shouldShowSkeleton}
      <ForecastSkeleton />
    {:else if hasError && (!todayWeather || isLocationMismatch)}
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
      <StartExperience
        onUsePosition={usePositionHandler}
        onSearch={focusPlaceSearch}
        {isLocating}
      />
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

  <BottomNav tabs={visibleTabs} {activeTab} onSelect={changeTab} />
</div>

{#if isLocationPanelOpen}
  <LocationPanel
    location={selectedLocation}
    sourceLabel={selectedLocationSource}
    ageLabel={selectedLocationAge}
    {isLocating}
    onClose={() => (isLocationPanelOpen = false)}
    onUsePosition={locateFromLocationPanel}
    onSearch={searchFromLocationPanel}
    onForget={forgetSelectedLocation}
  />
{/if}

{#if isPrivacyOpen}
  <PrivacyNotice onClose={() => (isPrivacyOpen = false)} />
{/if}
