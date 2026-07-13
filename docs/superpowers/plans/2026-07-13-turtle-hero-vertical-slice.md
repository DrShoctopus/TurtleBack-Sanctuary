# Turtle Hero Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the assembled-primitive turtle with a monumental authored world-bearer and ship one final-quality Crownwood-to-Galecrest bow corridor that proves the complete graphics, wildlife, ambience, music, collision, accessibility, fallback, and Low-through-Ultra performance contract.

**Architecture:** Keep the analytic shell heightfield and Rapier traversal mesh authoritative and motionless. Load a registered rigged turtle model with stable LOD, node, clip, material, and emitter contracts; drive it from a pure deterministic animation plan and publish only bounded presentation signals to water, foliage, props, and audio. The existing `Turtle()` export becomes a compatibility wrapper around the authored hero, with the current procedural turtle retained only as the registered failure fallback.

**Tech Stack:** React 19, TypeScript 5.9, React Three Fiber, Three.js `AnimationMixer`, Rapier, Vitest, Playwright, glTF/GLB, Meshopt, KTX2/Basis, Web Audio, the project asset registry, mutable frame runtime, and typed event bus.

---

## Scope, prerequisites, and non-negotiable contracts

This plan implements Phase B of `docs/superpowers/specs/2026-07-13-sanctuary-graphics-audio-overhaul-design.md`. Before Task 3 starts, the Phase A asset registry must expose registered model/texture/audio acquisition, explicit disposal, base-URL-safe resolution, fallback chains, and build-time license validation. Before Task 5 starts, execute soundtrack Task 1 so `TurtleSoundCategory` comes from the one shared audio-record schema. Before Task 8 starts, the cell/biome and wildlife foundations named in the companion plans must exist.

The implementation must preserve all of the following:

- `terrainHeight()` and the visual/Rapier shell grid remain the traversal source of truth.
- The authored turtle, breathing, strokes, wake, spray, and scale events never move the shell rigid body, building pads, player capsule, or camera transform.
- Existing building IDs, `HOME_SPAWN`, interactions, save data, and route IDs remain valid.
- Reduced Motion retains slow breathing and primary life signals while reducing secondary deformation, spray, foliage response, event intensity, and camera-independent spectacle.
- Low uses authored lower LODs and textures; it must not silently render the procedural fallback during normal operation.
- A load failure may use the procedural fallback, but diagnostics must record the stable failed asset ID and fallback ID.
- The vertical slice is the bow approach bounded by `x=-50..50`, `z=-225..-100`. It transitions from Crownwood into Galecrest and opens onto a normal-traversal view of the head and neck.

### Authored turtle asset contract

| Kind                          | Required repository path                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Close model                   | `public/assets/models/turtle/turtle-hero-lod0.glb`                                                  |
| Medium model                  | `public/assets/models/turtle/turtle-hero-lod1.glb`                                                  |
| Distant model                 | `public/assets/models/turtle/turtle-hero-lod2.glb`                                                  |
| Inaccessible body collision   | `public/assets/models/turtle/turtle-body-collision.glb`                                             |
| Generated inspection contract | `public/assets/models/turtle/turtle-hero.contract.json`                                             |
| Skin base color               | `public/assets/textures/turtle/turtle-skin-basecolor-{512,1k,2k,4k}.ktx2`                           |
| Skin normal                   | `public/assets/textures/turtle/turtle-skin-normal-{512,1k,2k,4k}.ktx2`                              |
| Skin roughness/AO             | `public/assets/textures/turtle/turtle-skin-rma-{512,1k,2k,4k}.ktx2`                                 |
| Skin masks                    | `public/assets/textures/turtle/turtle-skin-masks-{512,1k,2k,4k}.ktx2`                               |
| Turtle audio                  | `public/assets/audio/turtle/{breath-loop,breath-deep,stroke-front,stroke-rear,shell-resonance}.mp3` |

All three visual LODs use metre scale, origin at shell centre, bow toward negative Z, and identical rig/clip names. Required named nodes are `WorldRoot`, `Body`, `Neck`, `Head`, `Jaw`, `Nostril_L`, `Nostril_R`, `Eyelid_L`, `Eyelid_R`, `Eye_L`, `Eye_R`, `EyeFocus`, `Flipper_FL`, `Flipper_FR`, `Flipper_BL`, `Flipper_BR`, `ShellSkirt`, `Wake_FL`, `Wake_FR`, `Wake_BL`, and `Wake_BR`. Required clips are `Idle_Breathe`, `Swim_Stroke`, `Neck_Drift`, `Blink`, `Head_Turn`, `Eye_Contact`, `Jaw_Micro`, and `Nostril_Micro`.

