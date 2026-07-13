# Electron Conversion Audit

## Purpose and scope

This document records the Phase 0 audit of Turtleback Sanctuary before the
desktop conversion. The browser game at baseline commit `a1f7ec3` is the visual
and behavioral source of truth. The audit is intentionally descriptive: it does
not treat a planned Electron service or future Godot equivalent as already
implemented.

The required finding classifications used below are:

- **Directly reusable.** Can run in Electron's sandboxed Chromium renderer
  without changing its ownership or security boundary.
- **Reusable with an Electron adapter.** Existing behavior or logic can remain,
  but operating-system access or lifecycle behavior must be provided through a
  narrow typed preload bridge.
- **Browser-only and requiring replacement.** The current implementation is not
  an acceptable desktop implementation and must be replaced, not merely exposed
  to Node.js.
- **Risky or uncertain.** Requires a focused packaged-build, security, hardware,
  provider, or performance test before it can be claimed as supported.
- **Candidate for future Godot-portable refactoring.** Engine-neutral data or
  logic should be extracted without beginning a Godot port.

## Baseline status

| Item | Audited baseline |
| --- | --- |
| Source reference | Clean commit `a1f7ec3` |
| Package manager | pnpm 11.12.0 (`package.json` pins `pnpm@11.12.0`) |
| Runtime requirement | Node 20 or newer; audit machine used Node 26.5.0 |
| Browser build | Vite static production bundle with `base: './'` |
| Browser launch | Start screen and playable Arrival Overlook verified in the in-app browser |
| Type checking | Passed with `tsc --noEmit` |
| Linting | Passed with ESLint over `src` |
| Unit tests | 18 Vitest files, 140 tests passed |
| Browser E2E | 12 Playwright tests are defined; a full Phase 0 Playwright run was not recorded |
| Desktop support | No Electron application, preload bridge, IPC, packaging, installer, or desktop tests at baseline |

The README's stated count of 124 unit tests is stale; the audited suite contains
140. This is documentation drift, not a test failure.

## Build system and project configuration

The application is a TypeScript ESM project built by Vite. `pnpm build` runs a
strict no-emit TypeScript check followed by `vite build`. The renderer targets
ES2022 and is emitted as a static `dist/` directory. Vite's relative base is
already suitable for a renderer loaded from a packaged application directory.

Production source maps are disabled in the baseline. Development uses Vite HMR,
and Playwright starts a separate Vite development server. There are no desktop
development, production-like desktop launch, package, signing, or notarization
commands. The only application icon is an SVG browser favicon; platform installer
icons and application metadata do not exist.

The deployment documentation targets Netlify, Vercel, Cloudflare Pages, and
GitHub Pages. There is no checked-in deployment workflow or host-specific config.
The application has no backend, database, authentication, analytics, runtime
secret, or required environment variable. Runtime environment branching is
limited to `import.meta.env.DEV`; `BASE_URL` appears only in prospective music
documentation.

### Resolved framework and tool versions

The installed dependency tree at audit time resolved to:

| Package | Version |
| --- | ---: |
| React / React DOM | 19.2.7 |
| Three.js | 0.182.0 |
| `@react-three/fiber` | 9.6.1 |
| `@react-three/drei` | 10.7.7 |
| `@react-three/postprocessing` | 3.0.4 |
| `postprocessing` | 6.39.2 |
| `@react-three/rapier` | 2.2.0 |
| `@dimforge/rapier3d-compat` | 0.19.2 |
| Zustand | 5.0.14 |
| Vite | 7.3.6 |
| TypeScript | 5.9.3 |
| Vitest | 3.2.7 |
| Playwright | 1.61.1 |

No Electron, packaging, schema-validation, structured-logging, or desktop E2E
dependency was present at the audited baseline.

## System inventory

### Rendering and world simulation

The renderer is React Three Fiber over Three.js WebGL2. It uses ACES filmic tone
mapping, PCF soft shadows, optional bloom, custom GLSL sky/ocean/weather effects,
and procedural Three.js geometry. `GameCanvas.tsx` owns the R3F `Canvas`; the DOM
UI is deliberately outside the canvas. This division is sound for Electron and
preserves the current renderer.

