# Værvakt Stream Deck

Stream Deck-plugin for Værvakt.no, bygget med Svelte 5, Vite og Lucide.

## Handlinger

- `Værvakt nå` viser temperatur, værstatus og sted. Værdata hentes direkte fra MET.
- `Badetemp` viser nærmeste eller valgt badetemperatur fra Værvakt.
- `Badetemp info` viser badeplass, avstand og tidspunkt.
- `Siste rapport` viser siste lokale værrapport i nærheten.
- `Send rapport` sender en hurtigrapport med aktuell temperatur.
- `Åpne Værvakt` åpner nettsiden.

Property Inspector er en Svelte-app med konteksttilpassede innstillinger for hver
handling. Knappgrafikken rendres også med Svelte og Lucide.

## Utvikling

All redigerbar kildekode ligger direkte i denne mappen. Vite bygger filene inn i
den eksisterende `no.vaervakt.streamdeck.sdPlugin`-pakken.

```powershell
npm install
npm run check
npm run build
npm run validate
npm run pack
```

Den installerbare filen heter:

```text
no.vaervakt.streamdeck.streamDeckPlugin
```

## Krav

- Node.js 22.12 eller nyere for utvikling.
- Stream Deck 7.1 eller nyere for bruk.
