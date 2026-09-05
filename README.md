# Northern Lines AIS Route Mapper

The **Northern Lines AIS Route Mapper** turns recorded AIS/GPS voyage data into an inspectable route workspace and, later, into canonical and editorial route assets for the Northern Lines ecosystem.

## Product role

The Route Mapper sits between recording and editorial presentation:

```text
AIS Journey Recorder
        ↓
recorded observations
        ↓
AIS Route Mapper
        ↓
canonical / editorial route
        ↓
Northern Lines Studio
```

The architectural ownership rule is:

```text
Recorder owns observation.
Route Mapper owns reconstruction.
Studio owns editorial presentation.
```

## Current capabilities

- interactive Leaflet voyage map
- keyless OpenStreetMap base tiles
- keyless OpenSeaMap seamark overlay
- route playback and telemetry
- CSV/text, single-fragment AIS NMEA, GPS RMC, GPX and JSON import
- GPX and CSV export
- voyage metadata and logbook views
- canvas-based route poster export
- bundled demonstration voyages
- Raw Track preservation and Canonical Track derivation
- explicit timestamp and source provenance
- MMSI ambiguity detection

## Keyless map contract

Build 002A establishes the guaranteed baseline map path:

```text
OpenStreetMap base map
        +
OpenSeaMap seamarks
        ↓
no API key
no map account
no cloud secret
```

The visible map styles are intentionally limited to:

- **Nautical** — OpenStreetMap + OpenSeaMap seamarks
- **OpenStreetMap Standard** — OpenStreetMap only

No Google Maps, Mapbox, CARTO or Esri provider is required by the baseline runtime. Additional providers may only return later as explicit optional adapters; they must never become a requirement for opening or inspecting a route.

Internet access is still required to fetch online tiles. Offline/local tile support is a future desktop concern.

## Track data contract

Build 002 establishes the first explicit data contract:

```text
Raw Track
   ↓
Canonical Track
   ↓
Editorial Route (future)
```

`VoyageData.rawPoints` preserves imported observations. `VoyageData.points` contains the derived canonical route currently consumed by the UI. Derived SOG/COG values are marked, timestamp trust is explicit, and mixed MMSI datasets are identified rather than silently accepted as a single-vessel truth.

See [`docs/TRACK-DATA-CONTRACT.md`](docs/TRACK-DATA-CONTRACT.md) for the normative Build 002 contract.

## Development

Requirements:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

TypeScript quality gate:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

## Build roadmap

- **001 — Product Baseline:** complete. AI Studio/Gemini coupling removed; Northern Lines identity established.
- **002 — Track Data Contract:** complete. Raw/canonical separation, timestamp provenance and MMSI binding established.
- **002A — Keyless Map Baseline:** current build. OSM/OpenSeaMap-only guaranteed map runtime with no API-key requirement.
- **003 — Import Normalization:** normalize supported source formats into the track contract, including robust NMEA fragment handling.
- **004 — Track Quality:** gaps, duplicates, impossible movement, outliers and land-crossing detection (Troll Crossing).
- **005 — Journey Import Contract:** direct interoperability with Northern Lines Cartography/Journey Recorder output.
- **006 — Editorial Route:** controlled simplification and route assets for Northern Lines Studio.
- **007 — Tauri v2 Desktop Host:** package the hardened mapper as a native Northern Lines desktop application.

## Status

Build 002A is ready for local TypeScript, production-build and map-runtime gates before merge to `main`.