Continuous state is kept out of React in a mutable `runtime` singleton. The
single `FrameDriver` advances time, weather, turtle travel, audio, input polling,
and automatic quality. Discrete UI and settings use Zustand. This avoids excess
React rendering, but `runtime.player.pos` is a Three.js `Vector3`; the runtime
object must never be serialized as portable save data.

The graphics quality profiles already control DPR, shadow enablement/resolution
and distance, ocean detail, rain count, vegetation density, draw distance,
reflections, bloom eligibility, clouds, landmarks, and dynamic light count.
The UI exposes Auto/Low/Medium/High, FOV, UI scale, bloom, and particle density.
It does not expose desktop display mode, window size, render-scale override,
frame cap, V-sync, or an anti-aliasing selector.

Classification:

- **Directly reusable:** React, R3F, Three.js scene, shaders, DOM UI, quality
  profiles, frame driver, WebGL context-loss handling, and WebGL2 feature gate.
- **Risky or uncertain:** packaged GPU selection, GPU-process recovery, WebGL
  behavior on Windows and Intel/Apple Silicon macOS, long-session disposal, and
  whether current automatic quality thresholds are appropriate under Electron.
- **Candidate for future Godot-portable refactoring:** numeric quality settings,
  time/weather/environment values, and runtime DTOs that exclude Three objects.

### Physics

Physics is Rapier WASM through `@react-three/rapier`. The player is a kinematic
capsule driven by Rapier's character controller with autostep, ground snapping,
slope limits, and fixed simplified colliders for the world. This is a mature
working system and should not be replaced for the desktop conversion.

The production physics chunk contains WebAssembly instantiation paths and a
wasm-bindgen `new Function` import. Its compatibility with the final restrictive
Content Security Policy must be demonstrated in a packaged build. Broadly
enabling `unsafe-eval` is not an acceptable shortcut.

Classification:

- **Directly reusable:** Rapier world, controller behavior, collider authoring,
  and physics integration in the renderer.
- **Risky or uncertain:** CSP/WASM behavior, packaged load latency, frame pacing,
  and cross-platform controller/collision parity.
- **Candidate for future Godot-portable refactoring:** player dimensions,
  movement constants, gravity, spawn points, traversal metadata, and simplified
  collision descriptors. Rapier behavior itself will require a future native
  controller reimplementation.

### Audio

`AudioManager` lazily creates a Web Audio graph after the Enter Sanctuary user
gesture. It provides master, music, ambient, SFX, and media buses. The procedural
music, ambience, positional media, interaction sounds, and UI cues are all
implemented with Web Audio. Visibility changes suspend and resume the context.

Disposal methods exist for audio engines, but no application shutdown owner calls
them. Production audio failures are not written to a persistent diagnostic log.

Classification:

- **Directly reusable:** Web Audio synthesis, mixer topology, procedural music,
  ambience, SFX, listener updates, and current user-gesture start behavior.
- **Reusable with an Electron adapter:** application visibility, suspend/resume,
  shutdown, logging, and platform media references.
- **Risky or uncertain:** device switching, sleep/wake, renderer restart, audio
  behavior during fullscreen transitions, remote streams, and long-session node
  cleanup.
- **Candidate for future Godot-portable refactoring:** bus names, volume values,
  mood definitions, zone metadata, audio cue definitions, and station metadata.
  Web Audio synthesis code itself is not directly portable to Godot.

### State management and settings

Zustand owns ephemeral UI state plus persisted settings and media state. Settings
have version 1, a version-0 migration, defaults, a deep merge, and a reset action.
The merge rejects broad type mismatches but does not validate enum membership,
finite values, numeric ranges, array lengths, or future-version compatibility.
Media persistence has no migration or runtime validation.

Classification:

- **Directly reusable:** Zustand for renderer-only UI state and the existing
  settings UX.
- **Reusable with an Electron adapter:** settings reads/writes after moving the
  persistence boundary to a typed platform service.
- **Risky or uncertain:** invalid same-type values currently survive the merge;
  media/journal payloads are accepted without a schema.
