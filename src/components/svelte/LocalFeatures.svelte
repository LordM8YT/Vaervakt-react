<script>
  import { onMount } from "svelte";
  import {
    CheckCircle2,
    Flag,
    LoaderCircle,
    MapPin,
    RefreshCw,
    Send,
    Thermometer,
    Waves,
    X,
  } from "@lucide/svelte";
  import {
    fetchBathTemperatures,
    fetchReports,
    flagReport,
    submitBathTemperature,
    submitReport,
  } from "../../api/VaervaktApi";
  import WeatherIcon from "./WeatherIcon.svelte";

  export let selectedLocation;
  export let weather;
  export let activeTab = "local";
  export let refreshKey = 0;
  export let onOpenPrivacy = () => {};

  const VIPPS_URL = "https://betal.vipps.no/opy01u";
  const BATH_POI_CACHE_KEY = "vaervakt_bath_poi_cache_v1";
  const BATH_POI_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  const BATH_POI_CACHE_MAX_LOCATIONS = 8;
  const REPORT_RANGE_OPTIONS = [
    { hours: 6, label: "6 timer" },
    { hours: 24, label: "24 timer" },
    { hours: 168, label: "7 dager" },
  ];
  const CONDITIONS = [
    { value: "Sol / Klart", label: "Sol", kind: "sun" },
    { value: "Delvis skyet", label: "Delvis skyet", kind: "partly-cloudy" },
    { value: "Skyet", label: "Skyet", kind: "cloudy" },
    { value: "Regn", label: "Regn", kind: "rain" },
    { value: "Snø", label: "Snø", kind: "snow" },
    { value: "Torden", label: "Torden", kind: "thunder" },
  ];
  const REPORT_FLAG_REASONS = [
    { value: "inaccurate", label: "Feil værdata" },
    { value: "spam", label: "Spam eller reklame" },
    { value: "abusive", label: "Upassende innhold" },
    { value: "privacy", label: "Personopplysninger" },
    { value: "other", label: "Annet" },
  ];

  function getBathPoiCacheLocationKey(lat, lon) {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
    return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  }

  function sanitizeBathPoi(item) {
    if (!item || typeof item !== "object") return null;
    const name = String(item.name || "").trim().slice(0, 160);
    const temperature =
      item.temperature === null ||
      item.temperature === undefined ||
      item.temperature === ""
        ? null
        : Number(item.temperature);
    const distanceKm =
      item.distanceKm === null ||
      item.distanceKm === undefined ||
      item.distanceKm === ""
        ? null
        : Number(item.distanceKm);
    if (!name || !Number.isFinite(temperature)) return null;

    return {
      name,
      municipality: String(item.municipality || "").trim().slice(0, 120),
      temperature,
      distanceKm: distanceKm !== null && Number.isFinite(distanceKm) ? distanceKm : null,
      time: String(item.time || "").trim().slice(0, 40),
      heatedWater: Boolean(item.heatedWater),
    };
  }

  function readBathPoiCache(lat, lon) {
    const locationKey = getBathPoiCacheLocationKey(lat, lon);
    if (!locationKey) return [];

    try {
      const cache = JSON.parse(window.localStorage.getItem(BATH_POI_CACHE_KEY) || "{}");
      const now = Date.now();
      Object.entries(cache).forEach(([key, value]) => {
        const cachedAt = Number(value?.storedAt);
        const cachedAge = now - cachedAt;
        if (
          !Number.isFinite(cachedAt) ||
          cachedAge < 0 ||
          cachedAge > BATH_POI_CACHE_MAX_AGE_MS ||
          !Array.isArray(value?.items)
        ) {
          delete cache[key];
        }
      });
      if (Object.keys(cache).length > 0) {
        window.localStorage.setItem(BATH_POI_CACHE_KEY, JSON.stringify(cache));
      } else {
        window.localStorage.removeItem(BATH_POI_CACHE_KEY);
      }
      const entry = cache[locationKey];
      if (!entry) return [];
      return Array.isArray(entry.items)
        ? entry.items.map(sanitizeBathPoi).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  function writeBathPoiCache(lat, lon, items) {
    const locationKey = getBathPoiCacheLocationKey(lat, lon);
    if (!locationKey || !Array.isArray(items)) return;

    try {
      const sanitizedItems = items.map(sanitizeBathPoi).filter(Boolean);
      const cache = JSON.parse(window.localStorage.getItem(BATH_POI_CACHE_KEY) || "{}");
      cache[locationKey] = { storedAt: Date.now(), items: sanitizedItems };
      const newestEntries = Object.entries(cache)
        .filter(([, entry]) => Array.isArray(entry?.items))
        .sort(([, first], [, second]) => Number(second.storedAt) - Number(first.storedAt))
        .slice(0, BATH_POI_CACHE_MAX_LOCATIONS);
      window.localStorage.setItem(
        BATH_POI_CACHE_KEY,
        JSON.stringify(Object.fromEntries(newestEntries))
      );
    } catch {
      // POI-ene hentes fortsatt fra nettet når lokal lagring er blokkert.
    }
  }

  function normalizeTemp(value) {
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getWeatherSummary(value) {
    return value?.weather?.[0]?.description || "";
  }

  function getWeatherTemp(value) {
    const temp = value?.main?.temp;
    return Number.isFinite(temp) ? Math.round(temp) : "";
  }

  function conditionKind(condition = "") {
    const normalized = condition.toLowerCase();
    if (normalized.includes("torden") || normalized.includes("lyn")) return "thunder";
    if (normalized.includes("snø") || normalized.includes("sludd")) return "snow";
    if (normalized.includes("regn") || normalized.includes("byge")) return "rain";
    if (normalized.includes("delvis") || normalized.includes("lettskyet")) {
      return "partly-cloudy";
    }
    if (normalized.includes("sky")) return "cloudy";
    if (normalized.includes("klart") || normalized.includes("sol")) return "sun";
    return "partly-cloudy";
  }

  function getReportConditionFromWeather(value) {
    const kind = conditionKind(getWeatherSummary(value));
    return CONDITIONS.find((condition) => condition.kind === kind)?.value || "";
  }

  function formatTemperature(value) {
    const temperature = Number(value);
    if (!Number.isFinite(temperature)) return "–";
    return temperature.toFixed(temperature % 1 === 0 ? 0 : 1).replace(".", ",");
  }

  function formatDistance(value) {
    if (value === null || value === undefined || value === "") return "";
    const distance = Number(value);
    if (!Number.isFinite(distance)) return "";
    if (distance < 1) return `${Math.max(1, Math.round(distance * 1000))} m unna`;
    return `${distance.toFixed(1).replace(".", ",")} km unna`;
  }

  function formatBathTime(value) {
    if (!value) return "Nylig registrert";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "Nylig registrert";
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  let reports = [];
  let flaggingReportId = null;
  let flaggedReportIds = [];
  let isLoading = false;
  let notice = null;
  let reportForm = {
    username: "",
    temperature: "",
    condition: "",
  };
  let reportRangeHours = 24;
  let reportMeta = { total: 0, displayed: 0 };
  let bathForm = { name: "", temperature: "", heatedWater: false };
  let bathTemperatures = [];
  let isBathLoading = false;
  let isBathSubmitting = false;
  let mounted = false;
  let previousRefreshSignature = "";
  let previousForecastSignature = "";
  let loadSequence = 0;

  $: location = {
    name: selectedLocation?.name || "Valgt sted",
    lat: selectedLocation?.lat,
    lon: selectedLocation?.lon,
    source: selectedLocation?.source || "none",
  };
  $: latNumber = Number(location.lat);
  $: lonNumber = Number(location.lon);
  $: hasCoordinates = Number.isFinite(latNumber) && Number.isFinite(lonNumber);
  $: refreshSignature = [
    location.name,
    location.lat,
    location.lon,
    refreshKey,
    activeTab,
    reportRangeHours,
  ].join("|");
  $: if (mounted && refreshSignature !== previousRefreshSignature) {
    previousRefreshSignature = refreshSignature;
    refreshLocalData();
  }
  $: forecastSignature = [
    location.source,
    location.lat,
    location.lon,
    getWeatherTemp(weather),
    getWeatherSummary(weather),
  ].join("|");
  $: if (
    mounted &&
    location.source === "gps" &&
    forecastSignature !== previousForecastSignature
  ) {
    previousForecastSignature = forecastSignature;
    const forecastTemperature = getWeatherTemp(weather);
    const forecastCondition = getReportConditionFromWeather(weather);
    reportForm = {
      ...reportForm,
      temperature:
        reportForm.temperature === "" && forecastTemperature !== ""
          ? String(forecastTemperature)
          : reportForm.temperature,
      condition:
        reportForm.condition === "" && forecastCondition
          ? forecastCondition
          : reportForm.condition,
    };
  }

  onMount(() => {
    mounted = true;
  });

  async function refreshLocalData() {
    const loadId = ++loadSequence;
    const cachedBathItems =
      activeTab === "bath" && hasCoordinates
        ? readBathPoiCache(location.lat, location.lon)
        : [];
    isLoading = activeTab === "local";
    isBathLoading =
      activeTab === "bath" && hasCoordinates && cachedBathItems.length === 0;
    if (activeTab === "bath" && cachedBathItems.length > 0) {
      bathTemperatures = cachedBathItems;
    }

    const reportRequest =
      activeTab === "local"
        ? fetchReports(location, { maxAgeHours: reportRangeHours })
        : Promise.resolve({ reports: [], total: 0, displayed: 0 });
    const bathRequest =
      activeTab === "bath" && hasCoordinates
        ? fetchBathTemperatures(location)
        : Promise.resolve({ bathing: { nearby: [] } });
    const [reportResult, bathResult] = await Promise.allSettled([
      reportRequest,
      bathRequest,
    ]);
    if (loadId !== loadSequence) return;

    if (reportResult.status === "fulfilled") {
      reports = reportResult.value.reports || [];
      const total = Number(reportResult.value.total);
      const displayed = Number(reportResult.value.displayed);
      reportMeta = {
        total: Number.isFinite(total) ? total : reports.length,
        displayed: Number.isFinite(displayed) ? displayed : reports.length,
      };
    }

    if (bathResult.status === "fulfilled") {
      bathTemperatures = bathResult.value?.bathing?.nearby || [];
      if (activeTab === "bath" && hasCoordinates) {
        writeBathPoiCache(location.lat, location.lon, bathTemperatures);
      }
    } else if (activeTab === "bath") {
      bathTemperatures = cachedBathItems;
    }

    const requestedResult = activeTab === "bath" ? bathResult : reportResult;
    if (requestedResult.status === "rejected") {
      notice = {
        severity: "warning",
        text:
          activeTab === "bath"
            ? cachedBathItems.length > 0
              ? "Kunne ikke oppdatere nå. Viser lagrede badeplasser fra de siste 12 timene."
              : "Badetemperaturene kunne ikke lastes akkurat nå."
            : "Lokale rapporter kunne ikke lastes akkurat nå.",
      };
    } else if (notice?.severity === "warning") {
      notice = null;
    }

    isLoading = false;
    isBathLoading = false;
  }

  function fillReportFromForecast() {
    const temperature = getWeatherTemp(weather);
    const condition = getReportConditionFromWeather(weather);
    if (temperature === "" || !condition) {
      notice = { severity: "info", text: "Fant ikke nok værdata til å fylle ut rapporten." };
      return;
    }
    reportForm = { ...reportForm, temperature: String(temperature), condition };
  }

  async function handleReportSubmit() {
    const temperature = normalizeTemp(reportForm.temperature);
    if (temperature === null || !reportForm.condition) {
      notice = { severity: "info", text: "Skriv temperatur og værtype før du sender." };
      return;
    }
    if (temperature < -60 || temperature > 60) {
      notice = { severity: "info", text: "Temperaturen må være mellom -60 og 60 grader." };
      return;
    }
    if (!hasCoordinates) {
      notice = { severity: "info", text: "Søk opp stedet eller bruk posisjonen din først." };
      return;
    }

    try {
      window.navigator.vibrate?.(12);
      await submitReport({
        username: reportForm.username.trim() || "Anonym",
        temperature,
        condition: reportForm.condition,
        location: location.name,
        lat: location.lat,
        lon: location.lon,
      });
      reportForm = { username: "", temperature: "", condition: "" };
      notice = { severity: "success", text: "Rapporten er sendt. Takk!" };
      await refreshLocalData();
    } catch (error) {
      notice = { severity: "error", text: error.message };
    }
  }

  async function handleFlagReport(reportId, reason) {
    if (flaggedReportIds.includes(reportId)) return;

    try {
      flaggingReportId = reportId;
      const result = await flagReport(reportId, reason);
      flaggedReportIds = [...flaggedReportIds, reportId];
      notice = {
        severity: "success",
        text: result.message || "Takk. Rapporten er sendt til vurdering.",
      };
      if (result.hidden) {
        reports = reports.filter((report) => report.id !== reportId);
        reportMeta = {
          ...reportMeta,
          total: Math.max(0, reportMeta.total - 1),
          displayed: Math.max(0, reportMeta.displayed - 1),
        };
      }
    } catch (error) {
      notice = { severity: "error", text: error.message };
    } finally {
      flaggingReportId = null;
    }
  }

  async function handleBathSubmit() {
    const temperature = normalizeTemp(bathForm.temperature);
    const name = bathForm.name.trim();
    if (!name || temperature === null) {
      notice = { severity: "info", text: "Skriv badeplass og badetemperatur før du sender." };
      return;
    }
    if (!hasCoordinates) {
      notice = {
        severity: "info",
        text: "Velg posisjon eller søk opp badeplassen først, så Yr får riktige koordinater.",
      };
      return;
    }

    try {
      isBathSubmitting = true;
      window.navigator.vibrate?.(10);
      const result = await submitBathTemperature({
        name,
        temperature,
        lat: latNumber,
        lon: lonNumber,
        heatedWater: bathForm.heatedWater,
      });
      bathForm = { name: "", temperature: "", heatedWater: false };
      notice = {
        severity: "success",
        text: result.message || "Badetemperaturen er sendt til Yr.",
      };
      await refreshLocalData();
    } catch (error) {
      notice = { severity: "error", text: error.message };
    } finally {
      isBathSubmitting = false;
    }
  }
</script>

<section class="community-shell">
  {#if notice}
    <div class="notice notice-{notice.severity}" role="status">
      {#if notice.severity === "success"}
        <CheckCircle2 size={19} aria-hidden="true" />
      {:else}
        <WeatherIcon
          kind={notice.severity === "warning" ? "thunder" : "partly-cloudy"}
          size={19}
        />
      {/if}
      <span>{notice.text}</span>
      <button
        type="button"
        class="icon-button"
        on:click={() => (notice = null)}
        aria-label="Lukk beskjed"
      >
        <X size={17} />
      </button>
    </div>
  {/if}

  {#if activeTab === "local"}
    <article class="feature-panel">
      <header class="feature-header">
        <div>
          <span class="eyebrow">Lokalt fra Værvakt</span>
          <h2>Rapporter nær {location.name}</h2>
          <p>
            {reportMeta.total} lokale rapporter
            {reports[0]?.time ? ` · siste aktivitet ${reports[0].time}` : ""}
          </p>
        </div>
        <button
          class="pill-button"
          type="button"
          on:click={refreshLocalData}
          disabled={isLoading}
        >
          <RefreshCw size={15} class={isLoading ? "spin" : ""} />
          {reportMeta.displayed}/{reportMeta.total}
        </button>
      </header>

      <div class="chip-row filter-row">
        <span>Tidsrom</span>
        {#each REPORT_RANGE_OPTIONS as option}
          <button
            class="chip"
            class:selected={reportRangeHours === option.hours}
            type="button"
            on:click={() => (reportRangeHours = option.hours)}
          >
            {option.label}
          </button>
        {/each}
      </div>

      <div class="feature-grid">
        <form class="feature-card report-form" on:submit|preventDefault={handleReportSubmit}>
          <div class="card-title">
            <div>
              <h3>Send værrapport</h3>
              <p>Rapporten knyttes til {location.name}.</p>
            </div>
            <Thermometer size={28} aria-hidden="true" />
          </div>

          <button class="text-button" type="button" on:click={fillReportFromForecast}>
            Fyll fra værvarselet
          </button>

          <label>
            <span>Visningsnavn (valgfritt)</span>
            <input
              maxlength="40"
              placeholder="Bruk gjerne et kallenavn"
              bind:value={reportForm.username}
              autocomplete="off"
            />
          </label>
          <div class="field-row">
            <label>
              <span>Temperatur</span>
              <input
                inputmode="decimal"
                min="-60"
                max="60"
                step="0.1"
                placeholder="12,5"
                bind:value={reportForm.temperature}
              />
            </label>
            <label>
              <span>Værtype</span>
              <select bind:value={reportForm.condition}>
                <option value="" disabled>Velg værtype</option>
                {#each CONDITIONS as condition}
                  <option value={condition.value}>{condition.label}</option>
                {/each}
              </select>
            </label>
          </div>
          <p class="privacy-inline">
            Publiseres i 7 dager med omtrent 1 km stedsnøyaktighet. Ikke bruk fullt navn.
            <button type="button" on:click={onOpenPrivacy}>Les om personvern</button>
          </p>
          <button class="primary-button" type="submit" disabled={isLoading}>
            <Send size={17} /> Send værrapport
          </button>
        </form>

        <div class="card-list">
          {#if reports.length === 0 && notice?.severity !== "warning"}
            <div class="empty-state">Ingen lokale rapporter her ennå. Bli førstemann.</div>
          {/if}
          {#each reports as report}
            <article class="list-card report-card">
              <div class="icon-tile">
                <WeatherIcon kind={conditionKind(report.condition)} size={25} />
              </div>
              <div class="list-copy">
                <strong>{report.condition}</strong>
                <span>
                  {[report.reporter, report.location, formatDistance(report.distanceKm), report.time]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <details class="report-flag">
                  <summary>
                    <Flag size={12} aria-hidden="true" />
                    {flaggedReportIds.includes(report.id) ? "Rapportert" : "Rapporter feil"}
                  </summary>
                  <div class="report-flag-menu">
                    {#if flaggedReportIds.includes(report.id)}
                      <span>Takk – sendt til vurdering.</span>
                    {:else}
                      <strong>Hva er galt?</strong>
                      {#each REPORT_FLAG_REASONS as reason}
                        <button
                          type="button"
                          disabled={flaggingReportId === report.id}
                          on:click={() => handleFlagReport(report.id, reason.value)}
                        >
                          {reason.label}
                        </button>
                      {/each}
                    {/if}
                  </div>
                </details>
              </div>
              <b>{formatTemperature(report.temp)}°</b>
            </article>
          {/each}
        </div>
      </div>
    </article>
  {:else if activeTab === "bath"}
    <article class="feature-panel">
      <header class="feature-header">
        <div>
          <span class="eyebrow">Bad</span>
          <h2>Badetemperatur</h2>
          <p>Ferske målinger i nærheten, levert av Yr.</p>
        </div>
        <Waves size={30} aria-hidden="true" />
      </header>

      <div class="card-list bath-list">
        {#if isBathLoading}
          <div class="empty-state">
            <LoaderCircle class="spin" size={18} /> Laster badetemperaturer…
          </div>
        {:else if bathTemperatures.length === 0 && notice?.severity !== "warning"}
          <div class="empty-state">
            Fant ingen ferske målinger innenfor 50 km. Yr viser målinger fra de siste fem døgnene.
          </div>
        {/if}
        {#each bathTemperatures as bath}
          <article class="list-card bath-card">
            <div class="icon-tile"><Waves size={24} /></div>
            <div class="list-copy">
              <strong>{bath.name}</strong>
              <span>
                {[bath.municipality, formatDistance(bath.distanceKm), formatBathTime(bath.time)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {#if bath.heatedWater}<small class="mini-chip">Oppvarmet</small>{/if}
            </div>
            <b>{formatTemperature(bath.temperature)}°</b>
          </article>
        {/each}
      </div>

      <form class="feature-card bath-form" on:submit|preventDefault={handleBathSubmit}>
        <div class="card-title">
          <div>
            <h3>Send ny måling</h3>
            <p>Bruk søk eller posisjon på badeplassen først.</p>
          </div>
          <MapPin size={25} />
        </div>
        <div class="field-row">
          <label>
            <span>Badeplass</span>
            <input placeholder="For eksempel Bystranda" bind:value={bathForm.name} />
          </label>
          <label>
            <span>Badetemperatur</span>
            <input inputmode="decimal" placeholder="19,5" bind:value={bathForm.temperature} />
          </label>
        </div>
        <label class="switch-row">
          <input type="checkbox" bind:checked={bathForm.heatedWater} />
          <span>Oppvarmet vann</span>
        </label>
        <p class="form-hint">
          Sender fra {location.name}
          {hasCoordinates
            ? ` (${latNumber.toFixed(4)}, ${lonNumber.toFixed(4)})`
            : " uten koordinater"}.
        </p>
        <p class="privacy-inline">
          Badeplass, temperatur og koordinater sendes til Yr. Værvakt lagrer ikke navnet ditt.
          <button type="button" on:click={onOpenPrivacy}>Les om personvern</button>
        </p>
        <button class="primary-button" type="submit" disabled={isBathSubmitting}>
          {#if isBathSubmitting}
            <LoaderCircle class="spin" size={17} />
          {:else}
            <Send size={17} />
          {/if}
          {isBathSubmitting ? "Sender til Yr…" : "Send badetemperatur til Yr"}
        </button>
      </form>

      <aside class="support-card">
        <div>
          <h3>Hold Værvakt annonsefri</h3>
          <p>Vipps-støtte går til drift, API-er og videre utvikling.</p>
        </div>
        <a
          class="support-button"
          href={VIPPS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Støtt med Vipps
        </a>
      </aside>
    </article>
  {/if}
</section>
