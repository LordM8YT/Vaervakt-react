<script>
  import { Droplets, MapPin, Radio, SunMedium, Thermometer, Wind } from "@lucide/svelte";
  import { getDayMonthFromDate } from "../../utilities/DatetimeUtils";
  import WeatherIcon from "./WeatherIcon.svelte";

  export let data;
  export let forecastList = [];

  const dayMonth = getDayMonthFromDate();
  $: uvIndex =
    data?.main?.uvIndex == null ? null : Number(data.main.uvIndex);
</script>

<section class="weather-column" aria-label="Været i dag">
  <article class="weather-panel current-panel">
    <header class="section-heading heading-with-meta">
      <span>Været nå</span>
      <small class="live-weather"><Radio size={13} /> Live fra MET</small>
    </header>
    <div class="current-weather">
      <div class="current-hero-copy">
        <span class="hero-location"><MapPin size={15} /> {data.city}</span>
        <div class="hero-temperature">
          <strong>{Math.round(data.main.temp)}°</strong>
          <div>
            <span>{data.weather[0].description}</span>
            <small>Føles som {Math.round(data.main.feels_like)}° · I dag {dayMonth}</small>
          </div>
        </div>
      </div>
      <div class="current-icon weather-orb">
        <WeatherIcon
          code={data.weather[0].icon}
          label={data.weather[0].description}
          size={78}
          strokeWidth={1.45}
        />
      </div>
    </div>
  </article>

  <article class="weather-panel">
    <header class="section-heading">
      <span>Detaljer</span>
    </header>
    <div class="metrics-grid">
      <div class="metric">
        <Thermometer size={19} aria-hidden="true" />
        <span>Føles som</span>
        <strong>{Math.round(data.main.feels_like)}°</strong>
      </div>
      <div class="metric">
        <Wind size={19} aria-hidden="true" />
        <span>Vind</span>
        <strong>{data.wind.speed} m/s</strong>
      </div>
      <div class="metric">
        <SunMedium size={19} aria-hidden="true" />
        <span>UV-indeks</span>
        <strong>
          {Number.isFinite(uvIndex)
            ? uvIndex.toFixed(1).replace(".", ",")
            : "–"}
        </strong>
      </div>
      <div class="metric">
        <Droplets size={19} aria-hidden="true" />
        <span>Fuktighet</span>
        <strong>{Math.round(data.main.humidity)} %</strong>
      </div>
    </div>
  </article>

  <article class="weather-panel">
    <header class="section-heading heading-with-meta">
      <span>Time for time</span>
      <small>{forecastList.length} timevarsler</small>
    </header>
    {#if forecastList.length}
      <div class="hourly-grid">
        {#each forecastList as item}
          <div class="hour-card">
            <time>{item.time}</time>
            <WeatherIcon code={item.icon} size={35} strokeWidth={1.7} />
            <strong>{item.temperature.replace(" °C", "°")}</strong>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty-inline">Ingen flere timevarsler tilgjengelig akkurat nå.</p>
    {/if}
  </article>
</section>
