# Phase 1 — Secure Electron Vertical Slice

## Objective

Turn the Phase 0 desktop foundations into a runnable, production-like Electron
application without changing the existing React, Three.js, Rapier, or Web Audio
gameplay path. Phase 1 is complete when an unpacked macOS application can launch
offline, reach the playable sanctuary, use the preload bridge, persist validated
data under Electron's application profile, and shut down cleanly under a
restrictive security policy.

The browser build remains supported throughout this phase. Desktop-specific
behavior must sit behind typed platform adapters rather than leaking Electron or
Node APIs into game modules.

## Non-goals

- Rewriting rendering, physics, audio synthesis, or world generation.
- Shipping signed/notarized installers.
- Claiming Windows, Intel macOS, controller, or long-session parity before those
  environments have actually been tested.
- Beginning a Godot port or broadly converting procedural content into assets.
- Completing the remaining premium-art roadmap.

## Work slices

### 1. Executable desktop shell and security boundary

Status: **implemented and verified**

- Add the Electron main-process composition root.
- Register the `app://turtleback` renderer protocol and the
  `turtleback-media://` local-audio protocol before window creation.
- Create a sandboxed `BrowserWindow` with context isolation, no Node integration,
  no webview tag, no insecure content, and a narrowly scoped preload.
- Deny unexpected navigation, new windows, permissions, and network requests.
- Apply a production Content Security Policy that permits WebAssembly compilation
  but does not grant general JavaScript `unsafe-eval`.
- Wire the existing IPC handlers, repositories, window-state manager, URL policy,
  local-audio library, and structured logger into one lifecycle owner.
- Add development and production renderer loading paths.

Acceptance gates:

- `pnpm desktop:dev` opens the title screen from the Vite development renderer.
- `pnpm desktop:build` produces the Vite renderer plus bundled main and preload
  outputs.
- The production-like app loads from `app://turtleback`, not `file://` or an
  unrestricted local server.
- The renderer has `window.desktopApp` but no `require`, `process`, or Node globals.
- Unexpected navigation, popups, permissions, local-network media, and arbitrary
  filesystem reads are rejected and logged.
- Rapier initializes under the production CSP without adding JavaScript
  `unsafe-eval`.

### 2. Durable desktop platform adapters

Status: **implemented and verified**

- Hydrate settings from the desktop repository before the game mounts.
- Persist validated setting changes through the preload bridge with debouncing
  and error reporting; browser development continues to use browser storage.
- Add a validated desktop repository and IPC methods for journal, station, and
  recent-video metadata so desktop media state does not depend on `localStorage`.
- Wire the music UI to the native folder picker and app-controlled
  `turtleback-media://` playback references in Electron while preserving the
  browser file-picker fallback.
- Add explicit save/autosave serialization from framework-neutral runtime DTOs.
- Decide and document whether browser data import is in Phase 1 or deferred to a
  later explicit migration tool. Do not attempt to read unrelated browser
  profiles automatically.

Acceptance gates:

- Settings survive a full app quit/relaunch in `userData`.
- Corrupt primary settings/save files recover from the last valid backup and log
  the recovery.
- Local audio playback never exposes an absolute filesystem path to the renderer.
- Browser builds still persist and play local files through their existing safe
  fallbacks.

### 3. Lifecycle, diagnostics, and recovery

Status: **implemented and verified**

- Route uncaught renderer errors, rejected promises, process crashes, and failed
  loads into the structured application log.
- Coordinate quit with renderer teardown for Web Audio, media playback, event
  listeners, and cached Three.js textures, with a bounded timeout so shutdown
  cannot hang.
- Restore only window bounds that intersect a current display.
- Handle second-instance activation, macOS activate/reopen, sleep/wake, renderer
  unresponsiveness, render-process termination, and GPU-process failure with
  logged, user-safe recovery.
- Add a recovery path that never silently discards durable data.

Acceptance gates:

- Normal quit finishes without a stuck process or active audio.
- A renderer crash/reload leaves settings and saves intact and produces a useful
  diagnostic record.
- Window state is restored on-screen after monitor/layout changes.

### 4. Tests, package proof, and baseline update

Status: **implemented and verified**

- Unit-test protocol path containment, URL/request policy, atomic JSON writes,
  backup recovery, schemas, and window-state decisions where they can be pure.
- Add an Electron smoke test for first launch, preload availability, production
  origin, restricted globals, offline startup, quit/relaunch persistence, and
  packaged Rapier initialization.
- Build an unpacked macOS application with Electron Builder and launch that exact
  artifact.
- Record commit, OS/hardware, Electron/Chromium versions, cold startup milestones,
  initial process memory, and a fixed 60-second Arrival Overlook frame sample.
