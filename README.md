# Northern Lines AIS Route Mapper

The **Northern Lines AIS Route Mapper** turns recorded AIS/GPS voyage data into an inspectable route workspace and, later, into canonical and editorial route assets for the Northern Lines ecosystem.

## Product role

```text
AIS Journey Recorder
        ↓
Tracker QA
        ↓
recorded + QA-validated observations
        ↓
AIS Route Mapper
        ↓
canonical / editorial route
        ↓
Northern Lines Studio
```

The ownership rule is:

```text
Recorder owns observation.
Tracker QA owns track validity.
Route Mapper owns import normalization and reconstruction.
Studio owns editorial presentation.
```

## Current capabilities

- interactive Leaflet voyage map
- keyless OpenStreetMap base tiles
- keyless OpenSeaMap seamark overlay
- visible playback vessel marker and travelled-route overlay
- CSV/text, AIS NMEA, GPS RMC, GPX, JSON and GeoJSON import
- multi-fragment AIVDM/AIVDO assembly
- receiver/source/synthetic timestamp provenance
- GPX and CSV export
- voyage metadata and logbook views
- canvas-based route poster export
- bundled demonstration voyages
- Raw Track preservation and Canonical Track derivation
- MMSI ambiguity detection
- read-only Journey QA consumption contract
- editorial-readiness gating from upstream QA verdicts

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

The visible map styles are intentionally limited to **Nautical** (OSM + OpenSeaMap) and **OpenStreetMap Standard**. No Google Maps, Mapbox, CARTO or Esri provider is required by the baseline runtime.

## Track data contract

Build 002 establishes `Raw Track → Canonical Track → Editorial Route (future)`. `VoyageData.rawPoints` preserves imported observations while `VoyageData.points` contains the derived canonical route consumed by the UI. See [`docs/TRACK-DATA-CONTRACT.md`](docs/TRACK-DATA-CONTRACT.md).

## Import normalization

Build 003 moves CSV, GPX, JSON, GeoJSON and NMEA handling behind a dedicated adapter boundary. Multi-fragment AIS messages are assembled only when complete; timestamp provenance remains explicit. See [`docs/IMPORT-NORMALIZATION.md`](docs/IMPORT-NORMALIZATION.md).

## Journey Quality Contract

Build 004 consumes Tracker QA results without duplicating Tracker analysis:

```text
Tracker Quality Analyzer
        ↓
JourneyQualityReport
        ↓
Route Mapper
```

The Mapper may display and gate on `PASS/WARN/FAIL`, but it does not run land-mask analysis or Troll Crossing detection itself. Generic imports without an upstream QA report remain inspectable but are not considered editorial-ready. See [`docs/JOURNEY-QUALITY-CONTRACT.md`](docs/JOURNEY-QUALITY-CONTRACT.md).

## Development

Requirements: Node.js and npm.

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Build roadmap

- **001 — Product Baseline:** complete.
- **002 — Track Data Contract:** complete.
- **002A — Keyless Map Baseline:** complete.
- **002B — Playback Marker:** complete.
- **003 — Import Normalization:** complete; real Journey regression remains scheduled when recorder data is available.
- **004 — Journey Quality Contract:** current build; consume Tracker QA without duplicating it.
- **005 — Journey Recorder Import:** direct interoperability with Northern Lines Cartography/Journey Recorder output.
- **005A — Northern Lines Visual Language:** typography, tokens, chrome and control hierarchy without turning the Mapper into a Studio clone.
- **006 — Editorial Route:** controlled simplification and route assets for Northern Lines Studio.
- **007 — Tauri v2 Desktop Host:** package the hardened mapper as a native Northern Lines desktop application.

## Status

Build 004 defines the read-only Journey QA contract and editorial-readiness semantics. Build 005 will bind the real Recorder artifact format once available.
