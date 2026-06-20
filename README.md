# Værvakt React

Ny React-basert base for Værvakt.no, bygget videre fra en fork av
`vardhan-venkata/react-weather-forecast`.

## Hva denne basen gjør nå

- Henter værdata fra Meteorologisk institutt via MET Locationforecast.
- Søker etter steder via OpenStreetMap Nominatim.
- Krever ingen OpenWeather- eller RapidAPI-nøkler.
- Starter med Kristiansand som standardvisning.
- Viser vær nå, time-for-time og de neste dagene.

## Kjør lokalt

```powershell
npm install
npm start
```

## Bygg

```powershell
npm run build
```

## Videre arbeid

- Lage ny Værvakt-identitet og mobil-first UI.
- Koble inn egne rapporter, badetemperatur og Værhub.
- Legge inn PWA/service worker når ny struktur er stabil.
