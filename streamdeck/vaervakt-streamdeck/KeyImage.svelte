<script>
  import {
    CircleCheck,
    Cloud,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSnow,
    CloudSun,
    ExternalLink,
    MapPin,
    Send,
    Sun,
    TriangleAlert,
    Waves,
  } from "@lucide/svelte";

  export let input = {};

  function truncate(value, maxLength) {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function label(value, maxLength) {
    return truncate(value, maxLength).toUpperCase();
  }

  function formatTemperature(value) {
    const temperature = Number(value);
    return Number.isFinite(temperature)
      ? `${temperature.toFixed(1).replace(".", ",")}°`
      : "--";
  }

  function formatDistance(value) {
    const distance = Number(value);
    if (!Number.isFinite(distance)) return "";
    if (distance <= 0.05) return "VED DEG";
    if (distance < 1) {
      return `${Math.max(50, Math.round((distance * 1000) / 50) * 50)} M`;
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

  function weatherIcon(condition = "") {
    const value = String(condition).toLowerCase();
    if (value.includes("snø") || value.includes("sludd")) return CloudSnow;
    if (value.includes("regn") || value.includes("byge")) return CloudRain;
    if (value.includes("torden") || value.includes("storm")) return CloudLightning;
    if (value.includes("tåke")) return CloudFog;
    if (value.includes("sky")) return Cloud;
    if (value.includes("lett")) return CloudSun;
    return Sun;
  }

  $: status = input.status || "ok";
  $: place = label(input.placeName || "Værvakt", 10);
  $: condition = label(input.condition || "Lokalt vær", 12);
  $: temperature = formatTemperature(input.temperature);
  $: bathTemperature = formatTemperature(input.bathTemperature);
  $: bathPlace = label(input.bathPlace || input.placeName || "Ingen måling", 10);
  $: bathDistance = formatDistance(input.bathDistanceKm) || "VELG STED";
  $: bathTime = formatShortTime(input.bathTime);
  $: message = label(input.message || "Oppdaterer", 12);
  $: reportLabel = label(input.reportCondition || "Sol / Klart", 12);
  $: latestReport = input.latestReport;
  $: latestTemperature = formatTemperature(latestReport?.temp);
  $: latestLocation = label(latestReport?.location || input.placeName || "Lokalt", 10);
  $: latestMeta = label(
    latestReport
      ? `${latestReport.condition || "Rapport"} · ${latestReport.time || "Nå"}`
      : "Ingen rapport",
    14,
  );
  $: WeatherIcon = weatherIcon(input.condition || input.reportCondition);
  $: accent = status === "error" ? "#fb7185" : status === "success" ? "#22c55e" : "#38bdf8";
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="144"
  height="144"
  viewBox="0 0 144 144"
  role="img"
  aria-label="Værvakt"
>
  <defs>
    <linearGradient id="key-bg" x1="10" y1="0" x2="134" y2="144" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#16386e" />
      <stop offset="0.45" stop-color="#07162d" />
      <stop offset="1" stop-color="#020617" />
    </linearGradient>
    <radialGradient
      id="key-glow"
      cx="0"
      cy="0"
      r="1"
      gradientUnits="userSpaceOnUse"
      gradientTransform="translate(108 108) rotate(120) scale(76)"
    >
      <stop stop-color={accent} stop-opacity="0.66" />
      <stop offset="1" stop-color={accent} stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="144" height="144" rx="26" fill="url(#key-bg)" />
  <rect width="144" height="144" rx="26" fill="url(#key-glow)" />
  <path d="M0 0h25L0 25Z" fill={accent} opacity=".78" />
  <path d="M144 144h-25l25-25Z" fill="#2563eb" opacity=".78" />
  <rect
    x="7"
    y="7"
    width="130"
    height="130"
    rx="22"
    fill="rgba(255,255,255,.035)"
    stroke="rgba(186,230,253,.18)"
  />

  {#if status === "error"}
    <text x="16" y="31" fill="#fecdd3" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">VÆRVAKT</text>
    <TriangleAlert x={15} y={42} size={43} color="#ffffff" strokeWidth={3} />
    <text x="16" y="101" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="900">FEIL</text>
    <text x="16" y="119" fill="#fecdd3" font-family="Arial, sans-serif" font-size="9.5" font-weight="800">{message}</text>
  {:else if input.mode === "bathInfo"}
    <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">BADESTED</text>
    <text x="16" y="61" fill="#ffffff" font-family="Arial, sans-serif" font-size="17.5" font-weight="900">{status === "loading" ? "LASTER" : bathPlace}</text>
    <text x="16" y="84" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="15" font-weight="900">{status === "loading" ? "BADETEMP" : bathDistance}</text>
    <text x="16" y="105" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10" font-weight="800">{status === "loading" ? "YR" : `YR · ${bathTime}`}</text>
    <circle cx="113" cy="111" r="18" fill="#075985" opacity=".92" />
    <Waves x={98} y={96} size={30} color="#e0f2fe" strokeWidth={2.8} />
  {:else if input.mode === "latest"}
    <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">SISTE</text>
    <text x="15" y="72" fill="#ffffff" font-family="Arial, sans-serif" font-size={latestTemperature.length > 3 ? 42 : 53} font-weight="900">{status === "loading" ? "--" : latestTemperature}</text>
    <text x="16" y="97" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="12.5" font-weight="900">{latestLocation}</text>
    <text x="16" y="117" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="9.5" font-weight="800">{latestMeta}</text>
    <MapPin x={96} y={94} size={34} color="#e0f2fe" strokeWidth={2.6} />
  {:else if input.mode === "report"}
    <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">VÆRVAKT</text>
    {#if status === "success"}
      <CircleCheck x={49} y={40} size={46} color="#dcfce7" strokeWidth={2.8} />
    {:else if status === "loading"}
      <Send x={49} y={40} size={46} color="#e0f2fe" strokeWidth={2.8} />
    {:else}
      <WeatherIcon x={49} y={40} size={46} color="#e0f2fe" strokeWidth={2.8} />
    {/if}
    <text x="16" y="101" fill="#ffffff" font-family="Arial, sans-serif" font-size="18" font-weight="900">{status === "success" ? "SENDT" : status === "loading" ? "SENDER" : "RAPPORT"}</text>
    <text x="16" y="119" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10" font-weight="800">{status === "success" ? "TAKK" : reportLabel}</text>
  {:else if input.mode === "open"}
    <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">ÅPNE</text>
    <ExternalLink x={49} y={40} size={46} color="#e0f2fe" strokeWidth={2.7} />
    <text x="16" y="104" fill="#ffffff" font-family="Arial, sans-serif" font-size="17" font-weight="900">VÆRVAKT</text>
    <text x="16" y="121" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10" font-weight="800">{place}</text>
  {:else if input.mode === "bath"}
    <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">BADETEMP</text>
    <text x="15" y="72" fill="#ffffff" font-family="Arial, sans-serif" font-size={bathTemperature.length > 3 ? 44 : 56} font-weight="900">{status === "loading" ? "--" : bathTemperature}</text>
    <text x="16" y="97" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="12.5" font-weight="900">{bathPlace}</text>
    <text x="16" y="117" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="9.5" font-weight="800">YR · {bathDistance}</text>
    <circle cx="113" cy="111" r="18" fill="#075985" opacity=".92" />
    <Waves x={98} y={96} size={30} color="#e0f2fe" strokeWidth={2.8} />
  {:else}
    <text x="16" y="31" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="10.5" font-weight="900">NÅ</text>
    <text x="15" y="72" fill="#ffffff" font-family="Arial, sans-serif" font-size={temperature.length > 3 ? 44 : 56} font-weight="900">{status === "loading" ? "--" : temperature}</text>
    <text x="16" y="97" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="12.5" font-weight="900">{place}</text>
    <text x="16" y="117" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="9.5" font-weight="800">{condition}</text>
    <WeatherIcon x={96} y={94} size={34} color="#e0f2fe" strokeWidth={2.6} />
  {/if}
</svg>
