import React, { useEffect, useState } from "react";
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

function isBathSeason(date = new Date()) {
  const month = date.getMonth();
  return month >= 4 && month <= 8;
}

function getTabFromPath(pathname = window.location.pathname) {
  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return APP_TABS.find((tab) => tab.path === normalizedPath)?.value || "weather";
}

function requestBestPosition({
  targetAccuracy = 35,
  settleMs = 6500,
  timeout = 12000,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }

    let bestPosition = null;
    let settled = false;
    let watchId = 0;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.clearTimeout(settleId);
      if (watchId) navigator.geolocation.clearWatch(watchId);
      callback(value);
    };

    const timeoutId = window.setTimeout(() => {
      if (bestPosition) finish(resolve, bestPosition);
      else finish(reject, new Error("timeout"));
    }, timeout);

    const settleId = window.setTimeout(() => {
      if (bestPosition) finish(resolve, bestPosition);
    }, settleMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        if (position.coords.accuracy <= targetAccuracy) finish(resolve, position);
      },
      (error) => {
        if (bestPosition) finish(resolve, bestPosition);
        else finish(reject, error);
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
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
        targetAccuracy: 25,
        settleMs: 7500,
        timeout: 14000,
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
      setLocationStatus("Fikk ikke tilgang til posisjon. Søk etter sted i stedet.");
    } finally {
      setIsLocating(false);
    }
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
    <Box
      xs={12}
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
      <ErrorBox
        margin="3rem auto"
        flex="inherit"
        errorMessage="Noe gikk galt. Prøv igjen."
      />
    );
  }

  if (isLoading) {
    appContent = (
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
          <Search onSearchChange={searchChangeHandler} />
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
        {appContent}
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
