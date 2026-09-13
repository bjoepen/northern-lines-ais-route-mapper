# Build 006 — Tauri Desktop Host

## Status

**BUILD 006 — TAURI DESKTOP HOST — FINAL PASS 🟢**

006A Tauri Host Baseline: PASS. 006B Native Project I/O: REAL-WORLD PASS. 006C Native Export: REAL-WORLD PASS. 006D Packaging & Acceptance: REAL-WORLD PASS. 006D-R1 Native Editorial Input Repair: REAL-WORLD PASS.

Build 006 is merged to `main` and accepted as the native production baseline of the Northern Lines AIS Route Mapper.

## Product boundary

Build 006 turns the existing Northern Lines AIS Route Mapper into a native Tauri v2 desktop application.

The existing Mapper product, cartography renderer, Editorial Cartography Visual Baseline 1 and `.nlroute` data model remain unchanged.

> Output and host integration may evolve. The approved cartographic visual language does not.

The native Tauri application is the production surface. Browser execution remains useful for development and fallback testing, but browser-specific download behavior is not a release gate for Build 006.

## 006A — Tauri Host Baseline

Accepted scope:

- minimal Tauri v2 Rust host
- existing React/Vite frontend retained
- Vite development server pinned to port 3000
- native desktop window
- Tauri capability baseline
- native application bundling
- Northern Lines application icon

006A local and production acceptance: PASS.

## 006B — Native Project I/O

Contract:

- `.nlroute` serialization and parsing remain owned by `src/project/nlroute.ts`
- browser project I/O remains available outside Tauri
- Tauri uses native Open and Save dialogs
- native session remembers the path of an opened or saved project
- `Cmd+O` opens a `.nlroute`
- `Cmd+S` writes to the known path; without a known path it behaves as Save As
- `Shift+Cmd+S` always invokes Save As
- cancelling a dialog does not change project state or dirty state
- successful native save clears dirty state
- opening another project while dirty retains the existing confirmation guard
- importing or creating a new journey clears the remembered native project path

Implementation boundary:

- native adapter: `src/project/nativeProjectIO.ts`
- app orchestration: `src/AppShellEditorial.tsx`
- Tauri plugins: dialog and filesystem
- no renderer, cartography, Editorial Cartography or `.nlroute` schema changes

006B real-world acceptance: PASS.

## 006C — Native Export

Contract:

- the approved Editorial Cartography renderer remains unchanged
- A5/A4/A3/A2 sizing and 300 dpi PNG raster dimensions remain unchanged
- SVG and PNG continue to use the current file naming contract
- inside Tauri, SVG and PNG export use a native macOS Save dialog
- the user chooses destination and file name instead of the file being dropped into Downloads
- cancelling the Save dialog produces no file and no error state
- no export path is persisted as project state

Implementation boundary:

- native export integration lives in `src/export/editorialOutput.ts`
- native Save dialog uses the existing Tauri dialog plugin
- binary output uses the existing Tauri filesystem plugin
- no changes to map composition, geography, typography, colors, Editorial Visual Baseline 1 or `.nlroute`

006C real-world acceptance: PASS.

## 006D — Packaging & Acceptance

Goal: close Build 006 as a native macOS product without changing Mapper semantics or the frozen Editorial Cartography visual language.

Packaging scope:

- final production build with `npm run tauri build`
- application bundle at `src-tauri/target/release/bundle/macos/Northern Lines AIS Route Mapper.app`
- install helper `scripts/install-macos-app.sh`
- installation into `/Applications`
- cold-start launch from the installed application
- final smoke test of native project I/O and editorial export

### 006D acceptance sequence

The production gate was executed with:

```bash
npm run lint
npm run build
npm run tauri build
chmod +x scripts/install-macos-app.sh
./scripts/install-macos-app.sh
```

The installed application was then launched independently of the Vite development server:

```bash
open "/Applications/Northern Lines AIS Route Mapper.app"
```

Real-world acceptance covered:

1. Cold start of the installed Mapper application.
2. Northern Lines application icon in the native macOS bundle.
3. Native opening of an existing `.nlroute` project.
4. Direct `Cmd+S` save to the known project path without another dialog.
5. `Shift+Cmd+S` Save As through the native dialog.
6. Native SVG export.
7. Native PNG 300 dpi export with the existing A-series format/orientation contract.
8. Safe cancellation of native dialogs.
9. Clean application relaunch.
10. Clean repository state after production build and installation.

006D real-world acceptance: PASS.

## 006D-R1 — Native Editorial Input Repair

During installed-app acceptance, the existing `window.prompt(...)` flow for adding editorial journey places proved unsuitable for the native Tauri production surface.

The repair replaced the prompt chain with an embedded Northern Lines place-entry panel in `src/components/EditorialContentEditor.tsx`.

The repair preserves:

- the existing `EditorialJourneyPlace` / `.nlroute` data contract
- decimal coordinate input with dot or comma
- geographic anchors and editorial label offsets
- existing place rendering and persistence
- the frozen Editorial Cartography Visual Baseline 1

No cartography, renderer or project-schema behavior was changed.

006D-R1 real-world acceptance: PASS.

## Final acceptance

Build 006 is complete and merged to `main`.

Accepted native production chain:

```text
Northern Lines AIS Route Mapper
        ↓
Tauri v2 macOS host
        ↓
.nlroute Open / Save / Save As
        ↓
Editorial Cartography
        ↓
Native SVG / PNG export
        ↓
Installed macOS application
```

The production surface is the native Tauri application. The Editorial Cartography Visual Baseline 1 remains frozen.

**BUILD 006 — TAURI DESKTOP HOST — FINAL PASS 🟢**

Finder `.nlroute` file association remains explicitly out of scope for Build 006 unless separately approved.
