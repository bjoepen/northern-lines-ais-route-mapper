# Build 005B – Editorial Cartography

Status: **Real-World PASS**

## Ziel

Build 005B etabliert Northern Lines Editorial Cartography als eigenständige Ausgabeebene des AIS Route Mapper. Die echte, QA-validierte Reise wird nicht als Diagnosekarte, sondern als ruhiges redaktionelles Reiseobjekt dargestellt.

Grundsatz:

> Output changes the medium, not the visual language.

Die Visual Baseline 1 ist nach Abschluss dieses Builds eingefroren.

## Architekturgrenze

- Recorder owns observation.
- Tracker / QA Troll owns validity and reconstruction candidates.
- Route Mapper owns human review and editorial display adjustment.
- Studio owns final editorial presentation.

Der Mapper führt keine zweite QA- oder Routing-Logik ein.

## 005B-B – Geographic Renderer

- lokaler Natural-Earth-Renderer
- reduzierte Vektorgeografie
- keine Tile-Screenshots
- adaptive Auflösung 10m / 50m / 110m
- geografische Projektion auf die Editorial Composition

Status: **PASS**

## 005B-C – Journey Composition

- automatische Hoch-/Querformatentscheidung anhand der Journey Bounds
- definierte Header-, Footer- und Journey-Zonen
- Norwegen-Referenzreise erfolgreich als Hochformat komponiert

Status: **Real-World PASS**

## 005B-D / D1 / D2 – Typography & Journey Places

- Northern-Lines-Typografiehierarchie
- Eyebrow, Titel und Beschreibung
- redaktionelle Ortsanker
- geografische Anker bleiben unverändert
- Beschriftungen erhalten ausschließlich redaktionelle Offsets
- Ortsbeschreibungen und Leader Lines
- Speicherung in `.nlroute`

Status: **Real-World PASS**

## Visual Baseline 1

Verbindliche Gestaltung:

- warmes Papier
- sehr zurückhaltende helle Landflächen
- feine Küstenlinien
- tiefes, gedämpftes Seegrün für die Reise
- Sand als Akzent
- dunkelgraugrüne Typografie
- bewusste Negativräume
- ruhige Hierarchie
- keine dekorative Reiseposter-Typografie
- keine zusätzliche Kartenornamentik ohne fachlichen Grund

**Designstatus: LOCKED.**

Weitere Builds dürfen Produktions- und Ausgabequalität entwickeln, aber nicht die visuelle Sprache von 005B neu gestalten.

## 005B-E – Editorial Output Contract

Ausgabeformate:

- A5
- A4
- A3
- A2
- SVG
- PNG · 300 dpi

Die Ausgabe enthält ausschließlich die freigegebene Editorial-Szene; Editor-Chrome wird nicht exportiert.

Die Norwegen-Referenzreise wurde als reale A5-Ausgabe erfolgreich exportiert.

Status: **Real-World PASS**

## 005B-E1 – Format & Orientation Contract

Orientierungsmodi:

- Auto
- Hochformat
- Querformat

`Auto` verwendet die bestehende Journey-Analyse. Hoch- und Querformat ändern ausschließlich die verfügbare Kompositionsfläche; Visual Baseline 1 bleibt unverändert.

Real-World-Abnahme mit der Norwegen-Referenzreise:

- Auto: PASS
- Hochformat: PASS
- Querformat: PASS
- A5 / A4 / A3 / A2: PASS
- SVG / PNG 300 dpi: PASS

Abnahmeprädikat: **„Pass mit Aussicht bis in den Ärmelkanal.“**

Status: **Real-World PASS**

## Quality Gates

Vor Merge auf `main`:

```bash
npm run lint
npm run build
```

Beide Gates müssen grün sein.

## Abschluss

005B ist funktional und visuell abgeschlossen. Neue Features werden nicht mehr an diesen Build angehängt.

```text
DESIGN
→ eingefroren

OUTPUT / PRODUCTION
→ darf in Folgebuilds weiterentwickelt werden
```

Nächster Schritt: Branch final synchronisieren, Quality Gates erneut ausführen und anschließend auf `main` mergen.
