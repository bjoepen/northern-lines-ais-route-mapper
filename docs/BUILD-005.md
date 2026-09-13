# Build 005 — Northern Lines Journey Recorder Import

## Goal

Build 005 connects the Route Mapper to the real Northern Lines Cartography / Journey Recorder derivation output without duplicating Tracker QA.

The preferred native input is:

```text
normalized-track.json
```

GeoJSON review artifacts remain supported as geometry-only imports:

```text
raw-track.geojson
normalized-track.geojson
```

`acceptance-summary.json` is not itself a route and is therefore not treated as a standalone track import in Build 005.

## Reference journey

The implementation was derived against the first real Troll-QA / Build-009D Norway acceptance data:

```text
journeyId: 7-ta-gigen-norwegen-kreuzfahrt-2026-08-30
source observations: 5870
normalized positions: 4748
explicit gaps: 4
continuous route segments: 5
reconstruction: 0
```

## Ownership invariant

```text
Recorder owns observation.
Tracker QA owns track validity.
Cartography owns normalized truth and explicit gaps.
Route Mapper consumes that truth and owns reconstruction/presentation.
```

The Mapper MUST NOT recompute Troll QA and MUST NOT invent geometry across a supplied gap.

## Native Normalized Track adapter

`src/import/northernLinesJourney.ts` recognizes the Cartography schema-1 object by:

```text
schemaVersion === 1
journeyId: string
items: array
```

Position items (`observed`, `normalized`) become canonical Mapper points. Their `observedAt` values are used as source timestamps. Source observation indices are retained as provenance.

Gap items become explicit `TrackGap` values and terminate the current `TrackSegment`.

Therefore:

```text
Segment 1
  GAP
Segment 2
  GAP
Segment 3
  GAP
Segment 4
  GAP
Segment 5
```

is represented as five independent continuous polylines, never one flattened line.

## Segmented Track Contract

Build 005 extends `VoyageData` with:

```text
segments?: TrackSegment[]
gaps?: TrackGap[]
playbackAvailable?: boolean
geometryOnly?: boolean
northernLinesSource?: NorthernLinesJourneySource
```

The existing flat `points[]` remains as the UI/playback selection index for compatibility. It is NOT permission to render a continuous polyline. Renderers must use `segments` whenever supplied.

## Gap-safe derivation

Distance, derived SOG and derived COG are calculated only inside an individual continuous segment.

No calculation may use:

```text
last point of segment N -> first point of segment N+1
```

Consequences:

- no distance is added across a QA gap;
- no speed is derived across a missing-AIS region;
- no course is derived across a missing-AIS region;
- no map/export line bridges a gap.

## GeoJSON review mode

LineString FeatureCollections are accepted in addition to Point GeoJSON.

Because Cartography review GeoJSON contains geometry but no journey timestamps, Build 005 imports those files as:

```text
geometryOnly = true
playbackAvailable = false
```

Synthetic internal Date objects are used only to satisfy the legacy `AisPoint` shape. Their provenance is explicitly `synthetic`; they are not exposed as real journey time.

Gap features with `geometry: null` are retained and segment boundaries are preserved.

## Rendering changes

The following consumers are segment-aware in Build 005:

- Leaflet route rendering;
- playback travelled-route overlay;
- Editorial Route Sheet canvas;
- GPX export (`trkseg` per continuous segment);
- CSV export (segment column).

The playback controller is hidden for geometry-only imports.

Build 005 does not yet replace the existing point-step playback clock with the future time-interpolated playback model. That optimization remains a separate playback build after real-journey acceptance.

## Import UI

The file picker accepts:

```text
.csv
.txt
.nmea
.gpx
.json
.geojson
.log
```

Preferred workflow:

```text
Cartography normalized-track.json
        ↓
Route Mapper
        ↓
canonical points + segments + gaps + provenance
```

## Acceptance gates

Run locally:

```bash
npm run lint
npm run build
npm run dev
```

Real-world acceptance:

1. Import the Norway `normalized-track.json`.
2. Expect 4748 points.
3. Expect 5 continuous segments.
4. Expect 4 explicit gaps.
5. Confirm the map does not draw across any gap.
6. Confirm distance/SOG/COG do not derive across a gap.
7. Confirm playback is available because the native JSON has real `observedAt` timestamps.
8. Import `normalized-track.geojson`.
9. Expect geometry-only mode, 5 segments and 4 gaps.
10. Confirm playback is unavailable for GeoJSON.
11. Confirm Editorial Route Sheet preserves all four gaps.
12. Re-run a legacy CSV/GPX/NMEA preset/import to verify Build-003 compatibility.

## Non-goals

Build 005 does not:

- select a production coastal tolerance;
- rerun landmask analysis;
- reconstruct missing geometry;
- import `acceptance-summary.json` as a route;
- implement adaptive poster orientation;
- implement time-interpolated playback.
