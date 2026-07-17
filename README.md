# Værvakt Svelte

Frontend for Værvakt.no, bygget med Svelte 5, Vite og Lucide-ikoner.

## Hva denne basen gjør nå

- Henter værdata fra Meteorologisk institutt via MET Locationforecast.
- Søker etter steder via OpenStreetMap Nominatim.
- Krever ingen OpenWeather- eller RapidAPI-nøkler.
- Starter med Kristiansand som standardvisning.
- Viser vær nå, time-for-time og de neste dagene.
- Har lokale værrapporter og badetemperatur.
- Har lagret lys/mørk visning og nøyaktighetskontroll for GPS-posisjon.
- Bruker `@lucide/svelte` for vær- og grensesnittikoner.

## Repo-flyt

Dette repoet er utviklingsrepoet for Svelte-grensesnittet. Produksjonsrepoet er
`LordM8YT/Vaervakt.no`, og det er det eneste repoet som deployer til Webhuset.

Når Svelte-kode pushes til `main`, bygger GitHub Actions appen og sender ferdig
build videre til `LordM8YT/Vaervakt.no`. Produksjonsrepoet deployer deretter til
Webhuset med den eksisterende workflowen.

Secret som må ligge i dette repoet:

```text
VAERVAKT_SYNC_TOKEN
```

Tokenet må ha skrivetilgang til `LordM8YT/Vaervakt.no`.

## Kjør lokalt

```powershell
npm install
npm start
```

Vite viser deretter lokal adresse i terminalen.

## Bygg

```powershell
npm run check
npm run build
```

Vite er konfigurert til å skrive produksjonsbygget til `build/`, med JavaScript
og CSS under `build/static/`, slik at eksisterende produksjonssynk fungerer.

Valgfri API-base settes med:

```text
VITE_VAERVAKT_API_BASE=https://eksempel.no
```
