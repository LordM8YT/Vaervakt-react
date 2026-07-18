# Værvakt Svelte

Frontend for Værvakt.no, bygget med Svelte 5, Vite og Lucide-ikoner.

## Hva denne basen gjør nå

- Henter værdata fra Meteorologisk institutt via MET Locationforecast.
- Søker etter steder via OpenStreetMap Nominatim.
- Krever ingen OpenWeather- eller RapidAPI-nøkler.
- Starter uten valgt sted og henter først vær etter søk eller godkjent GPS-posisjon.
- Viser vær nå, time-for-time og de neste dagene.
- Har lokale værrapporter og badetemperatur.
- Har lys/mørk visning og nøyaktighetskontroll for GPS-posisjon.
- Lagrer ikke alias i nettleseren etter besøket.
- Husker valgt lyst/mørkt tema som en lokal visningspreferanse.
- Husker siste valgte sted lokalt; GPS-koordinater avrundes før de caches.
- Cacher offentlige badeplass-POI-er lokalt med 12 timers gyldighet.
- Har innebygd personverninformasjon og avrunder rapportkoordinater.
- Bruker `@lucide/svelte` for vær- og grensesnittikoner.

## Personvern

Frontend setter ingen informasjonskapsler og bruker ingen annonse- eller
sporingsverktøy. Posisjon hentes bare etter et aktivt klikk. Siste valgte sted
lagres lokalt som en visningspreferanse, og GPS-koordinater avrundes til tre
desimaler før lagring. Offentlige badeplass-POI-er caches lokalt med 12 timers
gyldighet, uten alias eller brukeridentifikator. Utdaterte POI-oppføringer
ryddes neste gang cachen brukes. Temaet lagres også lokalt. Annen eldre
Værvakt-lagring og service worker-cache ryddes bort ved oppstart.

Produksjons-API-et håndhever egne slettetider og dataminimering for lokale
rapporter og innsendinger til Yr. Se personvernpanelet i appen for formål,
behandlingsgrunnlag, mottakere og rettigheter.

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
