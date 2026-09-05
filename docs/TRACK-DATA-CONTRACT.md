# Northern Lines AIS Route Mapper — Track Data Contract

Status: Build 002
Contract version: `0.2.0`

## Ownership

```text
Recorder owns observation.
Route Mapper owns reconstruction.
Studio owns editorial presentation.
```

The Route Mapper must preserve imported observations before deriving a route from them.

## Layers

### Raw Track

`VoyageData.rawPoints` contains source observations in import order.

Raw points:

- keep the imported position, timestamp, MMSI, SOG, COG, heading and navigation status;
- carry explicit provenance;
- do not receive accumulated distance or elapsed-route values;
- are not silently replaced by reconstructed values.

### Canonical Track

`VoyageData.points` is the current canonical track used by the UI.

Canonical points:

- are chronologically ordered;
- may contain derived SOG or COG when the source did not provide them;
- mark derived values with `derivedSog` and `derivedCog`;
- carry accumulated distance and elapsed route time;
- retain the provenance of the source observation from which they were derived.

### Editorial Route

Not part of Build 002. Editorial simplification and presentation geometry belong to a later contract and must never overwrite Raw or Canonical data.

## Timestamp provenance

Every point records how its timestamp was obtained:

- `source` — timestamp was present in the imported source;
- `receiver` — timestamp represents an external observation/receive time;
- `synthetic` — the mapper had to create a placeholder chronology;
- `unknown` — provenance was not supplied by a legacy/internal caller.

A synthetic timestamp is valid for previewing a track but must not be presented as an observed voyage time.

## Source formats

Build 002 recognizes the following provenance identifiers:

- `ais-nmea`
- `gps-nmea`
- `csv`
- `gpx`
- `json`
- `geojson`
- `synthetic`
- `unknown`

## MMSI binding

`trackContract.observedMmsi` lists all MMSIs found in Raw Track observations.

`trackContract.primaryMmsi` is set when:

1. voyage metadata explicitly supplies an MMSI; or
2. exactly one MMSI occurs in the source observations.

`trackContract.mixedMmsi` becomes `true` when observations from more than one MMSI are present.

Build 002 records this condition but does not discard observations. Enforcement/isolation belongs to the import-normalization and quality builds.

## NMEA policy

Single-fragment AIS position messages are decoded by the current parser. Multi-fragment AIVDM/AIVDO messages are explicitly rejected rather than guessed or partially combined. Fragment assembly belongs to Build 003.

GPS RMC sentences use their embedded UTC date/time where available. AIS position sentences without an external receive timestamp currently receive a synthetic timestamp and are marked accordingly.

## Invariants

```text
Raw data is preserved.
Canonical data is derived.
Derived values are identifiable.
Timestamp trust is explicit.
MMSI ambiguity is explicit.
Editorial data must remain a separate layer.
```
