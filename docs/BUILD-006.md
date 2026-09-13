# Build 006 — Tauri Desktop Host

## Status

006A implementation prepared on branch `build/006-tauri-desktop-host`.

## Product boundary

Build 006 turns the existing Northern Lines AIS Route Mapper into a native Tauri v2 desktop application.

The existing Mapper product, cartography renderer, Editorial Cartography Visual Baseline 1 and `.nlroute` data model remain unchanged.

> Output and host integration may evolve. The approved cartographic visual language does not.

## 006A — Tauri Host Baseline

Scope:

- add a minimal Tauri v2 Rust host
- keep the existing React/Vite frontend unchanged
- pin the Vite development server to port 3000 for the native host
- add a native desktop window
- add the default Tauri capability
- enable native application bundling

Explicitly out of scope for 006A:

- native Open / Save / Save As
- `.nlroute` file associations
- native export dialogs
- renderer changes
- cartography changes
- Visual Baseline changes
- application icon/final release branding

## Acceptance

Local acceptance on macOS:

```bash
npm install
npm run lint
npm run build
npm run tauri dev
```

The Mapper must open in a native macOS application window and retain the existing browser functionality and visual appearance.

Production acceptance:

```bash
npm run tauri build
```

Expected result: a buildable native macOS application bundle without changes to Mapper semantics or visual output.

## Next step after 006A PASS

006B — Native Project I/O

Planned scope:

- Open `.nlroute`
- Save
- Save As
- native macOS dialogs
- standard keyboard shortcuts

006B must reuse the existing `.nlroute` serialization contract rather than introducing a second project format.