- **Candidate for future Godot-portable refactoring:** a framework-neutral
  `GameSettings` DTO, defaults, validation schema, migration functions, home
  customization, accessibility defaults, and balance values.

### Save system

The baseline does not have a game save. Zustand persists settings, recent video
IDs, radio stations, journal entries, and home customization to `localStorage`.
The declared `session` save key is unused. Player position, time progress,
weather simulation, activities, travel distance, and world state are not saved.

The `safeStorage` wrapper probes `localStorage` and silently falls back to an
in-memory `Map` if storage is unavailable. This prevents crashes in a browser but
does not provide durable desktop persistence. There are no slots, atomic writes,
backups, corruption detection, recovery, portable save envelope, or game-version
compatibility policy. A desktop application profile will not automatically have
access to saves stored by an unrelated hosted browser origin.

Classification:

- **Browser-only and requiring replacement:** `localStorage` as the authoritative
  desktop save/settings store and the silent in-memory fallback as a durability
  strategy.
- **Reusable with an Electron adapter:** existing browser persistence may remain
  as the browser development implementation behind a `SaveService` and
  `SettingsService` interface.
- **Risky or uncertain:** automatic import of hosted-browser saves is generally
  not feasible across browser profiles/origins. An explicit export/import path
  must be documented if migration is required.
- **Candidate for future Godot-portable refactoring:** a versioned portable JSON
  save DTO containing only player, world, settings, and progression data, plus
  pure migration and validation functions.

### Input

`InputManager` aggregates keyboard, pointer-lock mouse input, the browser Gamepad
API, reconnect/disconnect notifications, radial deadzones, look curves, haptics,
and synthetic controller menu-navigation events. Menu controls already support
controller focus navigation.

Action names and maps exist, but the action configuration is split. Movement
keys live in `InputManager`; Escape, menu, map, home, and performance shortcuts
are also handled directly in `UIRoot`; arrow/PageUp/PageDown menu codes live in
`useMenuNav`. Keyboard and controller bindings are constants and cannot be
remapped.

Classification:

- **Directly reusable:** input sampling, pointer lock, gamepad connection state,
  deadzone/look math, and controller UI navigation.
- **Risky or uncertain:** packaged controller enumeration, haptics support,
  focus loss, reconnect, macOS/Windows controller variants, and Steam/input-layer
  interference require hardware testing.
- **Candidate for future Godot-portable refactoring:** one stable action catalog,
  default keyboard/gamepad bindings, remapped bindings, sensitivity, inversion,
  and deadzone configuration suitable for a future Godot Input Map.

### Assets and content loading

There is no conventional GLB, texture, or audio asset loader. Terrain, buildings,
furniture, the turtle, landmarks, vegetation, materials, textures, artwork,
shaders, music, ambience, and SFX are generated by TypeScript at runtime. Shipped
files are limited to the browser favicon, an example radio configuration, and an
empty music drop-in folder. No required remote asset is fetched at startup.

The asset-license document records that shipped content is original/procedural,
but there is no machine-readable asset manifest, version, preload priority,
coordinate metadata, required/optional status, or compression metadata.

Classification:

- **Directly reusable:** all procedural rendering and audio content in the
  Electron renderer; no renderer-stack rewrite is justified.
- **Risky or uncertain:** runtime generation cost, shader compilation stalls,
  disposal, and startup failure behavior have not been profiled in a package.
- **Candidate for future Godot-portable refactoring:** asset IDs, material names,
  source/license metadata, coordinate conventions, preload priorities, and any
  future baked GLB/image/audio exports. Most current procedural geometry,
  shaders, and audio will require reconstruction or an offline bake/export path
  for Godot.

### Portable world and narrative data

`config/layout.ts` already contains stable string IDs and typed transforms for
buildings, districts, paths, pads, water features, bridges, ramps, and stairs.
One world unit is approximately one metre; +Y is up, +X is lateral/east, and the
bow is -Z. Landmark scheduling, time math, weather math, RNG, music theory, and
many balance constants are pure and covered by unit tests.

