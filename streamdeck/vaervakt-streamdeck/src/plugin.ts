import streamDeck from "@elgato/streamdeck";
import { BathInfoAction } from "./actions/bath-info";
import { BathTemperatureAction } from "./actions/bath-temperature";
import { WeatherNowAction } from "./actions/weather-now";

streamDeck.actions.registerAction(new WeatherNowAction());
streamDeck.actions.registerAction(new BathTemperatureAction());
streamDeck.actions.registerAction(new BathInfoAction());

streamDeck.connect();
