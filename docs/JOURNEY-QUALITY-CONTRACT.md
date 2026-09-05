# Journey Quality Contract — Build 004

## Purpose

Northern Lines Tracker/Cartography already owns track-quality analysis. The AIS Route Mapper must not duplicate land-mask checks, Troll Crossing detection or plausibility analysis.

```text
AIS Journey Recorder
        ↓
Tracker Quality Analyzer
        ↓
validated observations + QA report
        ↓
AIS Route Mapper
```

## Ownership

```text
Recorder owns observation.
Tracker QA owns track validity.
Route Mapper consumes QA and owns reconstruction.
Studio owns editorial presentation.
```

The Mapper may normalize field names, display issues and gate editorial operations. It must not silently upgrade, downgrade or recompute the upstream verdict.

## Mapper contract

`JourneyQualityReport` uses contract version `0.4.0` and carries:

- overall `status`: `pass`, `warn`, `fail` or `unknown`
- analyzer identity/version when supplied
- analysis timestamp
- journey/MMSI identity when supplied
- point count
- aggregate Troll Crossing and gap counts when supplied
- zero or more structured issues

Issue codes are forward-compatible strings. Known Northern Lines families include `TROLL_CROSSING`, `TRACK_GAP`, `POSITION_OUTLIER`, `IMPOSSIBLE_SPEED`, `DUPLICATE_POINT`, `OUT_OF_ORDER_TIMESTAMP` and `MMSI_MISMATCH`.

## Editorial readiness

The Mapper derives only an application state from the upstream verdict:

| Tracker QA | Mapper editorialReady |
| --- | --- |
| PASS | true |
| WARN | false until explicit editorial review exists in a later build |
| FAIL | false |
| unknown / no report | false |

This is a consumption rule, not a second quality analysis.

## Legacy and generic imports

CSV, GPX, JSON, GeoJSON and ad-hoc NMEA imports remain valid for inspection and development. They do not magically become QA-validated Northern Lines Journeys. Without an upstream report their `JourneyQualityState` is unsupplied and not editorial-ready.

## Build boundary

Build 004 defines types, parsing and readiness evaluation only. Build 005 will map the actual Northern Lines Journey Recorder output into this contract once a real recorder artifact is available for integration testing.