Interior interactions have stable local IDs and typed kinds, but they are
embedded inside procedural geometry-builder functions. Runtime handlers are
closures coupled to Zustand, React overlays, Three vectors, and pointer lock.
Reading content, activity text, interaction labels, and other narrative strings
are embedded in UI/handler source.

Classification:

- **Directly reusable:** pure deterministic math and current TypeScript layout
  data for the Electron build.
- **Candidate for future Godot-portable refactoring:** layout JSON, spawn data,
  interaction definitions, zone metadata, dialogue/text, landmark definitions,
  weather/day-night parameters, movement constants, home customization, and
  audio metadata with stable IDs and runtime schemas.
- **Risky or uncertain:** moving data out of builder code can alter geometry or
  interactions if done as a broad rewrite. Extraction should be incremental and
  regression-tested against the browser source of truth.

## Browser-specific API inventory

| Browser feature | Current use | Classification and desktop decision |
| --- | --- | --- |
| `window` / `document` | DOM mounting, events, timers, visibility, focus, canvas generation, CSS variables | **Directly reusable** in the sandboxed renderer; do not move ordinary DOM work to main |
| `localStorage` | Settings and media/journal persistence | **Browser-only and requiring replacement** for desktop durability; retain only as browser adapter |
| `sessionStorage` | Playwright test isolation only | **Directly reusable** in browser tests; not part of production state |
| IndexedDB | Optional file-handle helper | **Browser-only and requiring replacement** for desktop media; helper is currently not wired into UI |
| File System Access API | Select local audio files | **Browser-only and requiring replacement** with main-process picker and opaque app references |
| Blob/object URLs | Play selected local files | **Reusable with an Electron adapter** once the renderer receives only validated app-controlled media references |
| Gamepad API | Poll pads, connection events, haptics | **Directly reusable**, **risky or uncertain** until packaged hardware tests pass |
| Web Audio API | All game audio and local/radio media graph | **Directly reusable** with desktop lifecycle integration |
| Pointer Lock API | Mouse-look capture | **Directly reusable**, packaged behavior must be verified |
| WebGL2 | Mandatory renderer | **Directly reusable**, GPU failures need Electron recovery/logging |
| `matchMedia` | OS reduced-motion preference | **Directly reusable** |
| `window.location.search` | Development seed override | **Directly reusable** for browser/dev; desktop launch arguments should not depend on it |
| `window.location.reload` | Error recovery and erase-all | **Reusable with an Electron adapter** so reload/recovery is coordinated and logged |
| `<iframe>` / `postMessage` | YouTube player and volume commands | **Risky or uncertain**; constrain navigation and use external-browser fallback if secure embedding fails |
| Remote `<img>` | YouTube thumbnails | **Risky or uncertain** under offline/CSP policy; failures already degrade visually |
| Remote `<audio>` | User-entered HTTPS radio streams | **Risky or uncertain**; requires explicit policy, offline errors, and no weakened web security |
| `fetch` / XHR | Not used by application source | No migration required |
| Service workers | Not used | No migration required |
| Web workers / shared workers | Not used by application source | No migration required |
| Clipboard API | Not used | No migration required |
| Browser notifications | Not used | No migration required |
| Pop-up windows / `window.open` | Not used | Add only through a validated external-link desktop service |
| Drag and drop | Not used | No migration required |

## Local and remote media audit

### Local audio

The renderer currently calls `showOpenFilePicker` where available, otherwise
creates and clicks a hidden multi-file input. It accepts common audio filename
extensions and creates object URLs lazily. Exported IndexedDB helpers can store
file handles and re-request permission, but the music UI does not call them.

For Electron this is **browser-only and requiring replacement**. The main process
must own the picker and filesystem enumeration. The renderer must receive only
validated metadata and opaque/app-controlled references. It must not receive
absolute paths as persistent logical asset IDs or arbitrary filesystem access.

### Internet radio

Stations are user-entered direct HTTPS stream URLs played through an HTML audio
element. Validation rejects non-HTTPS protocols, embedded credentials, exact
loopback names, and `.local`, but it permits other hosts, private-network IPs,
redirects, and DNS changes. Browser CORS/provider behavior is explicitly treated
as fallible.

