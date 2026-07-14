# Architecture

Turtleback Sanctuary is a static React + TypeScript app that renders a Three.js
scene through `@react-three/fiber`, with physics from `@react-three/rapier`.
The guiding principle: **keep per-frame simulation out of React state**, and
keep pure logic separable from rendering so it can be unit-tested in Node.

## Big picture

```
Electron main ─ secure app/media protocols, BrowserWindow, repositories,
                URL policy, diagnostics, recovery, bounded shutdown
  preload ─ typed and validated desktopApp IPC bridge (no Node globals)
    main.tsx ─ hydrates desktop state, attaches lifecycle/input, mounts <App/>
      App.tsx ─ recovery/WebGL2 gates + <ErrorBoundary>
        GameCanvas.tsx ─ the R3F <Canvas>
          AssetProvider ─ manifest-backed GLB/KTX2 loaders, leases + fallbacks
            FrameDriver ─ authoritative per-frame update (time, weather, travel,
                          input polling, audio, auto-quality)
            <Physics> + PlayerController ─ kinematic capsule + camera rig
              TurtleWorld + SpatialCellProvider ─ sky, ocean, shell terrain,
                        turtle, landmarks, village, retained-cell vegetation,
                        rain, interaction + world systems
        UIRoot.tsx ─ all DOM overlays, outside the canvas

Browser builds enter at main.tsx directly and keep browser-safe fallbacks.
```

### The two worlds: React vs. the frame loop

- **React** owns discrete UI: which overlay is open, menu contents, toasts,
  device type. This lives in Zustand stores (`state/`).
- **The frame loop** owns continuous simulation. `core/runtime.ts` is a single
  mutable object (`runtime`) holding the player transform, time-of-day,
  weather, travel distance, and resolved quality. Systems write to it in
  `useFrame`; the low-frequency UI samples it on timers (e.g. the clock chip).
  This avoids thousands of React re-renders per second.

A tiny typed event bus (`core/events.ts`) carries one-shot signals
(footsteps, teleports, interaction sounds, toasts) between systems without
prop-drilling or state churn.

## Authored asset boundary and ownership

`AssetProvider` mounts inside the R3F canvas because KTX2 capability detection
needs the live `WebGLRenderer`. It creates one `AssetManager` from the canonical
`src/game/assets/manifest.json`, wires `GLTFLoader` to Meshopt and KTX2/Basis,
and resolves a quality/LOD variant before loading. The pipeline-smoke GLB and
KTX2 are preloaded before world children mount, so both decoder paths are
exercised at startup. A quality change is transactional: the preload coordinator
keeps the previous pin until the replacement preload succeeds, then releases the
old pin.

The cache has explicit ownership instead of relying on Three.js garbage
collection:

- `acquireModel()` returns an `AssetLease` with a scene-graph clone unique to
  that consumer. Materials and skeleton state are clone-owned while immutable
  textures and the cached base resources remain shared.
- `acquireTexture()` returns a lease on the shared cached texture.
- `preload()` returns an `AssetPreloadLease`; its pins retain resolved resources
  without creating a scene consumer.
- Every lease is idempotently released. A loaded cache entry is disposed only
  after its pending waiters, consumer references, and preload pins all reach
  zero. Releasing a model also tears down its consumer-owned clone.
- `AssetProvider` teardown releases the current preload, unregisters
  diagnostics, disposes all remaining cached GPU resources and the KTX2 loader,
  and makes the manager terminal. Electron's coordinated renderer shutdown
  reaches this path by unmounting React.

An authored load failure follows the manifest's registered asset fallback or
procedural factory. Fallback use is retained in manager diagnostics for as long
as the corresponding lease or pin is live; it is never an untracked catch-all.

### Static URL contract

Manifest paths are relative values such as
`assets/system/pipeline-smoke.glb`. `resolveStaticAssetUrl()` rejects absolute
paths, schemes, traversal, query/hash injection, encoded paths, and backslashes,
then resolves the safe value against `document.baseURI`. Valid bases are HTTP,
HTTPS, and the desktop `app:` protocol. Consequently the same manifest works at
a browser subpath such as `https://host.example/turtleback/` and at
`app://turtleback/` without root-relative exceptions.

The production bundle copies the Basis JavaScript/WASM and its same-origin
worker relay under `assets/decoders/basis/`. Electron's restricted `app:`
handler resolves files inside the packaged renderer directory and serves GLB,
KTX2, JavaScript, and WASM with explicit MIME types and cache policy. The worker
gets the narrowly scoped CSP capability needed by the Emscripten decoder; the
renderer document does not receive that broader worker script policy.

## The endless-travel illusion

The turtle appears to swim forever, but the playable world **never leaves the
origin** (which would wreck float precision and collisions). Instead:

