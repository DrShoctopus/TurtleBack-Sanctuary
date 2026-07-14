# Wildlife Ecosystem Implementation Plan

**Status:** Superseded on 2026-07-14. Do not execute; use `2026-07-14-stylized-sanctuary-reset.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace nine disconnected primitive gulls and random ambient chirps with a deterministic, habitat-aware, pooled living ecosystem whose visible near agents and explicit distant groups cover land, air, wetland, shell edge, and ocean habitats on every quality tier.

**Architecture:** Keep behavior and scheduling in fixed-tick pure TypeScript using tuple-based state, seeded agent IDs, biome habitat queries, and bounded state machines. A mutable `WildlifeDirector` owns pools and active-cell populations outside React state; React Three Fiber renderers consume immutable frame snapshots and select authored LODs. Wildlife calls are emitted only by active near agents or explicit distant-group representations and are rendered through a pooled spatial audio engine on the ambient bus.

**Tech Stack:** React 19, TypeScript 5.9, React Three Fiber, Three.js skinned animation/instancing, Vitest, Playwright, glTF/GLB, Meshopt, KTX2/Basis, Blender command-line export, Web Audio `PannerNode`, seeded RNG, biome/cell registries, mutable frame runtime, typed events, Quiet Mode, Reduced Motion, and quality budgets.

---

## Scope and invariants

This plan implements Phase D of `docs/superpowers/specs/2026-07-13-sanctuary-graphics-audio-overhaul-design.md`. Tasks 1-6 provide the wildlife foundation used by the turtle vertical slice; later tasks expand the complete ecosystem.

The implementation must preserve these contracts:

- Wildlife is ambient and nonviolent. No agent attacks, hunts, dies, blocks a critical path, requires care, or creates a failure state.
- Near agents use only `idle`, `wander`, `forage`, `rest`, `perch`, `investigate`, `flee`, and `regroup`. Distant groups use `flock`, `school`, `orbit`, `surface`, or `silhouette` representations.
- The director uses a fixed simulation tick and deterministic schedules. Render FPS, cell load order, and quality selection may not alter canonical IDs or schedules.
- Quality changes population representation, animation fidelity, shadowing, update frequency, and LOD distance; it never removes a major category from a biome.
- Structural path/building/water exclusions are shared with biome composition. Invalid habitat acquisition returns an agent to its pool.
- Quiet Mode reduces calls and activity without making the sanctuary silent or despawning whole categories.
- Reduced Motion preserves slow locomotion, breathing, perching, surfacing, and regrouping while reducing wingbeat exaggeration, insect swarms, rapid reactions, and turtle-event response.
- Calls originate from the same active agent ID or distant-group ID as the visible/spatial representation. `AmbienceEngine` must no longer synthesize unowned random birds or crickets.
- Wildlife never writes per-frame Zustand state and never owns shell traversal physics.
- Every `CellKey` is imported from the Phase A `src/game/world/spatial/types.ts` contract; wildlife does not define coordinates or residency a second time.

### Approved initial species roster and authored paths

| Stable species ID     | Category         | Authored model directory                                | Required behavior clips                     |
| --------------------- | ---------------- | ------------------------------------------------------- | ------------------------------------------- |
| `mossback-grazer`     | ground           | `public/assets/models/wildlife/mossback-grazer/`        | idle, walk, forage, rest, investigate, flee |
| `shell-hare`          | ground           | `public/assets/models/wildlife/shell-hare/`             | idle, hop, forage, rest, investigate, flee  |
| `fernfall-glider`     | tree-dweller     | `public/assets/models/wildlife/fernfall-glider/`        | idle, climb, leap, perch, flee              |
| `crownwood-songbird`  | air/perch        | `public/assets/models/wildlife/crownwood-songbird/`     | idle, hop, perch, takeoff, fly, land        |
| `tide-corvid`         | air/ground       | `public/assets/models/wildlife/tide-corvid/`            | idle, walk, forage, takeoff, fly, land      |
| `galecrest-seabird`   | air/edge         | `public/assets/models/wildlife/galecrest-seabird/`      | idle, perch, takeoff, glide, flap, land     |
| `lumenfen-frog`       | wetland          | `public/assets/models/wildlife/lumenfen-frog/`          | idle, breathe, hop, call, hide              |
| `reed-wader`          | wetland          | `public/assets/models/wildlife/reed-wader/`             | idle, wade, forage, takeoff, fly, land      |
| `lumenfen-insects`    | insect groups    | `public/assets/models/wildlife/lumenfen-insects.glb`    | dragonfly, firefly, beetle group cycles     |
| `blossom-pollinators` | insect groups    | `public/assets/models/wildlife/blossom-pollinators.glb` | butterfly, moth, pollinator group cycles    |
| `lumenfen-fish`       | water group      | `public/assets/models/wildlife/lumenfen-fish.glb`       | school loop, turn, scatter                  |
| `shell-ray`           | ocean group      | `public/assets/models/wildlife/shell-ray/`              | glide, bank, dive                           |
| `sanctuary-dolphin`   | ocean group      | `public/assets/models/wildlife/sanctuary-dolphin/`      | swim, surface, arc, dive                    |
| `distant-whale`       | ocean silhouette | `public/assets/models/wildlife/distant-whale/`          | cruise, surface, dive                       |

Every rigged species directory contains `<species>-lod0.glb`, `<species>-lod1.glb`, and `<species>-lod2.glb`. Texture tiers live in `public/assets/textures/wildlife/<species>/` and use `{512,1k,2k}` KTX2 base-color, normal, and roughness/AO/mask files; High and Ultra may share 2K when review shows no visible benefit from a larger map. Calls live in `public/assets/audio/wildlife/<species>/` as normalized MP3 variants.

Retained authoring sources live under `art-source/wildlife/<species>/` with `<species>.blend`, `SOURCE.md`, and an export settings JSON. Group assets use `art-source/wildlife/groups/`. Review renders and contact sheets live under `docs/art-review/wildlife/`.

## Task 1: Define wildlife, habitat, and asset contracts

**Files:**

- Create: `src/game/world/wildlife/types.ts`
- Create: `src/game/world/wildlife/registry.ts`
- Test: `tests/wildlifeRegistry.test.ts`

- [ ] Write tests requiring every approved species ID, category, biome population, active time/weather range, allowed states, three model LODs or a group pack, animation clips, audio variants where applicable, fallback, footprint, scale, and allowed license.

- [ ] Assert every biome has at least one characteristic group and Low retains a near or distant representation for ground/air/wetland/ocean categories where the habitat exists.

- [ ] Run `pnpm exec vitest run tests/wildlifeRegistry.test.ts`; expected result is a missing-module failure.

- [ ] Add these public types:

```ts
export type WildlifeSpeciesId =
  | 'mossback-grazer'
  | 'shell-hare'
  | 'fernfall-glider'
  | 'crownwood-songbird'
  | 'tide-corvid'
  | 'galecrest-seabird'
  | 'lumenfen-frog'
  | 'reed-wader'
  | 'lumenfen-insects'
  | 'blossom-pollinators'
  | 'lumenfen-fish'
  | 'shell-ray'
  | 'sanctuary-dolphin'
  | 'distant-whale'

