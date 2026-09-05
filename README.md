# Northern Lines AIS Route Mapper

The **Northern Lines AIS Route Mapper** turns recorded AIS/GPS voyage data into an inspectable route workspace and, later, into canonical and editorial route assets for the Northern Lines ecosystem.

## Product role

```text
AIS Journey Recorder
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

No Google Maps, Mapbox, CARTO or Esri provider is required by the baseline runtime. Internet access is still required to fetch online tiles; offline/local tile support is a future desktop concern.

## Track data contract

Build 002 establishes:

```text
Raw Track
   ↓
Canonical Track
   ↓
Editorial Route (future)
```

`VoyageData.rawPoints` preserves imported observations. `VoyageData.points` contains the derived canonical route currently consumed by the UI. Derived SOG/COG values are marked, timestamp trust is explicit, and mixed MMSI datasets are identified rather than silently accepted as a single-vessel truth.

See [`docs/TRACK-DATA-CONTRACT.md`](docs/TRACK-DATA-CONTRACT.md).

## Import normalization

Build 003 moves source-format handling behind a dedicated adapter boundary:

```text
CSV / GPX / JSON / GeoJSON / NMEA
                ↓
        Import Normalization
                ↓
       normalized Raw Points
                ↓
        Track Data Contract
```

Multi-fragment AIS messages are assembled only when all fragments are present. Incomplete groups are recorded in the normalization summary and never guessed. Receiver timestamps remain distinguishable from timestamps embedded in the original source record.

See [`docs/IMPORT-NORMALIZATION.md`](docs/IMPORT-NORMALIZATION.md).

## Development

Requirements:

- Node.js
- npm

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
- **003 — Import Normalization:** current build; dedicated format adapters and NMEA fragment assembly.
- **004 — Journey Quality Contract:** consume Tracker QA results; do not duplicate Troll/land-mask analysis in the Mapper.
- **005 — Journey Recorder Import:** direct interoperability with Northern Lines Cartography/Journey Recorder output.
- **005A — Northern Lines Visual Language:** typography, tokens, chrome and control hierarchy without turning the Mapper into a Studio clone.
- **006 — Editorial Route:** controlled simplification and route assets for Northern Lines Studio.
- **007 — Tauri v2 Desktop Host:** package the hardened mapper as a native Northern Lines desktop application.

## Status

Build 003 is ready for local TypeScript, production-build and import regression gates before merge to `main`.
