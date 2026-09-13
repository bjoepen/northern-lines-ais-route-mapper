# Build 005R — Mapper Review Contract

## Goal

Build 005R teaches Northern Lines AIS Route Mapper to consume Cartography `mapper-review.geojson` as a semantic review artifact instead of treating it as generic GeoJSON.

The Mapper does not rerun QA and does not promote reconstructed geometry to observed AIS truth.

## Ownership

```text
Recorder owns observation.
Tracker / QA Troll owns validity and reconstruction candidates.
Route Mapper owns human review and later editorial adjustment.
Studio owns final editorial presentation.
```

## Accepted review layers

The adapter recognizes these `routeLayer` values:

```text
ais_point
observed_route
reconstructed_route
```

`ais_point` is imported as the timestamped AIS observation/index layer.

`observed_route` is rendered as supplied observed route geometry.

`reconstructed_route` is retained as derived geometry with its upstream review metadata, including when present:

```text
evidenceClass
sourceSegmentIndex
sourceEventIndex
method
methodVersion
reviewState
visualAcceptance
classification
policyReason
note
```

No location name, route count, known Norway gap or expected source segment number is hard-coded.

## Generic reference artifact

The first generic real-world acceptance artifact contains:

```text
4409 ais_point features
6 observed_route features
5 reconstructed_route features
```

All five reconstruction candidates are currently reviewable upstream output rather than production-approved geometry.

The count is intentionally not treated as a contract invariant. A later artifact may contain any number of observed/reconstructed route features.

## Rendering

Mapper Review rendering intentionally distinguishes evidence classes:

```text
observed_route       Northern Lines sea line
reconstructed_route review line, visually distinct
```

A reconstructed route with `reviewState = review_required` is shown as a review candidate and exposes its upstream metadata through the map popup.

Playback is disabled for the Mapper Review artifact in 005R. The artifact contains real AIS timestamps, but its purpose is reconstruction review, not playback/product export. This prevents review geometry from being mistaken for a production route.

## Non-negotiable invariants

1. AIS observations remain unchanged.
2. Reconstructed geometry remains `derived_not_observed` when supplied that way.
3. Mapper does not perform landmask, maritime routing or Troll QA.
4. Mapper does not silently approve reconstruction candidates.
5. Mapper Review data is never written back as Normalized Track evidence.
6. No reconstructed route is inferred from a known place or known Norway fixture.

## Editorial adjustment follow-up

The approved Editorial Gap / Reconstruction Adjustment remains a Mapper responsibility:

- exact AIS endpoints remain fixed;
- a review connector may receive one or more editorial control points;
- `+` adds another control point so the visual route need not form a triangle;
- reset restores the upstream reconstruction geometry;
- adjustments are presentation-only and never overwrite QA reconstruction;
- upstream production reconstruction always outranks an editorial adjustment.

The interactive control-point editor is deliberately separated from the 005R import contract so the generic producer/consumer boundary can be accepted first.

## Real-world acceptance target

Import the generically generated `mapper-review.geojson` and verify:

```text
4409 AIS points
6 observed routes
5 reconstructed routes
5 review-required candidates
Mapper Review mode visible
Playback hidden
observed and reconstructed route geometry visually distinct
clicking reconstructed geometry exposes method/review metadata
```

Quality gates:

```bash
npm run lint
npm run build
npm run dev
```

## Status

Implementation branch:

```text
build/005R-mapper-review-contract
```

Real-world UI acceptance remains pending local execution.