- `runtime.travel.distance` accumulates each frame.
- The ocean shader, clouds, and landmark scheduler read that distance and
  scroll their own coordinates. The turtle's visual body animates in place.
- Landmarks (`world/landmarks/`) are object-pooled: a deterministic seeded
  schedule (`schedule.ts`, unit-tested) decides what appears at which travel
  distance; one instance of each type is built lazily and repositioned as it
  cycles through the fog.

## Spatial-cell subscription boundary

`SpatialCellProvider` is the only runtime owner of a `SpatialCellTracker`. Its
single tracker samples `runtime.player.pos` at 10 Hz, using 50 m cells, 6 m
boundary hysteresis, and quality-specific active/retained radii. It writes the
latest immutable `center`, `active`, and `retained` arrays to
`runtime.spatial` for imperative per-frame systems. React consumers subscribe
through `useSpatialCellSnapshot()` (`useSyncExternalStore`) and are notified
only when the center or configured residency sets actually change; they do not
poll player coordinates or create competing trackers.

Vegetation partitions its seeded population once by cell and renders full near
detail for active cells. Retained cells keep a bounded horizon-tree silhouette
and their simplified tree colliders, so crossing an active boundary does not
erase the distant forest or create a reachable collision gap. A retained cell
unmounts only after it exits the wider retain radius. Quality changes reconfigure
the same tracker and publish one discrete transition.

## The shell as one source of truth

`world/shell/shellShape.ts` is a pure analytic height function. The visual
terrain mesh, the Rapier trimesh collider, building pad flattening, vegetation
scattering, path splatting, and footstep-surface sampling **all** read from it,
so nothing can drift out of sync. It imports only math and layout data, so its
core is testable.

## The village kit

Buildings are **data, not scenes**. Each interior is a function in
`village/buildings/interiors.ts` that appends primitives to a `BuildPlan`
(`kit/geometry.ts`). `BuildPlan.merge()` collapses everything into one merged
`BufferGeometry` per material, so a fully furnished building renders in well
under ten draw calls. Collision is a separate list of simplified boxes — never
the display geometry. `kit/props.ts` is the furniture vocabulary; `kit/materials.ts`
is the shared PBR palette (all textures procedural, from `world/textures.ts`).

Interiors declare `InteractionSpec`s and audio-`Zone` boxes; `Building.tsx`
places the building in the world, wires interactions to real handlers, drives
window-glow/daylight-fill lighting, and animates dynamic pieces (sliding doors,
lamps, generative artworks, pool water).

## Input

`input/InputManager.ts` unifies keyboard, mouse (pointer-lock deltas), and the
Gamepad API into game actions, and emits synthetic `menu-nav` events for
controller-driven menu navigation. Key **presses** are time-stamped
(`consumeKey`) so a press is never dropped by frame-timing races. The pure
gamepad math (radial deadzone, look curve, standard-layout action mapping) lives
in `input/gamepadMath.ts` and is unit-tested.

## Audio

`audio/AudioManager.ts` builds the Web Audio graph lazily on the first user
gesture ("Enter Sanctuary"), with typed buses: **master, music, ambient, sfx,
media** (plus a UI sub-bus riding sfx). Three engines feed it:

- `proceduralMusic/MusicEngine.ts` — a lookahead scheduler rendering seeded
  lo-fi (electric-piano chords, pad, bass, brushed percussion, sparse melody,
  procedural tape/vinyl texture) across four moods; the mood follows time and
  weather. Music theory (`theory.ts`) and progressions (`moods.ts`) are pure and
  tested.
- `ambience/AmbienceEngine.ts` — synthesized ocean/wind/rain beds plus
  bird/cricket details, with a zone low-pass that muffles the outdoor bed and
  re-balances rain when the player is indoors.
- `SfxEngine.ts` — synthesized footsteps (per surface), interaction sounds, and
  UI blips, driven by the event bus.

A master analyser tap exposes `masterLevel()` for QA/visualizers.

## Media

- `media/youtube.ts` — pure URL/ID parsing + validation and nocookie embed
  building (tested). The TV overlay is a clean HTML "TV interface" that appears
  after pointer lock is released; it hosts the official iframe embed. We never
  texture cross-origin video onto a WebGL surface.
- `media/safeUrl.ts` — pure radio-URL safety validation (tested).
- `media/localFiles.ts` — Electron uses a native main-process folder picker and
  opaque `turtleback-media://` track references; browsers use the File System
  Access API or a plain-input fallback. Absolute desktop paths never enter the
  renderer and browser object URLs are revoked when dropped.
- `media/MediaPlayer.ts` — the stereo engine: built-in generative moods, local
  files, and direct radio, routed through a `PannerNode` for room/personal
  listening.