The shell traversal mesh generated by `ShellTerrain.tsx` is the separate simplified traversal mesh required by the design. `turtle-body-collision.glb` may cover inaccessible head/body volumes below the shell rim; it may not overlap walkable shell terrain or animate.

## Task 1: Lock the authored model contract in pure TypeScript

**Files:**

- Create: `src/game/world/turtle/modelContract.ts`
- Test: `tests/turtleModelContract.test.ts`

- [ ] Write `tests/turtleModelContract.test.ts` with a complete valid contract fixture and individual failures for a missing node, missing clip, mismatched LOD bounds, non-metre scale, wrong bow axis, missing wake emitter, and animated traversal collision.

- [ ] Run `pnpm exec vitest run tests/turtleModelContract.test.ts` and confirm it fails because `modelContract.ts` does not exist.

- [ ] Add the following public API to `modelContract.ts`:

```ts
export const TURTLE_REQUIRED_NODES = [
  'WorldRoot',
  'Body',
  'Neck',
  'Head',
  'Jaw',
  'Nostril_L',
  'Nostril_R',
  'Eyelid_L',
  'Eyelid_R',
  'Eye_L',
  'Eye_R',
  'EyeFocus',
  'Flipper_FL',
  'Flipper_FR',
  'Flipper_BL',
  'Flipper_BR',
  'ShellSkirt',
  'Wake_FL',
  'Wake_FR',
  'Wake_BL',
  'Wake_BR',
] as const

export const TURTLE_REQUIRED_CLIPS = [
  'Idle_Breathe',
  'Swim_Stroke',
  'Neck_Drift',
  'Blink',
  'Head_Turn',
  'Eye_Contact',
  'Jaw_Micro',
  'Nostril_Micro',
] as const

export type TurtleNodeName = (typeof TURTLE_REQUIRED_NODES)[number]
export type TurtleClipName = (typeof TURTLE_REQUIRED_CLIPS)[number]
export type TurtleLod = 0 | 1 | 2

export interface TurtleModelContract {
  metreScale: 1
  bowAxis: '-z'
  nodes: readonly string[]
  clips: readonly string[]
  lods: readonly {
    level: TurtleLod
    triangleCount: number
    bounds: readonly [number, number, number, number, number, number]
  }[]
  shellAnchor: { semiX: number; semiZ: number; rimY: number }
  collision: { animated: false; overlapsTraversal: false }
}

export interface TurtleModelContractIssue {
  code: string
  message: string
}

export function validateTurtleModelContract(
  contract: TurtleModelContract,
): readonly TurtleModelContractIssue[]
```

- [ ] Make validation require LOD triangle counts to decrease strictly and corresponding bounds to remain within 1.5 percent of LOD0 on each axis.

- [ ] Run `pnpm exec vitest run tests/turtleModelContract.test.ts`; expected result is one passing file with every invalid fixture rejected by a stable issue code.

- [ ] Commit the contract seam:

```bash
git add src/game/world/turtle/modelContract.ts tests/turtleModelContract.test.ts
git commit -m "test: define turtle hero model contract"
```

## Task 2: Add binary inspection and asset/license validation

**Files:**

- Modify: `package.json`
- Modify: `src/game/assets/manifest.json`
- Modify: `ASSET_LICENSES.md`
- Create: `scripts/blender/export-turtle.py`
- Create: `scripts/validate-turtle-model.mjs`
- Add: `art-source/turtle/turtle-hero.blend`
- Add: `art-source/turtle/turtle-body-collision.blend`
- Add: `art-source/turtle/export-settings.json`
- Add: `art-source/turtle/SOURCE.md`
- Add: `docs/art-review/turtle/README.md`
- Add: turtle silhouette, material, animation, and LOD contact sheets under `docs/art-review/turtle/`
- Create: `public/assets/models/turtle/turtle-hero.contract.json`
- Add: every turtle model, texture, and audio file listed in the asset contract table
- Test: `tests/turtleAssets.test.ts`

- [ ] Add `@gltf-transform/core` and `@gltf-transform/extensions` as pinned development dependencies and add a canonical `validate:assets:turtle` script that runs `node scripts/validate-turtle-model.mjs`.

- [ ] Write `tests/turtleAssets.test.ts` to assert that each stable turtle asset ID exists, every LOD points to the next lower fallback, texture tiers map exactly to Low/Medium/High/Ultra, all files stay under `public/assets/`, and every license is exactly one of the shared allowlist values: `Original`, `CC0-1.0`, or `CC-BY-4.0`.

