import React, { useEffect, useRef, useState } from "react";
import { Box, Button, Container, Grid, Link, SvgIcon, Typography } from "@mui/material";
import Search from "./components/Search/Search";
import WeeklyForecast from "./components/WeeklyForecast/WeeklyForecast";
import TodayWeather from "./components/TodayWeather/TodayWeather";
import { fetchWeatherData, reverseGeocode } from "./api/OpenWeatherService";
import { trackVisit } from "./api/VaervaktApi";
import UTCDatetime from "./components/Reusable/UTCDatetime";
import LoadingBox from "./components/Reusable/LoadingBox";
import { ReactComponent as SplashIcon } from "./assets/splash-icon.svg";
import Logo from "./assets/logo3.png";
import ErrorBox from "./components/Reusable/ErrorBox";
import VaervaktFeatures from "./components/VaervaktFeatures/VaervaktFeatures";
import { ALL_DESCRIPTIONS } from "./utilities/DateConstants";
import GitHubIcon from "@mui/icons-material/GitHub";
import {
  getTodayForecastWeather,
  getWeekForecastWeather,
} from "./utilities/DataUtils";

const APP_TABS = [
  { value: "weather", label: "Vær", icon: "☁️", path: "/" },
  { value: "local", label: "Lokalt", icon: "📍", path: "/lokalt/" },
  { value: "bath", label: "Bad", icon: "🌊", path: "/bad/" },
  { value: "glimpse", label: "Glimt", icon: "⚡", path: "/glimt/" },
];

const VIPPS_URL = "https://betal.vipps.no/opy01u";
const PULL_TRIGGER_DISTANCE = 74;
const PULL_MAX_DISTANCE = 96;

function isBathSeason(date = new Date()) {
  const month = date.getMonth();
  return month >= 4 && month <= 8;
}

function getTabFromPath(pathname = window.location.pathname) {
  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return APP_TABS.find((tab) => tab.path === normalizedPath)?.value || "weather";
}

function requestBestPosition({
  timeout = 10000,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );
  });
}

function getPositionStatusMessage(error) {
  if (error?.message === "unsupported") {
    return "Nettleseren støtter ikke posisjon.";
  }

  if (error?.code === 1) {
    return "Posisjon er avslått. Søk etter sted i stedet.";
  }

  if (error?.code === 2) {
    return "Fant ikke posisjonen akkurat nå. Prøv igjen eller søk etter sted.";
  }

  if (error?.code === 3 || error?.message === "timeout") {
    return "Posisjon brukte for lang tid. Prøv igjen eller søk etter sted.";
  }

  return "Kunne ikke hente posisjon. Søk etter sted i stedet.";
}

