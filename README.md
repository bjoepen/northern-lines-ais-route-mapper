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

Build 001 deliberately preserves the existing working map, playback, logbook, import and export prototype while removing its Google AI Studio runtime identity.

## Current capabilities

- interactive Leaflet voyage map
- nautical seamarks via OpenSeaMap
- route playback and telemetry
- CSV/text, NMEA, GPX and JSON import
- GPX and CSV export
- voyage metadata and logbook views
- canvas-based route poster export
- bundled demonstration voyages

The current import pipeline is still prototype-grade. In particular, AIS timestamp provenance, multi-fragment NMEA handling, MMSI isolation and track-quality validation are planned follow-up work.

## Planned route layers

```text
Raw Track
   ↓
Canonical Track
   ↓
Editorial Route
```

Raw observations must remain traceable. Reconstruction and editorial simplification must never silently overwrite source observations.

## Development

Requirements:

- Node.js
- npm (the repository currently also contains the original Bun lockfile)

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

- **001 — Product Baseline:** remove AI Studio/Gemini coupling and establish Northern Lines identity.
- **002 — Track Data Contract:** timestamp provenance, MMSI binding, raw/canonical separation.
- **003 — Import Normalization:** normalize supported source formats into the track contract.
- **004 — Track Quality:** gaps, duplicates, impossible movement, outliers and land-crossing detection (Troll Crossing).
- **005 — Journey Import Contract:** direct interoperability with Northern Lines Cartography/Journey Recorder output.
- **006 — Editorial Route:** controlled simplification and route assets for Northern Lines Studio.

## Status

Build 001 establishes the product baseline. The existing UI remains intentionally close to the successful prototype; domain hardening follows in subsequent builds.