export type WildlifeBehaviorState =
  'idle' | 'wander' | 'forage' | 'rest' | 'perch' | 'investigate' | 'flee' | 'regroup'

export type DistantGroupState = 'flock' | 'school' | 'orbit' | 'surface' | 'silhouette'

export interface WildlifeSpeciesDefinition {
  id: WildlifeSpeciesId
  category: 'ground' | 'air' | 'wetland' | 'insect' | 'freshwater' | 'ocean'
  biomeIds: readonly BiomeId[]
  allowedStates: readonly WildlifeBehaviorState[]
  lodAssetIds: readonly [AssetId, AssetId, AssetId] | readonly [AssetId]
  fallbackAssetId: AssetId
  callAssetIds: readonly AssetId[]
  footprintRadius: number
  preferredGroupSize: readonly [number, number]
  activeTime: readonly [number, number]
  maxRain: number
  castsShadow: boolean
}

export const WILDLIFE_REGISTRY: Readonly<Record<WildlifeSpeciesId, WildlifeSpeciesDefinition>>
```

- [ ] Populate the immutable roster and explicit biome population mappings; do not infer behavior or asset IDs from filenames at runtime.

- [ ] Run `pnpm exec vitest run tests/wildlifeRegistry.test.ts`; expected result is a complete and internally consistent registry fixture passing.

- [ ] Commit the wildlife contract:

```bash
git add src/game/world/wildlife/types.ts src/game/world/wildlife/registry.ts tests/wildlifeRegistry.test.ts
git commit -m "test: define sanctuary wildlife contracts"
```

## Task 2: Establish the wildlife asset pipeline and author the hero-slice birds

**Files:**

- Create: `scripts/blender/export-wildlife.py`
- Create: `scripts/validate-wildlife-assets.mjs`
- Create: `docs/art-review/wildlife/README.md`
- Add: `art-source/wildlife/{crownwood-songbird,galecrest-seabird}/` source scenes and provenance records
- Add: approved `public/assets/models/wildlife/{crownwood-songbird,galecrest-seabird}/`, matching textures, and matching call files
- Modify: `src/game/assets/manifest.json`
- Modify: `ASSET_LICENSES.md`
- Modify: `package.json`
- Test: `tests/wildlifeAssets.test.ts`

- [ ] Freeze the full registry and asset-delivery contract for every approved species, but require real authored binaries only for `crownwood-songbird` and `galecrest-seabird` at this hero-slice gate. Every later species retains an explicit procedural/distant fallback until Tasks 8 or 9 delivers its authored files.

- [ ] For both hero-slice birds, decide and record one of two provenance paths in `SOURCE.md`: original in-house/generated with retained generation inputs and artist edits, or an explicitly redistributable source with author, source URL, license text, required attribution, modifications, and download date.

- [ ] Build metre-scale Blender source scenes for the songbird and seabird with anatomically believable silhouette, grounded pivots, named skeletons, and no cute/exaggerated proportions that conflict with the near-photoreal target.

- [ ] Use these retopology targets: large ground/ocean LOD0 35k-60k triangles, LOD1 12k-22k, LOD2 2k-6k; birds/small ground LOD0 15k-30k, LOD1 6k-12k, LOD2 1k-3k; frogs and group hero meshes LOD0 at or below 12k; individual insect/fish group members at or below 2k.

- [ ] UV and bake at consistent metre-based texel density. Produce 2K source bakes and registry-derived 1K/512 variants for base color, normal, and packed roughness/AO/masks. Validate tangent orientation, mipmaps, alpha edges, believable eyes/feathers/fur/skin, and wetness masks for wetland/ocean species.

- [ ] Rig both birds and create exactly the registry-required clips with root motion removed. Verify loop boundaries, foot contact, wing arcs, landing poses, and LOD skeleton/clip compatibility.

- [ ] Export one GLB per LOD with Blender's command-line pipeline:

```bash
blender --background art-source/wildlife/crownwood-songbird/crownwood-songbird.blend --python scripts/blender/export-wildlife.py -- crownwood-songbird
blender --background art-source/wildlife/galecrest-seabird/galecrest-seabird.blend --python scripts/blender/export-wildlife.py -- galecrest-seabird
```

The exporter writes only the exact registered `public/assets/models/wildlife/` paths and fails on missing bones, clips, LOD collections, metre scale, or unapplied transforms. Tasks 8 and 9 run the same pinned exporter for the remaining approved species.

- [ ] Optimize exported GLBs with the pinned glTF Transform/Meshopt pipeline while preserving skinning, morphs, node names, and animations. Compress baked textures to KTX2 through the repository's pinned texture toolchain.

- [ ] Render turntable, locomotion, close-material, and Low-LOD contact sheets for both birds into `docs/art-review/wildlife/<species>/`. Review silhouette at habitat distance, perch/wing/landing contact, texture stretching, specular clipping, LOD pop, and fantasy accents under noon, rain, sunset, and night lighting.

- [ ] Source or produce at least three calm, non-distressing call variants for each hero-slice bird. Retain provenance, trim silence, remove clipping/noise, and normalize to the ambient target.

- [ ] Write `tests/wildlifeAssets.test.ts` with an explicit required-species set. The hero-slice gate verifies real files, checksums, allowed licenses, fallbacks, texture tiers, clip names, triangle ordering, bounds stability, decoded-size budgets, and audio variants for the songbird/seabird, while ensuring every later species has a valid fallback definition.

- [ ] Implement `validate-wildlife-assets.mjs` to parse actual GLBs and fail on missing source/provenance records, missing clips, bounds drift above 5 percent, non-decreasing LOD triangles, embedded unsupported textures, unregistered files, invalid licenses, or missing contact-sheet signoff.

- [ ] Add the exact package script `"validate:assets:wildlife": "node scripts/validate-wildlife-assets.mjs"`. Make `validate-wildlife-assets.mjs` accept an optional leading `--` delimiter followed only by `--required-species=<comma-separated species IDs>` and reject every other flag. This is the specialized species/GLB/clip/review gate; it must not add `wildlife` to the shared Phase A `rendering|world|audio` slice union or forward species flags to that CLI. Run `pnpm validate:assets:wildlife -- --required-species=crownwood-songbird,galecrest-seabird`, `pnpm validate:assets`, `pnpm write:asset-licenses`, and `pnpm exec vitest run tests/wildlifeAssets.test.ts`; expected result is both hero-slice birds and every current source, license, model, texture, clip, call, review gate, fallback, and generated ledger entry passing. Reserve the global final-inventory gate for Phase F.

- [ ] Commit the reviewed wildlife asset library:

```bash
git add art-source/wildlife/crownwood-songbird art-source/wildlife/galecrest-seabird scripts/blender/export-wildlife.py scripts/validate-wildlife-assets.mjs docs/art-review/wildlife/crownwood-songbird docs/art-review/wildlife/galecrest-seabird public/assets/models/wildlife/crownwood-songbird public/assets/models/wildlife/galecrest-seabird public/assets/textures/wildlife/crownwood-songbird public/assets/textures/wildlife/galecrest-seabird public/assets/audio/wildlife/crownwood-songbird public/assets/audio/wildlife/galecrest-seabird src/game/assets/manifest.json ASSET_LICENSES.md package.json pnpm-lock.yaml tests/wildlifeAssets.test.ts
git commit -m "assets: add reviewed hero-slice birds"
```

## Task 3: Build deterministic habitat queries

**Files:**

- Create: `src/game/world/wildlife/habitat.ts`
- Test: `tests/wildlifeHabitat.test.ts`

- [ ] Write tests for biome/elevation/slope/moisture/exposure/rim/time/weather filtering, path/building/water exclusions, ground-height alignment, perching anchors, wetland shallows, ocean bounds, and deterministic point acquisition.

- [ ] Assert a failed query returns `null` rather than an invalid position and never returns a critical path, interior, interaction radius, or unsafe shell edge for a ground agent.

- [ ] Run `pnpm exec vitest run tests/wildlifeHabitat.test.ts`; expected result is a missing-module failure.

- [ ] Implement:

```ts
export interface HabitatPoint {
  position: readonly [number, number, number]
  normal: readonly [number, number, number]
  biomeWeights: BiomeWeights
  cell: CellKey
  perchId?: string
  waterDepth?: number
}

