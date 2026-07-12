# Architecture

Turtleback Sanctuary is a static React + TypeScript app that renders a Three.js
scene through `@react-three/fiber`, with physics from `@react-three/rapier`.
The guiding principle: **keep per-frame simulation out of React state**, and
keep pure logic separable from rendering so it can be unit-tested in Node.

## Big picture

```
main.tsx ─ attaches input + pointer-lock watchers, mounts <App/>
  App.tsx ─ WebGL2 gate + <ErrorBoundary>
    GameCanvas.tsx ─ the R3F <Canvas> + <Physics>
      FrameDriver ─ the single authoritative per-frame update (time, weather,
                    travel, input polling, audio, auto-quality)
      PlayerController ─ kinematic capsule + camera rig
      TurtleWorld ─ sky, ocean, shell terrain, turtle, landmarks, village,
                    vegetation, rain, interaction + world systems
    UIRoot.tsx ─ all DOM overlays (title, HUD, menus, media), outside the canvas
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
- `media/localFiles.ts` — File System Access API with a plain-input fallback and
  optional IndexedDB handle persistence; object URLs are revoked when dropped.
- `media/MediaPlayer.ts` — the stereo engine: built-in generative moods, local
  files, and direct radio, routed through a `PannerNode` for room/personal
  listening.

## State & persistence

`state/settingsStore.ts` and `state/mediaStore.ts` are Zustand stores persisted
to `localStorage` via a **crash-proof wrapper** (`core/save/storage.ts`) that
falls back to in-memory storage when storage is unavailable. Settings are
**versioned with a migration function** (`migrateSettings`) and a defensive
deep-merge (`mergeWithDefaults`) that drops unknown keys and wrong types — both
unit-tested. Nothing sensitive is persisted.

## Why no `<StrictMode>`

React 18/19 StrictMode double-invokes effects in development. That fights with
imperative singletons that must be created exactly once (the physics world, the
`AudioContext`, event subscriptions). Rather than scatter idempotency guards,
StrictMode is intentionally omitted; the trade-off is documented here.

## Directory map

```
src/
  app/            App shell, error boundary, WebGL2 support check
  game/
    config/       constants, village layout data
    core/         runtime, events, rng, noise, math, quality, save
    state/        Zustand stores (game, settings, media)
    input/        InputManager, gamepad math, pointer lock
    player/       kinematic controller, safe-position tracker
    time/         day-night math
    weather/      weather sim, rain, wet materials
    world/
      shell/      analytic terrain + collider + biolum seams
      sky/        sky dome, stars, clouds, time lighting, palette
      ocean/      Gerstner ocean shader
      turtle/     the animated giant turtle
      landmarks/  seeded schedule + pooled landmark builders
      textures.ts procedural CanvasTexture factory
    village/      building kit, interiors, props, vegetation, zones
    interaction/  typed interaction registry + raycast picker
    activities/   sitting, breathing, tea, journal, handlers
    audio/        mixer, procedural music, ambience, sfx, cues
    media/        youtube, safeUrl, localFiles, MediaPlayer
    ui/           screens, HUD, menus, media overlays
  styles/         global CSS (design tokens + components)
tests/            Vitest unit tests
e2e/              Playwright browser tests
public/           favicon, example radio config, audio drop-in folder
```