This path is **risky or uncertain**. A static CSP host allowlist conflicts with
arbitrary user stations. The desktop policy must define whether validated user
streams are allowed, proxied nowhere, and limited further; it must never disable
`webSecurity`. Offline or refused streams must remain non-blocking.

### YouTube

Video input parsing limits accepted hosts and validates the 11-character video
ID. Playback uses the official privacy-enhanced iframe and thumbnails use
`i.ytimg.com`. The iframe has no HTML `sandbox` attribute, and plain iframe
`onError` cannot reliably determine that an uploader disabled embedding.

This path is **risky or uncertain**. A production renderer loaded from a local
application URL may not provide the origin expected by the YouTube IFrame API.
Electron must deny unexpected navigation/new-window creation and permissions.
If secure packaged playback is unreliable, opening the validated page in the
user's default browser is the required fallback.

## Security and content-security audit

The baseline has no Content Security Policy. Deployment documentation suggests
prospective `frame-src`, `media-src`, and `img-src` values, but does not enforce
them. The HTML contains an inline first-paint style block, and React components
use inline style attributes; the final `style-src` policy must account for these
without weakening script policy.

There is no `eval` in application source. The generated Rapier bundle nevertheless
contains wasm-bindgen dynamic-function support, so the exact production CSP must
be tested. The development-only `window.__sanctuary`/scene debugging handles are
guarded by `import.meta.env.DEV` and must remain absent from production builds.

The existing app does not expose Node.js because Electron is absent. The desktop
architecture must preserve this with `contextIsolation: true`,
`nodeIntegration: false`, and `sandbox: true`; expose no raw `ipcRenderer`, Node
objects, or generic channel invocation.

URL safety is strongest for YouTube IDs and weaker for arbitrary radio streams.
There is no current policy for main-frame navigation, new windows, renderer
permissions, external links, or remote subframe failures. These are desktop
main-process responsibilities.

Classification:

- **Directly reusable:** pure URL/video validation and the absence of Node APIs.
- **Reusable with an Electron adapter:** validated external opening, reload,
  local media, logging, permissions, and renderer recovery.
- **Risky or uncertain:** Rapier CSP requirements, remote iframe behavior,
  arbitrary HTTPS radio, local/private network addressing, and packaged origin.

## Startup, shutdown, resilience, and diagnostics

The HTML supplies a dark first paint, React shows a loading screen, WebGL2 is
checked, and `Suspense` keeps the loading UI present while Rapier/world children
resolve. An error boundary provides a reload action, and WebGL context loss has a
visible recovery message. These are useful foundations.

The baseline does not validate required packaged assets, await a desktop settings
service, load a game save, time out a stalled startup, or provide a startup-failure
diagnostic path. `Suspense` uses a null canvas fallback, so an unresolved physics
load can leave the loading overlay indefinitely.

There is no coordinated shutdown. No owner stops new save work, awaits writes,
persists window state, stops remote streams, disposes shared textures, closes the
audio graph, or terminates background tasks. Disposal methods exist in several
subsystems but are not bound to application lifecycle.

Production logging is effectively absent. Error-boundary and event-bus details
are console-logged only in development. There is no structured startup log,
version/platform/GPU record, local log folder, renderer crash detection, GPU
process failure handling, unhandled-exception log, or redaction policy in code.

Classification:

- **Directly reusable:** first-paint styling, boot screen, WebGL support check,
  error UI, and WebGL context-loss UI.
- **Reusable with an Electron adapter:** startup orchestration, settings/save
  initialization, reload/recovery, shutdown, and structured logging.
- **Risky or uncertain:** stalled startup, crash recovery, renderer/GPU failures,
  and resource cleanup until packaged and long-session tests exist.

## Test suite and coverage gaps

