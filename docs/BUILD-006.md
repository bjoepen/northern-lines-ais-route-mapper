# Build 006 — Tauri Desktop Host

## Status

006A Tauri Host Baseline: PASS. 006B Native Project I/O: REAL-WORLD PASS. 006C Native Export: REAL-WORLD PASS. 006D Packaging & Acceptance is active on branch `build/006-tauri-desktop-host`.

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

Run from the repository root:

```bash
npm run lint
npm run build
npm run tauri build
chmod +x scripts/install-macos-app.sh
./scripts/install-macos-app.sh
```

Then close any development instance and launch the installed application:

```bash
open "/Applications/Northern Lines AIS Route Mapper.app"
```

Real-world acceptance in the installed app:

1. Cold start reaches the empty Mapper state without requiring the Vite development server.
2. The Northern Lines application icon is present in Finder/Dock.
3. Open an existing `.nlroute` through the native Open dialog.
4. Modify editorial content and save with `Cmd+S`; the known project path is overwritten without another dialog.
5. Use `Shift+Cmd+S`; a native Save As dialog opens and the new path becomes the current project path.
6. Export one SVG through the native Save dialog and verify the file opens correctly.
7. Export one PNG 300 dpi through the native Save dialog and verify the selected A-series format and orientation.
8. Cancel a native Open, Save As and Export dialog once; cancellation must not damage the current project or produce an error.
9. Quit and relaunch the installed app once more; cold start must remain clean.

### 006D production gate

After the real-world checks:

```bash
git status
```

Expected repository state: clean working tree. Generated Tauri build output must remain outside version control.

When all checks pass, Build 006 may be marked:

`BUILD 006 — TAURI DESKTOP HOST — FINAL PASS`

Finder `.nlroute` file association remains explicitly out of scope for Build 006 unless separately approved.
