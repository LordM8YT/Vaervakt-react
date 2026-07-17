const MET_API_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_API_URL = "https://nominatim.openstreetmap.org/reverse";
const VAERVAKT_API_BASE = (import.meta.env.VITE_VAERVAKT_API_BASE || "").replace(/\/$/, "");

function formatDateTime(isoString) {
  return isoString.replace("T", " ").substring(0, 19);
}

function isNight(isoString) {
  const hour = new Date(isoString).getHours();
  return hour < 7 || hour > 20;
}

function symbolToIcon(symbolCode = "", isoString = "") {
  const symbol = symbolCode.toLowerCase();
  const suffix = isNight(isoString) ? "n" : "d";

  if (symbol.includes("thunder")) return `11${suffix}`;
  if (symbol.includes("snow") || symbol.includes("sleet")) return `13${suffix}`;
  if (symbol.includes("fog")) return `50${suffix}`;
  if (symbol.includes("rain") || symbol.includes("drizzle")) {
    return symbol.includes("showers") ? `09${suffix}` : `10${suffix}`;
  }
  if (symbol.includes("cloudy")) return symbol.includes("partly") ? `02${suffix}` : `04${suffix}`;
  if (symbol.includes("fair")) return `02${suffix}`;
  if (symbol.includes("clearsky")) return `01${suffix}`;

  return `03${suffix}`;
}

function symbolToNorwegian(symbolCode = "") {
  const symbol = symbolCode.toLowerCase();

  if (symbol.includes("thunder")) return "Torden";
  if (symbol.includes("snow")) return "Snø";
  if (symbol.includes("sleet")) return "Sludd";
  if (symbol.includes("fog")) return "Tåke";
  if (symbol.includes("rain")) return symbol.includes("showers") ? "Regnbyger" : "Regn";
  if (symbol.includes("cloudy")) return symbol.includes("partly") ? "Delvis skyet" : "Skyet";
  if (symbol.includes("fair")) return "Lettskyet";
  if (symbol.includes("clearsky")) return "Klart";

  return "Skiftende vær";
}

function toOpenWeatherLikePoint(point) {
  const details = point.data.instant.details;
  const nextHour = point.data.next_1_hours || point.data.next_6_hours || {};
  const symbolCode = nextHour.summary?.symbol_code || "cloudy";

  return {
    dt: Math.floor(new Date(point.time).getTime() / 1000),
    dt_txt: formatDateTime(point.time),
    main: {
      temp: details.air_temperature,
      feels_like: details.air_temperature,
      humidity: details.relative_humidity ?? 0,
      uvIndex: details.ultraviolet_index_clear_sky ?? null,
    },
    weather: [
      {
        description: symbolToNorwegian(symbolCode),
        icon: symbolToIcon(symbolCode, point.time),
      },
    ],
    wind: {
      speed: details.wind_speed ?? 0,
    },
    clouds: {
      all: details.cloud_area_fraction ?? 0,
    },
  };
}

export async function fetchWeatherData(lat, lon) {
  const response = await fetch(
    `${MET_API_URL}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
  );

  if (!response.ok) {
    throw new Error("Kunne ikke hente værdata fra MET.");
  }

  const payload = await response.json();
  const timeseries = payload?.properties?.timeseries || [];

  if (!timeseries.length) {
    throw new Error("MET returnerte ingen værdata for dette stedet.");
  }

  const list = timeseries.slice(0, 56).map(toOpenWeatherLikePoint);
  const current = list[0];

  return [
    {
      cod: "200",
      main: current.main,
      weather: current.weather,
      wind: current.wind,
      clouds: current.clouds,
    },
    {
      cod: "200",
      list,
    },
  ];
}

export async function fetchCities(input) {
  if (!input || input.trim().length < 2) {
    return { data: [] };
  }

  const params = new URLSearchParams({
    q: input,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
    "accept-language": "nb",
  });

  const response = await fetch(`${NOMINATIM_API_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Kunne ikke søke etter sted.");
  }

  const results = await response.json();

  return {
    data: results.map((place) => {
      const address = place.address || {};
      const localName =
        address.suburb ||
        address.city_district ||
        address.borough ||
        (place.type === "suburb" ? place.name : "") ||
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        place.display_name.split(",")[0];
      const municipality =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        "";
      const name =
        municipality &&
        localName.localeCompare(municipality, "nb", { sensitivity: "base" }) !== 0
          ? `${localName}, ${municipality}`
          : localName;

      return {
        latitude: place.lat,
        longitude: place.lon,
        name,
        countryCode: address.country_code?.toUpperCase() || "",
      };
    }),
  };
}

export async function reverseGeocode(lat, lon) {
  const safeLat = Number.isFinite(Number(lat)) ? Number(lat).toFixed(3) : lat;
  const safeLon = Number.isFinite(Number(lon)) ? Number(lon).toFixed(3) : lon;

  try {
    const response = await fetch(`${VAERVAKT_API_BASE}/api/geocode.php`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lat: safeLat, lon: safeLon }),
    });
    if (!response.ok) {
      throw new Error("Kartverket-oppslaget feilet.");
    }

    const payload = await response.json();
    if (payload?.result?.name) {
      return payload.result.name;
    }
  } catch (error) {
    // Fall back to Nominatim if the Værvakt/Kartverket endpoint is unavailable.
  }

  const params = new URLSearchParams({
    lat: safeLat,
    lon: safeLon,
    format: "jsonv2",
    addressdetails: "1",
    zoom: "14",
    "accept-language": "nb",
  });

  const response = await fetch(`${NOMINATIM_REVERSE_API_URL}?${params.toString()}`, {
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });

  if (!response.ok) {
    throw new Error("Kunne ikke finne stedsnavn for posisjonen.");
  }

  const place = await response.json();
  const address = place.address || {};
  const name =
    address.suburb ||
    address.city_district ||
    address.borough ||
    address.town ||
    address.village ||
    address.city ||
    address.municipality ||
    address.county ||
    "Din posisjon";

  const region =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.country_code?.toUpperCase() ||
    "";

  return region && !name.toLowerCase().includes(region.toLowerCase())
    ? `${name}, ${region}`
    : name;
}
