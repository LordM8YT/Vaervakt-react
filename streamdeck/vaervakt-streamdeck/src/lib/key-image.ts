type WeatherImageInput = {
  mode: "weather" | "bath";
  placeName: string;
  temperature?: number | null;
  condition?: string;
  icon?: string;
  bathTemperature?: number | null;
  bathPlace?: string | null;
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

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function compactLabel(value: string, maxLength: number): string {
  return truncate(value, maxLength).toUpperCase();
}

export function makeKeyImage(input: WeatherImageInput): string {
  const place = escapeXml(compactLabel(input.placeName || "Værvakt", 13));
  const condition = escapeXml(compactLabel(input.condition || "Lokalt vær", 13));
  const icon = escapeXml(input.icon || (input.mode === "bath" ? "🌊" : "☁️"));
  const temp = escapeXml(formatTemperature(input.temperature));
  const bathTemp = escapeXml(formatTemperature(input.bathTemperature));
  const bathPlace = escapeXml(compactLabel(input.bathPlace || "Badetemp", 13));
  const status = input.status || "ok";
  const message = escapeXml(compactLabel(input.message || "Sjekker Værvakt", 13));
  const isBath = input.mode === "bath";

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