- [ ] Run `pnpm exec vitest run tests/turtleAssets.test.ts`; expected result is failure listing the missing manifest entries.

- [ ] Choose and record provenance before modeling: either an original in-house/generated asset with retained prompts, references, generation settings, author, and edit history, or an explicitly redistributable source with author, source URL, license text, required attribution, download date, and modification record. Retain this in `art-source/turtle/SOURCE.md` and register the same facts in `src/game/assets/manifest.json`.

- [ ] Create and retain `art-source/turtle/turtle-hero.blend`, `art-source/turtle/turtle-body-collision.blend`, and `art-source/turtle/export-settings.json`. Set metre units, world origin at shell centre, bow toward negative Z, shell anchors at 170 m × 250 m, and anatomy/silhouette collections named `LOD0`, `LOD1`, `LOD2`, `COLLISION`, and `RIG`.

- [ ] Complete silhouette/anatomy review before surface detail: capture orthographic front/side/top and the in-game bow-deck perspective; reject cute head proportions, short neck scale cues, weak beak/jaw structure, undersized flippers, or any shell/body transition that reads as a separate creature placed under terrain. Record approved renders in `docs/art-review/turtle/silhouette-contact-sheet.png` and the approval checklist in `docs/art-review/turtle/README.md`.

- [ ] Retopologize to these measured targets: LOD0 180k-260k triangles, LOD1 65k-100k, LOD2 15k-28k, and static inaccessible collision at or below 8k. Preserve eyelid, jaw, nostril, flipper, head/neck, and shell-skirt deformation loops; require strictly decreasing counts and silhouette-bound drift below 1.5 percent.

- [ ] UV at consistent metre-based texel density with separate non-overlapping hero head/eye, neck/flipper, body, and shell-skirt sets. Bake 4K source base color, tangent-space normal, packed roughness/metalness/AO, emissive, wetness, algae, barnacle, scar, and mineral masks; derive mipmapped 2K/1K/512 KTX2 tiers through the pinned texture toolchain rather than rebaking different content.

- [ ] Build the named rig and create all required clips with root motion removed. Verify seamless breathing/swim/neck loops, eyelid closure without eye penetration, restrained jaw/nostril motion, flipper arcs that match wake emitter positions, stable eye focus, and identical skeleton/clip contracts across all LOD exports.

- [ ] Add `scripts/blender/export-turtle.py` and export with the explicit authoring command:

```bash
blender --background art-source/turtle/turtle-hero.blend --python scripts/blender/export-turtle.py -- public/assets/models/turtle
```

The exporter must fail on unapplied scale, wrong axis/origin, missing collections/nodes/clips, non-decreasing triangle counts, root motion, or missing wake emitters. If the implementing environment cannot run the approved Blender version and pinned texture encoder, stop at this named external-authoring gate and do not substitute primitive or synthetic production binaries.

- [ ] Optimize exported GLBs with Meshopt while preserving skinning, morphs, node names, clips, and bounds. Normalize final turtle MP3 assets against the ambient bus target and retain audio provenance under `art-source/turtle/audio/`.

- [ ] Render `docs/art-review/turtle/material-contact-sheet.png`, `animation-contact-sheet.png`, and `lod-contact-sheet.png` from the exported assets. Review noon/rain/sunset/night materials, close eye/head anatomy, stretched UVs, seam visibility, wetness/specular clipping, skin deformation, LOD pose/silhouette pop, and collision/traversal separation before importing the binaries into the manifest-controlled runtime.

- [ ] Register stable IDs using the `turtle.` prefix, including `turtle.hero.lod0`, `turtle.hero.lod1`, `turtle.hero.lod2`, `turtle.body-collision`, texture-tier IDs, and each audio ID. Record source or generation provenance, author, license, attribution, checksum, decoded size, quality variants, preload region `hero`, material capabilities, and fallbacks.

- [ ] Implement `validate-turtle-model.mjs` so it parses all GLBs, writes `turtle-hero.contract.json` only when called with `--write-contract`, and otherwise fails on contract drift, missing nodes/clips, non-decreasing triangles, non-KTX2 authored textures, animated collision, or bounds misalignment.

- [ ] Generate the inspection contract with `node scripts/validate-turtle-model.mjs --write-contract`, then run `pnpm validate:assets:turtle`; expected output includes all four model paths and ends with `Turtle model contract valid`.