export interface HabitatRequest {
  speciesId: WildlifeSpeciesId
  cell: CellKey
  time: number
  rain: number
  seed: number
}

export interface HabitatQuery {
  sample(x: number, z: number): HabitatPoint | null
  findPoint(request: HabitatRequest): HabitatPoint | null
}

export function createWildlifeHabitatQuery(
  exclusions: readonly PlacementExclusion[],
  perchAnchors: readonly PerchAnchor[],
): HabitatQuery
```

- [ ] Share `sampleHabitatFields()`, biome weights, `terrainHeight()`, and placement exclusions. Do not duplicate approximate terrain or route math in wildlife code.

- [ ] Run `pnpm exec vitest run tests/wildlifeHabitat.test.ts tests/placementExclusions.test.ts`; expected result is deterministic valid points and explicit `null` failures.

- [ ] Commit habitat acquisition:

```bash
git add src/game/world/wildlife/habitat.ts tests/wildlifeHabitat.test.ts
git commit -m "feat: query safe wildlife habitats"
```

## Task 4: Generate fixed-tick population and call schedules

**Files:**

- Create: `src/game/world/wildlife/schedule.ts`
- Test: `tests/wildlifeSchedule.test.ts`

- [ ] Write tests proving identical seeds/cells produce identical agent/group IDs, schedules are independent of cell load order and render-frame chunking, time/rain windows are respected, calls do not repeat the same variant consecutively, and every suitable biome has activity during a representative 90-second observation window.

- [ ] Run `pnpm exec vitest run tests/wildlifeSchedule.test.ts`; expected result is a missing-module failure.

- [ ] Implement pure schedule APIs:

```ts
export const WILDLIFE_TICK_SECONDS = 0.1

