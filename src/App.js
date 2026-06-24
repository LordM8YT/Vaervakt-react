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

function formatAccuracySuffix(accuracy) {
  if (!Number.isFinite(accuracy)) return "";
  return accuracy < 1000
    ? ` (ca. ${Math.round(accuracy)} m)`
    : ` (ca. ${(accuracy / 1000).toFixed(1).replace(".", ",")} km)`;
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
  const [todayWeather, setTodayWeather] = useState(null);
  const [todayForecast, setTodayForecast] = useState([]);
  const [weekForecast, setWeekForecast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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

  const usePositionHandler = async () => {
    if (!navigator.geolocation) {
      setLocationStatus("Nettleseren støtter ikke posisjon.");
      return;
    }

    setLocationStatus("Finner posisjonen din mer nøyaktig...");
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
      setLocationStatus(
        `Viser vær for ${label}${formatAccuracySuffix(position.coords.accuracy)}.`
      );
    } catch (error) {
      setLocationStatus("Fikk ikke tilgang til posisjon. Søk etter sted i stedet.");
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
        <Grid item xs={12} md={todayWeather ? 6 : 12}>
          <Grid item xs={12}>
            <TodayWeather data={todayWeather} forecastList={todayForecast} />
          </Grid>
        </Grid>
        <Grid item xs={12} md={6}>
          <WeeklyForecast data={weekForecast} />
        </Grid>
        <VaervaktFeatures selectedLocation={selectedLocation} weather={todayWeather} />
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
        paddingBottom: "3rem",
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
                size="small"
                sx={{
                  color: "#e2e8f0",
                  border: "1px solid rgba(148, 163, 184, 0.24)",
                  borderRadius: "999px",
                  px: { xs: 1, sm: 1.5 },
                  fontSize: { xs: "0.68rem", sm: "0.78rem" },
                  textTransform: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Bruk posisjon
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
            <Typography
              sx={{
                color: "#94a3b8",
                fontSize: "0.82rem",
                mt: 1,
                textAlign: "center",
              }}
            >
              {locationStatus}
            </Typography>
          )}
        </Grid>
        {appContent}
      </Grid>
    </Container>
  );
}

export default App;