- [ ] Run `pnpm validate:assets`, `pnpm validate:assets:turtle`, and `pnpm write:asset-licenses`; expected result is schema/registry/turtle-slice success and `ASSET_LICENSES.md` exactly matching every asset currently present. Reserve the global final-inventory gate for Phase F.

- [ ] Run `pnpm exec vitest run tests/turtleModelContract.test.ts tests/turtleAssets.test.ts`; expected result is both files passing.

- [ ] Commit the validated authored asset set:

```bash
git add package.json pnpm-lock.yaml scripts/blender/export-turtle.py scripts/validate-turtle-model.mjs art-source/turtle docs/art-review/turtle public/assets/models/turtle public/assets/textures/turtle public/assets/audio/turtle src/game/assets/manifest.json ASSET_LICENSES.md tests/turtleAssets.test.ts
git commit -m "assets: add validated world-bearer turtle"
```

## Task 3: Extract the current turtle as the explicit fallback

**Files:**

- Create: `src/game/world/turtle/ProceduralTurtleFallback.tsx`
- Modify: `src/game/world/turtle/Turtle.tsx`
- Test: `tests/turtleFallback.test.ts`

- [ ] Write a source-level contract test that permits `ProceduralTurtleFallback` to be imported only by the stable `Turtle.tsx` wrapper, requires `TurtleWorld.tsx` to mount only `Turtle`, and forbids a second fallback mount elsewhere.

- [ ] Run `pnpm exec vitest run tests/turtleFallback.test.ts`; expected result is failure because the fallback component does not exist.

- [ ] Move the current procedural implementation, geometry constants, material construction, blink logic, and helper functions unchanged into `ProceduralTurtleFallback.tsx`, exporting `ProceduralTurtleFallback()`.

- [ ] Reduce `Turtle.tsx` to the stable public wrapper. During this task it may render `ProceduralTurtleFallback`; Task 6 replaces that temporary direct render with the registered hero.

- [ ] Run `pnpm typecheck` and `pnpm exec vitest run tests/turtleFallback.test.ts`; expected result is a clean typecheck and passing fallback ownership test.

- [ ] Commit the behavior-preserving extraction:

```bash
git add src/game/world/turtle/Turtle.tsx src/game/world/turtle/ProceduralTurtleFallback.tsx tests/turtleFallback.test.ts
git commit -m "refactor: isolate procedural turtle fallback"
```

## Task 4: Build the deterministic turtle animation plan

**Files:**

- Create: `src/game/world/turtle/types.ts`
- Create: `src/game/world/turtle/animationPlan.ts`
- Test: `tests/turtleAnimation.test.ts`

- [ ] Write tests for deterministic output, bounded gaze, monotonic rain wetness, stable stroke phase, blinking from an explicit trigger, and Reduced Motion preserving breathing while limiting secondary response to at most 20 percent.

- [ ] Run `pnpm exec vitest run tests/turtleAnimation.test.ts`; expected result is a missing-module failure.

- [ ] Define the shared event types in `types.ts`, then implement the pure animation API without importing React, Three.js, Zustand, or `runtime`:

```ts
export type TurtleScaleEventKind = 'deep-breath' | 'front-stroke' | 'head-turn' | 'eye-contact'

export interface TurtleScaleEvent {
  id: number
  kind: TurtleScaleEventKind
  startedAt: number
  duration: number
  intensity: number
}

export interface TurtleAnimationInput {
  dt: number
  comfortTime: number
  reducedMotion: boolean
  player: readonly [number, number, number]
  rain: number
  blink: number
  event: TurtleScaleEvent | null
}

export interface TurtleAnimationPlan {
  clipWeights: Readonly<Record<TurtleClipName, number>>
  gazeTarget: readonly [number, number, number]
  wetness: number
  wakeStrength: number
  foliageImpulse: number
  resonanceStrength: number
  sprayStrength: number
}

export function buildTurtleAnimationPlan(input: TurtleAnimationInput): TurtleAnimationPlan
```

- [ ] Ensure player tracking clamps head attention to a restrained cone and does not continuously force eye contact.

- [ ] Run `pnpm exec vitest run tests/turtleAnimation.test.ts`; expected result is all animation-plan tests passing with no browser environment.

- [ ] Commit the pure animation seam:

```bash
git add src/game/world/turtle/types.ts src/game/world/turtle/animationPlan.ts tests/turtleAnimation.test.ts
git commit -m "feat: plan deterministic turtle animation"
```

## Task 5: Add rare scale-event scheduling and shared runtime signals

**Files:**