export interface WildlifeSpawnEvent {
  tick: number
  id: string
  speciesId: WildlifeSpeciesId
  cell: CellKey
  representation: 'near' | 'distant'
}

export interface WildlifeCallEvent {
  tick: number
  emitterId: string
  speciesId: WildlifeSpeciesId
  variant: number
}

export function buildCellWildlifeSchedule(
  worldSeed: number,
  cell: CellKey,
  durationTicks: number,
): readonly WildlifeSpawnEvent[]

export function buildAgentCallSchedule(
  worldSeed: number,
  emitterId: string,
  durationTicks: number,
  variantCount: number,
): readonly WildlifeCallEvent[]
```

- [ ] Key schedules by seed/cell/species/agent rather than `Math.random()` or mount order. Quiet Mode is an activity filter over the canonical schedule, not an alternate random source.

- [ ] Run `pnpm exec vitest run tests/wildlifeSchedule.test.ts`; expected result is deterministic fixed-tick schedules with 90-second coverage.

- [ ] Commit wildlife schedules:

```bash
git add src/game/world/wildlife/schedule.ts tests/wildlifeSchedule.test.ts
git commit -m "feat: schedule deterministic wildlife activity"
```

## Task 5: Implement bounded near-agent state machines

**Files:**

- Create: `src/game/world/wildlife/stateMachine.ts`
- Test: `tests/wildlifeStateMachine.test.ts`

- [ ] Write table-driven tests for every allowed state transition, habitat reacquisition, gentle player avoidance, regrouping, time/rain changes, Quiet Mode, Reduced Motion, and turtle events.

- [ ] Assert no transition produces attack, pursuit, death, distress, unbounded velocity, path entry, building entry, or an invalid position.

- [ ] Run `pnpm exec vitest run tests/wildlifeStateMachine.test.ts`; expected result is a missing-module failure.

- [ ] Add tuple-only state and reducer:

```ts
export interface WildlifeAgentState {
  id: string
  speciesId: WildlifeSpeciesId
  cell: CellKey
  position: readonly [number, number, number]
  velocity: readonly [number, number, number]
  heading: number
  behavior: WildlifeBehaviorState
  behaviorUntilTick: number
  representation: 'near' | 'distant'
  animationPhase: number
}

export interface WildlifeContext {
  tick: number
  player: readonly [number, number, number]
  time: number
  rain: number
  wind: number
  quietMode: boolean
  reducedMotion: boolean
  turtleEvent: TurtleScaleEvent | null
}

export function stepWildlifeAgent(
  agent: WildlifeAgentState,
  context: WildlifeContext,
  habitat: HabitatQuery,
): WildlifeAgentState | null
```

- [ ] Return `null` when no valid habitat can be acquired so the director can return the agent to its pool. Use bounded flee distance/speed and state cooldowns.

- [ ] Keep primary locomotion at a calm readable rate under Reduced Motion; separately cap rapid wings, insects, animation exaggeration, and turtle-event reactions.

- [ ] Run `pnpm exec vitest run tests/wildlifeStateMachine.test.ts`; expected result is complete safe transition coverage.

- [ ] Commit bounded behavior:

```bash
git add src/game/world/wildlife/stateMachine.ts tests/wildlifeStateMachine.test.ts
git commit -m "feat: add gentle wildlife state machines"
```

## Task 6: Add pooled director and quality representation budgets

**Files:**

- Create: `src/game/world/wildlife/WildlifeDirector.ts`
- Modify: `src/game/core/quality.ts`
- Modify: `tests/quality.test.ts`
- Create: `tests/wildlifePooling.test.ts`
- Create: `tests/wildlifeQuality.test.ts`

- [ ] Write pooling tests for active-cell spawn/despawn, object reuse, invalid-habitat return, bounded pool sizes, stable agent IDs, no duplicate active IDs, and full cleanup.

- [ ] Write quality tests with exact initial budgets: Low `10/8/8/0/4`, Medium `18/12/12/12/6`, High `32/20/20/28/10`, Ultra `48/28/30/42/12` for near agents, distant groups, update Hz, shadow radius, and audio voices respectively.

- [ ] Assert each suitable biome/category keeps at least one near or distant representative on Low and canonical schedule IDs do not change across profiles.

- [ ] Run the pooling/quality tests; expected result is failure because director and budgets are absent.

- [ ] Extend quality types:

```ts
export interface WildlifeQualityBudget {
  maxNearAgents: number
  maxDistantGroups: number
  updateHz: number
  animationLodBias: 0 | 1 | 2
  shadowRadius: number
  maxAudioVoices: number
}
```

- [ ] Add `wildlife: WildlifeQualityBudget` to the existing Phase A `QualityProfile`. Map the Phase A broad `wildlifeDensity` value into these concrete limits and keep both fields monotonic until all broad-density consumers have migrated.

- [ ] Implement the director:

```ts
export interface WildlifeFrame {
  tick: number
  nearAgents: readonly WildlifeAgentState[]
  distantGroups: readonly DistantWildlifeGroup[]
  calls: readonly WildlifeCallEvent[]
}

