# Build 003 — Import Normalization Contract

## Purpose

Import normalization is the boundary between external file/text formats and the Northern Lines track domain.

```text
external source
   ↓
format adapter
   ↓
normalized Raw Track points
   ↓
Track Data Contract (Build 002)
   ↓
Canonical Track
```

The Route Mapper does **not** become an AIS recorder or a second Track Quality Analyzer. It only translates supported source representations into traceable Raw Track observations.

## Supported adapters

Build 003 normalizes:

- CSV / delimited coordinate tables
- GPX track points
- JSON point arrays
- GeoJSON Point features
- GPS NMEA RMC
- AIS NMEA AIVDM / AIVDO

## NMEA fragment assembly

AIVDM/AIVDO messages may consist of multiple fragments. Build 003 buffers fragments by talker/type, sequence id, channel and expected fragment count.

A message is decoded only when all expected fragments are present. Incomplete fragment groups are not guessed or converted into observations.

The normalization summary exposes:

- `assembledNmeaMessages`
- `incompleteNmeaFragments`
- `ignoredRecords`

## Timestamp provenance

Timestamp origin remains explicit:

- `source` — timestamp is embedded in the source record, e.g. GPX `<time>`, CSV timestamp, GPS RMC date/time.
- `receiver` — timestamp was attached by the receiving/logging system before the NMEA sentence.
- `synthetic` — no trustworthy timestamp was available; a monotonic import-only fallback was assigned.
- `unknown` — provenance cannot be determined.

A receiver timestamp is never silently promoted to a source timestamp.

## AIS position decoding

The mapper currently derives position observations from AIS message types 1, 2, 3 and 18. Other correctly assembled AIS messages may be ignored because they do not contribute a route position in the current contract.

This is deliberate: Build 003 is an import normalizer, not a complete AIS protocol implementation.

## Import summary

Text/file imports receive an optional `VoyageData.importNormalization` summary:

```ts
{
  version: '0.3.0',
  detectedFormat,
  inputRecords,
  normalizedPoints,
  ignoredRecords,
  assembledNmeaMessages,
  incompleteNmeaFragments,
}
```

The summary describes normalization behavior. It is **not** a journey-quality verdict.

## Ownership boundary

```text
Recorder owns observation.
Tracker QA owns track validity.
Route Mapper owns import normalization and reconstruction.
Studio owns editorial presentation.
```

Northern Lines Journey QA is consumed later through the Journey Quality Contract; it is not recomputed here.