## State & persistence

The Zustand settings/media stores remain the renderer's live UI state. In a
browser they persist through the crash-proof `localStorage` wrapper in
`core/save/storage.ts`, which falls back to memory when browser storage is
unavailable.

In Electron, `localStorage` is deliberately non-authoritative. Before React
mounts, `desktop/renderer/persistence.ts` hydrates validated settings, media,
preferences, and autosave data through the preload bridge. Debounced changes and
60-second autosaves cross IPC into main-process repositories under Electron's
`userData` directory. JSON writes use synced temporary files, atomic rename,
last-valid backups, corrupt-primary quarantine, and immediate backup promotion.
Portable saves contain framework-neutral player, world, settings, media, and
progression DTOs rather than serializing Zustand or Three/Rapier objects.

Settings remain versioned with `migrateSettings` and a defensive deep merge that
drops unknown keys and wrong types. Desktop browser-profile import is not
automatic; any future migration must be an explicit validated export/import
flow.

## Desktop lifecycle and recovery

The Electron main process owns the single-instance lifecycle, current-display
window placement, session security, sleep/wake events, crash diagnostics, and a
three-second coordinated shutdown deadline. The renderer flushes persistence,
detaches global input/pointer listeners, unmounts React, and disposes media, Web
Audio, and cached textures before acknowledging shutdown.

Renderer/GPU failures reload at most twice within a one-minute window. A third
failure opens a low-activity safe screen rather than looping. Reloaded renderers
rehydrate only validated durable data and show a recovery notice. The same path
is exercised by the packaged smoke tooling in `scripts/smoke-desktop.mjs`.

## Rendering diagnostics and probe contributors

`debug/probes.ts` is the typed aggregation boundary for graphics evidence.
`collectSceneProbe()` starts with stable root fields for active/retained cells,
instance/LOD families, asset IDs and decoded-byte estimates, renderer counters,
texture estimates, and named sections. Systems may register a root contributor
or a contributor to one of the `turtle`, `world`, `wildlife`, `audio`, or
`atmosphere` sections. Contributor IDs and returned keys are sorted
deterministically; duplicate IDs or two contributors claiming the same section
leaf fail loudly instead of silently overwriting evidence.

The current `WorldSystems` wiring contributes manifest-backed asset diagnostics
at the root and combines `world/spatial` with `world/vegetation` in the `world`
section. The same probe feeds the F3 overlay, E2E assertions, visual capture, and
the graphics benchmark runner.

The window globals `__scene` and `__turtlebackDebug` (fixed cameras, teleport,
probe collection, benchmark variants, and deliberate asset-failure injection)
are installed only when `import.meta.env.DEV` is true or a build explicitly sets
`VITE_TURTLEBACK_DIAGNOSTICS=1`. Ordinary production builds do not create or
mutate those diagnostic globals.

## Why no `<StrictMode>`

React 18/19 StrictMode double-invokes effects in development. That fights with
imperative singletons that must be created exactly once (the physics world, the
`AudioContext`, event subscriptions). Rather than scatter idempotency guards,
StrictMode is intentionally omitted; the trade-off is documented here.

## Directory map

```
src/
  app/            App shell, error boundary, WebGL2 support check
  desktop/        Electron main/preload/shared contracts + renderer adapters
  game/
    assets/       manifest registry, authored loaders, leases, fallbacks, validation
    config/       constants, village layout data
    core/         runtime, events, rng, noise, math, quality, save
    debug/        deterministic scene probes and performance math
    state/        Zustand stores (game, settings, media)
    input/        InputManager, gamepad math, pointer lock
    player/       kinematic controller, safe-position tracker
    time/         day-night math
    weather/      weather sim, rain, wet materials
    world/
      spatial/    one residency tracker + discrete React subscription boundary
      shell/      analytic terrain + collider + biolum seams
      sky/        sky dome, stars, clouds, time lighting, palette
      ocean/      Gerstner ocean shader
      turtle/     the animated giant turtle
      landmarks/  seeded schedule + pooled landmark builders
      textures.ts procedural CanvasTexture factory
    village/      building kit, interiors, props, cell vegetation, zones
    interaction/  typed interaction registry + raycast picker
    activities/   sitting, breathing, tea, journal, handlers
    audio/        mixer, procedural music, ambience, sfx, cues
    media/        youtube, safeUrl, localFiles, MediaPlayer
    ui/           screens, HUD, menus, media overlays
  styles/         global CSS (design tokens + components)
tests/            Vitest unit tests
e2e/              Playwright browser tests
scripts/          Desktop build/dev/package smoke helpers
public/           favicon, example radio config, audio drop-in folder
```