function PullToRefreshShell({ children, disabled = false, onRefresh }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const distanceRef = useRef(0);
  const isTrackingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const setDistance = (value) => {
      distanceRef.current = value;
      setPullDistance(value);
    };

    const handleTouchStart = (event) => {
      if (disabled || isRefreshing || window.scrollY > 2 || event.touches.length !== 1) {
        return;
      }

      startYRef.current = event.touches[0].clientY;
      isTrackingRef.current = true;
    };

    const handleTouchMove = (event) => {
      if (!isTrackingRef.current || event.touches.length !== 1) return;

      const dragDistance = event.touches[0].clientY - startYRef.current;
      if (dragDistance <= 0 || window.scrollY > 2) {
        setDistance(0);
        return;
      }

      const resistedDistance = Math.min(PULL_MAX_DISTANCE, dragDistance * 0.56);
      setDistance(resistedDistance);

      if (event.cancelable && resistedDistance > 8) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (!isTrackingRef.current) return;
      isTrackingRef.current = false;

      if (distanceRef.current < PULL_TRIGGER_DISTANCE) {
        setDistance(0);
        return;
      }

      setDistance(PULL_TRIGGER_DISTANCE);
      setIsRefreshing(true);
      try {
        window.navigator.vibrate?.(8);
        await onRefreshRef.current?.();
      } finally {
        setIsRefreshing(false);
        setDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [disabled, isRefreshing]);

  const progress = Math.min(1, pullDistance / PULL_TRIGGER_DISTANCE);

  return (
    <>
      <Box
        aria-hidden="true"
        sx={{
          position: "fixed",
          top: "calc(12px + env(safe-area-inset-top))",
          left: "50%",
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.4,
          py: 0.85,
          borderRadius: "999px",
          border: "1px solid rgba(125, 211, 252, .24)",
          background: "rgba(2, 6, 23, .88)",
          color: "rgba(226, 232, 240, .9)",
          boxShadow: "0 18px 36px rgba(2, 6, 23, .42)",
          backdropFilter: "blur(18px)",
          opacity: isRefreshing || pullDistance > 6 ? 1 : 0,
          pointerEvents: "none",
          transform: `translate(-50%, ${isRefreshing ? 0 : Math.max(-18, pullDistance - 56)}px)`,
          transition: isRefreshing ? "opacity .18s ease, transform .18s ease" : "none",
        }}
      >
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: "999px",
            border: "2px solid rgba(125, 211, 252, .28)",
            borderTopColor: "#7dd3fc",
            transform: `rotate(${progress * 260}deg)`,
            animation: isRefreshing ? "vvPullSpin .8s linear infinite" : "none",
          }}
        />
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800 }}>
          {isRefreshing ? "Oppdaterer..." : progress >= 1 ? "Slipp for å oppdatere" : "Dra for å oppdatere"}
        </Typography>
      </Box>

      <Grid item xs={12} component="main" sx={{ width: "100%", minWidth: 0 }}>
        <Grid
          container
          columnSpacing={{ xs: 0, sm: 2 }}
          rowSpacing={{ xs: 1.4, sm: 1.8 }}
          sx={{ width: "100%", minWidth: 0, margin: 0 }}
        >
          {children}
        </Grid>
      </Grid>
    </>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(() => getTabFromPath());
  const bathSeasonActive = isBathSeason();
  const visibleTabs = APP_TABS.filter(
    (tab) => tab.value !== "bath" || bathSeasonActive || activeTab === "bath"
  );
  const communityHint = bathSeasonActive
    ? "lokale rapporter, badetemperatur og Værglimt"
    : "lokale rapporter og Værglimt";
  const [todayWeather, setTodayWeather] = useState(null);
  const [todayForecast, setTodayForecast] = useState([]);
  const [weekForecast, setWeekForecast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [communityRefreshKey, setCommunityRefreshKey] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState({
    name: "Kristiansand, NO",
    lat: 58.1467,
    lon: 7.9956,
  });

  const searchChangeHandler = async (enteredData, showLoading = true) => {
    if (!enteredData?.value) return;
    const [latitude, longitude] = enteredData?.value?.split(" ");
    const nextLocation = {
      name: enteredData.label,
      lat: Number(latitude),
      lon: Number(longitude),
    };

    setError(false);
    if (showLoading) setIsLoading(true);

    const date = new Date();
    const dt_now = Math.floor(date.getTime() / 1000);

    try {
      const [todayWeatherResponse, weekForecastResponse] =
        await fetchWeatherData(latitude, longitude);
      const all_today_forecasts_list = getTodayForecastWeather(
        weekForecastResponse,
        dt_now
      );

      const all_week_forecasts_list = getWeekForecastWeather(
        weekForecastResponse,
        ALL_DESCRIPTIONS
      );

      setTodayForecast([...all_today_forecasts_list]);
      setTodayWeather({ city: enteredData.label, ...todayWeatherResponse });
      setSelectedLocation(nextLocation);
      setWeekForecast({
        city: enteredData.label,
        list: all_week_forecasts_list,
      });
    } catch (error) {
      setError(true);
    }

    if (showLoading) setIsLoading(false);
  };

  const changeTab = (tabValue) => {
    const tab = APP_TABS.find((item) => item.value === tabValue);
    if (!tab) return;

    window.navigator.vibrate?.(8);
    setActiveTab(tab.value);
    if (window.location.pathname !== tab.path) {
      window.history.pushState({ tab: tab.value }, "", tab.path);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const usePositionHandler = async () => {
    if (isLocating) return;

    if (!navigator.geolocation) {
      setLocationStatus("Nettleseren støtter ikke posisjon.");
      return;
    }

    setIsLocating(true);
    setLocationStatus("");
    try {
      const position = await requestBestPosition({
        timeout: 10000,
      });
      const latitude = position.coords.latitude.toFixed(7);
      const longitude = position.coords.longitude.toFixed(7);
      const label = await reverseGeocode(latitude, longitude).catch(
        () => "Din posisjon"
      );

      await searchChangeHandler(
        {
          value: `${latitude} ${longitude}`,
          label,
        },
        true
      );
      setLocationStatus("");
    } catch (error) {
      setLocationStatus(getPositionStatusMessage(error));
    } finally {
      setIsLocating(false);
    }
  };

  const refreshActiveTab = async () => {
    if (isLoading) return;

    if (selectedLocation?.lat && selectedLocation?.lon) {
      await searchChangeHandler(
        {
          value: `${selectedLocation.lat} ${selectedLocation.lon}`,
          label: selectedLocation.name,
        },
        true
      );
    }

    setCommunityRefreshKey((value) => value + 1);
  };

  useEffect(() => {
    trackVisit();
    searchChangeHandler(
      {
        value: "58.1467 7.9956",
        label: "Kristiansand, NO",
      },
      false
    );
  }, []);

  useEffect(() => {
    const handlePopState = () => setActiveTab(getTabFromPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  let appContent = (
    <Grid item xs={12}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        sx={{
          width: "100%",
          minHeight: "500px",
        }}
      >
        <SvgIcon
          component={SplashIcon}
          inheritViewBox
          sx={{ fontSize: { xs: "100px", sm: "120px", md: "140px" } }}
        />
        <Typography
          variant="h4"
          component="h4"
          sx={{
            fontSize: { xs: "12px", sm: "14px" },
            color: "rgba(255,255,255, .85)",
            fontFamily: "Poppins",
            textAlign: "center",
            margin: "2rem 0",
            maxWidth: "80%",
            lineHeight: "22px",
          }}
        >
          Søk etter et sted, eller bruk standardvisningen for Kristiansand. Data
          hentes fra Meteorologisk institutt.
        </Typography>
      </Box>
    </Grid>
  );

  if (todayWeather && todayForecast && weekForecast) {
    appContent = (
      <React.Fragment>
        {activeTab === "weather" && (
          <>
            <Grid item xs={12} md={todayWeather ? 6 : 12}>
              <Grid item xs={12}>
                <TodayWeather data={todayWeather} forecastList={todayForecast} />
              </Grid>
            </Grid>
            <Grid item xs={12} md={6}>
              <WeeklyForecast data={weekForecast} />
            </Grid>
          </>
        )}
        {activeTab !== "weather" && (
          <VaervaktFeatures
            selectedLocation={selectedLocation}
            weather={todayWeather}
            activeTab={activeTab}
            refreshKey={communityRefreshKey}
          />
        )}
        {activeTab === "weather" && (
          <Grid item xs={12}>
            <Box
              sx={{
                mt: { xs: 1.5, md: 2 },
                mb: { xs: 8, md: 3 },
                border: "1px solid rgba(148, 163, 184, .18)",
                borderRadius: "22px",
                background: "rgba(15, 23, 42, .62)",
                color: "rgba(226,232,240,.72)",
                px: { xs: 1.4, sm: 1.8 },
                py: 1.3,
                fontSize: "0.82rem",
              }}
            >
              Bytt fane nederst for {communityHint}.
            </Box>
          </Grid>
        )}
      </React.Fragment>
    );
  }

  if (error) {
    appContent = (
      <Grid item xs={12}>
        <ErrorBox
          margin="3rem auto"
          flex="inherit"
          errorMessage="Noe gikk galt. Prøv igjen."
        />
      </Grid>
    );
  }

  if (isLoading) {
    appContent = (
      <Grid item xs={12}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            minHeight: "500px",
          }}
        >
          <LoadingBox value="1">
            <Typography
              variant="h3"
              component="h3"
              sx={{
                fontSize: { xs: "10px", sm: "12px" },
                color: "rgba(255, 255, 255, .8)",
                lineHeight: 1,
                fontFamily: "Poppins",
              }}
            >
              Laster værdata...
            </Typography>
          </LoadingBox>
        </Box>
      </Grid>
    );
  }

  return (
    <Container
      disableGutters
      sx={{
        maxWidth: { xs: "100%", sm: "92%", md: "1100px" },
        width: "100%",
        minHeight: "100%",
        margin: "0 auto",
        boxSizing: "border-box",
        overflowX: "clip",
        px: { xs: "12px", sm: 0 },
        paddingTop: "1rem",
        paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom))",
        marginBottom: "1rem",
        borderRadius: {
          xs: "none",
          sm: "0 0 1rem 1rem",
        },
        boxShadow: {
          xs: "none",
          sm: "rgba(0,0,0, 0.5) 0px 10px 15px -3px, rgba(0,0,0, 0.5) 0px 4px 6px -2px",
        },
      }}
    >
      <Grid
        container
        columnSpacing={{ xs: 0, sm: 2 }}
        sx={{
          width: "100%",
          minWidth: 0,
          marginLeft: 0,
          marginRight: 0,
        }}
      >
        <Grid item xs={12}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              width: "100%",
              marginBottom: "1rem",
              gap: "0.75rem",
            }}
          >
            <Box
              component="img"
              sx={{
                height: { xs: "32px", sm: "46px", md: "50px" },
                width: "auto",
              }}
              alt="logo"
              src={Logo}
            />

            <Box display="flex" alignItems="center" justifyContent="flex-end" gap="0.7rem">
              <Button
                component="a"
                href={VIPPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                sx={{
                  color: "#fff",
                  border: "1px solid rgba(255, 115, 115, .38)",
                  borderRadius: "999px",
                  px: { xs: 1, sm: 1.5 },
                  fontSize: { xs: "0.68rem", sm: "0.78rem" },
                  fontWeight: 900,
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  background: "linear-gradient(135deg, #ff7a3d, #ff2d55)",
                  boxShadow: "0 10px 24px rgba(255,45,85,.16)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #ff8f5c, #ff4770)",
                  },
                }}
              >
                Støtt
              </Button>
              <Button
                onClick={usePositionHandler}
                disabled={isLocating}
                size="small"
                sx={{
                  color: "#e2e8f0",
                  border: "1px solid rgba(148, 163, 184, 0.24)",
                  borderRadius: "999px",
                  px: { xs: 1, sm: 1.5 },
                  fontSize: { xs: "0.68rem", sm: "0.78rem" },
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  opacity: isLocating ? 0.72 : 1,
                }}
              >
                {isLocating ? "Finner..." : "Bruk posisjon"}
              </Button>
              <UTCDatetime />
              <Link
                href="https://github.com/LordM8YT/Vaervakt-react"
                target="_blank"
                underline="none"
                sx={{ display: { xs: "none", sm: "flex" } }}
              >
                <GitHubIcon
                  sx={{
                    fontSize: { xs: "20px", sm: "22px", md: "26px" },
                    color: "white",
                    "&:hover": { color: "#2d95bd" },
                  }}
                />
              </Link>
            </Box>
          </Box>
          {activeTab !== "glimpse" && (
            <Search onSearchChange={searchChangeHandler} />
          )}
          {locationStatus && (
            <Box
              role="status"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.8,
                mt: 1,
                mx: "auto",
                width: "fit-content",
                maxWidth: "100%",
                px: 1.25,
                py: 0.8,
                borderRadius: "999px",
                border: "1px solid rgba(251, 191, 36, .24)",
                background: "rgba(251, 191, 36, .1)",
                color: "#fde68a",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              <Box component="span" aria-hidden="true">
                !
              </Box>
              <Typography component="span" sx={{ fontSize: "inherit", fontWeight: "inherit" }}>
                {locationStatus}
              </Typography>
            </Box>
          )}
        </Grid>
        <PullToRefreshShell
          disabled={isLocating}
          onRefresh={refreshActiveTab}
        >
          {appContent}
        </PullToRefreshShell>
      </Grid>
      <Box
        component="nav"
        aria-label="Hovedmeny"
        sx={{
          position: "fixed",
          left: "50%",
          bottom: "calc(12px + env(safe-area-inset-bottom))",
          transform: "translateX(-50%)",
          zIndex: 30,
          width: "min(520px, calc(100vw - 24px))",
          display: "grid",
          gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))`,
          gap: "6px",
          p: "7px",
          borderRadius: "999px",
          border: "1px solid rgba(148, 163, 184, .22)",
          background: "rgba(2, 6, 23, .86)",
          backdropFilter: "blur(22px)",
          boxShadow: "0 18px 44px rgba(2, 6, 23, .45)",
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.value;

          return (
            <Button
              key={tab.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => changeTab(tab.value)}
              sx={{
                minWidth: 0,
                borderRadius: "999px",
                px: { xs: 0.6, sm: 1 },
                py: 0.95,
                color: isActive ? "#06111f" : "rgba(226,232,240,.74)",
                background: isActive
                  ? "linear-gradient(135deg, #7dd3fc, #38bdf8)"
                  : "rgba(255,255,255,.04)",
                border: "1px solid",
                borderColor: isActive ? "rgba(125, 211, 252, .75)" : "rgba(255,255,255,.05)",
                fontWeight: 900,
                fontSize: { xs: "0.72rem", sm: "0.82rem" },
                lineHeight: 1,
                textTransform: "none",
                gap: { xs: 0.35, sm: 0.55 },
                "&:hover": {
                  background: isActive
                    ? "linear-gradient(135deg, #bae6fd, #38bdf8)"
                    : "rgba(255,255,255,.08)",
                },
              }}
            >
              <Box component="span" aria-hidden="true" sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}>
                {tab.icon}
              </Box>
              {tab.label}
            </Button>
          );
        })}
      </Box>
    </Container>
  );
}

export default App;