- Create: `src/game/world/turtle/TurtleEventDirector.ts`
- Modify: `src/game/core/runtime.ts`
- Modify: `src/game/core/events.ts`
- Test: `tests/turtleEvents.test.ts`

- [ ] Write tests proving identical seeds produce identical event sequences, no rare event repeats within 12 real minutes, eye contact requires the player to be in a configured vista, rain suppresses spray-heavy events, and Reduced Motion lowers event intensity without eliminating deep breaths.

- [ ] Run `pnpm exec vitest run tests/turtleEvents.test.ts`; expected result is failure for missing exports.

- [ ] Import `TurtleScaleEvent` from `types.ts` and add the director input and API:

```ts
export interface TurtleEventInput {
  elapsedTime: number
  playerInVista: boolean
  rain: number
  reducedMotion: boolean
}

export class TurtleEventDirector {
  constructor(seed: number)
  update(dt: number, input: TurtleEventInput): TurtleScaleEvent | null
  reset(seed: number): void
}
```

- [ ] Add `turtleScaleEvent: TurtleScaleEvent` and the owned audio payload below to `GameEvents`; add `runtime.turtle` with `breath`, `stroke`, `wakeStrength`, `foliageImpulse`, `resonanceStrength`, `sprayStrength`, and `activeEvent` fields.

```ts
export interface TurtleSoundEvent {
  eventId: string
  kind: TurtleSoundCategory
  position: readonly [number, number, number]
  intensity: number
}

export type GameEvents = {
  // Preserve existing events.
  turtleScaleEvent: TurtleScaleEvent
  turtleSound: TurtleSoundEvent
}
```

Import `TurtleSoundCategory` from the shared authored-audio schema established by the soundtrack pilot. Phase B ships the five required files in the asset table; Phase E extends the same category metadata to at least two registered variants for each category without changing this event payload.

- [ ] Do not put an `AnimationMixer`, `Object3D`, audio node, or React state in `runtime`.

- [ ] Run `pnpm exec vitest run tests/turtleEvents.test.ts tests/comfortMotion.test.ts` and `pnpm typecheck`; expected result is passing tests and no runtime-type regressions.

- [ ] Commit event/runtime plumbing:

```bash
git add src/game/world/turtle/TurtleEventDirector.ts src/game/core/runtime.ts src/game/core/events.ts tests/turtleEvents.test.ts
git commit -m "feat: schedule accessible turtle scale events"
```

## Task 6: Render the authored hero with stable LODs and fallback

**Files:**

- Create: `src/game/world/turtle/TurtleHero.tsx`
- Create: `src/game/world/turtle/materials.ts`
- Modify: `src/game/world/turtle/Turtle.tsx`
- Modify: `src/game/world/TurtleWorld.tsx`
- Test: `tests/turtleLod.test.ts`
- Test: `e2e/worldResources.spec.ts`

- [ ] Write `tests/turtleLod.test.ts` against a pure `selectTurtleLod(distance, quality)` helper. Assert Low cannot request LOD0/4K, Ultra can request LOD0/4K at the portrait distance, transitions have hysteresis, and every selection has a lower-detail fallback.

- [ ] Add an E2E assertion that `window.__turtlebackDebug.probe().sections.turtle` reports a non-fallback `turtle.hero.*` model after scene readiness on all four explicit quality levels.

- [ ] Run both tests; expected result is failure because the helper and resource probe do not exist.

- [ ] Implement and export:

```ts
export interface TurtleHeroProps {
  forceLod?: TurtleLod
}

export function selectTurtleLod(
  cameraDistance: number,
  quality: QualityProfile,
  previous?: TurtleLod,
): TurtleLod

export function TurtleHero(props: TurtleHeroProps): JSX.Element
```

- [ ] Clone skinned scenes safely, use one `AnimationMixer` per mounted LOD, drive all clips from `buildTurtleAnimationPlan()`, and dispose mixer actions, cloned materials, and registry leases on unmount or quality replacement.

- [ ] Apply wetness, emissive seams, subsurface color variation, scars, algae, barnacles, and mineral masks through named material capabilities rather than node-name heuristics.

- [ ] Make `Turtle()` render the registered `TurtleHero` and use `ProceduralTurtleFallback` only when the registry exhausts the authored LOD chain. Keep the existing `TurtleWorld.tsx` import stable.

- [ ] Run `pnpm exec vitest run tests/turtleLod.test.ts tests/turtleFallback.test.ts`, `pnpm typecheck`, and `pnpm exec playwright test e2e/worldResources.spec.ts`; expected result is unit success and the loaded hero ID visible in E2E diagnostics.

