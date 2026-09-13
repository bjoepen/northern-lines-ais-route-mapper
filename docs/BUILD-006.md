# Build 006 — Tauri Desktop Host

## Status

006A is accepted. 006B Native Project I/O is accepted locally. 006C Native Export is implemented on branch `build/006-tauri-desktop-host` and awaiting local acceptance.

## Product boundary

Build 006 turns the existing Northern Lines AIS Route Mapper into a native Tauri v2 desktop application.

The existing Mapper product, cartography renderer, Editorial Cartography Visual Baseline 1 and `.nlroute` data model remain unchanged.

> Output and host integration may evolve. The approved cartographic visual language does not.

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

006B local acceptance: PASS.

## 006C — Native Export

Contract:

- the approved Editorial Cartography renderer remains unchanged
- A5/A4/A3/A2 sizing and 300 dpi PNG raster dimensions remain unchanged
- SVG and PNG continue to use the current file naming contract
- inside Tauri, SVG and PNG export use a native macOS Save dialog
- the user chooses destination and file name instead of the file being dropped into Downloads
- cancelling the Save dialog produces no file and no error state
- outside Tauri, the existing browser download fallback remains available
- no export path is persisted as project state

Implementation boundary:

- native export integration lives in `src/export/editorialOutput.ts`
- native Save dialog uses the existing Tauri dialog plugin
- binary output uses the existing Tauri filesystem plugin
- no changes to map composition, geography, typography, colors, Editorial Visual Baseline 1 or `.nlroute`

## 006C acceptance

Run:

```bash
npm run lint
npm run build
npm run tauri dev
```

Real-world checks in the native app:

1. Open a journey and go to Export.
2. Export SVG. A native macOS Save dialog must open.
3. Select a custom folder and file name. The SVG must be written there and nowhere else.
4. Export PNG 300 dpi. A native macOS Save dialog must open.
5. Select a custom folder and file name. The PNG must be written there and keep the selected A-series dimensions/orientation.
6. Cancel both SVG and PNG Save dialogs. No file must be created and no error alert may appear.
7. Run the browser app with `npm run dev`; SVG/PNG must still use the existing browser download fallback.

Production gate after functional PASS:

```bash
npm run tauri build
```

Expected result: native project I/O and native editorial export without any change to Mapper semantics or approved visual output.

## Next step after 006C PASS

006D — Packaging & Acceptance

Planned scope:

- final macOS application bundle acceptance
- clean-install / cold-start check
- project Open / Save / Save As smoke test
- native SVG / PNG export smoke test
- package documentation and release readiness

Finder `.nlroute` file association remains a separate follow-up unless explicitly pulled into 006D.