- Update the audit, performance baseline, architecture, README commands, and
  manual QA matrix with verified behavior only.

Acceptance gates:

- Typecheck, unit tests, browser production build, desktop bundle, and Electron
  smoke test all pass from a clean install.
- The unpacked app launches offline and reaches a controllable frame.
- No browser-only persistence claim remains in the desktop documentation.
- Unknown platform or hardware results remain explicitly marked untested.

## Implementation order

1. Complete slice 1 before modifying user-facing persistence or media behavior.
2. Connect settings first in slice 2, then media metadata/local audio, then save
   serialization. Each adapter must have focused tests before the next one lands.
3. Add lifecycle teardown after the desktop services have real owners.
4. Package and measure the same fixed scene only after the production origin,
   CSP, and persistence paths are stable.

## Phase 1 definition of done

Phase 1 is done only when all four slices and their acceptance gates are closed.
A working development window alone is not completion; the proof must use the
unpacked production application, durable application-profile data, restrictive
security settings, clean shutdown, and recorded verification evidence.

## Implementation log

### 2026-07-13 — Slice 1 vertical slice established

Implemented:

- Electron main-process composition root and single-instance lifecycle.
- Sandboxed, context-isolated `BrowserWindow` with Node integration, webviews,
  insecure content, unexpected navigation, popups, and permissions disabled.
- `app://turtleback` renderer protocol with contained path resolution and direct
  packaged-resource reads; no renderer `file://` access was granted.
- `turtleback-media://` protocol with contained track IDs, streaming reads, and
  byte-range responses without exposing absolute paths.
- Restrictive CSP with WebAssembly compilation allowed but no general JavaScript
  `unsafe-eval`.
- Global remote-request policy, preload bridge, IPC services, repositories,
  local-audio library, window-state persistence, logging, and bounded renderer
  shutdown under one application owner.
- Vite renderer plus esbuild main/preload build pipeline, desktop development
  launcher, Electron Builder configuration, and unpacked packaging command.
- Focused protocol/path and URL-policy tests.

Verified on Apple Silicon macOS 26.5 with Electron 43.1.0 / Chromium 150.0.7871.47:

- Strict TypeScript check passed.
- 146 unit tests passed across 19 files.
- Browser production build and desktop main/preload bundles passed.
- Electron Builder produced an unpacked arm64 application. The bundled app
  archive is approximately 4.2 MB; development dependencies are excluded.
- The packaged renderer loaded from `app://turtleback/index.html`.
- `window.desktopApp` was available while `window.require` and `window.process`
  were unavailable.
- The canvas initialized, the title screen rendered, Enter Sanctuary reached a
  playable Arrival Overlook frame, and no CSP/Rapier error was observed.
- `pnpm desktop:dev` launched the Vite renderer and Electron window together;
  its development-only CSP allowance supported React Refresh while production
  retained the stricter policy.
- Closing through the preload bridge logged `lifecycle.shutdown_requested` and
  `lifecycle.renderer_shutdown_ready`, then the process exited cleanly.

The automated packaged-app proof was completed in slice 4. Replacing Electron's
default icon remains dependent on final original artwork; signing and
notarization remain outside Phase 1.

### 2026-07-13 — Slice 2 durable adapters established

Implemented:

- Pre-mount desktop hydration for settings, media metadata, preferences, platform
  information, and the validated autosave envelope.
- Debounced settings/media writes and a 60-second autosave through the preload
  bridge, with an explicit flush on visibility changes and coordinated quit.
- Portable, schema-validated player/world/settings/media save data. Player
  transform restore is deferred until the Rapier scene is ready.
- Main-process repositories for settings, media, preferences, saves, and native
  local-audio folder registrations, including atomic writes, backups, corruption
  reporting, and erase-all support.
- Native folder selection and opaque `turtleback-media://` playback references in
  Electron while retaining browser file-picker and IndexedDB fallbacks.
- Desktop media state no longer treats renderer `localStorage` as authoritative.
  Browser-profile import is deferred to a future explicit export/import tool;
  Phase 1 does not inspect unrelated browser profiles.

Verified on the same Apple Silicon macOS environment as slice 1:

- Strict TypeScript, ESLint, 152 unit tests across 21 files, the browser
  production build, desktop bundles, and all 12 browser Playwright flows passed.
- An unpacked arm64 app persisted an FOV change and journal entry across a full
  process quit and relaunch using the same application profile.
- A seeded autosave player transform was applied only after scene readiness and
  written back from the live runtime on the following clean shutdown.
