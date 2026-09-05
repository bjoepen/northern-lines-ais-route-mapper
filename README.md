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
- nautical seamarks via OpenSeaMap
- route playback and telemetry
- CSV/text, single-fragment AIS NMEA, GPS RMC, GPX and JSON import
- GPX and CSV export
- voyage metadata and logbook views
- canvas-based route poster export
- bundled demonstration voyages
- Raw Track preservation and Canonical Track derivation
- explicit timestamp and source provenance
- MMSI ambiguity detection

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
- **002 — Track Data Contract:** implemented on the current build branch; raw/canonical separation, timestamp provenance and MMSI binding.
- **003 — Import Normalization:** normalize supported source formats into the track contract, including robust NMEA fragment handling.
- **004 — Track Quality:** gaps, duplicates, impossible movement, outliers and land-crossing detection (Troll Crossing).
- **005 — Journey Import Contract:** direct interoperability with Northern Lines Cartography/Journey Recorder output.
- **006 — Editorial Route:** controlled simplification and route assets for Northern Lines Studio.

## Status

Build 002 is ready for local TypeScript, production-build and real-world regression gates before merge to `main`.
