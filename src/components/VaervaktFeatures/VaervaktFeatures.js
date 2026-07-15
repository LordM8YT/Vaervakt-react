import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  createHubPost,
  fetchBathTemperatures,
  fetchGlimpsePhotos,
  fetchHubPosts,
  fetchReports,
  loginHubProfile,
  submitBathTemperature,
  submitReport,
  uploadGlimpsePhoto,
  voteHubPost,
} from "../../api/VaervaktApi";

const PROFILE_KEY = "vaervakt_hub_profile";
const REPORTER_KEY = "vaervakt_reporter_name";
const VOTES_KEY_PREFIX = "vaervakt_hub_votes_";
const VIPPS_URL = "https://betal.vipps.no/opy01u";
const BATH_CACHE_KEY = "vaervakt_bath_cache_v1";
const BATH_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function getBathCacheLocationKey(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

function readBathCache(lat, lon) {
  const locationKey = getBathCacheLocationKey(lat, lon);
  if (!locationKey || typeof window === "undefined") return [];

  try {
    const cache = JSON.parse(window.localStorage.getItem(BATH_CACHE_KEY) || "{}");
    const entry = cache[locationKey];
    if (!entry || Date.now() - Number(entry.storedAt) > BATH_CACHE_MAX_AGE_MS) return [];
    return Array.isArray(entry.items) ? entry.items : [];
  } catch (error) {
    return [];
  }
}

function writeBathCache(lat, lon, items) {
  const locationKey = getBathCacheLocationKey(lat, lon);
  if (!locationKey || !Array.isArray(items) || items.length === 0 || typeof window === "undefined") return;

  try {
    const cache = JSON.parse(window.localStorage.getItem(BATH_CACHE_KEY) || "{}");
    cache[locationKey] = { storedAt: Date.now(), items };
    const newestEntries = Object.entries(cache)
      .sort(([, first], [, second]) => Number(second.storedAt) - Number(first.storedAt))
      .slice(0, 8);
    window.localStorage.setItem(BATH_CACHE_KEY, JSON.stringify(Object.fromEntries(newestEntries)));
  } catch (error) {
    // Badedata skal fortsatt fungere hvis lagring er blokkert i nettleseren.
  }
}
const MAX_CLIENT_IMAGE_BYTES = 10 * 1024 * 1024;

const CONDITIONS = [
  { value: "Sol / Klart", label: "Sol", icon: "☀️" },
  { value: "Delvis skyet", label: "Delvis skyet", icon: "⛅" },
  { value: "Skyet", label: "Skyet", icon: "☁️" },
  { value: "Regn", label: "Regn", icon: "🌧️" },
  { value: "Snø", label: "Snø", icon: "❄️" },
  { value: "Torden", label: "Torden", icon: "⛈️" },
];

const SNAP_TYPES = [
  {
    value: "sun",
    label: "Sol",
    icon: "☀️",
    title: "Sol nå",
    body: "Sola titter frem her.",
    category: "tip",
    keywords: ["sol", "klart", "lysner"],
  },
  {
    value: "rain",
    label: "Regn",
    icon: "🌧️",
    title: "Regn nå",
    body: "Det regner lokalt akkurat nå.",
    category: "general",
    keywords: ["regn", "byge", "vått"],
  },
  {
    value: "cloudy",
    label: "Skyet",
    icon: "☁️",
    title: "Skyet nå",
    body: "Det er skyet akkurat her.",
    category: "general",
    keywords: ["skyet", "skyer", "grått"],
  },
  {
    value: "partly-cloudy",
    label: "Litt skyet",
    icon: "⛅",
    title: "Litt skyet",
    body: "Sola og skyene deler på himmelen.",
    category: "general",
    keywords: ["delvis", "lettskyet", "solgløtt"],
  },
  {
    value: "snow",
    label: "Snø",
    icon: "❄️",
    title: "Snø nå",
    body: "Det snør lokalt akkurat nå.",
    category: "warning",
    keywords: ["snø", "snør", "sludd"],
  },
  {
    value: "hail",
    label: "Hagl",
    icon: "🧊",
    title: "Hagl",
    body: "Det hagler i området.",
    category: "warning",
    keywords: ["hagl", "hagler", "is"],
  },
  {
    value: "wind",
    label: "Vind",
    icon: "💨",
    title: "Mye vind",
    body: "Vinden merkes godt her.",
    category: "warning",
    keywords: ["vind", "blåser", "kast"],
  },
  {
    value: "fog",
    label: "Tåke",
    icon: "🌫️",
    title: "Tåke",
    body: "Det er redusert sikt her.",
    category: "warning",
    keywords: ["tåke", "sikt"],
  },
  {
    value: "slippery",
    label: "Glatt",
    icon: "🧊",
    title: "Glatt føre",
    body: "Det er glatt lokalt.",
    category: "warning",
    keywords: ["glatt", "is", "føre"],
  },
  {
    value: "thunder",
    label: "Lyn",
    icon: "⛈️",
    title: "Lyn og torden",
    body: "Lyn eller torden observert i området.",
    category: "warning",
    keywords: ["lyn", "torden", "uvær"],
  },
  {
    value: "rainbow",
    label: "Regnbue",
    icon: "🌈",
    title: "Regnbue",
    body: "Regnbue observert her.",
    category: "tip",
    keywords: ["regnbue", "sol", "regn"],
  },
  {
    value: "sunset",
    label: "Solnedgang",
    icon: "🌅",
    title: "Fin solnedgang",
    body: "Fin himmel eller solnedgang akkurat nå.",
    category: "tip",
    keywords: ["solnedgang", "himmel", "kveld"],
  },
  {
    value: "water",
    label: "Mye vann",
    icon: "🌊",
    title: "Mye vann",
    body: "Mye vann, store dammer eller overvann lokalt.",
    category: "warning",
    keywords: ["vann", "overvann", "flom", "dam"],
  },
  {
    value: "beach",
    label: "Badevær",
    icon: "🏖️",
    title: "Badevær",
    body: "Det ser fint ut for bading her.",
    category: "tip",
    keywords: ["bade", "strand", "vann"],
  },
  {
    value: "outdoor",
    label: "Turvær",
    icon: "🥾",
    title: "Turvær",
    body: "Det er fint å være ute her.",
    category: "tip",
    keywords: ["tur", "ute", "fint"],
  },
];

const CATEGORIES = [
  { value: "general", label: "Glimt" },
  { value: "question", label: "Spørsmål" },
  { value: "warning", label: "Obs" },
  { value: "tip", label: "Tips" },
];

const GLIMPSE_TTLS = [
  { hours: 1, label: "1 t" },
  { hours: 3, label: "3 t" },
  { hours: 12, label: "12 t" },
  { hours: 24, label: "24 t" },
];

const sectionSx = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden",
  borderRadius: { xs: "18px", sm: "22px" },
  background:
    "linear-gradient(0deg, rgba(255, 255, 255, .045) 0%, rgba(171, 203, 222, .07) 100%)",
  boxShadow:
    "rgba(0, 0, 0, 0.12) 0px 12px 24px -10px, inset 0 1px 0 rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.08)",
  p: { xs: 1.3, sm: 1.8 },
};

const cardSx = {
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  borderRadius: { xs: "14px", sm: "18px" },
  background:
    "linear-gradient(180deg, rgba(9, 16, 36, .72) 0%, rgba(7, 12, 27, .86) 100%)",
  border: "1px solid rgba(255,255,255,.075)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
};

