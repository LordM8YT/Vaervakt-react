# Værvakt Stream Deck

En liten Stream Deck-plugin for Værvakt.no.

## Hva den gjør

- `Værvakt Nå`: viser temperatur, værikon, sted og eventuell nærmeste badetemperatur.
- `Badetemp`: viser nærmeste badetemperatur fra Yr via Værvakt sitt API.
- `Badetemp info`: viser badeplass, avstand og tidspunkt. Plasser den rett ved siden av `Badetemp` for en todelt badetemp-widget.
- `Siste rapport`: viser siste lokale værrapport i nærheten.
- `Send rapport`: sender en hurtigrapport med valgt værtype og aktuell temperatur.
- `Åpne Værvakt`: åpner Værvakt.no i nettleseren.
- De fleste visningsknapper kan åpne riktig Værvakt-side ved trykk. `Send rapport` sender en hurtigrapport i stedet.
- Property Inspector lar deg sette sted, koordinater, API-base og oppdateringsintervall.

Anbefalt layout på Stream Deck:

```text
[Værvakt Nå] [Siste rapport] [Åpne Værvakt]
[Badetemp]  [Badetemp info] [Send rapport]
```

## Struktur

Pluginen bruker klassisk Stream Deck JavaScript med `connectElgatoStreamDeckSocket` i:

```text
no.vaervakt.streamdeck.sdPlugin/plugin.js
```

Den bruker ikke React, TypeScript eller Elgato Node SDK-runtime.

## Krav

- Stream Deck 7.1 eller nyere.
- Stream Deck CLI hvis du vil pakke pluginen til installasjonsfil.

## Bruk

```powershell
npm install
npm run build
npm run pack
```

Den byggede pluginen ligger i:

```text
no.vaervakt.streamdeck.sdPlugin
```

## Standardsted

Pluginen starter på Kristiansand:

- Lat: `58.1467`
- Lon: `7.9956`

Dette kan endres per knapp i Stream Deck sin Property Inspector.