- [ ] Commit the authored hero cutover:

```bash
git add src/game/world/turtle/TurtleHero.tsx src/game/world/turtle/materials.ts src/game/world/turtle/Turtle.tsx src/game/world/TurtleWorld.tsx tests/turtleLod.test.ts e2e/worldResources.spec.ts
git commit -m "feat: render authored turtle hero"
```

## Task 7: Prove shell alignment while preserving analytic physics

**Files:**

- Create: `src/game/world/turtle/ShellTransitionBand.tsx`
- Create: `src/game/world/turtle/shellAlignment.ts`
- Modify: `src/game/world/shell/ShellTerrain.tsx`
- Modify: `src/game/world/shell/BiolumSeams.tsx`
- Test: `tests/turtleShellAlignment.test.ts`

- [ ] Write tests that sample at least 64 shell-rim anchors and assert the authored `shellAnchor` is within 0.75 m of `SHELL_SEMI_X`, `SHELL_SEMI_Z`, and `WORLD.rimHeight`; assert no body-collision triangle intersects the walkable shell ellipse at or above `terrainHeight(x, z)` while allowing head/neck collision outside that ellipse; assert `terrainHeight()` output at existing building pads is unchanged.

- [ ] Record a deterministic golden table for `terrainHeight()` at `HOME_SPAWN`, all deck centres, the plaza, and every traversal endpoint before changing rendering.

- [ ] Run `pnpm exec vitest run tests/turtleShellAlignment.test.ts`; expected result is failure for missing alignment helpers.

- [ ] Implement `sampleShellTransitionAnchors(count)` as pure data derived from `terrainHeight()` and the turtle inspection contract.

- [ ] Render geology, roots, shell plate transitions, algae, and restrained emissive seams in `ShellTransitionBand.tsx`; do not add a second walkable mesh or collider.

- [ ] Keep `ShellTerrain`'s `TrimeshCollider args={[vertices, indices]}` sourced from its existing analytic grid. Add a development assertion that no authored mesh is marked as traversal collision.

- [ ] Run `pnpm exec vitest run tests/turtleShellAlignment.test.ts tests/traversal.test.ts tests/safePosition.test.ts`; expected result is exact golden-height preservation and all traversal tests passing.

- [ ] Commit the visual/physics seam:

```bash
git add src/game/world/turtle/ShellTransitionBand.tsx src/game/world/turtle/shellAlignment.ts src/game/world/shell/ShellTerrain.tsx src/game/world/shell/BiolumSeams.tsx tests/turtleShellAlignment.test.ts
git commit -m "feat: blend hero turtle into analytic shell"
```

## Task 8: Drive wake, spray, foliage, props, and turtle audio from one signal

**Files:**

- Create: `src/game/world/ocean/TurtleWake.tsx`
- Create: `src/game/world/ocean/FlipperSpray.tsx`
- Create: `src/game/audio/ambience/TurtleAudioEngine.ts`
- Modify: `src/game/world/ocean/Ocean.tsx`
- Modify: `src/game/audio/AudioManager.ts`
- Modify: `src/game/core/events.ts`
- Modify: `src/game/world/turtle/TurtleHero.tsx`
- Test: `tests/turtleResponse.test.ts`
- Test: `tests/turtleAudio.test.ts`

- [ ] Write pure response tests that feed a normalized front-stroke envelope and assert wake, spray, resonance, and foliage impulse peak in the same phase, remain zero before the stroke, decay to zero, and obey Reduced Motion caps.

- [ ] Write AudioContext-double tests proving turtle audio connects only to the ambient bus, uses the registered fallback chain, limits simultaneous voices, and disposes every source/gain/panner on shutdown.

- [ ] Add event tests proving `TurtleHero` emits exactly one stable `turtleSound` event at each qualified breath/stroke/wake threshold, never derives audio by polling a bone transform, and does not duplicate an event across adjacent render frames.

- [ ] Run both tests; expected result is failure for missing response and audio APIs.

- [ ] Implement `sampleTurtleResponse(strokePhase, event, reducedMotion)` as the only mapping from animation state to presentation intensity.

- [ ] Feed `runtime.turtle.wakeStrength` into a broad water-displacement/wake field and named wake emitters into localized foam. Keep the existing ocean travel illusion and near-shell calming behavior.

- [ ] Pool spray particles and disable their allocation on Low. Reduced Motion must retain wake shape while limiting spray and rapid secondary particles.