- The packaged renderer reported no page, CSP, preload, or Rapier errors during
  those launches. Settings and autosave writes completed before the renderer's
  shutdown-ready acknowledgement.

### 2026-07-13 — Slice 3 lifecycle and recovery established

Implemented:

- Detachable keyboard, mouse, gamepad, rumble, pointer-lock, global-error, and
  lifecycle listeners, plus coordinated React, Web Audio, media, persistence,
  and shared-texture teardown under a three-second main-process deadline.
- Main-to-renderer suspend/resume events that flush an autosave, clear transient
  input, release pointer lock, pause media, suspend Web Audio, and resume the
  ambient audio context after wake.
- Structured diagnostics for renderer crashes, failed main-frame loads,
  unresponsive/responsive transitions, GPU/child process termination, sleep,
  wake, second-instance activation, and main/renderer exceptions.
- Bounded automatic renderer recovery. Two failures within one minute reload the
  production origin with a visible recovery notice; a third loads a low-activity
  safe screen with restart and diagnostic-log actions instead of looping.
- Corrupt atomic JSON primaries are quarantined as `.corrupt`, valid backups are
  promoted immediately, and missing/default data can be reseeded without
  silently destroying the invalid bytes.
- Off-screen saved window bounds are rejected against current display work areas.

Verified:

- Strict TypeScript, ESLint, 157 unit tests across 22 files, browser production
  build, desktop bundles, and unpacked arm64 packaging passed.
- CDP deliberately crashed the packaged renderer. The main process logged exit
  code 5, automatically restored `app://turtleback`, recreated the preload
  bridge, retained repository access, displayed the recovery notice, and then
  shut down cleanly after renderer teardown.
- Three deliberate crashes in one process selected reload, reload, then safe
  mode as designed. A durable FOV value of 83 remained intact on the safe screen.
- Backup-recovery tests prove the primary is repaired while the invalid original
  remains quarantined. Window-placement tests cover reachable and stranded bounds.
- A real machine sleep cycle was not forced during automation; the packaged
  suspend/resume path is wired through Electron `powerMonitor` and remains a
  manual QA check to exercise on target hardware.

### 2026-07-13 — Slice 4 package proof and baseline closed

Implemented:

- `pnpm desktop:smoke` launches the existing unpacked artifact under Playwright
  with a clean profile and DNS resolution disabled, then verifies the production
  origin, preload boundary, restricted globals, visible Rapier/Three canvas,
  settings UI persistence, autosave-on-quit, full relaunch hydration, and clean
  process exit.
- `pnpm desktop:measure` runs the same proof and adds a five-second warm-up plus
  a fixed 60-second `requestAnimationFrame` sample and Electron per-process
  memory/CPU snapshots.
- README commands, architecture, conversion audit, performance baseline, raw
  measurement evidence, and manual QA coverage now distinguish verified macOS
  behavior from untested platforms and hardware.

Verified on Apple M5 macOS 26.5.1 (build 25F80), 16 GB memory, 10 CPU cores / 10
GPU cores, Electron 43.1.0, Chromium 150.0.7871.47:

- The automated unpacked-app smoke passed twice from fresh profiles while DNS was
  mapped to `NOTFOUND`. The renderer used `app://turtleback/index.html`, exposed
  `window.desktopApp`, and exposed neither `require` nor `process`.
- Clean-profile title/Rapier readiness was 1.776 seconds and the first
  controllable frame was 1.889 seconds from process launch. Renderer navigation
  reported first contentful paint at 144 ms.
- A real UI change to FOV 83 and High quality survived coordinated quit/relaunch;
  the media repository was present and the `autosave` slot was restored.
- The 60.007-second High-preset Arrival Overlook sample captured 7,201 frames:
  120.00 FPS average, 8.3 ms median, 9.5 ms p95, 10.0 ms p99, 10.4 ms maximum,
  and zero frames over 25 ms.
- The unpacked app occupied approximately 280.1 MiB, including Electron; its
  `app.asar` was approximately 4.25 MiB. Aggregate working set was approximately
  746 MiB at title, 806 MiB at gameplay sample start, and 839 MiB at sample end.
- Strict TypeScript, ESLint, all 157 unit tests, all 12 browser Playwright flows,
  browser/desktop production builds, unpacked packaging, packaged smoke, and the
  60-second packaged measurement passed.

## Phase 1 closeout

All four work slices and Phase 1 acceptance gates are closed for the verified
Apple Silicon macOS environment. Windows x64, Intel macOS, Linux, other GPU
classes, controller-connected packaged play, real sleep/wake hardware exercise,
long-session soak, final icon artwork, signing, notarization, and installers
remain explicitly untested or out of scope; no support claim is inferred for
them.
