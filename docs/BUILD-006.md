# Build 006 — Tauri Desktop Host

## Status

006A is accepted. 006B Native Project I/O is implemented on branch `build/006-tauri-desktop-host` and awaiting local acceptance.

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

Explicitly out of scope:

- Finder file association / double-click open
- native export dialogs
- document recents
- autosave
- renderer or visual changes

## 006B acceptance

After synchronizing the branch and installing the two frontend plugins, run:

```bash
npm run lint
npm run build
npm run tauri dev
```

Real-world checks in the native app:

1. `Cmd+O` opens a valid `.nlroute` through the native macOS dialog.
2. Edit any project field; dirty state appears.
3. `Cmd+S` saves back to the opened file without another dialog and clears dirty state.
4. `Shift+Cmd+S` opens the native Save As dialog, writes the selected file and makes that path the active project path.
5. Start/import a new journey; `Cmd+S` opens Save As because no native path is known yet.
6. Cancel Open and Save As dialogs; project and dirty state remain unchanged.
7. Browser `npm run dev` still uses the existing file input/download fallback.

Production gate after functional PASS:

```bash
npm run tauri build
```

Expected result: native project I/O without any change to Mapper semantics or approved visual output.