- [ ] Add `TurtleAudioEngine` to `AudioManager`, connecting it to the ambient bus and driving breath, resonance, stroke, and wake sounds from the typed `turtleSound` event. The engine owns registry selection, pooled playback, fallback, and disposal; later soundtrack work may adapt its asset catalog but may not create a second turtle renderer.

- [ ] Expose the shared response to cell vegetation and hanging village props through `runtime.turtle.foliageImpulse`; consumers apply it only inside bounded radii.

- [ ] Run `pnpm exec vitest run tests/turtleResponse.test.ts tests/turtleAudio.test.ts tests/audioBus.test.ts` and `pnpm typecheck`; expected result is all tests passing.

- [ ] Commit synchronized scale effects:

```bash
git add src/game/world/ocean/TurtleWake.tsx src/game/world/ocean/FlipperSpray.tsx src/game/world/ocean/Ocean.tsx src/game/audio/ambience/TurtleAudioEngine.ts src/game/audio/AudioManager.ts src/game/core/events.ts src/game/world/turtle/TurtleHero.tsx tests/turtleResponse.test.ts tests/turtleAudio.test.ts
git commit -m "feat: synchronize turtle wake motion and sound"
```

## Task 9: Assemble the complete Crownwood-to-Galecrest corridor

**Files:**

- Modify: `src/game/world/biomes/verticalSlice.ts`
- Modify: `src/game/world/biomes/registry.ts`
- Modify: `src/game/config/layout.ts`
- Modify: `src/game/config/benchmarks.ts`
- Modify: `src/game/world/wildlife/registry.ts`
- Test: `tests/turtleHeroSliceIntegration.test.ts`
- Test: `tests/traversal.test.ts`

- [ ] Execute Tasks 1-12 of the biome/world plan plus Tasks 1-7 of the wildlife plan before this assembly task. Biome Task 7 publishes the live runtime weights used by the soundtrack/ambience pilot, and Wildlife Task 7 includes the synchronized hero-bird call checkpoint. Those companion tasks own first creation of the corridor, authored bird renderers, pooling, context, and call engine; do not duplicate their implementations here or jump ahead to full-roster Wildlife Tasks 8-10.

- [ ] Write `turtleHeroSliceIntegration.test.ts` asserting the registered corridor bounds, Crownwood/Galecrest coverage, continuous transition weights, clear primary route, three navigation silhouettes per biome, all five forest layers on High, `crownwood-songbird` and `galecrest-seabird` representation on Low, owned call IDs, turtle vista membership, and no placements in route/door/spawn/vista exclusions.

- [ ] Run `pnpm exec vitest run tests/turtleHeroSliceIntegration.test.ts`; expected result is failure until turtle, biome, wildlife, and call ownership are linked by the slice definition.

- [ ] Export a concrete immutable definition:

```ts
export const TURTLE_VERTICAL_SLICE = {
  id: 'crownwood-bow-vista',
  bounds: { minX: -50, maxX: 50, minZ: -225, maxZ: -100 },
  requiredBiomes: ['crownwood', 'galecrest'],
  requiredWildlife: ['crownwood-songbird', 'galecrest-seabird'],
  routeIds: ['bow-overlook-spine', 'home-bow-shortcut', 'bow-deck-gangway'],
  benchmarkIds: [
    'crownwood-bow-corridor',
    'turtle-vista-bow',
    'turtle-vista-arrival',
    'turtle-vista-east',
    'turtle-vista-west',
    'flipper-scale',
    'turtle-material-close',
  ],
} as const

export const TURTLE_NORMAL_VISTA_IDS = [
  'turtle-vista-arrival',
  'turtle-vista-bow',
  'turtle-vista-east',
  'turtle-vista-west',
] as const
```

- [ ] Register all four normal-play vistas as teleport benchmarks on reachable shell terrain: arrival near `(0, -202)`, bow near `(0, -238)`, east edge near `(166, 58)`, and west edge near `(-166, -24)`. Keep `flipper-scale` and `turtle-material-close` as separate art-review cameras; they do not count toward the four traversal-vista acceptance criterion.

- [ ] Extend `turtleHeroSliceIntegration.test.ts` to assert each normal vista is inside reachable traversal bounds, has an unobstructed hero sightline, resolves a non-fallback turtle LOD on every quality tier, and remains a teleport/player camera rather than an exterior fixed portrait.

- [ ] Preserve existing route coordinates unless a failing composition review requires a change. If a route changes, update `PATH_SPECS`, map rendering, terrain splat, traversal endpoints, lamp placement, vegetation exclusions, and traversal tests in the same commit.

