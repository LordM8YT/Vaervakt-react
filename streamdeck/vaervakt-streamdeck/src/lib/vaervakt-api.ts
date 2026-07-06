import { normalizeSettings, type VaervaktSettings } from "../settings";

export type VaervaktWeather = {
  current: {
    temperature: number;
    condition: string;
    icon: string;
    windSpeed: number;
  };
  bathing?: {
    waterTemperature?: number | null;
    waterTemperatureLocation?: string | null;
    waterTemperatureDistanceKm?: number | null;
    waterTemperatureTime?: string | null;
    nearby?: Array<{
      name: string;
      municipality?: string;
      temperature: number;
      distanceKm?: number;
      time?: string;
    }>;
  };
};

export async function fetchVaervaktWeather(settings: VaervaktSettings): Promise<VaervaktWeather> {
  const normalized = normalizeSettings(settings);
  const params = new URLSearchParams({
    lat: String(normalized.lat),
    lon: String(normalized.lon),
  });
  const response = await fetch(`${normalized.apiBase}/api/weather.php?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Vaervakt-StreamDeck/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Værvakt svarte med HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as VaervaktWeather & {
    success?: boolean;
    message?: string;
  };

  if (payload.success === false) {
    throw new Error(payload.message || "Værvakt kunne ikke hente data.");
  }

  if (!payload.current) {
    throw new Error("Værvakt-data mangler current-felt.");
  }

  return payload;
}