export class WildlifeDirector {
  constructor(worldSeed: number, registry: WildlifeRegistry, habitat: HabitatQuery)
  setActiveCells(cells: readonly CellKey[]): void
  update(
    elapsedSeconds: number,
    context: Omit<WildlifeContext, 'tick'>,
    budget: WildlifeQualityBudget,
  ): WildlifeFrame
  snapshot(): WildlifeDirectorSnapshot
  dispose(): void
}
```

- [ ] Use an accumulator and `WILDLIFE_TICK_SECONDS`; cap catch-up work after tab suspension and retain deterministic tick ordering.

- [ ] Select population representation by stable importance/category coverage before filling remaining budget. Do not select the first N global agents and accidentally erase late registry categories.

- [ ] Run `pnpm exec vitest run tests/wildlifePooling.test.ts tests/wildlifeQuality.test.ts tests/quality.test.ts`; expected result is bounded reuse, category retention, and monotonic budgets.

- [ ] Commit the wildlife runtime core:

```bash
git add src/game/world/wildlife/WildlifeDirector.ts src/game/core/quality.ts tests/quality.test.ts tests/wildlifePooling.test.ts tests/wildlifeQuality.test.ts
git commit -m "feat: pool quality-scaled wildlife"
```

## Task 7: Replace primitive gulls and prove owned hero-bird calls

**Files:**

- Create: `src/game/world/wildlife/WildlifeWorld.tsx`
- Create: `src/game/world/wildlife/render/BirdGroups.tsx`
- Create: `src/game/world/wildlife/render/InsectGroups.tsx`
- Create: `src/game/audio/ambience/WildlifeAudioEngine.ts`
- Modify: `src/game/world/landmarks/Landmarks.tsx`
- Modify: `src/game/world/TurtleWorld.tsx`
- Modify: `src/game/audio/ambience/AmbienceEngine.ts`
- Modify: `src/game/audio/AudioManager.ts`
- Modify: `src/game/core/events.ts`
- Test: `tests/ambientLifeRemoval.test.ts`
- Test: `tests/wildlifeAudio.test.ts`
- Test: `tests/ambienceWildlifeOwnership.test.ts`
- Test: `e2e/wildlife.spec.ts`

- [ ] Write a source contract test that `Landmarks.tsx` exports `Landmarks()` but no longer exports or defines `AmbientLife()`, and `TurtleWorld.tsx` mounts `WildlifeWorld` once.

- [ ] Add E2E probes for visible bird/group IDs, species, representation, model asset ID, LOD, active cell, and behavior. Defer call-ownership assertions to the audio checkpoint later in this task so the first visual cutover can pass independently.

- [ ] Run both tests; expected result is failure while the old nine-gull component remains.

- [ ] Mount one long-lived `WildlifeDirector` in `WildlifeWorld`, feed it active cells and prior-frame runtime context, and store render snapshots in refs rather than Zustand.

- [ ] Render articulated near birds with cloned registered rigs and distant flocks through pooled/instanced representations. Use explicit per-agent/group bounds and LODs; dispose animation mixers and leases on pool release.

- [ ] Render butterflies, moths, fireflies, dragonflies, and beetles as bounded habitat groups. Limit rapid/large swarm motion under Reduced Motion while retaining slow visible life.

- [ ] Delete `AmbientLife()` and its primitive gull geometry from `Landmarks.tsx`; keep the deterministic voyage `Landmarks()` scheduler unchanged.

- [ ] Run `pnpm exec vitest run tests/ambientLifeRemoval.test.ts tests/landmarks.test.ts tests/wildlifePooling.test.ts` and `pnpm exec playwright test e2e/wildlife.spec.ts`; expected result is authored hero-slice birds, a registered procedural insect-group fallback, and no legacy gull component. Task 8 replaces the insect fallback with its reviewed authored pack.

- [ ] Commit the first visual wildlife cutover:

```bash
git add src/game/world/wildlife/WildlifeWorld.tsx src/game/world/wildlife/render/BirdGroups.tsx src/game/world/wildlife/render/InsectGroups.tsx src/game/world/landmarks/Landmarks.tsx src/game/world/TurtleWorld.tsx tests/ambientLifeRemoval.test.ts e2e/wildlife.spec.ts
git commit -m "feat: replace ambient gulls with wildlife groups"
```

- [ ] Before the Phase B turtle/audio assembly resumes, write Web Audio doubles in `tests/wildlifeAudio.test.ts` that verify a represented Crownwood songbird or Galecrest seabird call connects only to the ambient bus, borrows one bounded panner/voice, updates position, uses deterministic variant/playback values, obeys the current quality voice limit, and disposes nodes/listeners.

- [ ] Write `tests/ambienceWildlifeOwnership.test.ts` so `AmbienceEngine` contains no `birdTimer`, `scheduleBird`, wildlife `chirp`, or `Math.random()` call while retaining ocean, wind, rain, and interior beds. Run both tests and confirm the legacy random scheduler makes them fail.

- [ ] Add the stable event and sole renderer API at this pilot checkpoint:

```ts
export interface WildlifeCall {
  emitterId: string
  speciesId: WildlifeSpeciesId
  position: readonly [number, number, number]
  assetId: AssetId
  gain: number
  playbackRate: number
  source: 'near-agent' | 'distant-group'
}

export type GameEvents = {
  // Preserve existing events.
  wildlifeCall: WildlifeCall
}