- [ ] Compose canopy, mid-story, understory, ground cover, deadfall, edge rock, shell transition props, one foreground story, middle-distance framing, and a clear head/neck horizon reveal.

- [ ] Add habitat-backed songbird and seabird groups whose calls originate from their visible agent/group IDs.

- [ ] Run `pnpm exec vitest run tests/turtleHeroSliceIntegration.test.ts tests/turtleVerticalSlice.test.ts tests/biomeCompositor.test.ts tests/traversal.test.ts tests/wildlifeQuality.test.ts tests/ambienceWildlifeOwnership.test.ts`; expected result is full pass on all four quality budgets.

- [ ] Commit the playable vertical slice content:

```bash
git add src/game/world/biomes/verticalSlice.ts src/game/world/biomes/registry.ts src/game/config/layout.ts src/game/config/benchmarks.ts src/game/world/wildlife/registry.ts tests/turtleHeroSliceIntegration.test.ts tests/traversal.test.ts
git commit -m "feat: compose turtle hero bow corridor"
```

## Task 10: Add deterministic probes, capture matrix, and final gates

**Files:**

- Modify: `src/game/debug/probes.ts`
- Modify: `src/game/world/WorldSystems.tsx`
- Modify: `visual/graphics.capture.ts`
- Modify: `playwright.visual.config.ts`
- Modify: `e2e/worldResources.spec.ts`
- Modify: `docs/performance-baseline.md`
- Modify: `MANUAL_QA.md`

- [ ] Declaration-merge the Phase A `TurtleProbeSection` with typed turtle asset IDs, texture tier, current LOD, visibility, fallback status, active clip weights, turtle event, and wake/spray counts. Register it through `registerProbeSection('turtle', 'hero', contributor)` so the data appears only at `window.__turtlebackDebug.probe().sections.turtle`; keep shared renderer/cell/asset metrics in their existing top-level/world fields. Unregister on world teardown.

- [ ] Add E2E checks that switch Low, Medium, High, and Ultra and wait for real model/texture/instance changes through `probe()`. Call the dev-only `window.__turtlebackDebug.failAsset(id)` for LOD0, its lower LOD, one KTX2 texture, and one turtle audio asset; assert traversal remains grounded and each registered fallback preserves play.

- [ ] Expand visual capture conditions for `turtle-vista-arrival`, `turtle-vista-bow`, `turtle-vista-east`, and `turtle-vista-west`, plus the separate flipper/material review cameras: High noon clear, High noon rain, High sunset, High night, Medium noon/night, Low noon smoke and corridor traversal, and Ultra hero close-ups.

- [ ] Add E2E traversal-vista assertions for all four normal-play IDs: move the player through the public benchmark seam, wait for `probe().sections.turtle` to report a visible non-fallback hero and expected LOD/texture tier, verify the player remains grounded on the analytic shell, and save a named capture for human scale/composition signoff.

- [ ] Run `pnpm exec playwright test e2e/worldResources.spec.ts`; expected result is every quality/resource/fallback assertion passing without console errors.

- [ ] Run `pnpm capture:graphics`; expected result is the complete turtle/corridor matrix under `test-results/graphics-captures/` with no procedural fallback visible.

- [ ] Manually inspect silhouette stability, eye/head proportions, stretched UVs, skin response, shell seam, waterline, spray comfort, calls from visible animals, foreground/midground/horizon composition, and Low navigation clarity. Record the reviewed hardware and capture names in `MANUAL_QA.md`.

- [ ] Run a fixed Crownwood traversal and turtle/flipper event benchmark after shader warm-up. Record p50/p95/p99, draw calls, triangles, visible instances, texture estimate, and process memory in `docs/performance-baseline.md`. High must reach p95 at or below 16.7 ms on the dedicated reference path; Low must reach p95 at or below 33.3 ms on the integrated reference path.

- [ ] Run the complete automated gate:

```bash
pnpm validate:assets
pnpm validate:assets:turtle
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm capture:graphics
pnpm desktop:package:mac
pnpm desktop:smoke
```

Expected result: every command exits zero, production build contains every registered hero asset, packaged Electron loads the same asset IDs, existing interactions/save/recovery remain green, and no unresolved turtle/corridor collision or performance regression remains.

- [ ] Commit the verified vertical-slice closeout:

```bash
git add src/game/debug/probes.ts src/game/world/WorldSystems.tsx visual/graphics.capture.ts playwright.visual.config.ts e2e/worldResources.spec.ts docs/performance-baseline.md MANUAL_QA.md
git commit -m "test: verify turtle hero vertical slice"
```
