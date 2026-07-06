# Værvakt Stream Deck

En liten Stream Deck-plugin for Værvakt.no.

## Hva den gjør

- `Værvakt Nå`: viser temperatur, værikon, sted og eventuell nærmeste badetemperatur.
- `Badetemp`: viser nærmeste badetemperatur fra Yr via Værvakt sitt API.
- `Badetemp info`: viser badeplass, avstand og tidspunkt. Plasser den rett ved siden av `Badetemp` for en todelt badetemp-widget.
- Trykk på knappen åpner Værvakt i nettleseren.
- Property Inspector lar deg sette sted, koordinater, API-base og oppdateringsintervall.

## Krav

- Node.js 24 eller nyere.
- Stream Deck 7.1 eller nyere.
- Stream Deck CLI hvis du vil pakke pluginen til installasjonsfil.

## Bruk

```powershell
npm install
npm run build
```

Den byggede pluginen ligger i:

```text
no.vaervakt.streamdeck.sdPlugin
```

For å lage installerbar fil:

```powershell
npm run pack
```

## Standardsted

Pluginen starter på Kristiansand:

- Lat: `58.1467`
- Lon: `7.9956`

Dette kan endres per knapp i Stream Deck sin Property Inspector.