Vitest runs in Node and covers deterministic math, settings merge/migration,
input mapping math, URL validation, landmarks, traversal, weather, time, quality,
safe positions, procedural music theory, and selected geometry/material behavior.
Playwright browser tests cover initial load, entering play, menu/time/weather,
live shaders, quality rebuilds, settings reload persistence, keyboard menu
navigation, traversal, YouTube input, radio URL rejection, and built-in tracks.
Manual QA covers movement, buildings, interactions, audio, gamepad, media,
graphics, accessibility, persistence, resilience, and browsers, but its boxes are
not evidence until platform/date/results are recorded.

Missing at baseline:

- preload and IPC contract tests;
- schema validation, portable save serialization, atomic writes, backup, and
  corruption-recovery tests;
- window-state, fullscreen, external-link, local-picker, logging, shutdown, and
  renderer-recovery integration tests;
- Electron first-launch, production renderer, upgrade, offline, restart, and
  packaged-launch E2E tests;
- automated controller hardware coverage;
- installer tests and Windows/macOS artifacts;
- long-session resource and memory tests.

## Consolidated classification summary

### Directly reusable

- Vite renderer bundle and relative production paths.
- React UI and React Three Fiber/Three.js renderer.
- Rapier gameplay physics and kinematic player controller.
- Web Audio synthesis, mixing, ambience, SFX, and current gesture gate.
- Pure time, weather, RNG, quality, traversal, landmark, and input math.
- Existing DOM UI, accessibility controls, pointer lock, and controller menu
  navigation.
- Browser development mode and valuable browser unit/E2E tests.

### Reusable with an Electron adapter

- Settings and save service calls while retaining a browser implementation.
- Application/platform version, fullscreen, window state, quit, recovery, and
  external-link behavior.
- Local audio selection and app-controlled media references.
- Startup/shutdown lifecycle, structured logging, and crash diagnostics.
- Visibility/reload behavior where it must coordinate with desktop lifecycle.

### Browser-only and requiring replacement

- `localStorage` as authoritative desktop save/settings persistence.
- IndexedDB/File System Access API as the desktop local-media implementation.
- Hidden file inputs as the desktop filesystem picker.
- Silent in-memory persistence fallback as a desktop durability strategy.
- Browser-only wording and assumptions in media/data UI where desktop services
  replace them.

### Risky or uncertain

- Rapier WASM under a restrictive CSP and its startup cost.
- YouTube iframe behavior from a packaged origin and provider restrictions.
- Arbitrary user-supplied HTTPS radio streams and private-network destinations.
- Gamepad/haptics parity across packaged Windows and macOS builds.
- GPU process failures, renderer crashes, sleep/wake, audio-device changes, and
  fullscreen transitions.
- Startup time, frame pacing, memory, GPU/CPU use, shader stalls, and long-session
  growth outside the short browser observation.
- Browser-save migration across unrelated origins/profiles.

### Candidate for future Godot-portable refactoring

- World layout, districts, paths, pads, traversal spans, zones, and spawn points.
- Stable interaction IDs/kinds and interaction metadata separated from handlers.
- Player/turtle movement constants and environment/time/weather parameters.
- Settings/accessibility/home customization DTOs and defaults.
- Portable save DTO, runtime validation, and pure migrations.
- Landmark schedule/type metadata, dialogue/narrative content, music mood data,
  radio metadata, and audio-zone definitions.
- Asset/material IDs, coordinate conventions, licensing, and future baked asset
  metadata in one manifest.

## Phase 0 migration risks and assumptions

1. Preserve the browser renderer and physics path; a renderer or physics rewrite
   would add risk without helping the immediate desktop goal.
2. Establish platform interfaces before replacing persistence or local media, so
   browser development and Electron use the same game logic.
3. Treat desktop saves as a new durable schema, not a dump of Zustand or
   `runtime`; browser storage may be imported only through an explicit validated
   migration path.
4. Test Rapier under the real production CSP before freezing the policy. Do not
   solve it by disabling Electron security.
5. Treat YouTube and radio as optional services. Offline or provider failure must
   never prevent startup or core gameplay.
6. Extract portable data incrementally. Current procedural builders are part of
   the visual source of truth and should not be converted wholesale merely to
   achieve a preferred directory layout.
7. Windows, macOS packaged behavior, installers, signing, notarization, gamepad
   hardware, and long-session stability remain unverified after Phase 0.