export class WildlifeAudioEngine {
  constructor(ctx: AudioContext, destination: AudioNode)
  play(call: WildlifeCall, voiceLimit: number): void
  updateEmitter(id: string, position: readonly [number, number, number]): void
  disposeEmitter(id: string): void
  dispose(): void
}
```

- [ ] Have `WildlifeWorld` emit `wildlifeCall` only when the hero-slice emitter ID exists in the current near-agent or distant-group snapshot. Subscribe the one `WildlifeAudioEngine` through owned `AudioManager` plumbing, connect it to the ambient bus, and pass `runtime.quality.wildlife.maxAudioVoices`. Delete the random bird/cricket scheduler from `AmbienceEngine`; extend `e2e/wildlife.spec.ts` with owner-ID/call-ID assertions only now. Later Tasks 8-10 expand and audit this same engine rather than creating another subscriber.

- [ ] Run `pnpm exec vitest run tests/wildlifeAudio.test.ts tests/ambienceWildlifeOwnership.test.ts tests/audioBus.test.ts` and the wildlife E2E file; expected result is synchronized songbird/seabird calls, no nearby disembodied calls, and clean disposal.

- [ ] Commit the reusable Phase B call checkpoint:

```bash
git add src/game/audio/ambience/WildlifeAudioEngine.ts src/game/audio/ambience/AmbienceEngine.ts src/game/audio/AudioManager.ts src/game/core/events.ts src/game/world/wildlife/WildlifeWorld.tsx tests/wildlifeAudio.test.ts tests/ambienceWildlifeOwnership.test.ts e2e/wildlife.spec.ts
git commit -m "feat: tie hero-bird calls to visible wildlife"
```

## Task 8: Add ground and wetland agents

**Files:**

- Add: retained source/provenance under `art-source/wildlife/{mossback-grazer,shell-hare,fernfall-glider,tide-corvid,lumenfen-frog,reed-wader,lumenfen-insects,blossom-pollinators,lumenfen-fish}/`
- Add: matching reviewed contact sheets under `docs/art-review/wildlife/`
- Add: matching registered models, KTX2 textures, and calls under `public/assets/{models,textures,audio}/wildlife/`
- Modify: `src/game/assets/manifest.json`
- Modify: `ASSET_LICENSES.md`
- Create: `src/game/world/wildlife/render/GroundAgents.tsx`
- Create: `src/game/world/wildlife/render/WetlandAgents.tsx`
- Modify: `src/game/world/wildlife/render/BirdGroups.tsx`
- Modify: `src/game/world/wildlife/render/InsectGroups.tsx`
- Modify: `src/game/world/wildlife/WildlifeWorld.tsx`
- Modify: `src/game/world/wildlife/registry.ts`
- Test: `tests/groundWetlandWildlife.test.ts`
- Modify: `e2e/wildlife.spec.ts`

- [ ] Write tests requiring grazers/rabbits/tree-dwellers to remain off primary paths/buildings and frogs/waders/fish to remain in suitable Lumenfen water/shallow anchors.

- [ ] Test gentle player flee thresholds, regrouping, rain/time activity, pool return, Low representation retention, and no Rapier collider creation for wildlife.

- [ ] Run tests; expected result is failure because renderers/populations are absent.

- [ ] Author the nine listed non-ocean species/groups through the Task 2 pipeline: retained provenance and Blender/generation source, exact roster clips, appropriate large/small/group triangle budgets, 2K/1K/512 KTX2 tiers, normalized traceable calls, and signed turntable/locomotion/material/LOD contact sheets. Do not replace absent source files with unreviewed primitives.

- [ ] Export each articulated or group asset with `scripts/blender/export-wildlife.py`, then run:

```bash
pnpm validate:assets:wildlife -- --required-species=crownwood-songbird,galecrest-seabird,mossback-grazer,shell-hare,fernfall-glider,tide-corvid,lumenfen-frog,reed-wader,lumenfen-insects,blossom-pollinators,lumenfen-fish
pnpm validate:assets
pnpm write:asset-licenses
```

Expected result: every required land/air/wetland/freshwater file, source record, LOD/clip contract, call variant, contact sheet, fallback, and license row passes.

- [ ] Render `mossback-grazer`, `shell-hare`, and `fernfall-glider` from near-agent states with animation crossfades, ground-normal alignment, bounded shadows, and LOD hysteresis.

- [ ] Render frogs and waders as near agents and freshwater fish as an explicit distant/near school representation. Do not add dynamic rigid bodies or path-blocking colliders.

- [ ] Add tide-corvids and Blossomshade pollinators to the existing bird/insect render groups, then populate Crownwood, Blossomshade, Fernfall, Lumenfen, and Hearth definitions with characteristic groups and explicit 90-second observation schedules.

- [ ] Run `pnpm exec vitest run tests/groundWetlandWildlife.test.ts tests/wildlifeHabitat.test.ts tests/wildlifeQuality.test.ts` and the updated E2E file; expected result is safe, visible category coverage.

- [ ] Commit land/wetland wildlife:

```bash
git add art-source/wildlife docs/art-review/wildlife public/assets/models/wildlife public/assets/textures/wildlife public/assets/audio/wildlife src/game/assets/manifest.json ASSET_LICENSES.md src/game/world/wildlife/render/GroundAgents.tsx src/game/world/wildlife/render/WetlandAgents.tsx src/game/world/wildlife/render/BirdGroups.tsx src/game/world/wildlife/render/InsectGroups.tsx src/game/world/wildlife/WildlifeWorld.tsx src/game/world/wildlife/registry.ts tests/groundWetlandWildlife.test.ts e2e/wildlife.spec.ts
git commit -m "feat: add ground and wetland wildlife"
```

## Task 9: Add ocean schools, rays, dolphins, and whale silhouettes

**Files:**

- Add: retained source/provenance under `art-source/wildlife/{shell-ray,sanctuary-dolphin,distant-whale}/`
- Add: matching reviewed contact sheets under `docs/art-review/wildlife/`
- Add: matching registered models, KTX2 textures, and calls under `public/assets/{models,textures,audio}/wildlife/`
- Modify: `src/game/assets/manifest.json`
- Modify: `ASSET_LICENSES.md`
- Create: `src/game/world/wildlife/render/AquaticGroups.tsx`
- Modify: `src/game/world/wildlife/WildlifeWorld.tsx`
- Modify: `src/game/world/wildlife/registry.ts`
- Test: `tests/oceanWildlife.test.ts`
- Modify: `e2e/wildlife.spec.ts`

- [ ] Write tests for water-relative paths, shell/body avoidance, travel-distance stability, surface/dive cooldowns, time/weather filters, turtle-stroke responses, and Low ocean-category retention.

- [ ] Run tests; expected result is failure because aquatic groups are absent.

- [ ] Author the ray, dolphin, and whale through the Task 2 pipeline with retained provenance/source, calm anatomically credible silhouettes, waterline-aware rigs/clips, large/ocean triangle budgets, 2K/1K/512 KTX2 tiers, normalized traceable calls where applicable, and signed waterline/material/LOD contact sheets.

- [ ] Export all three species and require the complete registry roster:

```bash
blender --background art-source/wildlife/shell-ray/shell-ray.blend --python scripts/blender/export-wildlife.py -- shell-ray
blender --background art-source/wildlife/sanctuary-dolphin/sanctuary-dolphin.blend --python scripts/blender/export-wildlife.py -- sanctuary-dolphin
blender --background art-source/wildlife/distant-whale/distant-whale.blend --python scripts/blender/export-wildlife.py -- distant-whale
pnpm validate:assets:wildlife -- --required-species=mossback-grazer,shell-hare,fernfall-glider,crownwood-songbird,tide-corvid,galecrest-seabird,lumenfen-frog,reed-wader,lumenfen-insects,blossom-pollinators,lumenfen-fish,shell-ray,sanctuary-dolphin,distant-whale
```

Expected result: the full fourteen-species asset, provenance, LOD/clip, fallback, call, review, and license inventory passes.

- [ ] Render fish schools and rays as bounded group representations, dolphins as pooled surface/arc groups, and whales as rare distant silhouettes. Use the endless-travel coordinate convention without moving physics-world origin.

- [ ] Keep dolphins/whales rare, calm, noninteractive, and on long cooldowns. Reduced Motion limits breach/arc height and rapid water particles while retaining surfacing silhouettes.

- [ ] Drive broad wake response from turtle events through the shared runtime signal; do not couple aquatic animation directly to turtle bone objects.

- [ ] Run `pnpm exec vitest run tests/oceanWildlife.test.ts tests/wildlifeSchedule.test.ts tests/wildlifeQuality.test.ts` and E2E; expected result is stable ocean activity with no shell intersections.

- [ ] Commit ocean wildlife:

```bash
git add art-source/wildlife/shell-ray art-source/wildlife/sanctuary-dolphin art-source/wildlife/distant-whale docs/art-review/wildlife/shell-ray docs/art-review/wildlife/sanctuary-dolphin docs/art-review/wildlife/distant-whale public/assets/models/wildlife/shell-ray public/assets/models/wildlife/sanctuary-dolphin public/assets/models/wildlife/distant-whale public/assets/textures/wildlife/shell-ray public/assets/textures/wildlife/sanctuary-dolphin public/assets/textures/wildlife/distant-whale public/assets/audio/wildlife src/game/assets/manifest.json ASSET_LICENSES.md src/game/world/wildlife/render/AquaticGroups.tsx src/game/world/wildlife/WildlifeWorld.tsx src/game/world/wildlife/registry.ts tests/oceanWildlife.test.ts e2e/wildlife.spec.ts
git commit -m "feat: add calm ocean wildlife groups"
```

## Task 10: Audit spatial-call ownership across the complete roster

**Files:**

- Modify: `src/game/audio/ambience/WildlifeAudioEngine.ts`
- Modify: `src/game/audio/ambience/AmbienceEngine.ts`
- Modify: `src/game/audio/AudioManager.ts`
- Modify: `src/game/core/events.ts`
- Modify: `src/game/world/wildlife/WildlifeWorld.tsx`
- Modify: `tests/wildlifeAudio.test.ts`
- Modify: `tests/ambienceWildlifeOwnership.test.ts`

- [ ] Extend the Task 7 Web Audio doubles across every call-producing species/group added in Tasks 8-9. Require a current represented owner ID, correct position updates, deterministic variant/playback values, ambient-bus routing, bounded voice reuse, and disposal on despawn or world teardown.

- [ ] Extend the ownership test to reject any reintroduced timer/synth/random wildlife scheduler and to assert ocean, wind, rain, and interior beds remain independent of represented calls.

- [ ] Run the two focused tests; expected result is failure until the Task 8-9 land, wetland, insect, freshwater, and ocean emitters all satisfy the Task 7 ownership contract.

- [ ] Keep the Task 7 `WildlifeCall` payload and sole `WildlifeAudioEngine` API unchanged. Have every call-producing population emit only when its scheduled emitter ID exists in the current near-agent or explicit distant-group snapshot; ocean silhouettes with no call asset remain silent.

- [ ] Scale call probability/gain under Quiet Mode, preserve sparse bed detail, and pass the current quality voice limit without changing event ownership. Confirm `AmbienceEngine` still contains no wildlife call scheduler or renderer.

- [ ] Confirm Task 7 created and disposes exactly one engine in `AudioManager`; this task may extend its asset/voice behavior but may not add a second event subscriber or renderer.

- [ ] Run `pnpm exec vitest run tests/wildlifeAudio.test.ts tests/ambienceWildlifeOwnership.test.ts tests/audioBus.test.ts`; expected result is synchronized ownership and clean disposal across the complete registry.

- [ ] Commit the complete-roster ownership audit:

```bash
git add src/game/audio/ambience/WildlifeAudioEngine.ts src/game/audio/ambience/AmbienceEngine.ts src/game/audio/AudioManager.ts src/game/core/events.ts src/game/world/wildlife/WildlifeWorld.tsx tests/wildlifeAudio.test.ts tests/ambienceWildlifeOwnership.test.ts
git commit -m "test: verify wildlife call ownership"
```

## Task 11: Integrate turtle events, Quiet Mode, Reduced Motion, and diagnostics

**Files:**

- Modify: `src/game/world/wildlife/WildlifeDirector.ts`
- Modify: `src/game/world/wildlife/WildlifeWorld.tsx`
- Modify: `src/game/core/runtime.ts`
- Modify: `src/game/debug/probes.ts`
- Modify: `src/game/ui/hud/PerfOverlay.tsx`
- Test: `tests/wildlifeAccessibility.test.ts`
- Modify: `e2e/wildlife.spec.ts`

- [ ] Write tests that Quiet Mode reduces calls/activity but retains representatives, Reduced Motion caps secondary motion while keeping primary behaviors, and turtle events produce bounded flee/regroup/surface responses with long cooldowns.

- [ ] Add E2E toggles for Quiet Mode and Reduced Motion and assert stable IDs/category presence before and after each change.

- [ ] Run tests; expected result is failure until the director consumes accessibility/turtle context.

- [ ] Add bounded `runtime.wildlife` diagnostics only: active near/distant/call counts and pool sizes. Do not expose full agent arrays through runtime.

- [ ] Declaration-merge the Phase A `WildlifeProbeSection` with active species/category IDs, representation, behavior, cell, LOD, model ID, call emitter ownership, pool use, and update rate. Register it through `registerProbeSection('wildlife', 'director', contributor)` so diagnostics appear at `window.__turtlebackDebug.probe().sections.wildlife`. Unregister it when `WildlifeWorld` unmounts.

- [ ] Show concise development-only wildlife counts in `PerfOverlay` without introducing per-frame React updates.

- [ ] Run `pnpm exec vitest run tests/wildlifeAccessibility.test.ts tests/wildlifeQuality.test.ts tests/turtleEvents.test.ts` and E2E; expected result is accessible bounded response and category retention.

- [ ] Commit cross-system wildlife behavior:

```bash
git add src/game/world/wildlife/WildlifeDirector.ts src/game/world/wildlife/WildlifeWorld.tsx src/game/core/runtime.ts src/game/debug/probes.ts src/game/ui/hud/PerfOverlay.tsx tests/wildlifeAccessibility.test.ts e2e/wildlife.spec.ts
git commit -m "feat: integrate accessible wildlife responses"
```

## Task 12: Verify observation coverage, performance, soak, and release behavior

**Files:**

- Modify: `src/game/config/benchmarks.ts`
- Modify: `visual/graphics.capture.ts`
- Modify: `e2e/wildlife.spec.ts`
- Create: `scripts/wildlife-soak.mjs`
- Modify: `docs/performance-baseline.md`
- Modify: `MANUAL_QA.md`

- [ ] Add benchmark views `wildlife-crownwood-group`, `wildlife-lumenfen-group`, `wildlife-blossomshade-group`, `wildlife-fernfall-group`, `wildlife-galecrest-group`, `wildlife-hearth-group`, and `wildlife-ocean-group`.

- [ ] Extend E2E to observe each suitable biome for 90 deterministic seconds under controlled time/weather and require a characteristic visible or explicit distant representation with owned calls.

- [ ] Call the dev-only `window.__turtlebackDebug.failAsset(id)` for one model and one call asset, and inject habitat exhaustion through the director test seam; expected behavior is registered visual fallback, skipped/alternate call without an error loop, and pool return without invalid placement. Use `probe()` to verify the failed ID, chosen fallback, active emitter ownership, and stable pool counts.

- [ ] Implement `scripts/wildlife-soak.mjs` to collect fixed-tick counts, active/pool IDs, call voices, audio nodes, model/texture leases, draw calls, and process/renderer memory during a 30-minute traversal and two-hour audio/ambience run.

- [ ] Run `pnpm exec playwright test e2e/wildlife.spec.ts`; expected result is biome/category/ownership/accessibility/fallback coverage passing without console errors.

- [ ] Run `pnpm capture:graphics`; expected result is group captures at High and representative Low/Ultra comparisons without LOD pops, floating feet, waterline errors, path incursions, or empty nearby call origins.

- [ ] Manually inspect anatomy, scale, grounding, material response, calm behavior, transition quality, group repetition, fantasy restraint, Quiet Mode, Reduced Motion, rain/night visibility, and the representative 90-second acceptance window. Record capture IDs and hardware in `MANUAL_QA.md`.

- [ ] Run `node scripts/wildlife-soak.mjs --minutes=30` and the two-hour audio mode. Pool sizes, active IDs, asset leases, and audio nodes must plateau; process memory growth over the final 20 traversal minutes must remain below 10 percent.

- [ ] Record per-scene p50/p95/p99 frame time, update cost, agents/groups, draw calls, triangles, audio voices, renderer memory, and process memory in `docs/performance-baseline.md`. High and Low must remain inside the approved reference targets.

- [ ] Run the complete release gate:

```bash
pnpm validate:assets
pnpm validate:assets:wildlife
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm capture:graphics
pnpm desktop:package:mac
pnpm desktop:smoke
```

Expected result: all commands exit zero, every biome presents spatially credible wildlife, calls have active owners, all quality tiers retain major categories, accessibility settings work, existing interactions/save/recovery remain green, and both soaks reach a stable resource plateau.

- [ ] Commit the wildlife ecosystem closeout:

```bash
git add src/game/config/benchmarks.ts visual/graphics.capture.ts e2e/wildlife.spec.ts scripts/wildlife-soak.mjs docs/performance-baseline.md MANUAL_QA.md
git commit -m "test: verify sanctuary wildlife ecosystem"
```
