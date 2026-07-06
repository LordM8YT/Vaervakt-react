type WeatherImageInput = {
  mode: "weather" | "bath" | "bathInfo";
  placeName: string;
  temperature?: number | null;
  condition?: string;
  icon?: string;
  bathTemperature?: number | null;
  bathPlace?: string | null;
  bathDistanceKm?: number | null;
  bathTime?: string | null;
  status?: "ok" | "loading" | "error";
  message?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTemperature(value?: number | null): string {
  if (!Number.isFinite(Number(value))) {
    return "--";
  }

  return `${Math.round(Number(value))}°`;
}

function formatDistance(value?: number | null): string {
  const distance = Number(value);
  if (!Number.isFinite(distance)) {
    return "";
  }

  if (distance < 1) {
    return `${Math.max(1, Math.round(distance * 1000))} M UNNA`;
  }

  return `${distance.toFixed(1).replace(".", ",")} KM UNNA`;
}

function formatShortTime(value?: string | null): string {
  if (!value) {
    return "YR";
  }

  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return "YR";
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function compactLabel(value: string, maxLength: number): string {
  return truncate(value, maxLength).toUpperCase();
}

export function makeKeyImage(input: WeatherImageInput): string {
  const place = escapeXml(compactLabel(input.placeName || "Værvakt", 13));
  const condition = escapeXml(compactLabel(input.condition || "Lokalt vær", 13));
  const icon = escapeXml(input.icon || (input.mode === "weather" ? "☁️" : "🌊"));
  const temp = escapeXml(formatTemperature(input.temperature));
  const bathTemp = escapeXml(formatTemperature(input.bathTemperature));
  const bathPlace = escapeXml(compactLabel(input.bathPlace || "Badeplass", 13));
  const bathDistance = escapeXml(formatDistance(input.bathDistanceKm) || "I NÆRHETEN");
  const bathTime = escapeXml(formatShortTime(input.bathTime));
  const status = input.status || "ok";
  const message = escapeXml(compactLabel(input.message || "Sjekker Værvakt", 13));
  const isBath = input.mode === "bath";
  const isBathInfo = input.mode === "bathInfo";

  if (isBathInfo) {
    const primary = status === "error" ? "FEIL" : status === "loading" ? "LASTER" : bathPlace;
    const secondary = status === "error" ? message : status === "loading" ? "BADETEMP INFO" : bathDistance;
    const tertiary = status === "error" ? "PRØV IGJEN" : status === "loading" ? "YR" : `YR · ${bathTime}`;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs>
    <linearGradient id="bg" x1="12" y1="0" x2="132" y2="144" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#12305f"/>
      <stop offset="0.52" stop-color="#061328"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(106 104) rotate(120) scale(70)">
      <stop stop-color="#38bdf8" stop-opacity="0.58"/>
      <stop offset="1" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="144" height="144" rx="26" fill="url(#bg)"/>
  <rect width="144" height="144" rx="26" fill="url(#glow)"/>
  <path d="M0 0h22L0 22Z" fill="#38bdf8" opacity=".72"/>
  <path d="M144 144h-22l22-22Z" fill="#2563eb" opacity=".72"/>
  <text x="13" y="33" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="12" font-weight="900">BADESTED</text>
  <text x="13" y="65" fill="#ffffff" font-family="Arial, sans-serif" font-size="20" font-weight="900">${primary}</text>
  <text x="13" y="91" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="14" font-weight="900">${secondary}</text>
  <text x="13" y="111" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10.5" font-weight="800">${tertiary}</text>
  <text x="111" y="119" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="40">🌊</text>
</svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const centerText = status === "error" ? "!" : isBath ? bathTemp : temp;
  const bottomPrimary = status === "error" ? "FEIL" : isBath ? bathPlace : place;
  const bottomSecondary =
    status === "error"
      ? message
      : isBath
        ? "BADETEMP FRA YR"
        : input.bathTemperature
          ? `Bad ${bathTemp}`
          : condition;
  const temperatureSize = centerText.length > 3 ? 48 : 60;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs>
    <linearGradient id="bg" x1="12" y1="0" x2="132" y2="144" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#12305f"/>
      <stop offset="0.52" stop-color="#061328"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(105 30) rotate(120) scale(72)">
      <stop stop-color="#38bdf8" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="144" height="144" rx="26" fill="url(#bg)"/>
  <rect width="144" height="144" rx="26" fill="url(#glow)"/>
  <path d="M0 0h22L0 22Z" fill="#38bdf8" opacity=".72"/>
  <path d="M144 144h-22l22-22Z" fill="#2563eb" opacity=".72"/>
  <text x="11" y="56" fill="#ffffff" font-family="Arial, sans-serif" font-size="${temperatureSize}" font-weight="900">${centerText}</text>
  <text x="13" y="86" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="15" font-weight="900">${bottomPrimary}</text>
  <text x="13" y="105" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="10.5" font-weight="800">${escapeXml(bottomSecondary)}</text>
  <text x="110" y="116" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="42">${icon}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