const inputSx = {
  "& .MuiInputBase-root": {
    minHeight: "44px",
    borderRadius: "12px",
    backgroundColor: "rgba(2, 6, 23, 0.35)",
    color: "rgba(255,255,255,.9)",
    fontSize: "16px",
    fontFamily: "Poppins",
  },
  "& .MuiInputBase-input": {
    fontSize: "16px",
  },
  "& .MuiInputLabel-root": {
    color: "rgba(255,255,255,.55)",
    fontFamily: "Poppins",
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#38bdf8",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,.1)",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(56, 189, 248, 0.45)",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#38bdf8",
  },
  "& .MuiSelect-icon": {
    color: "rgba(255,255,255,.65)",
  },
};

const selectMenuProps = {
  PaperProps: {
    sx: {
      borderRadius: "14px",
      backgroundColor: "#101a33",
      color: "rgba(255,255,255,.9)",
      border: "1px solid rgba(255,255,255,.1)",
    },
  },
};

function getStoredProfile() {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function getStoredReporterName() {
  try {
    return window.localStorage.getItem(REPORTER_KEY) || "";
  } catch (error) {
    return "";
  }
}

function getStoredVotes(userId) {
  if (!userId) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(`${VOTES_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function setStoredVotes(userId, votes) {
  if (!userId) {
    return;
  }
  try {
    window.localStorage.setItem(`${VOTES_KEY_PREFIX}${userId}`, JSON.stringify(votes));
  } catch (error) {
    // Ignore storage errors (e.g. private browsing).
  }
}

function normalizeTemp(value) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function getWeatherSummary(weather) {
  return weather?.weather?.[0]?.description || "";
}

function getWeatherTemp(weather) {
  const temp = weather?.main?.temp;
  return Number.isFinite(temp) ? Math.round(temp) : "";
}

function getConditionIcon(condition = "") {
  const match = CONDITIONS.find((item) =>
    condition.toLowerCase().includes(item.value.toLowerCase().split(" ")[0])
  );
  return match?.icon || "🌦️";
}

function formatBathTemperature(value) {
  const temperature = Number(value);
  if (!Number.isFinite(temperature)) {
    return "–";
  }

  return temperature.toFixed(temperature % 1 === 0 ? 0 : 1).replace(".", ",");
}

function formatBathDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) {
    return "";
  }

  if (distance < 1) {
    return `${Math.max(1, Math.round(distance * 1000))} m unna`;
  }

  return `${distance.toFixed(1).replace(".", ",")} km unna`;
}

function formatBathTime(value) {
  if (!value) {
    return "Nylig registrert";
  }

  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return "Nylig registrert";
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getBathFreshness(value) {
  if (!value) {
    return { label: "Ukjent tidspunkt", fresh: false };
  }

  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return { label: "Ukjent tidspunkt", fresh: false };
  }

  const hours = Math.max(0, (Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return { label: "Målt siste time", fresh: true };
  if (hours < 12) return { label: `Målt for ${Math.floor(hours)} t siden`, fresh: true };
  if (hours < 24) return { label: `Målt for ${Math.floor(hours)} t siden`, fresh: false };
  if (hours < 48) return { label: "Målt i går", fresh: false };
  return { label: formatBathTime(value), fresh: false };
}

function getBathAgeHours(value) {
  if (!value) return Infinity;
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return Infinity;
  return Math.max(0, (Date.now() - date.getTime()) / 3600000);
}

function getBathComfort(value) {
  const temperature = Number(value);
  if (!Number.isFinite(temperature)) {
    return { label: "Ukjent", color: "rgba(255,255,255,.6)" };
  }
  if (temperature < 15) return { label: "Kaldt", color: "#bae6fd" };
  if (temperature < 18) return { label: "Friskt", color: "#67e8f9" };
  if (temperature < 21) return { label: "Fint", color: "#6ee7b7" };
  if (temperature < 24) return { label: "Behagelig", color: "#fcd34d" };
  return { label: "Varmt", color: "#fb923c" };
}

function getSnapTypeForPost(post) {
  const text = `${post.title || ""} ${post.body || ""} ${post.category || ""} ${
    post.weatherCondition || ""
  }`.toLowerCase();

  return (
    SNAP_TYPES.find((type) => type.keywords.some((keyword) => text.includes(keyword))) ||
    SNAP_TYPES.find((type) => type.category === post.category) ||
    SNAP_TYPES[0]
  );
}

function getCategoryLabel(category) {
  return CATEGORIES.find((item) => item.value === category)?.label || "Glimt";
}

function formatExpiry(expiresAt) {
  const expires = new Date(String(expiresAt).replace(" ", "T"));
  const diffMs = expires.getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return "Utløper nå";
  }

  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes} min igjen`;
  }

  return `${Math.ceil(minutes / 60)} t igjen`;
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Velg et bilde."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(file);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          resolve(
            new File([blob], `${Date.now()}-vaerglimt.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.84
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Kunne ikke lese bildet."));
    };

    image.src = objectUrl;
  });
}

function EmptyState({ children }) {
  return (
    <Box
      sx={{
        ...cardSx,
        p: 1.6,
        borderStyle: "dashed",
        color: "rgba(255,255,255,.58)",
      }}
    >
      <Typography sx={{ fontSize: { xs: "0.78rem", sm: "0.86rem" } }}>
        {children}
      </Typography>
    </Box>
  );
}

function SectionHeading({ title, subtitle, action }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent="space-between"
      gap={1.2}
      sx={{ mb: 1.4 }}
    >
      <Box>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            color: "rgba(255,255,255,.74)",
            fontFamily: "Roboto Condensed",
            fontSize: { xs: "12px", sm: "16px", md: "18px" },
            fontWeight: 600,
            letterSpacing: ".05em",
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            sx={{
              color: "rgba(255,255,255,.42)",
              fontSize: { xs: "0.74rem", sm: "0.82rem" },
              mt: 0.7,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

function WeatherPillButton({ children, selected, ...props }) {
  return (
    <Button
      size="small"
      {...props}
      sx={{
        minWidth: "auto",
        borderRadius: "999px",
        px: 1.35,
        py: 0.55,
        color: selected ? "#06111f" : "rgba(255,255,255,.78)",
        backgroundColor: selected ? "#38bdf8" : "rgba(255,255,255,.06)",
        border: selected
          ? "1px solid rgba(56,189,248,.4)"
          : "1px solid rgba(255,255,255,.1)",
        fontSize: "0.72rem",
        fontWeight: 700,
        textTransform: "none",
        "&:hover": {
          backgroundColor: selected ? "#7dd3fc" : "rgba(255,255,255,.1)",
        },
        ...(props.sx || {}),
      }}
    >
      {children}
    </Button>
  );
}

function SnapTypeButton({ type, selected, onClick }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      sx={{
        flex: "0 0 auto",
        minWidth: "max-content",
        height: { xs: 42, sm: 44 },
        borderRadius: "999px",
        px: { xs: 1.05, sm: 1.18 },
        py: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 0.65,
        color: selected ? "#06111f" : "rgba(255,255,255,.82)",
        background: selected
          ? "linear-gradient(160deg, #bae6fd, #38bdf8)"
          : "linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.035))",
        border: selected
          ? "1px solid rgba(186,230,253,.72)"
          : "1px solid rgba(255,255,255,.11)",
        textTransform: "none",
        boxShadow: selected ? "0 12px 26px rgba(56,189,248,.18)" : "none",
        scrollSnapAlign: "start",
        whiteSpace: "nowrap",
        "&:hover": {
          background: selected
            ? "linear-gradient(160deg, #e0f2fe, #38bdf8)"
            : "linear-gradient(180deg, rgba(255,255,255,.11), rgba(255,255,255,.05))",
        },
      }}
    >
      <Typography sx={{ fontSize: "1.22rem", lineHeight: 1 }}>{type.icon}</Typography>
      <Typography sx={{ fontSize: "0.74rem", fontWeight: 850, lineHeight: 1 }}>
        {type.label}
      </Typography>
    </Button>
  );
}

function VaervaktFeatures({ selectedLocation, weather, activeTab = "local", refreshKey = 0 }) {
  const [reports, setReports] = useState([]);
  const [posts, setPosts] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [sort, setSort] = useState("new");
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [profile, setProfile] = useState(() => getStoredProfile());
  const [votedPosts, setVotedPosts] = useState(() => getStoredVotes(getStoredProfile()?.user?.id));
  const [profileForm, setProfileForm] = useState({ displayName: "", pin: "" });
  const [reportForm, setReportForm] = useState({
    username: getStoredReporterName(),
    temperature: "",
    condition: "Sol / Klart",
  });
  const [bathForm, setBathForm] = useState({
    name: "",
    temperature: "",
    heatedWater: false,
    lat: null,
    lon: null,
  });
  const [bathTemperatures, setBathTemperatures] = useState(() =>
    readBathCache(selectedLocation?.lat, selectedLocation?.lon)
  );
  const [isBathLoading, setIsBathLoading] = useState(false);
  const [isBathSubmitting, setIsBathSubmitting] = useState(false);
  const [isBathCacheFallback, setIsBathCacheFallback] = useState(false);
  const [bathSearch, setBathSearch] = useState("");
  const [showAllBaths, setShowAllBaths] = useState(false);
  const [showBathReport, setShowBathReport] = useState(false);
  const [isGlimpseComposerOpen, setIsGlimpseComposerOpen] = useState(false);
  const [glimpseFilter, setGlimpseFilter] = useState("all");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isGlimpseSubmitting, setIsGlimpseSubmitting] = useState(false);
  const refreshRequestId = useRef(0);
  const [snapForm, setSnapForm] = useState({
    type: "rain",
    note: "",
    file: null,
    previewUrl: "",
    ttlHours: 3,
  });

  const location = useMemo(
    () => ({
      name: selectedLocation?.name || "Kristiansand",
      lat: selectedLocation?.lat,
      lon: selectedLocation?.lon,
    }),
    [selectedLocation]
  );

  const selectedSnapType =
    SNAP_TYPES.find((type) => type.value === snapForm.type) || SNAP_TYPES[0];

  const locationCoordinates = useMemo(() => {
    const lat = Number(location.lat);
    const lon = Number(location.lon);
    return {
      lat,
      lon,
      hasCoordinates: Number.isFinite(lat) && Number.isFinite(lon),
    };
  }, [location.lat, location.lon]);

  const sortedBathTemperatures = useMemo(
    () =>
      [...bathTemperatures].sort((first, second) => {
        const firstIsFresh = getBathAgeHours(first.time) < 12;
        const secondIsFresh = getBathAgeHours(second.time) < 12;
        if (firstIsFresh !== secondIsFresh) return firstIsFresh ? -1 : 1;
        return Number(first.distanceKm ?? Infinity) - Number(second.distanceKm ?? Infinity);
      }),
    [bathTemperatures]
  );

  const filteredBathTemperatures = useMemo(() => {
    const query = bathSearch.trim().toLowerCase();
    if (!query) return sortedBathTemperatures;
    return sortedBathTemperatures.filter((bath) =>
      `${bath.name || ""} ${bath.municipality || ""}`.toLowerCase().includes(query)
    );
  }, [bathSearch, sortedBathTemperatures]);

  const nearestBath = !bathSearch ? sortedBathTemperatures[0] || null : null;
  const bathList = nearestBath
    ? filteredBathTemperatures.filter((bath) => bath !== nearestBath)
    : filteredBathTemperatures;
  const visibleBaths = showAllBaths ? bathList : bathList.slice(0, 4);
  const visiblePhotos = glimpseFilter === "posts" ? [] : photos;
  const visiblePosts = glimpseFilter === "photos" ? [] : posts;

  useEffect(() => {
    const cachedItems = readBathCache(locationCoordinates.lat, locationCoordinates.lon);
    setBathTemperatures(cachedItems);
    setIsBathCacheFallback(cachedItems.length > 0);
    setBathSearch("");
    setShowAllBaths(false);
  }, [locationCoordinates.lat, locationCoordinates.lon]);

  useEffect(() => {
    return () => {
      if (snapForm.previewUrl) {
        URL.revokeObjectURL(snapForm.previewUrl);
      }
    };
  }, [snapForm.previewUrl]);

  const refreshCommunityData = async () => {
    const requestId = ++refreshRequestId.current;
    setIsLoading(true);
    const shouldFetchBath = activeTab === "bath" && locationCoordinates.hasCoordinates;
    setIsBathLoading(shouldFetchBath);
    const bathRequest = shouldFetchBath
      ? fetchBathTemperatures(location)
      : Promise.resolve({ bathing: { nearby: [] } });
    const [reportResult, postResult, photoResult, bathResult] = await Promise.allSettled([
      fetchReports(location),
      fetchHubPosts(location, sort),
      fetchGlimpsePhotos(location),
      bathRequest,
    ]);

    // A slower request from the previous tab must not overwrite newer data.
    if (requestId !== refreshRequestId.current) return;

    if (reportResult.status === "fulfilled") {
      setReports(reportResult.value.reports || []);
    }

    if (postResult.status === "fulfilled") {
      setPosts(postResult.value.posts || []);
    }

    if (photoResult.status === "fulfilled") {
      setPhotos(photoResult.value.photos || []);
    }

    if (shouldFetchBath && bathResult.status === "fulfilled") {
      const bathItems = bathResult.value?.bathing?.nearby || [];
      if (bathItems.length > 0) {
        setBathTemperatures(bathItems);
        setIsBathCacheFallback(false);
        writeBathCache(locationCoordinates.lat, locationCoordinates.lon, bathItems);
      } else {
        const cachedItems = readBathCache(locationCoordinates.lat, locationCoordinates.lon);
        setBathTemperatures(cachedItems);
        setIsBathCacheFallback(cachedItems.length > 0);
      }
    } else if (shouldFetchBath && bathResult.status === "rejected") {
      const cachedItems = readBathCache(locationCoordinates.lat, locationCoordinates.lon);
      if (cachedItems.length > 0) {
        setBathTemperatures(cachedItems);
        setIsBathCacheFallback(true);
      }
    }

    if (
      reportResult.status === "rejected" ||
      postResult.status === "rejected" ||
      photoResult.status === "rejected" ||
      bathResult.status === "rejected"
    ) {
      setNotice({
        severity: "warning",
        text: "Noe av lokaldelen kunne ikke lastes akkurat nå.",
      });
    }

    setIsLoading(false);
    setIsBathLoading(false);
  };

  useEffect(() => {
    refreshCommunityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.name, location.lat, location.lon, sort, refreshKey, activeTab]);

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    const temperature = normalizeTemp(reportForm.temperature);

    if (!reportForm.username.trim() || temperature === null) {
      setNotice({ severity: "info", text: "Skriv navn og temperatur før du sender." });
      return;
    }

    try {
      window.navigator.vibrate?.(12);
      await submitReport({
        username: reportForm.username.trim(),
        temperature,
        condition: reportForm.condition,
        location: location.name,
        lat: location.lat,
        lon: location.lon,
      });
      window.localStorage.setItem(REPORTER_KEY, reportForm.username.trim());
      setReportForm((current) => ({ ...current, temperature: "" }));
      setNotice({ severity: "success", text: "Rapporten er sendt. Takk!" });
      await refreshCommunityData();
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    }
  };

  const handleBathSubmit = async (event) => {
    event.preventDefault();
    const temperature = normalizeTemp(bathForm.temperature);
    const name = bathForm.name.trim();
    const selectedLat = Number(bathForm.lat);
    const selectedLon = Number(bathForm.lon);
    const hasSelectedBathCoordinates =
      bathForm.lat !== null &&
      bathForm.lat !== "" &&
      bathForm.lon !== null &&
      bathForm.lon !== "" &&
      Number.isFinite(selectedLat) &&
      Number.isFinite(selectedLon);

    if (!name || temperature === null) {
      setNotice({
        severity: "info",
        text: "Skriv badeplass og badetemperatur før du sender.",
      });
      return;
    }

    if (temperature < -3 || temperature > 45) {
      setNotice({
        severity: "info",
        text: "Badetemperaturen må være mellom -3 og 45 grader.",
      });
      return;
    }

    if (!hasSelectedBathCoordinates && !locationCoordinates.hasCoordinates) {
      setNotice({
        severity: "info",
        text: "Velg posisjon eller søk opp badeplassen først, så Yr får riktige koordinater.",
      });
      return;
    }

    try {
      setIsBathSubmitting(true);
      window.navigator.vibrate?.(10);
      const result = await submitBathTemperature({
        name,
        temperature,
        lat: hasSelectedBathCoordinates ? selectedLat : locationCoordinates.lat,
        lon: hasSelectedBathCoordinates ? selectedLon : locationCoordinates.lon,
        heatedWater: bathForm.heatedWater,
        reporter: reportForm.username.trim() || profile?.user?.displayName || "",
      });
      setBathForm({ name: "", temperature: "", heatedWater: false, lat: null, lon: null });
      setShowBathReport(false);
      setNotice({
        severity: "success",
        text: result.message || "Badetemperaturen er sendt til Yr.",
      });
      await refreshCommunityData();
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    } finally {
      setIsBathSubmitting(false);
    }
  };

  const selectBathForReport = (bath) => {
    setBathForm((current) => ({
      ...current,
      name: bath.name || "",
      lat: bath.lat ?? null,
      lon: bath.lon ?? null,
    }));
    setShowBathReport(true);
    window.navigator.vibrate?.(8);
    window.setTimeout(() => {
      document.getElementById("bath-report-form")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  };

  const handleProfileAction = async (action) => {
    try {
      const result = await loginHubProfile(
        profileForm.displayName.trim(),
        profileForm.pin.trim(),
        action
      );
      const nextProfile = { user: result.user, token: result.token };
      setProfile(nextProfile);
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      setVotedPosts(getStoredVotes(nextProfile.user.id));
      setProfileForm({ displayName: "", pin: "" });
      setNotice({ severity: "success", text: result.message || "Profilen er klar." });
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    await handleProfileAction("login");
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setNotice({ severity: "info", text: "Velg en bildefil." });
      return;
    }

    if (file.size > MAX_CLIENT_IMAGE_BYTES) {
      setNotice({ severity: "info", text: "Bildet er for stort. Velg et bilde under 10 MB." });
      return;
    }

    try {
      const compressed = await compressImageFile(file);
      const previewUrl = URL.createObjectURL(compressed);
      setSnapForm((current) => {
        if (current.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }
        return { ...current, file: compressed, previewUrl };
      });
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    }
  };

  const clearPhoto = () => {
    setSnapForm((current) => {
      if (current.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return { ...current, file: null, previewUrl: "" };
    });
  };

  const handleSnapSubmit = async (event) => {
    event.preventDefault();

    if (isGlimpseSubmitting) return;

    if (!profile) {
      setNotice({ severity: "info", text: "Logg inn med navn og PIN før du sender værglimt." });
      return;
    }

    try {
      setIsGlimpseSubmitting(true);
      if (snapForm.file) {
        const formData = new FormData();
        formData.append("userId", profile.user.id);
        formData.append("token", profile.token);
        formData.append("snapType", selectedSnapType.value);
        formData.append("title", selectedSnapType.title);
        formData.append("note", snapForm.note.trim() || selectedSnapType.body);
        formData.append("location", location.name);
        if (location.lat !== undefined && location.lat !== null) {
          formData.append("lat", location.lat);
        }
        if (location.lon !== undefined && location.lon !== null) {
          formData.append("lon", location.lon);
        }
        formData.append("ttlHours", snapForm.ttlHours);
        formData.append("image", snapForm.file, snapForm.file.name || "vaerglimt.jpg");

        await uploadGlimpsePhoto(formData);
        clearPhoto();
        setSnapForm((current) => ({ ...current, note: "" }));
        setNotice({ severity: "success", text: "Bildeglimtet er publisert." });
      } else {
        await createHubPost({
          userId: profile.user.id,
          token: profile.token,
          title: selectedSnapType.title,
          body: snapForm.note.trim() || selectedSnapType.body,
          category: selectedSnapType.category,
          location: location.name,
          lat: location.lat,
          lon: location.lon,
          weatherCondition: selectedSnapType.label || getWeatherSummary(weather),
          temperature: getWeatherTemp(weather),
        });
        setSnapForm((current) => ({ ...current, note: "" }));
        setNotice({ severity: "success", text: "Værglimtet er publisert." });
      }
      setIsGlimpseComposerOpen(false);
      await refreshCommunityData();
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    } finally {
      setIsGlimpseSubmitting(false);
    }
  };

  const isOwnPost = (post) => {
    if (!profile || !post) {
      return false;
    }
    if (post.userId !== undefined && post.userId !== null) {
      return String(post.userId) === String(profile.user.id);
    }
    return Boolean(post.displayName) && post.displayName === profile.user.displayName;
  };

  const handleVote = async (postId, vote) => {
    if (!profile) {
      setNotice({ severity: "info", text: "Logg inn med navn og PIN for å stemme." });
      return;
    }

    const targetPost = posts.find((post) => post.id === postId);
    if (isOwnPost(targetPost)) {
      setNotice({ severity: "info", text: "Du kan ikke stemme på ditt eget værglimt." });
      return;
    }

    const alreadyVoted = votedPosts[postId] === vote;
    const nextVote = alreadyVoted ? 0 : vote;

    try {
      const result = await voteHubPost({
        userId: profile.user.id,
        token: profile.token,
        postId,
        vote: nextVote,
      });
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, score: result.score, voteCount: result.voteCount }
            : post
        )
      );
      setVotedPosts((current) => {
        const next = { ...current };
        if (nextVote === 0) {
          delete next[postId];
        } else {
          next[postId] = nextVote;
        }
        setStoredVotes(profile.user.id, next);
        return next;
      });
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    }
  };

  const logout = () => {
    setProfile(null);
    setVotedPosts({});
    window.localStorage.removeItem(PROFILE_KEY);
    setNotice({ severity: "info", text: "Du er logget ut av Værglimt." });
  };

  return (
    <Grid item xs={12} sx={{ mt: { xs: 2.5, md: 3.5 }, mb: { xs: 8, md: 3 } }}>
      <Stack spacing={2}>
        {notice && (
          <Alert
            severity={notice.severity}
            onClose={() => setNotice(null)}
            sx={{
              borderRadius: "16px",
              backgroundColor: "rgba(9, 16, 36, .92)",
              color: "rgba(255,255,255,.88)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            {notice.text}
          </Alert>
        )}

        {activeTab === "local" && (
          <Box sx={sectionSx}>
            <SectionHeading
              title="Lokalt fra Værvakt"
              subtitle={`Rapporter og observasjoner nær ${location.name}.`}
              action={
                <WeatherPillButton onClick={refreshCommunityData} disabled={isLoading}>
                  Oppdater
                </WeatherPillButton>
              }
            />

          <Grid
            container
            rowSpacing={1.4}
            columnSpacing={{ xs: 0, md: 1.4 }}
            alignItems="stretch"
            sx={{ width: "100%", minWidth: 0, margin: 0 }}
          >
            <Grid item xs={12} md={5}>
              <Stack component="form" spacing={1.2} onSubmit={handleReportSubmit} sx={{ ...cardSx, p: 1.5, height: "100%" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Box>
                    <Typography sx={{ color: "white", fontWeight: 700, fontSize: "0.96rem" }}>
                      Send værrapport
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,.46)", fontSize: "0.75rem" }}>
                      Vises sammen med varselet for stedet ditt.
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: "1.8rem", lineHeight: 1 }}>🌡️</Typography>
                </Stack>

                <TextField
                  label="Navn"
                  value={reportForm.username}
                  onChange={(event) =>
                    setReportForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  fullWidth
                  sx={inputSx}
                />

                <Stack direction={{ xs: "column", sm: "row", md: "column", lg: "row" }} spacing={1}>
                  <TextField
                    label="Temperatur"
                    value={reportForm.temperature}
                    onChange={(event) =>
                      setReportForm((current) => ({
                        ...current,
                        temperature: event.target.value,
                      }))
                    }
                    fullWidth
                    inputProps={{ inputMode: "decimal" }}
                    sx={inputSx}
                  />
                  <TextField
                    select
                    label="Værtype"
                    value={reportForm.condition}
                    onChange={(event) =>
                      setReportForm((current) => ({
                        ...current,
                        condition: event.target.value,
                      }))
                    }
                    fullWidth
                    SelectProps={{ MenuProps: selectMenuProps }}
                    sx={inputSx}
                  >
                    {CONDITIONS.map((condition) => (
                      <MenuItem key={condition.value} value={condition.value}>
                        {condition.icon} {condition.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                  sx={{
                    borderRadius: "14px",
                    py: 1.05,
                    color: "#06111f",
                    fontWeight: 800,
                    background: "linear-gradient(135deg, #7dd3fc, #38bdf8)",
                    boxShadow: "0 10px 24px rgba(56, 189, 248, .18)",
                    textTransform: "none",
                    "&:hover": {
                      background: "linear-gradient(135deg, #bae6fd, #38bdf8)",
                    },
                  }}
                >
                  Send værrapport
                </Button>
              </Stack>
            </Grid>

            <Grid item xs={12} md={7}>
              <Stack spacing={0.8}>
                {reports.length === 0 && (
                  <EmptyState>Ingen lokale rapporter her enda. Bli førstemann.</EmptyState>
                )}
                {reports.map((report) => (
                  <Stack
                    key={report.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1.5}
                    sx={{
                      ...cardSx,
                      px: { xs: 1.2, sm: 1.5 },
                      py: 1.05,
                    }}
                  >
                    <Stack direction="row" alignItems="center" gap={1.1} minWidth={0}>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          flex: "0 0 auto",
                          borderRadius: "14px",
                          display: "grid",
                          placeItems: "center",
                          background:
                            "radial-gradient(circle at 35% 30%, rgba(255,255,255,.22), rgba(56,189,248,.08) 55%, rgba(255,255,255,.04))",
                          fontSize: "1.25rem",
                        }}
                      >
                        {report.icon || getConditionIcon(report.condition)}
                      </Box>
                      <Box minWidth={0}>
                        <Typography sx={{ color: "white", fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.2 }}>
                          {report.condition}
                        </Typography>
                        <Typography
                          noWrap
                          sx={{ color: "rgba(255,255,255,.45)", fontSize: "0.72rem", mt: 0.35 }}
                        >
                          {report.reporter} · {report.location} · {report.time}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography sx={{ color: "white", fontWeight: 800, fontSize: "1rem" }}>
                      {report.temp}°
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
          </Box>
        )}

        {activeTab === "bath" && (
          <>
            <Box sx={sectionSx}>
              <SectionHeading
                title="Bad i nærheten"
                subtitle={`Målinger rundt ${location.name}. Ferske målinger prioriteres.`}
                action={
                  <WeatherPillButton onClick={refreshCommunityData} disabled={isBathLoading || isLoading}>
                    {isBathLoading ? "Henter..." : "Oppdater"}
                  </WeatherPillButton>
                }
              />
              <Stack spacing={1.1}>
                {isBathCacheFallback && bathTemperatures.length > 0 && (
                  <Alert severity="info" sx={{ borderRadius: "14px", py: 0.15 }}>
                    Viser sist hentede målinger mens Yr oppdateres.
                  </Alert>
                )}
                {isBathLoading && <EmptyState>Laster badetemperaturer i nærheten...</EmptyState>}

                {!isBathLoading && bathTemperatures.length === 0 && (
                  <EmptyState>
                    Ingen ferske målinger innenfor 50 km akkurat nå. Du kan fortsatt registrere en måling nedenfor.
                  </EmptyState>
                )}

                {!isBathLoading && nearestBath &&
                  ((bath) => {
                    const comfort = getBathComfort(bath.temperature);
                    const freshness = getBathFreshness(bath.time);
                    return (
                      <Box
                        sx={{
                          ...cardSx,
                          p: { xs: 1.45, sm: 1.9 },
                          overflow: "hidden",
                          background:
                            "radial-gradient(circle at 88% 12%, rgba(103,232,249,.28), transparent 34%), linear-gradient(135deg, rgba(14,165,233,.24), rgba(9,16,36,.9) 62%)",
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.4}>
                          <Box minWidth={0}>
                            <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 0.8 }}>
                              <Chip
                                label={freshness.fresh ? "Fersk nær deg" : "Nærmest"}
                                size="small"
                                sx={{ color: "#06111f", backgroundColor: "#67e8f9", fontWeight: 900 }}
                              />
                              <Chip
                                label={freshness.label}
                                size="small"
                                sx={{
                                  color: freshness.fresh ? "#bbf7d0" : "#fde68a",
                                  backgroundColor: freshness.fresh ? "rgba(34,197,94,.12)" : "rgba(245,158,11,.12)",
                                  fontWeight: 750,
                                }}
                              />
                            </Stack>
                            <Typography sx={{ color: "white", fontWeight: 900, fontSize: { xs: "1.05rem", sm: "1.2rem" } }}>
                              {bath.name}
                            </Typography>
                            <Typography sx={{ color: "rgba(255,255,255,.55)", fontSize: "0.78rem", mt: 0.35 }}>
                              {[bath.municipality, formatBathDistance(bath.distanceKm)].filter(Boolean).join(" · ")}
                            </Typography>
                          </Box>
                          <Box textAlign="right" flex="0 0 auto">
                            <Typography sx={{ color: "white", fontWeight: 950, fontSize: { xs: "2.1rem", sm: "2.5rem" }, lineHeight: 0.95 }}>
                              {formatBathTemperature(bath.temperature)}°
                            </Typography>
                            <Typography sx={{ color: comfort.color, fontSize: "0.75rem", mt: 0.55, fontWeight: 900 }}>
                              {comfort.label}
                            </Typography>
                          </Box>
                        </Stack>
                        <Button
                          type="button"
                          onClick={() => selectBathForReport(bath)}
                          sx={{ mt: 1.25, px: 0, minHeight: 0, color: "#7dd3fc", fontWeight: 850, textTransform: "none" }}
                        >
                          Rapporter ny måling her →
                        </Button>
                      </Box>
                    );
                  })(nearestBath)}

                {!isBathLoading && bathTemperatures.length > 1 && (
                  <>
                    <TextField
                      value={bathSearch}
                      onChange={(event) => {
                        setBathSearch(event.target.value);
                        setShowAllBaths(false);
                      }}
                      placeholder="Filtrer badeplasser i nærheten"
                      inputProps={{ "aria-label": "Filtrer badeplasser" }}
                      fullWidth
                      sx={inputSx}
                    />
                    <Stack spacing={0.8}>
                      {visibleBaths.map((bath) => {
                        const comfort = getBathComfort(bath.temperature);
                        const freshness = getBathFreshness(bath.time);
                        return (
                          <Stack
                            key={`${bath.locationId || bath.name}-${bath.time}`}
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            gap={1}
                            sx={{ ...cardSx, px: 1.15, py: 1 }}
                          >
                            <Box minWidth={0}>
                              <Typography noWrap sx={{ color: "white", fontWeight: 850, fontSize: "0.88rem" }}>
                                {bath.name}
                              </Typography>
                              <Typography noWrap sx={{ color: "rgba(255,255,255,.45)", fontSize: "0.7rem", mt: 0.3 }}>
                                {[formatBathDistance(bath.distanceKm), freshness.label].filter(Boolean).join(" · ")}
                              </Typography>
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={1} flex="0 0 auto">
                              <Box textAlign="right">
                                <Typography sx={{ color: "white", fontWeight: 900 }}>{formatBathTemperature(bath.temperature)}°</Typography>
                                <Typography sx={{ color: comfort.color, fontSize: "0.65rem", fontWeight: 850 }}>{comfort.label}</Typography>
                              </Box>
                              <WeatherPillButton type="button" onClick={() => selectBathForReport(bath)}>
                                Velg
                              </WeatherPillButton>
                            </Stack>
                          </Stack>
                        );
                      })}
                      {visibleBaths.length === 0 && <EmptyState>Ingen badeplasser matcher søket.</EmptyState>}
                    </Stack>
                    {bathList.length > 4 && (
                      <WeatherPillButton type="button" onClick={() => setShowAllBaths((value) => !value)}>
                        {showAllBaths ? "Vis færre" : `Vis alle ${bathList.length}`}
                      </WeatherPillButton>
                    )}
                  </>
                )}

                {bathTemperatures.length > 0 && (
                  <Typography sx={{ color: "rgba(255,255,255,.38)", fontSize: "0.68rem", px: 0.35 }}>
                    Badetemperaturer levert av Yr. Måletidspunkt vises på hver badeplass.
                  </Typography>
                )}

                <Button
                  type="button"
                  onClick={() => setShowBathReport((value) => !value)}
                  sx={{
                    borderRadius: "14px",
                    py: 1.05,
                    color: showBathReport ? "rgba(255,255,255,.75)" : "#06111f",
                    fontWeight: 900,
                    background: showBathReport ? "rgba(255,255,255,.06)" : "linear-gradient(135deg, #67e8f9, #38bdf8)",
                    textTransform: "none",
                  }}
                >
                  {showBathReport ? "Lukk registrering" : "＋ Registrer badetemperatur"}
                </Button>

                {showBathReport && (
                  <Stack
                    id="bath-report-form"
                    component="form"
                    spacing={1.2}
                    onSubmit={handleBathSubmit}
                    sx={{ ...cardSx, p: { xs: 1.35, sm: 1.6 }, background: "rgba(14,165,233,.08)" }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                      <Box>
                        <Typography sx={{ color: "white", fontWeight: 850 }}>Registrer måling</Typography>
                        <Typography sx={{ color: "rgba(255,255,255,.45)", fontSize: "0.72rem", mt: 0.25 }}>
                          Målingen sendes videre til Yr.
                        </Typography>
                      </Box>
                      {bathForm.lat !== null && <Chip label="Valgt fra Yr" size="small" sx={{ color: "#bae6fd", backgroundColor: "rgba(14,165,233,.12)" }} />}
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="Badeplass"
                        placeholder="For eksempel Bystranda"
                        value={bathForm.name}
                        onChange={(event) => setBathForm((current) => ({ ...current, name: event.target.value, lat: null, lon: null }))}
                        inputProps={{ maxLength: 140 }}
                        fullWidth
                        sx={inputSx}
                      />
                      <TextField
                        label="Badetemp °C"
                        placeholder="19,5"
                        value={bathForm.temperature}
                        onChange={(event) => setBathForm((current) => ({ ...current, temperature: event.target.value }))}
                        inputProps={{ inputMode: "decimal", min: -3, max: 45, step: 0.1 }}
                        fullWidth
                        sx={inputSx}
                      />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
                      <Typography sx={{ color: "rgba(255,255,255,.48)", fontSize: "0.72rem" }}>
                        {bathForm.lat !== null ? `Bruker koordinatene til ${bathForm.name}.` : `Bruker valgt sted: ${location.name}.`}
                      </Typography>
                      <FormControlLabel
                        control={<Switch checked={bathForm.heatedWater} onChange={(event) => setBathForm((current) => ({ ...current, heatedWater: event.target.checked }))} size="small" />}
                        label="Oppvarmet vann"
                        sx={{ color: "rgba(255,255,255,.68)", m: 0, "& .MuiFormControlLabel-label": { fontSize: "0.76rem", fontWeight: 700 } }}
                      />
                    </Stack>
                    <Button type="submit" variant="contained" disabled={isBathSubmitting} sx={{ borderRadius: "14px", py: 1.05, color: "#06111f", fontWeight: 900, background: "linear-gradient(135deg, #67e8f9, #38bdf8)", textTransform: "none" }}>
                      {isBathSubmitting ? "Sender til Yr..." : "Send måling"}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Box>

            <Box
              sx={{
                ...cardSx,
                p: { xs: 1.4, sm: 1.6 },
                borderRadius: { xs: "18px", sm: "22px" },
                background:
                  "linear-gradient(135deg, rgba(255,91,36,.17), rgba(255,45,85,.08) 48%, rgba(9,16,36,.82))",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
                gap={1.4}
              >
                <Box>
                  <Typography sx={{ color: "white", fontWeight: 800, fontSize: "0.98rem" }}>
                    Hold Værvakt annonsefri
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,.52)", fontSize: "0.78rem", mt: 0.3 }}>
                    Vipps-støtte går til drift, API-er og videre utvikling.
                  </Typography>
                </Box>
                <Button
                  component="a"
                  href={VIPPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    borderRadius: "14px",
                    px: 2.2,
                    py: 1,
                    color: "#fff",
                    fontWeight: 900,
                    background: "linear-gradient(135deg, #ff7a3d, #ff2d55)",
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    "&:hover": {
                      background: "linear-gradient(135deg, #ff8f5c, #ff4770)",
                    },
                  }}
                >
                  Støtt med Vipps
                </Button>
              </Stack>
            </Box>
          </>
        )}

        {activeTab === "glimpse" && (
          <Box sx={sectionSx}>
            <SectionHeading
              title="Værglimt"
              subtitle={`${photos.length + posts.length} lokale glimt rundt ${location.name}.`}
              action={
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <WeatherPillButton onClick={refreshCommunityData} disabled={isLoading}>
                    {isLoading ? "Henter..." : "Oppdater"}
                  </WeatherPillButton>
                  <WeatherPillButton
                    selected={isGlimpseComposerOpen}
                    onClick={() => setIsGlimpseComposerOpen((value) => !value)}
                  >
                    {isGlimpseComposerOpen ? "Lukk" : "＋ Nytt glimt"}
                  </WeatherPillButton>
                </Stack>
              }
            />

            <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 1.35 }}>
              <WeatherPillButton selected={glimpseFilter === "all"} onClick={() => setGlimpseFilter("all")}>
                Alle {photos.length + posts.length}
              </WeatherPillButton>
              <WeatherPillButton selected={glimpseFilter === "photos"} onClick={() => setGlimpseFilter("photos")}>
                Bilder {photos.length}
              </WeatherPillButton>
              <WeatherPillButton selected={glimpseFilter === "posts"} onClick={() => setGlimpseFilter("posts")}>
                Tekst {posts.length}
              </WeatherPillButton>
              <Box sx={{ flex: 1 }} />
              <WeatherPillButton selected={sort === "new"} onClick={() => setSort("new")}>
                Fersk
              </WeatherPillButton>
              <WeatherPillButton selected={sort === "top"} onClick={() => setSort("top")}>
                Nyttig
              </WeatherPillButton>
            </Stack>

          <Grid
            container
            rowSpacing={1.4}
            columnSpacing={{ xs: 0, md: 1.4 }}
            sx={{ width: "100%", minWidth: 0, margin: 0 }}
          >
            {isGlimpseComposerOpen && (
            <Grid item xs={12} md={5}>
              <Stack spacing={1.2} sx={{ ...cardSx, p: 1.5 }}>
                {!profile ? (
                  <Stack component="form" spacing={1.15} onSubmit={handleProfileSubmit}>
                    <Box>
                      <Typography sx={{ color: "white", fontWeight: 700, fontSize: "0.94rem" }}>
                        Visningsnavn
                      </Typography>
                      <Typography sx={{ color: "rgba(255,255,255,.45)", fontSize: "0.74rem", mt: 0.25 }}>
                        Bruk bare navn og PIN for å sende bildeglimt. Ingen e-post eller tracking-konto.
                      </Typography>
                    </Box>
                    <TextField
                      label="Navn"
                      value={profileForm.displayName}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          displayName: event.target.value,
                        }))
                      }
                      fullWidth
                      sx={inputSx}
                    />
                    <TextField
                      label="PIN"
                      type="password"
                      value={profileForm.pin}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          pin: event.target.value,
                        }))
                      }
                      fullWidth
                      inputProps={{ inputMode: "numeric" }}
                      sx={inputSx}
                    />
                    <Stack direction="row" spacing={1}>
                      <WeatherPillButton type="submit" selected>
                        Fortsett
                      </WeatherPillButton>
                      <WeatherPillButton type="button" onClick={() => handleProfileAction("register")}>
                        Opprett
                      </WeatherPillButton>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack component="form" spacing={1.15} onSubmit={handleSnapSubmit}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                      <Box>
                        <Typography sx={{ color: "white", fontWeight: 700, fontSize: "0.94rem" }}>
                          Hva skjer ute?
                        </Typography>
                        <Typography sx={{ color: "rgba(255,255,255,.45)", fontSize: "0.74rem", mt: 0.25 }}>
                          Poster som {profile.user.displayName}.
                        </Typography>
                      </Box>
                      <WeatherPillButton type="button" onClick={logout}>
                        Bytt
                      </WeatherPillButton>
                    </Stack>

                    <Box
                      sx={{
                        position: "relative",
                        minWidth: 0,
                        mx: { xs: -0.25, sm: -0.35 },
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          top: 0,
                          right: 0,
                          bottom: 6,
                          width: 34,
                          pointerEvents: "none",
                          borderRadius: "0 18px 18px 0",
                          background:
                            "linear-gradient(90deg, rgba(7,12,27,0), rgba(7,12,27,.86))",
                        },
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{
                          maxWidth: "100%",
                          overflowX: "auto",
                          overflowY: "hidden",
                          px: { xs: 0.25, sm: 0.35 },
                          pb: 0.8,
                          scrollbarWidth: "none",
                          scrollSnapType: "x proximity",
                          WebkitOverflowScrolling: "touch",
                          "&::-webkit-scrollbar": { display: "none" },
                        }}
                      >
                        {SNAP_TYPES.map((type) => (
                          <SnapTypeButton
                            key={type.value}
                            type={type}
                            selected={snapForm.type === type.value}
                            onClick={() =>
                              setSnapForm((current) => ({ ...current, type: type.value }))
                            }
                          />
                        ))}
                      </Stack>
                    </Box>

                    <Stack spacing={1}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                        <Typography sx={{ color: "rgba(255,255,255,.68)", fontSize: "0.78rem", fontWeight: 700 }}>
                          Bildeglimt
                        </Typography>
                        <Typography sx={{ color: "rgba(255,255,255,.42)", fontSize: "0.72rem" }}>
                          Slettes etter valgt tid
                        </Typography>
                      </Stack>

                      {snapForm.previewUrl ? (
                        <Box
                          sx={{
                            position: "relative",
                            overflow: "hidden",
                            borderRadius: "20px",
                            border: "1px solid rgba(255,255,255,.1)",
                            minHeight: 190,
                            backgroundColor: "rgba(255,255,255,.04)",
                          }}
                        >
                          <Box
                            component="img"
                            src={snapForm.previewUrl}
                            alt="Forhåndsvisning av bildeglimt"
                            sx={{
                              display: "block",
                              width: "100%",
                              maxHeight: 260,
                              objectFit: "cover",
                            }}
                          />
                          <Button
                            type="button"
                            onClick={clearPhoto}
                            sx={{
                              position: "absolute",
                              top: 10,
                              right: 10,
                              minWidth: "auto",
                              borderRadius: "999px",
                              px: 1.2,
                              color: "white",
                              backgroundColor: "rgba(2,6,23,.72)",
                              textTransform: "none",
                              "&:hover": { backgroundColor: "rgba(2,6,23,.88)" },
                            }}
                          >
                            Fjern
                          </Button>
                        </Box>
                      ) : (
                        <Button
                          component="label"
                          type="button"
                          sx={{
                            borderRadius: "18px",
                            py: 1.8,
                            color: "rgba(255,255,255,.86)",
                            border: "1px dashed rgba(255,255,255,.18)",
                            background:
                              "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025))",
                            textTransform: "none",
                            fontWeight: 800,
                            "&:hover": {
                              background:
                                "linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,.04))",
                            },
                          }}
                        >
                          📷 Ta eller velg bilde
                          <input
                            hidden
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            onChange={handlePhotoChange}
                          />
                        </Button>
                      )}

                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {GLIMPSE_TTLS.map((ttl) => (
                          <WeatherPillButton
                            key={ttl.hours}
                            type="button"
                            selected={snapForm.ttlHours === ttl.hours}
                            onClick={() =>
                              setSnapForm((current) => ({ ...current, ttlHours: ttl.hours }))
                            }
                          >
                            {ttl.label}
                          </WeatherPillButton>
                        ))}
                      </Stack>
                    </Stack>

                    <TextField
                      label="Legg til kort tekst"
                      placeholder="F.eks. plutselig regn ved sentrum"
                      value={snapForm.note}
                      onChange={(event) =>
                        setSnapForm((current) => ({ ...current, note: event.target.value }))
                      }
                      multiline
                      minRows={2}
                      helperText={`${snapForm.note.length}/180 tegn`}
                      inputProps={{ maxLength: 180 }}
                      fullWidth
                      sx={inputSx}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isGlimpseSubmitting}
                      sx={{
                        borderRadius: "14px",
                        py: 1.05,
                        color: "#06111f",
                        fontWeight: 900,
                        background: "linear-gradient(135deg, #7dd3fc, #38bdf8)",
                        textTransform: "none",
                        "&:hover": {
                          background: "linear-gradient(135deg, #bae6fd, #38bdf8)",
                        },
                      }}
                    >
                      {isGlimpseSubmitting
                        ? "Publiserer..."
                        : `Publiser ${selectedSnapType.icon} ${snapForm.file ? "bildeglimt" : "værglimt"}`}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Grid>
            )}

            <Grid item xs={12} md={isGlimpseComposerOpen ? 7 : 12}>
              <Stack spacing={0.9}>
                {isLoading && photos.length === 0 && posts.length === 0 && (
                  <EmptyState>Henter lokale værglimt...</EmptyState>
                )}

                {visiblePhotos.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      overflowX: "auto",
                      pb: 0.5,
                      scrollbarWidth: "none",
                      "&::-webkit-scrollbar": { display: "none" },
                    }}
                  >
                    {visiblePhotos.map((photo) => {
                      const snapType =
                        SNAP_TYPES.find((type) => type.value === photo.snapType) ||
                        getSnapTypeForPost({
                          title: photo.title,
                          body: photo.note,
                          category: "general",
                          weatherCondition: photo.snapType,
                        });

                      return (
                        <Box
                          component="button"
                          type="button"
                          key={photo.id}
                          onClick={() => setSelectedPhoto(photo)}
                          aria-label={`Åpne bildeglimt: ${photo.title}`}
                          sx={{
                            position: "relative",
                            flex: "0 0 172px",
                            height: 246,
                            overflow: "hidden",
                            borderRadius: "24px",
                            border: "1px solid rgba(255,255,255,.12)",
                            backgroundColor: "rgba(7,12,27,.9)",
                            boxShadow: "0 18px 36px rgba(2,6,23,.26)",
                            p: 0,
                            color: "inherit",
                            textAlign: "left",
                            font: "inherit",
                            cursor: "pointer",
                            "&:focus-visible": { outline: "2px solid #7dd3fc", outlineOffset: 2 },
                          }}
                        >
                          <Box
                            component="img"
                            src={photo.imageUrl}
                            alt={photo.title}
                            loading="lazy"
                            sx={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              background:
                                "linear-gradient(180deg, rgba(2,6,23,.15), rgba(2,6,23,.2) 42%, rgba(2,6,23,.88))",
                            }}
                          />
                          <Stack
                            justifyContent="space-between"
                            sx={{
                              position: "absolute",
                              inset: 0,
                              p: 1.15,
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography sx={{ fontSize: "1.55rem", lineHeight: 1 }}>
                                {snapType.icon}
                              </Typography>
                              <Chip
                                label={formatExpiry(photo.expiresAt)}
                                size="small"
                                sx={{
                                  height: 22,
                                  borderRadius: "999px",
                                  color: "#06111f",
                                  backgroundColor: "rgba(186,230,253,.86)",
                                  fontSize: "0.66rem",
                                  fontWeight: 900,
                                }}
                              />
                            </Stack>
                            <Box>
                              <Typography sx={{ color: "white", fontWeight: 900, fontSize: "0.95rem", lineHeight: 1.15 }}>
                                {photo.title}
                              </Typography>
                              {photo.note && (
                                <Typography sx={{ color: "rgba(255,255,255,.78)", fontSize: "0.75rem", mt: 0.35, lineHeight: 1.35 }}>
                                  {photo.note}
                                </Typography>
                              )}
                              <Typography noWrap sx={{ color: "rgba(255,255,255,.58)", fontSize: "0.68rem", mt: 0.55 }}>
                                {photo.displayName} · {photo.location}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}

                {!isLoading && visiblePosts.length === 0 && visiblePhotos.length === 0 && (
                  <EmptyState>
                    {glimpseFilter === "all"
                      ? "Ingen værglimt i nærheten enda. Send det første."
                      : "Ingen glimt i dette filteret enda."}
                  </EmptyState>
                )}
                {visiblePosts.map((post) => {
                  const snapType = getSnapTypeForPost(post);
                  return (
                    <Box
                      key={post.id}
                      sx={{
                        ...cardSx,
                        p: 1.25,
                        background:
                          "linear-gradient(135deg, rgba(56,189,248,.1), rgba(9,16,36,.86) 40%, rgba(7,12,27,.92))",
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1.4}>
                        <Stack direction="row" spacing={1.15} minWidth={0}>
                          <Box
                            sx={{
                              width: 54,
                              height: 70,
                              flex: "0 0 auto",
                              borderRadius: "22px",
                              display: "grid",
                              placeItems: "center",
                              background:
                                "radial-gradient(circle at 35% 25%, rgba(255,255,255,.28), rgba(56,189,248,.14) 52%, rgba(255,255,255,.05))",
                              border: "1px solid rgba(255,255,255,.1)",
                              fontSize: "1.75rem",
                            }}
                          >
                            {snapType.icon}
                          </Box>
                          <Box minWidth={0}>
                            <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.55 }}>
                              <Chip
                                label={getCategoryLabel(post.category)}
                                size="small"
                                sx={{
                                  height: "21px",
                                  borderRadius: "999px",
                                  color: "#7dd3fc",
                                  backgroundColor: "rgba(56,189,248,.1)",
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                }}
                              />
                              <Typography sx={{ color: "rgba(255,255,255,.42)", fontSize: "0.72rem" }}>
                                {post.time}
                              </Typography>
                            </Stack>
                            <Typography sx={{ color: "white", fontWeight: 800, fontSize: "0.96rem", lineHeight: 1.2 }}>
                              {post.title}
                            </Typography>
                            <Typography sx={{ color: "rgba(255,255,255,.66)", fontSize: "0.82rem", mt: 0.45, lineHeight: 1.45 }}>
                              {post.body}
                            </Typography>
                            <Typography noWrap sx={{ color: "rgba(255,255,255,.42)", fontSize: "0.72rem", mt: 0.75 }}>
                              {post.displayName} · {post.location}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack alignItems="center" justifyContent="center" spacing={0.45} sx={{ flex: "0 0 auto" }}>
                          <Button
                            size="small"
                            disabled={isOwnPost(post)}
                            onClick={() => handleVote(post.id, 1)}
                            title={
                              isOwnPost(post)
                                ? "Du kan ikke stemme på ditt eget værglimt."
                                : votedPosts[post.id] === 1
                                ? "Fjern stemmen din"
                                : "Stem opp"
                            }
                            sx={{
                              minWidth: 0,
                              width: 36,
                              height: 36,
                              borderRadius: "999px",
                              color: votedPosts[post.id] === 1 ? "white" : "#06111f",
                              backgroundColor: votedPosts[post.id] === 1 ? "#0ea5e9" : "#7dd3fc",
                              fontWeight: 900,
                              "&:hover": {
                                backgroundColor: votedPosts[post.id] === 1 ? "#0284c7" : "#bae6fd",
                              },
                              "&.Mui-disabled": {
                                color: "rgba(6,17,31,.5)",
                                backgroundColor: "rgba(125,211,252,.35)",
                              },
                            }}
                          >
                            👍
                          </Button>
                          <Typography sx={{ color: "white", fontWeight: 900, fontSize: "0.82rem" }}>
                            {post.score}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Grid>
          </Grid>
          </Box>
        )}

        <Dialog
          open={Boolean(selectedPhoto)}
          onClose={() => setSelectedPhoto(null)}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              m: { xs: 1.25, sm: 2 },
              maxHeight: "calc(100svh - 24px)",
              overflow: "hidden",
              borderRadius: { xs: "22px", sm: "28px" },
              background: "#07101f",
              color: "white",
              border: "1px solid rgba(255,255,255,.12)",
              boxShadow: "0 28px 80px rgba(0,0,0,.55)",
            },
          }}
        >
          {selectedPhoto && (
            <Box>
              <Box
                component="img"
                src={selectedPhoto.imageUrl}
                alt={selectedPhoto.title}
                sx={{ display: "block", width: "100%", maxHeight: "68svh", objectFit: "contain", backgroundColor: "#020617" }}
              />
              <Stack spacing={0.7} sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box minWidth={0}>
                    <Typography sx={{ color: "white", fontWeight: 900, fontSize: "1.05rem" }}>
                      {selectedPhoto.title}
                    </Typography>
                    {selectedPhoto.note && (
                      <Typography sx={{ color: "rgba(255,255,255,.68)", fontSize: "0.82rem", mt: 0.4 }}>
                        {selectedPhoto.note}
                      </Typography>
                    )}
                  </Box>
                  <WeatherPillButton type="button" onClick={() => setSelectedPhoto(null)}>
                    Lukk
                  </WeatherPillButton>
                </Stack>
                <Typography sx={{ color: "rgba(255,255,255,.45)", fontSize: "0.72rem" }}>
                  {selectedPhoto.displayName} · {selectedPhoto.location} · {formatExpiry(selectedPhoto.expiresAt)}
                </Typography>
              </Stack>
            </Box>
          )}
        </Dialog>
      </Stack>
    </Grid>
  );
}

export default VaervaktFeatures;
