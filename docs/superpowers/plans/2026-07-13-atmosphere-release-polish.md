# Atmosphere and Release Polish Implementation Plan

**Status:** Superseded on 2026-07-14. Do not execute; use `2026-07-14-stylized-sanctuary-reset.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase F of the approved graphics overhaul: continuously blended time/weather grading, cached sky-derived image-based lighting, restrained contact grounding, height-aware fog and local mist, finished rain and wet response, turtle-scale water effects, interior/wildlife rendering polish, final quality tuning, memory stabilization, asset-license closeout, benchmark evidence, and packaged release verification.

**Architecture:** Derive one immutable atmosphere snapshot from time, rain, and resolved quality, then let lighting, postprocessing, mist, materials, water, wildlife, and diagnostics consume that shared state. Keep expensive GPU features behind Phase A quality budgets, cache and explicitly dispose environment/effect resources, and drive only discrete React topology changes while continuous values remain in `runtime` and `useFrame`. Treat Phase B-E systems as typed dependencies rather than reaching into mesh names or unrelated stores.

**Tech Stack:** TypeScript 5.9, React 19, React Three Fiber 9, Three.js 0.182, `@react-three/postprocessing`/postprocessing, Rapier, Zustand, Zod, Vitest, Playwright, Electron, the Phase A asset manager/spatial cells/probe system, and existing desktop verification scripts.

---

This plan implements Phase F of `docs/superpowers/specs/2026-07-13-sanctuary-graphics-audio-overhaul-design.md`, with Tasks 1-3 intentionally staged early as the Phase B corridor atmosphere pilot.

## Preconditions and completion rules

Phase A is the only precondition for Tasks 1-3. Those tasks form the approved atmosphere corridor pilot: establish grading, height fog, cached IBL, and contact grounding early enough for Phase B turtle material/scale review without waiting for all world content.

Before Task 4 begins, all of these contracts must be present and green:

- Phase A: `QualityProfile`, `AssetManager`, `SpatialCellTracker`, `SceneProbeSnapshot`, benchmark scenarios, GLB/KTX2 loading, and explicit resource disposal;
- Phase B: Turtle Hero exposes stable animation and wake-emitter state without requiring bone-name inspection;
- Phase C: biomes expose stable IDs, blend weights, moisture/exposure fields, mist anchors, and waterfall/runoff anchors;
- Phase D: wildlife exposes visible/represented counts, LOD groups, habitat ownership, and quality budgets;
- Phase E: music diagnostics expose the current source through `sections.audio` in scene probes.

This split is a hard sequencing gate: Tasks 1-3 may proceed after Phase A; Tasks 4-9 may not proceed until Phases B-E are complete. Phase B may consume the corridor pilot, so it must not depend on the rest of Phase F.

Phase F is complete only when:

- dawn, day, sunset, blue hour, night, and rain grade/fog families blend without pops;
- coherent image-based lighting reaches metal, glass, skin, foliage, and wet surfaces on enabled tiers;
- contact AO is restrained, quality gated, and artifact-reviewed;
- rain, mist, runoff, puddles, protected interiors, and wet materials share one weather state;
- ocean wake, flipper foam, shell-rim interaction, spray, and reflections scale by quality and Reduced Motion;
- all authored resources, postprocessing passes, wetness registrations, cells, wildlife pools, and audio nodes reach a stable disposal/memory plateau;
- High and Low meet their p95 targets on hardware fingerprinted in the `high-dedicated` and `low-integrated` reference slots;
- the approved visual matrix and 30-minute traversal soak complete;
- asset licenses and attributions reproduce from the registry;
- browser and packaged Electron gates pass.

## Task 1: Create the shared atmosphere and color-grade model

**Files:**

- Create: `src/game/rendering/atmosphere/types.ts`
- Create: `src/game/rendering/atmosphere/atmosphereModel.ts`
- Create: `src/game/rendering/grading/gradePalette.ts`
- Create: `tests/atmosphereModel.test.ts`
- Create: `tests/gradePalette.test.ts`
- Modify: `src/game/core/runtime.ts`
- Modify: `src/game/core/FrameDriver.tsx`
- Modify: `src/game/world/sky/palette.ts`

- [ ] Write `tests/atmosphereModel.test.ts` for exact family anchors, midnight wrap, continuous transitions, rain override blending, finite/clamped values, and monotonic rain density.

```ts
import { describe, expect, it } from 'vitest'
import { sampleAtmosphere } from '@/game/rendering/atmosphere/atmosphereModel'

describe('atmosphere model', () => {
  it('wraps continuously around midnight', () => {
    const before = sampleAtmosphere({ time: 0.9999, rain: 0, quality: 'high' })
    const after = sampleAtmosphere({ time: 0.0001, rain: 0, quality: 'high' })
    expect(Math.abs(before.fogDensity - after.fogDensity)).toBeLessThan(0.0001)
    expect(colorDistance(before.fogColor, after.fogColor)).toBeLessThan(0.01)
  })

  it('increases fog and mist continuously with rain', () => {
    const dry = sampleAtmosphere({ time: 0.5, rain: 0, quality: 'high' })
    const wet = sampleAtmosphere({ time: 0.5, rain: 1, quality: 'high' })
    expect(wet.fogDensity).toBeGreaterThan(dry.fogDensity)
    expect(wet.mistStrength).toBeGreaterThan(dry.mistStrength)
  })
})
```

- [ ] Write `tests/gradePalette.test.ts` for anchor values, wraparound interpolation, rain blending, and bounded exposure/contrast/saturation/lift/gain.

- [ ] Run `pnpm exec vitest run tests/atmosphereModel.test.ts tests/gradePalette.test.ts`.

Expected: FAIL because the atmosphere and grade modules do not exist.

- [ ] Create shared types.

```ts
export type AtmosphereFamily = 'dawn' | 'day' | 'sunset' | 'blue-hour' | 'night' | 'rain'

export interface AtmosphereState {
  primaryFamily: AtmosphereFamily
  secondaryFamily: AtmosphereFamily
  familyMix: number
  fogColor: [number, number, number]
  fogDensity: number
  fogBaseHeight: number
  fogHeightFalloff: number
  mistStrength: number
  rainShaftStrength: number
  lightRayStrength: number
  environmentIntensity: number
}

export interface ColorGrade {
  exposure: number
  contrast: number
  saturation: number
  lift: [number, number, number]
  gain: [number, number, number]
}
```

- [ ] Implement pure samplers.

```ts
export function sampleAtmosphere(input: {
  time: number
  rain: number
  quality: QualityLevel
}): AtmosphereState

export function sampleColorGrade(input: { time: number; rain: number }): ColorGrade
```

- [ ] Define anchor data for dawn, day, sunset, blue hour, and night in linear color space. Blend rain as an overlay on the current time family rather than snapping to a separate state.

- [ ] Add `runtime.atmosphere: AtmosphereState` and assign it once per frame in `FrameDriver` after time/weather and resolved quality update.

- [ ] Keep `src/game/world/sky/palette.ts` as the source for sky/sun anchor colors, but remove duplicated fog decisions from render components. The shared atmosphere model owns fog density, fog color, and effect strengths.

- [ ] Run the focused tests.

Expected: PASS with continuous midnight and rain transitions.

- [ ] Run `pnpm typecheck`.

Expected: PASS; all atmosphere consumers can import one stable type.

- [ ] Commit the pure atmosphere-model slice.

```sh
git add src/game/rendering/atmosphere src/game/rendering/grading/gradePalette.ts src/game/core/runtime.ts src/game/core/FrameDriver.tsx src/game/world/sky/palette.ts tests/atmosphereModel.test.ts tests/gradePalette.test.ts
git commit -m "feat: model shared atmosphere state"
```

## Task 2: Add continuous grading and height-aware fog postprocessing

**Files:**

- Create: `src/game/rendering/grading/SanctuaryGradeEffect.ts`
- Create: `src/game/rendering/atmosphere/HeightFogEffect.ts`
- Create: `src/game/rendering/postProcessingConfig.ts`
- Create: `src/game/rendering/SanctuaryPostProcessing.tsx`
- Create: `tests/postProcessingConfig.test.ts`
- Modify: `src/game/GameCanvas.tsx`
- Modify: `src/game/world/sky/TimeLighting.tsx`
- Modify: `src/game/core/quality.ts`
- Modify: `src/game/debug/probes.ts`
- Modify: `e2e/app.spec.ts`

- [ ] Write `tests/postProcessingConfig.test.ts` against a pure configuration resolver. Cover Low/Medium/High/Ultra, user bloom off, rain, indoor state, and no duplicate tone mapper.

```ts
it('enables only budgeted passes on Low', () => {
  expect(
    resolvePostProcessingConfig({
      profile: QUALITY_PROFILES.low,
      bloomEnabled: true,
      indoors: false,
    }),
  ).toEqual({
    grading: true,
    heightFog: false,
    bloom: false,
    contactAo: false,
  })
})
```

- [ ] Run `pnpm exec vitest run tests/postProcessingConfig.test.ts`.

Expected: FAIL because postprocessing configuration is still private and bloom-only in `GameCanvas.tsx`.

- [ ] Create `src/game/rendering/postProcessingConfig.ts` with this pure public contract and implement every boolean solely from resolved quality, user bloom, and shelter state.

```ts
export interface PostProcessingConfig {
  grading: true
  heightFog: boolean
  bloom: boolean
  contactAo: boolean
}

export function resolvePostProcessingConfig(input: {
  profile: QualityProfile
  bloomEnabled: boolean
  indoors: boolean
}): PostProcessingConfig
```

- [ ] Implement `SanctuaryGradeEffect` as one `postprocessing.Effect` with uniforms for exposure, contrast, saturation, lift, and gain. Expose one mutation method and allocate no objects in `update()`.

```ts
export class SanctuaryGradeEffect extends Effect {
  constructor()
  setGrade(grade: ColorGrade): void
}
```

- [ ] Implement `HeightFogEffect` with depth reconstruction and `EffectAttribute.DEPTH`. Fog must use camera/world height, distance, base height, falloff, and linear fog color; it must not recolor sky pixels without scene depth.

```ts
export class HeightFogEffect extends Effect {
  constructor()
  setAtmosphere(state: AtmosphereState): void
  setCamera(camera: Camera): void
}
```

- [ ] Extract `SanctuaryPostProcessing` from `GameCanvas.tsx`. Mount one `EffectComposer`; order contact AO, height fog, bloom, and final grading so bloom does not flatten fog and grading is the final artistic transform. Keep ACES renderer tone mapping singular.

- [ ] Retain `FogExp2` in `TimeLighting` as the Low fallback and distant-object fog input. On High/Ultra, reduce its density so height fog adds depth without double-opacity.

- [ ] Declaration-merge `AtmosphereProbeSection` with `family`, `familyMix`, `grade`, `heightFogActive`, `bloomActive`, and `contactAoActive`. Register the postprocessing contribution as `registerProbeSection('atmosphere', 'postprocessing', contributor)`, add stable material/effect names, and extend `e2e/app.spec.ts` to probe live grade and height-fog values across time and rain changes.

- [ ] Run `pnpm exec vitest run tests/postProcessingConfig.test.ts tests/atmosphereModel.test.ts tests/gradePalette.test.ts`.

Expected: PASS.

- [ ] Run `pnpm test:e2e -- e2e/app.spec.ts`.

Expected: PASS; live grade/fog uniforms change and Low omits the height-fog pass.

- [ ] Capture High noon, sunset, night, and rain at `arrival-bridge`, `forest-interior`, `home-interior`, and `turtle-material-close`.

Expected: no fog edge around the sky, no broad white bloom, no clipped emissive surfaces, and no grade pop at family boundaries.

- [ ] Commit the grading/fog slice.

```sh
git add src/game/rendering src/game/GameCanvas.tsx src/game/world/sky/TimeLighting.tsx src/game/core/quality.ts src/game/debug/probes.ts tests/postProcessingConfig.test.ts e2e/app.spec.ts
git commit -m "feat: add atmosphere postprocessing"
```

## Task 3: Add cached sky-derived image-based lighting and contact AO

**Files:**

- Create: `src/game/rendering/ibl/environmentFamily.ts`
- Create: `src/game/rendering/ibl/EnvironmentMapCache.ts`
- Create: `src/game/rendering/ibl/EnvironmentLighting.tsx`
- Create: `tests/environmentFamily.test.ts`
- Create: `tests/environmentMapCache.test.ts`
- Modify: `src/game/world/TurtleWorld.tsx`
- Modify: `src/game/rendering/SanctuaryPostProcessing.tsx`
- Modify: `src/game/core/quality.ts`
- Modify: `src/game/debug/probes.ts`
- Modify: `src/main.tsx`
- Modify: `e2e/app.spec.ts`

- [ ] Write `tests/environmentFamily.test.ts` for dawn/day/sunset/blue-hour/night anchors, rain precedence, transition hysteresis, and deterministic cache keys by family/resolution.

```ts
it('does not churn environment family near a boundary', () => {
  const selector = new EnvironmentFamilySelector({ hysteresis: 0.1 })
  expect(selector.update(atmosphereFixture('day', 'sunset', 0.45))).toBe('day')
  expect(selector.update(atmosphereFixture('day', 'sunset', 0.52))).toBeNull()
  expect(selector.update(atmosphereFixture('day', 'sunset', 0.61))).toBe('sunset')
})
```

- [ ] Write `tests/environmentMapCache.test.ts` with an injected PMREM factory. Cover request de-duplication, LRU eviction, family/resolution keys, reference counts, delayed disposal, context restoration, and idempotent full disposal.

- [ ] Run `pnpm exec vitest run tests/environmentFamily.test.ts tests/environmentMapCache.test.ts`.

Expected: FAIL because the IBL modules do not exist.

- [ ] Implement environment selection.

```ts
export interface EnvironmentSelection {
  primary: AtmosphereFamily
  secondary: AtmosphereFamily
  mix: number
}

export function selectEnvironmentFamily(state: AtmosphereState): EnvironmentSelection

export class EnvironmentFamilySelector {
  constructor(options: { hysteresis: number })
  update(state: AtmosphereState): AtmosphereFamily | null
  current(): AtmosphereFamily | null
}
```

`selectEnvironmentFamily()` may read only the shared state's primary/secondary families and mix. It must not derive independent thresholds from raw clock or rain values.

- [ ] Implement `EnvironmentMapCache` around `PMREMGenerator.fromScene(scene, 0, 0.1, 100, { size: resolution })`. Render a small offscreen sky scene using the corrected linear palette; generate at most one map per idle frame; retain only the current family plus adjacent family; recreate on WebGL context restoration.

```ts
export interface EnvironmentMapResource {
  texture: Texture
  estimatedBytes: number
  dispose(): void
}

export interface EnvironmentMapLease {
  key: string
  texture: Texture
  release(): void
}

export type EnvironmentMapFactory = (input: {
  renderer: WebGLRenderer
  family: AtmosphereFamily
  resolution: 64 | 128 | 256
}) => Promise<EnvironmentMapResource>

export class EnvironmentMapCache {
  constructor(input: {
    renderer: WebGLRenderer
    factory?: EnvironmentMapFactory
    maxEntries?: number
  })
  acquire(family: AtmosphereFamily, resolution: 64 | 128 | 256): Promise<EnvironmentMapLease>
  diagnostics(): { keys: readonly string[]; estimatedBytes: number }
  restore(renderer: WebGLRenderer): void
  dispose(): void
}
```

- [ ] Create `EnvironmentLighting.tsx`. Low uses no PMREM; Medium uses 64; High uses 128; Ultra uses 256. Apply the selected texture to `scene.environment` and drive `scene.environmentIntensity` from `runtime.atmosphere`.

- [ ] Use hysteretic environment-family switches. Blend indirect-light intensity, hemisphere color, fog, and grade continuously around the switch; do not add an unmeasured dual-PMREM shader patch.

- [ ] Add the existing `SSAO` effect from `@react-three/postprocessing` only when `profile.ssaoAllowed`, and enable the composer's NormalPass only on those tiers. Start with 17 samples, 5 rings, 0.8 luminance influence, 0.6 intensity, and conservative world-distance/world-proximity falloff; the installed `postprocessing` contract requires prime rings and a sample count that is not a multiple of the ring count. Approve parameter changes only through benchmark capture and frame-time review. Use `SSAOEffect` rather than `N8AO`: the installed N8AO wrapper does not provide a complete disposal path for its internal render targets, which conflicts with the soak gate.

- [ ] Declaration-merge environment family, PMREM key/resolution, cache keys/bytes, and SSAO activity into `AtmosphereProbeSection`; register them with contributor ID `ibl`. Release the current `EnvironmentMapLease` on family/tier change, dispose the cache during coordinated shutdown, and recreate it during context recovery.

- [ ] Extend `e2e/app.spec.ts` to read `probe().sections.atmosphere`: High/Ultra must report a PMREM key and active contact AO, Low must report neither, and 20 alternating day/rain family changes must settle with cache keys at or below the configured three-entry bound.

- [ ] Run the focused IBL tests.

Expected: PASS with explicit disposal and hysteresis.

- [ ] Run `pnpm test:e2e -- e2e/app.spec.ts`.

Expected: High/Ultra report an environment texture and contact-AO pass; Low reports neither; time/rain switching settles without cache growth.

- [ ] Capture metal, glass, wet path, foliage, and turtle-skin benchmark views at day, rain, sunset, and night.

Expected: coherent reflected sky color, restrained crevice grounding, no AO halos through fog, and no metallic blackouts.

- [ ] Run both exact accepted commands: `pnpm benchmark:graphics -- --scenario=turtle-material-close-high-noon-clear --variant=default` and `pnpm benchmark:graphics -- --scenario=turtle-material-close-high-noon-clear --variant=no-ao`. The second command is diagnostic comparison evidence only; release evidence uses `default`.

Expected: the measured AO cost is recorded; keep AO enabled only if High remains within its scenario budget.

- [ ] Commit the IBL/contact slice.

```sh
git add src/game/rendering/ibl src/game/rendering/SanctuaryPostProcessing.tsx src/game/world/TurtleWorld.tsx src/game/core/quality.ts src/game/debug/probes.ts src/main.tsx tests/environmentFamily.test.ts tests/environmentMapCache.test.ts e2e/app.spec.ts
git commit -m "feat: add cached environment lighting"
```

## Task 4: Add biome-aware mist, rain shafts, and light-ray cards

**Files:**

- Create: `src/game/weather/MistBanks.tsx`
- Create: `src/game/weather/RainShafts.tsx`
- Create: `src/game/weather/LightRayCards.tsx`
- Create: `tests/mistPlacement.test.ts`
- Modify: `src/game/weather/AtmosphereDetails.tsx`
- Modify: `src/game/weather/atmosphereLayout.ts`
- Modify: `src/game/weather/Rain.tsx`
- Modify: `src/game/world/TurtleWorld.tsx`
- Modify: `src/game/core/quality.ts`
- Modify: `src/game/debug/probes.ts`
- Modify: `tests/atmosphereLayout.test.ts`
- Modify: `e2e/app.spec.ts`

- [ ] Write `tests/mistPlacement.test.ts` against Phase C biome fields. Cover deterministic seed behavior, moisture preference, Crownwood/Lumenfen eligibility, Galecrest wind rejection, path/door/spawn exclusions, active-cell filtering, and Low retaining representative mist.

```ts
it('never places a mist bank in a protected traversal clearance', () => {
  const banks = buildMistBankLayout({
    seed: 20260712,
    cells: fixtureCells,
    biomeField: fixtureBiomeField,
    quality: QUALITY_PROFILES.high,
  })
  expect(banks.every((bank) => !isProtectedClearance(bank.position[0], bank.position[2]))).toBe(
    true,
  )
})
```

- [ ] Extend `tests/atmosphereLayout.test.ts` for quality counts and stable cell ownership.

- [ ] Run `pnpm exec vitest run tests/mistPlacement.test.ts tests/atmosphereLayout.test.ts`.

Expected: FAIL because current rim mist is a fixed global ring unrelated to biomes or cells.

- [ ] Add pure layout APIs to `atmosphereLayout.ts`.

```ts
export interface MistBankAnchor {
  id: string
  cellId: CellKey
  position: [number, number, number]
  scale: [number, number]
  rotation: number
  density: number
  moisture: number
}

export function buildMistBankLayout(input: {
  seed: number
  cells: readonly CellKey[]
  biomeField: BiomeField
  quality: QualityProfile
}): readonly MistBankAnchor[]
```

- [ ] Import `CellKey` and the current/retained snapshot from `src/game/world/spatial`; replace the fixed `RimMist` implementation with `MistBanks` owned by retained spatial cells. `SpatialCellTracker` remains the sole residency authority—this task must not add another cell tracker or cell-budget API. Use depth-softened cards/noise, correct linear output, and the comfort clock. Low uses a small deterministic subset; High/Ultra add local layers without making paths opaque.

- [ ] Implement `RainShafts` as camera-relative, depth-faded, wind-angled cards active outdoors during rain. Reuse the rain shelter interpolation so shafts fade under roofs.

- [ ] Implement `LightRayCards` at authored canopy/opening anchors from Phase C. Gate by sun direction, rain, fog, interior state, quality, and Reduced Motion. Rays remain subordinate to correct exposure and do not add dynamic lights.

- [ ] Refactor `AtmosphereDetails.tsx` into an orchestrator for mist banks, roof drips, puddles, rain shafts, and light rays. Keep each child independently quality gated.

- [ ] Declaration-merge mist-bank, shaft, ray, roof-drip, and puddle counts into `AtmosphereProbeSection`; register them through `registerProbeSection('atmosphere', 'weather-layers', contributor)` and unregister on world teardown.

- [ ] Run the focused layout tests.

Expected: PASS with deterministic placement and traversal exclusions.

- [ ] Run `pnpm test:e2e -- e2e/app.spec.ts`.

Expected: quality and weather changes update real instance counts; indoor shelter removes player-centred shafts without hiding exterior rain through windows.

- [ ] Capture Crownwood, Lumenfen, Galecrest, a biome threshold, and two interiors at clear/rain/day/night.

Expected: atmospheric depth supports silhouettes, paths remain readable, cards do not reveal hard rectangular edges, and Reduced Motion remains calm.

- [ ] Commit the atmospheric-layer slice.

```sh
git add src/game/weather src/game/world/TurtleWorld.tsx src/game/core/quality.ts src/game/debug/probes.ts tests/mistPlacement.test.ts tests/atmosphereLayout.test.ts e2e/app.spec.ts
git commit -m "feat: layer biome weather atmosphere"
```

## Task 5: Finish shared wet-material behavior, runoff, puddles, and protected interiors

**Files:**

- Create: `src/game/rendering/materials/materialFamilies.ts`
- Create: `src/game/rendering/materials/MaterialWeatherController.ts`
- Create: `tests/materialFamilies.test.ts`
- Create: `tests/materialWeatherController.test.ts`
- Modify: `src/game/weather/simpleWet.ts`
- Modify: `src/game/weather/wetMaterials.ts`
- Modify: `src/game/world/shell/ShellTerrain.tsx`
- Modify: `src/game/village/kit/materials.ts`
- Modify: `src/game/village/Building.tsx`
- Modify: `src/game/weather/AtmosphereDetails.tsx`
- Modify: `src/game/world/turtle/materials.ts`
- Modify: `src/game/core/FrameDriver.tsx`
- Modify: `src/game/world/WorldSystems.tsx`
- Modify: `src/game/debug/probes.ts`
- Modify: `tests/wetness.test.ts`
- Modify: `e2e/app.spec.ts`

- [ ] Write `tests/materialFamilies.test.ts` to require policies for shell, skin, soil, stone, wood, plaster, concrete, metal, glass, fabric, bark, leaves, and water. Assert metre-based texel density, bounded dry/wet roughness, valid texture roles, and no interior runoff capability.

- [ ] Write `tests/materialWeatherController.test.ts` for standard/shader registration, duplicate registration, idempotent unregister, full `{ wetness, rain, time }` application, dry-state restoration, disposed materials, deterministic diagnostics, and idempotent controller disposal.

- [ ] Extend `tests/wetness.test.ts` with unregister, repeated registration, clamped inputs, dry-state restoration, and disposed-material cases.

```ts
it('stops mutating a material after unregister', () => {
  const material = new MeshStandardMaterial({ color: '#8090a0', roughness: 0.8 })
  const unregister = registerWetMaterial(material, STONE_WET_POLICY)
  unregister()
  applyMaterialWeather({ wetness: 1, rain: 1, time: 0.5 })
  expect(material.roughness).toBe(0.8)
})
```

- [ ] Run `pnpm exec vitest run tests/materialFamilies.test.ts tests/materialWeatherController.test.ts tests/wetness.test.ts`.

Expected: FAIL because the global registries return no unregister handle and material families are incomplete.

- [ ] Define the material contracts.

```ts
export type MaterialFamily =
  | 'shell'
  | 'skin'
  | 'soil'
  | 'stone'
  | 'wood'
  | 'plaster'
  | 'concrete'
  | 'metal'
  | 'glass'
  | 'fabric'
  | 'bark'
  | 'leaves'
  | 'water'

export interface WetMaterialPolicy {
  darken: number
  dryRoughness: number
  wetRoughness: number
  runoffStrength: number
  puddleEligible: boolean
}

export interface MaterialFamilyDefinition {
  id: MaterialFamily
  texelsPerMetre: number
  colorTextureRole: 'srgb'
  dataTextureRole: 'linear-data'
  wet: WetMaterialPolicy
}
```

- [ ] Implement `MaterialWeatherController` and make both simple standard-material registration and shader-uniform registration return idempotent unregister callbacks.

```ts
export class MaterialWeatherController {
  registerStandard(material: MeshStandardMaterial, policy: WetMaterialPolicy): () => void
  registerShader(uniforms: { wetness: { value: number } }): () => void
  apply(state: { wetness: number; rain: number; time: number }): void
  diagnostics(): { standardCount: number; shaderCount: number }
  dispose(): void
}
```

- [ ] Adapt existing `registerWetMaterial()` and `registerWeatherMaterial()` call sites. Every component-owned material unregisters in cleanup; shared application-lifetime material caches unregister during coordinated shutdown.

- [ ] Export one application-lifetime `materialWeatherController`. In `FrameDriver.tsx`, after `runtime.time.t`, `runtime.weather.rain`, and `runtime.weather.wetness` update, call `materialWeatherController.apply({ wetness: runtime.weather.wetness, rain: runtime.weather.rain, time: runtime.time.t })` exactly once. Remove `updateWetness()` from `FrameDriver` and `applySimpleWetness()` from `WorldSystems` so two partial-state loops cannot diverge.

- [ ] Declaration-merge standard/shader registration counts into `AtmosphereProbeSection` and register them with contributor ID `materials`; unregister/dispose the controller during coordinated application shutdown.

- [ ] Normalize authored glTF materials through material-family metadata from the Phase A registry. Mark albedo/emissive maps sRGB and normal/roughness/AO/mask maps as data.

- [ ] Apply rain darkening, wet roughness, runoff masks, and localized puddle eligibility to shell, paths, stone, wood, metal, bark, and turtle surfaces according to capability. Keep roofs/walls directional where authored masks exist.

- [ ] Preserve protected interior clones. Verify open-air pavilion pieces remain exterior and sealed furnishings remain dry.

- [ ] Add baked or vertex AO to static authored models on all tiers; use contact AO only as the High/Ultra supplement.

- [ ] Run the focused material tests.

Expected: PASS, including unregister and full dry-state restoration.

- [ ] Extend `e2e/app.spec.ts` to alternate clear/rain ten times, then run `pnpm test:e2e -- e2e/app.spec.ts`.

Expected: registry counts remain constant, interiors stay dry, and no material remains wet after returning to clear and completing dry-down.

- [ ] Capture the same exterior/interior pairs dry and wet at day and night.

Expected: wet hard surfaces darken and smooth locally, fabric/foliage remain plausible, and protected interiors do not inherit exterior wetness.

- [ ] Commit the material-weather slice.

```sh
git add src/game/rendering/materials src/game/weather/simpleWet.ts src/game/weather/wetMaterials.ts src/game/world/shell/ShellTerrain.tsx src/game/village/kit/materials.ts src/game/village/Building.tsx src/game/weather/AtmosphereDetails.tsx src/game/world/turtle src/game/core/FrameDriver.tsx src/game/world/WorldSystems.tsx src/game/debug/probes.ts tests/materialFamilies.test.ts tests/materialWeatherController.test.ts tests/wetness.test.ts e2e/app.spec.ts
git commit -m "feat: unify material weather response"
```

## Task 6: Finish turtle-scale ocean, wake, foam, spray, and shell-rim water

**Files:**

- Create: `src/game/world/ocean/wakeField.ts`
- Create: `src/game/world/ocean/WakeFoam.tsx`
- Create: `src/game/world/ocean/ShellRunoff.tsx`
- Create: `tests/wakeField.test.ts`
- Create: `tests/shellRunoff.test.ts`
- Modify: `src/game/world/ocean/Ocean.tsx`
- Modify: `src/game/world/turtle/TurtleHero.tsx`
- Modify: `src/game/world/turtle/animationPlan.ts`
- Modify: `src/game/core/runtime.ts`
- Modify: `src/game/core/quality.ts`
- Modify: `src/game/core/events.ts`
- Modify: `src/game/debug/probes.ts`
- Modify: `src/game/world/WorldSystems.tsx`
- Modify: `src/game/world/TurtleWorld.tsx`
- Modify: `e2e/app.spec.ts`

- [ ] Write `tests/wakeField.test.ts` for stable emitter packing, strongest-emitter selection, fixed shader-array length, finite values, deterministic foam decay, quality caps, and Reduced Motion scaling that retains primary strokes.

```ts
it('packs the strongest emitters into a fixed shader array', () => {
  const packed = packWakeEmitters(fixtureEmitters, 4)
  expect(packed).toHaveLength(4 * WAKE_EMITTER_STRIDE)
  expect(unpackStrengths(packed)).toEqual([1, 0.8, 0.6, 0.4])
})
```

- [ ] Write `tests/shellRunoff.test.ts` against Phase C drainage/waterfall anchors. Assert shell-rim ownership, rain thresholds, active-cell selection, and path/collider independence.

- [ ] Run `pnpm exec vitest run tests/wakeField.test.ts tests/shellRunoff.test.ts`.

Expected: FAIL because wake and runoff modules do not exist.

- [ ] Agree on the Phase B contract and expose it through runtime without inspecting bones by string.

```ts
export interface WakeEmitter {
  id: string
  position: readonly [number, number, number]
  direction: readonly [number, number]
  radius: number
  strength: number
  phase: number
}

export interface TurtleWaterState {
  emitters: readonly WakeEmitter[]
  breath: number
  stroke: number
}

export interface FoamPatch {
  id: string
  position: readonly [number, number, number]
  velocity: readonly [number, number, number]
  age: number
  lifetime: number
  radius: number
  strength: number
  opacity: number
}
```

- [ ] Implement pure packing and decay.

```ts
export const WAKE_EMITTER_STRIDE = 8

export function packWakeEmitters(
  emitters: readonly WakeEmitter[],
  maxEmitters: number,
): Float32Array

export function advanceFoamPatch(
  patch: FoamPatch,
  dt: number,
  reducedMotion: boolean,
): FoamPatch | null
```

- [ ] Extend `Ocean.tsx` uniforms with fixed-size wake data. Add broad low-frequency displacement, directional wake normals, flipper-driven crest foam, rain interaction, distance-appropriate reflection, and calm near-shell behavior without moving physics.

- [ ] Create `WakeFoam.tsx` using a bounded pool owned by Turtle Hero events. Low keeps broad wake identity; Medium adds flipper patches; High/Ultra increase patch count, lifetime detail, spray, and reflection quality.

- [ ] Create `ShellRunoff.tsx` from Phase C anchors. Rain drives drainage streams, waterfalls, rim foam, and a bounded spray pool. Water effects never add collision or block traversal.

- [ ] Route all secondary motion through the comfort clock. Reduced Motion lowers spray count, foam turbulence, camera response, and ray movement while keeping slow primary wake/flipper displacement.

- [ ] Declaration-merge wake-emitter, foam-patch, and spray counts into `TurtleProbeSection`, and runoff counts into `AtmosphereProbeSection`. Register contributor IDs `water` and `runoff` respectively, with teardown unregister callbacks.

- [ ] Extend the dev-only `TurtlebackDebug` surface in `WorldSystems.tsx` with `triggerTurtleEvent(kind: 'front-stroke'): boolean`. Implement it by emitting the existing Phase B `turtleScaleEvent` with a monotonic debug event ID, current comfort time, the canonical front-stroke duration, and intensity 1; return false outside development/benchmark builds. The E2E test must call this seam rather than wait for the rare-event scheduler.

- [ ] Run the focused water tests.

Expected: PASS with fixed allocations and deterministic decay.

- [ ] Extend `e2e/app.spec.ts`, call `triggerTurtleEvent('front-stroke')`, and probe Low/Medium/High/Ultra during that deterministic stroke and a rain transition.

Expected: real pool/uniform budgets change monotonically and remain bounded.

- [ ] Capture `waterfall-rim`, `flipper-scale`, turtle portrait, and ocean hero views at clear/rain/day/night with Reduced Motion both off and on.

Expected: turtle scale reads through broad water displacement, foam is not a static ellipse, spray does not glitter or clip, and Reduced Motion remains visibly alive but calm.

- [ ] Commit the water-polish slice.

```sh
git add src/game/world/ocean src/game/world/turtle/TurtleHero.tsx src/game/world/turtle/animationPlan.ts src/game/world/TurtleWorld.tsx src/game/world/WorldSystems.tsx src/game/core/runtime.ts src/game/core/quality.ts src/game/core/events.ts src/game/debug/probes.ts tests/wakeField.test.ts tests/shellRunoff.test.ts e2e/app.spec.ts
git commit -m "feat: finish turtle water response"
```

## Task 7: Polish interiors and wildlife rendering against the final atmosphere

**Files:**

- Create: `src/game/rendering/renderBudget.ts`
- Create: `tests/renderBudget.test.ts`
- Modify: `src/game/village/Building.tsx`
- Modify: `src/game/village/buildings/interiors.ts`
- Modify: `src/game/world/wildlife/WildlifeWorld.tsx`
- Modify: `src/game/world/wildlife/WildlifeDirector.ts`
- Modify: `src/game/world/wildlife/render/GroundAgents.tsx`
- Modify: `src/game/world/wildlife/render/BirdGroups.tsx`
- Modify: `src/game/world/wildlife/render/InsectGroups.tsx`
- Modify: `src/game/world/wildlife/render/AquaticGroups.tsx`
- Modify: `src/game/world/sky/TimeLighting.tsx`
- Modify: `src/game/core/quality.ts`
- Modify: `src/game/debug/probes.ts`
- Modify: `src/game/config/benchmarkScenarios.ts`

- [ ] Write `tests/renderBudget.test.ts` against pure resolved budgets. Assert every quality tier retains each major wildlife category, interior identity lights, biome identity, and turtle landmarks while scaling shadow range, animation Hz, LOD distance, population, and atmospheric cost.

```ts
it('never removes an entire wildlife category from Low', () => {
  const low = resolveRenderBudget(QUALITY_PROFILES.low)
  expect(Object.values(low.wildlife.minimumByCategory).every((count) => count > 0)).toBe(true)
})
```

- [ ] Run `pnpm exec vitest run tests/renderBudget.test.ts`.

Expected: FAIL until Phase D budgets and final quality resolver expose category minima.

- [ ] Create `src/game/rendering/renderBudget.ts` as the only final presentation-budget adapter. Import `WildlifeSpeciesDefinition['category']` and the existing Phase A/Phase D quality fields; do not duplicate numeric profile tables.

```ts
export type MajorWildlifeCategory = WildlifeSpeciesDefinition['category']

export interface ResolvedRenderBudget {
  wildlife: {
    minimumByCategory: Readonly<Record<MajorWildlifeCategory, number>>
    maxNearAgents: number
    maxDistantGroups: number
    updateHz: number
    shadowRadius: number
  }
  interiors: {
    minimumIdentityLights: number
    maxDynamicLights: number
  }
  preserveBiomeIdentity: true
  preserveTurtleLandmarks: true
}

export function resolveRenderBudget(profile: QualityProfile): ResolvedRenderBudget
```

- [ ] Map every category minimum to 1 on all four tiers, take population/update/shadow caps from `profile.wildlife`, take the light cap from `profile.maxDynamicLights`, and keep at least one identity light for an occupied interior. Any future removal of a major category, biome identity, or turtle landmark must therefore fail this pure contract first.

- [ ] Add final indoor daylight-fill/environment-intensity rules to `Building.tsx`. Interiors consume shared atmosphere family and rain attenuation; they do not create per-room environment maps or unbounded dynamic lights.

- [ ] Apply authored vertex/baked AO and material-family normalization to interiors. Verify glass, metal, fabric, painted surfaces, wet thresholds, emissive fixtures, and exterior views through windows under every required condition.

- [ ] Apply final wildlife material/LOD policies from the shared quality profile. Near animals use authored PBR materials and bounded shadows; distant groups use cheaper silhouettes/impostors while retaining species/category identity.

- [ ] Drive wildlife call representation and scene probes from the same visible agent or explicit distant group. Rendering polish must not reintroduce audio calls from empty nearby space.

- [ ] Ensure Quiet Mode lowers nonessential movement and visible village/wildlife activity without making habitats empty. Ensure Reduced Motion lowers secondary animation without freezing primary life signals.

- [ ] Add interior and wildlife-grouping scenarios to the full visual and performance matrices.

- [ ] Run `pnpm exec vitest run tests/renderBudget.test.ts`.

Expected: PASS with all category minima and tier budgets explicit.

- [ ] Run the Phase D wildlife unit suite and `pnpm test:e2e`.

Expected: all pooling, habitat, call ownership, interior, quality, and existing application tests PASS.

- [ ] Observe each biome for 90 seconds under suitable time/weather and record visible/represented wildlife counts through probes.

Expected: every biome satisfies the product acceptance window without nearby disembodied calls.

- [ ] Capture every building threshold and the wildlife-grouping benchmark at required tiers/conditions.

Expected: interiors share the exterior color story, thresholds do not blow out or blacken, and wildlife remains grounded in fog and contact light.

- [ ] Commit the interior/wildlife polish slice.

```sh
git add src/game/rendering/renderBudget.ts src/game/village src/game/world/wildlife src/game/world/sky/TimeLighting.tsx src/game/core/quality.ts src/game/debug/probes.ts src/game/config/benchmarkScenarios.ts tests/renderBudget.test.ts
git commit -m "fix: polish interior and wildlife rendering"
```

## Task 8: Add multi-scene benchmarks and the 30-minute memory plateau gate

**Files:**

- Create: `.env.diagnostics`
- Create: `electron-builder.diagnostics.yml`
- Create: `scripts/build-diagnostic-desktop.mjs`
- Create: `scripts/lib/diagnosticArtifact.mjs`
- Create: `scripts/benchmark-desktop.ts`
- Create: `scripts/soak-graphics.ts`
- Create: `src/game/config/performanceContract.ts`
- Create: `docs/performance-reference-systems.json`
- Create: `tests/diagnosticArtifact.test.ts`
- Modify: `scripts/build-desktop.mjs`
- Modify: `scripts/lib/graphicsCli.ts`
- Modify: `tests/graphicsCli.test.ts`
- Modify: `tests/performanceMath.test.ts`
- Modify: `src/game/debug/performanceMath.ts`
- Modify: `src/game/debug/probes.ts`
- Modify: `src/game/ui/hud/PerfOverlay.tsx`
- Modify: `scripts/smoke-desktop.mjs`
- Modify: `package.json`
- Modify: `docs/performance-baseline.md`

- [ ] Add failing tests for exact percentiles, final-window memory growth, plateau detection, cell-churn rates, and empty/invalid samples.

```ts
it('measures growth across the final twenty minutes', () => {
  const samples = [
    { atMs: 0, bytes: 900 },
    { atMs: 10 * 60_000, bytes: 1_000 },
    { atMs: 20 * 60_000, bytes: 1_040 },
    { atMs: 30 * 60_000, bytes: 1_080 },
  ]
  expect(finalWindowGrowthPercent(samples, 20 * 60_000)).toBe(8)
})
```

- [ ] Run `pnpm exec vitest run tests/performanceMath.test.ts`.

Expected: FAIL until plateau helpers exist.

- [ ] Create `src/game/config/performanceContract.ts` with the single checked-in gate object.

```ts
export const GRAPHICS_PERFORMANCE_CONTRACT = {
  highP95Ms: 16.7,
  lowP95Ms: 33.3,
  soakMinutes: 30,
  finalWindowMinutes: 20,
  maxFinalWindowGrowthPercent: 10,
  maxCellTransitionsPerMinute: 18,
} as const

export type PerformanceReferenceId = 'high-dedicated' | 'low-integrated'

export interface PerformanceReferenceSystem {
  id: PerformanceReferenceId
  fingerprint: string
  os: string
  cpu: string
  memoryBytes: number
  gpuVendor: string
  gpuDevice: string
  gpuDriver: string
  viewport: readonly [number, number]
  dpr: number
  electron: string
  chromium: string
  capturedAt: string
}
```

- [ ] Add these exports to `performanceMath.ts`.

```ts
export interface TimedMemorySample {
  atMs: number
  bytes: number
}

export function finalWindowGrowthPercent(
  samples: readonly TimedMemorySample[],
  finalWindowMs: number,
): number
export function cellChurnPerMinute(events: readonly { atMs: number }[]): number
```

Import and re-export the nearest-rank `percentile()` from `src/game/core/frameTimeStats.ts`; there must remain one percentile implementation across Auto quality, probes, browser benchmarks, and packaged benchmarks.

- [ ] Extend `tests/performanceMath.test.ts` to assert every numeric gate above, including exactly 18 allowed cell-center transitions per minute and failure at 19. Scripts import this contract rather than embedding a second threshold.

- [ ] Extend the Phase A parser in `scripts/lib/graphicsCli.ts`; do not add a desktop-only argument parser. `parseDesktopBenchmarkArgs()` accepts exactly one of `--reference=high-dedicated|low-integrated` or `--register-reference=high-dedicated|low-integrated`. A reference run may also accept the same optional single `--scenario=<registered ID>` and `--variant=default|no-ao`; registration mode accepts only its registration flag and exits after writing the fingerprint. `parseGraphicsSoakArgs()` requires one `--reference=high-dedicated|low-integrated` and accepts one optional `--minutes=<integer 1..120>`; the release gate still requires 30. Both parsers strip at most one leading `--` and fail before artifact discovery or launch on positional arguments, unknown/empty flags, duplicates, a missing reference, a reference/register conflict, an unregistered scenario, an unsupported variant, or `no-ao` on a scenario without `ao-review`. Extend `tests/graphicsCli.test.ts` with every accepted form and every rejection above, including the exact reference values.

- [ ] Create `scripts/benchmark-desktop.ts`. Resolve the executable only through `scripts/lib/diagnosticArtifact.mjs`, drive fixed paths for dense Crownwood, Lumenfen water/wildlife, busy Hearth clearing, turtle portrait/flipper event, rain, and night, and honor an optional parsed scenario/variant. Warm each path, sample at least 60 seconds, and record p50/p95/p99/max frame time, renderer counts, instances, LODs, decoded bytes, Electron process metrics, reference ID, scenario ID, variant, diagnostic marker, and build commit.

- [ ] On registration, derive a stable machine fingerprint from OS version, CPU model, physical memory, GPU vendor/device/driver, viewport, DPR, and Electron/Chromium versions, then atomically create/update `docs/performance-reference-systems.json`. Store exactly two named slots, `high-dedicated` and `low-integrated`, with the captured fingerprint and human-readable hardware fields. A normal `--reference` run must fail before measurement when its live fingerprint differs from the committed slot, eliminating ambiguous claims about an unnamed machine.

- [ ] Create `scripts/soak-graphics.ts`. Resolve the executable through the same diagnostic-artifact helper, traverse the world deterministically for the parsed duration, revisit the same terminal scene, and record process memory, renderer resources, active/retained cells, asset cache, wildlife pools, audio nodes, event/listener counts, reference ID, diagnostic marker, and build commit at fixed intervals.

- [ ] Make the soak import `GRAPHICS_PERFORMANCE_CONTRACT` and fail when final-20-minute memory growth is 10 percent or greater, resources continue monotonically growing without content change, cell-center transitions exceed 18 per minute, or tracked audio/GPU resources fail to release after revisiting the baseline scene.

- [ ] Build a separate diagnostic renderer and desktop bundle. Set only `VITE_TURTLEBACK_DIAGNOSTICS=1` in `.env.diagnostics`. Make `scripts/build-desktop.mjs` accept one strict `--out-dir=<relative directory>` option and reject all other arguments. `scripts/build-diagnostic-desktop.mjs` runs asset validation and typecheck, runs `vite build --mode diagnostics --outDir dist-diagnostics`, bundles Electron to `dist-desktop-diagnostics`, and writes `dist-diagnostics/turtleback-diagnostics.json` containing `{ "schemaVersion": 1, "diagnostics": true, "commit": "<git HEAD>" }`. The normal `pnpm build` and `pnpm desktop:build` commands remain unchanged and never set the flag or copy diagnostic output.

- [ ] Add `electron-builder.diagnostics.yml` extending the normal builder policy but with product name `Turtleback Sanctuary Diagnostics`, app ID `com.turtleback.sanctuary.diagnostics`, and output `release-diagnostics/`. Map `dist-diagnostics/**` to packaged `dist/**` and `dist-desktop-diagnostics/**` to packaged `dist-desktop/**`; copy the marker as `turtleback-diagnostics.json` under the packaged resources directory so it can be checked without reading ASAR. Diagnostic packages are unsigned local `dir` artifacts, are never inputs to release verification/signing/notarization, and are not added to release workflows.

- [ ] Implement `scripts/lib/diagnosticArtifact.mjs` as the only artifact locator used by the desktop benchmark and soak. It accepts no arbitrary executable path and recognizes only the diagnostics product under `release-diagnostics/mac-arm64/` or `release-diagnostics/win-unpacked/`. Before launch, require the external marker's schema, `diagnostics: true`, and commit to match current `git HEAD`; reject a missing/stale marker, any path under normal `release/`, or the normal product name. Test exact macOS/Windows discovery plus all rejection cases in `tests/diagnosticArtifact.test.ts`.

- [ ] Keep `scripts/smoke-desktop.mjs`, `desktop:smoke`, and both release verifiers pointed only at normal `release/`. Extend their production-security assertion to require the diagnostic marker and `window.__turtlebackDebug` both be absent. The diagnostic artifact proves benchmark/soak behavior only; it cannot satisfy normal package, signing, notarization, installer, or release smoke evidence.

- [ ] Add scripts.

```json
"desktop:build:diagnostics": "node scripts/build-diagnostic-desktop.mjs",
"desktop:package:diagnostics": "pnpm desktop:build:diagnostics && electron-builder --config electron-builder.diagnostics.yml --dir --publish never",
"desktop:benchmark": "tsx scripts/benchmark-desktop.ts",
"soak:graphics": "tsx scripts/soak-graphics.ts"
```

- [ ] Run `pnpm exec vitest run tests/graphicsCli.test.ts tests/diagnosticArtifact.test.ts` before packaging. Expected: all accepted CLI forms parse to exact typed values, all unsupported input exits nonzero before launch, normal release paths are rejected, and only a current marked diagnostic artifact resolves.

- [ ] Run `pnpm desktop:package:diagnostics` on each performance host before benchmark or soak. Inspect the package path and marker; do not fall back to `release/` if the diagnostics package is absent.

- [ ] Update `PerfOverlay` with p95, draw calls, triangles, active/retained cells, loaded/fallback assets, texture estimate, `sections.wildlife`, and `sections.audio.currentMusicSource`. Keep its DOM refresh at low frequency and show `—` when an optional section is absent.

- [ ] Run `pnpm exec vitest run tests/performanceMath.test.ts`.

Expected: PASS with exact final-window growth behavior.

- [ ] On the selected dedicated-GPU machine, run `pnpm desktop:benchmark -- --register-reference=high-dedicated`, review the captured fingerprint, then run `pnpm desktop:benchmark -- --reference=high-dedicated` at High 1080p.

Expected: every required High scene records p95 at or below 16.7 ms after warm-up.

- [ ] On the selected integrated-GPU machine, run `pnpm desktop:benchmark -- --register-reference=low-integrated`, review the captured fingerprint, then run `pnpm desktop:benchmark -- --reference=low-integrated` at Low 1080p-equivalent output.

Expected: every required Low scene records p95 at or below 33.3 ms after warm-up.

- [ ] Run `pnpm soak:graphics -- --reference=high-dedicated --minutes=30` and `pnpm soak:graphics -- --reference=low-integrated --minutes=30` on the matching registered machines.

Expected: each traversal reaches a plateau with less than 10 percent growth over the final 20 minutes and no unbounded cache/pool/node growth.

- [ ] If a target fails, reduce the corresponding quality budget in `src/game/core/quality.ts`, rerun its focused benchmark, then rerun the full tier suite. Do not remove biome, route, hero-landmark, or major-wildlife identity from Low.

- [ ] Record exact hardware, OS, GPU, driver, viewport, DPR, build commit, scenario, warm-up, and raw result paths in `docs/performance-baseline.md`.

- [ ] Commit only after both named hardware gates and the soak pass.

```sh
git add .env.diagnostics electron-builder.diagnostics.yml scripts/build-desktop.mjs scripts/build-diagnostic-desktop.mjs scripts/lib/diagnosticArtifact.mjs scripts/lib/graphicsCli.ts scripts/benchmark-desktop.ts scripts/soak-graphics.ts scripts/smoke-desktop.mjs src/game/debug src/game/config/performanceContract.ts src/game/ui/hud/PerfOverlay.tsx src/game/core/quality.ts package.json docs/performance-reference-systems.json docs/performance-baseline.md tests/performanceMath.test.ts tests/graphicsCli.test.ts tests/diagnosticArtifact.test.ts
git commit -m "test: enforce graphics performance contracts"
```

## Task 9: Complete licenses, the visual matrix, and release verification

**Files:**

- Create: `src/game/assets/releaseInventory.node.ts`
- Create: `tests/releaseAssetInventory.test.ts`
- Modify: `src/game/assets/manifest.json`
- Modify: `src/game/assets/validate.node.ts`
- Modify: `scripts/validate-assets.ts`
- Modify: `tests/assetValidator.test.ts`
- Modify: `ASSET_LICENSES.md`
- Modify: `ART_BIBLE.md`
- Modify: `MANUAL_QA.md`
- Modify: `README.md`
- Modify: `docs/performance-baseline.md`
- Modify: `visual/graphics.capture.ts`
- Modify: `src/game/config/benchmarkScenarios.ts`
- Modify: `scripts/verify-macos-release.mjs`
- Modify: `scripts/verify-windows-release.mjs`
- Modify: `.github/workflows/macos-arm64-release.yml`
- Modify: `.github/workflows/windows-x64-release.yml`

- [ ] Run `pnpm validate:assets` before editing the ledger.

Expected: any missing file, mismatched checksum, unsupported license, missing source/generation record, invalid fallback/LOD, or ledger drift fails with a stable asset ID.

- [ ] Complete source URL or generation record, author, redistributable license, attribution, checksum, encoded/decoded size, quality variants, preload regions, fallback, and material/weather capabilities for every shipped authored asset.

- [ ] Create `releaseInventory.node.ts` as the Phase F-owned whole-release contract. It consumes the canonical `AssetRegistry`, the canonical `WILDLIFE_REGISTRY`, and the validator root; it must not add another manifest parser, registry, wildlife roster, biome union, or task-specific package script. Export a sorted issue list with stable codes/owner IDs, and call it only from the existing `validateAssetRegistry(rootDirectory, options)` implementation when `options.final === true`. Generic validation and `--slice=rendering|world|audio` remain present-record validators so Phases A-E can pass with partial inventories.

```ts
export interface ReleaseInventoryIssue {
  code:
    | 'world-pack-missing'
    | 'world-material-tier-missing'
    | 'turtle-contract-missing'
    | 'turtle-asset-missing'
    | 'turtle-sound-variant-count'
    | 'wildlife-species-missing'
    | 'wildlife-asset-missing'
    | 'wildlife-call-count'
    | 'music-track-set'
    | 'ambience-bed-set'
    | 'ambient-detail-layer-missing'
    | 'referenced-one-shot-missing'
  ownerId: string
  assetId?: AssetId
  message: string
}

export async function validateFinalReleaseInventory(input: {
  rootDirectory: string
  registry: AssetRegistry
  wildlife: readonly WildlifeSpeciesDefinition[]
}): Promise<readonly ReleaseInventoryIssue[]>
```

- [ ] Freeze the final world/turtle inventory in that module. Require registered model variants whose normalized static paths are exactly `assets/models/vegetation/<slug>-vegetation.glb` and `assets/models/props/<slug>-props.glb` for `crownwood`, `lumenfen`, `blossomshade`, `fernfall`, `galecrest`, and runtime slug `hearth`. For each matching `assets/textures/biomes/<slug>/` family, require registered base-color, normal, and roughness/AO/mask coverage resolving on Low, Medium, High, and Ultra. Require model IDs `turtle.hero.lod0`, `turtle.hero.lod1`, `turtle.hero.lod2`, and `turtle.body-collision` at the four Phase B paths; require `public/assets/models/turtle/turtle-hero.contract.json` to exist; and require all four turtle texture families (`basecolor`, `normal`, `rma`, `masks`) at `512`, `1k`, `2k`, and `4k` through registered variants.

- [ ] Require the five Phase B turtle-sound records and paths exactly: `turtle.sound.breath-loop`, `turtle.sound.breath-deep`, `turtle.sound.stroke-front`, `turtle.sound.stroke-rear`, and `turtle.sound.shell-resonance` under `assets/audio/turtle/<name>.mp3`. Require the three Phase E completion records exactly: `turtle.sound.shell-resonance-deep`, `turtle.sound.wake-surge`, and `turtle.sound.wake-trail` at their matching filenames under the same root. Group all `turtle-sound` records by canonical `turtle.category` and require at least two variants for each of the four `TurtleSoundCategory` values `breath`, `shell-resonance`, `flipper`, and `wake`; do not invent a fifth event category.

- [ ] Import the fourteen definitions from `WILDLIFE_REGISTRY` and require the exact approved ID set from Phase D, every definition's authored `lodAssetIds` and `fallbackAssetId` to resolve, and every `callAssetIds` reference to resolve as kind `wildlife-call` with matching `wildlife.speciesId`. Treat a non-empty `callAssetIds` list as the canonical audibility declaration and require at least three distinct registered call variants for each such definition; an empty list keeps a silent silhouette silent. This final validator consumes the wildlife registry rather than copying its representation or audibility rules.

- [ ] Require exactly this twelve-ID `music-track` set, with no missing or extra release tracks: `music.crownwood.canopy-hush`, `music.crownwood.mosslight-steps`, `music.lumenfen.lantern-water`, `music.lumenfen.rain-on-reeds`, `music.blossomshade.petal-static`, `music.blossomshade.hearth-window`, `music.fernfall.root-and-rill`, `music.fernfall.blue-hour-drift`, `music.galecrest.saltwind-tape`, `music.galecrest.moonwake`, `music.hearth.market-drowse`, and `music.hearth.afterglow`.

- [ ] Require exactly six `ambience-bed` records, one whose `ambience.biome` is each canonical `BiomeId`: `crownwood`, `lumenfen`, `blossomshade`, `fernfall`, `galecrest`, and `hearth-clearing`. Freeze their IDs as `ambience.crownwood.bed-01`, `ambience.lumenfen.bed-01`, `ambience.blossomshade.bed-01`, `ambience.fernfall.bed-01`, `ambience.galecrest.bed-01`, and `ambience.hearth-clearing.bed-01`; reject duplicates or extra beds masquerading as completion.

- [ ] Close the required one-shot inventory. Every turtle-audio catalog reference must resolve to `turtle-sound` with the matching category, every audible wildlife catalog reference must resolve to `wildlife-call` with the matching species, and every ambient source scheduled by Phase E must resolve to `ambient-detail` with the matching layer. Require at least one registered ambient-detail source in each canonical layer `water`, `canopy`, `village`, and `interior` (the directory may remain plural `interiors/`). Missing referenced records and wrong-kind records use `referenced-one-shot-missing`, not a silent runtime skip.

- [ ] Write `tests/releaseAssetInventory.test.ts` with one complete fixture and table-driven negative cases that remove one required biome pack, material tier, turtle model/contract/texture, exact pilot sound, turtle category variant, wildlife definition/LOD/call, music ID, bed/biome, ambient-detail layer, and referenced one-shot. Assert stable issue code plus owner/asset ID and deterministic sort order. Extend `tests/assetValidator.test.ts` to prove a partial manifest still passes generic/slice validation but fails `final: true`, that extra or missing track/bed IDs fail, and that `validate:assets:final` cannot pass by provenance alone.

- [ ] Run `pnpm exec vitest run tests/releaseAssetInventory.test.ts tests/assetValidator.test.ts` before implementation and confirm the new cases fail because Phase F inventory enforcement is absent. Implement the Node-only contract and final-mode hook, then rerun both files green.

- [ ] Run `pnpm write:asset-licenses` and review every generated row against the source record. Do not hand-edit generated ledger rows.

- [ ] Run every specialized full-roster gate before the aggregate final validator:

```sh
pnpm validate:assets:world -- --required-biomes=crownwood,galecrest,lumenfen,fernfall,blossomshade,hearth
pnpm validate:assets:turtle
pnpm validate:assets:wildlife -- --required-species=mossback-grazer,shell-hare,fernfall-glider,crownwood-songbird,tide-corvid,galecrest-seabird,lumenfen-frog,reed-wader,lumenfen-insects,blossom-pollinators,lumenfen-fish,shell-ray,sanctuary-dolphin,distant-whale
pnpm validate:assets:audio
```

Expected: all world-pack, turtle-model, wildlife GLB/clip/review, and audio-delivery validators pass on their exact final rosters.

- [ ] Run `pnpm validate:assets:final`.

Expected: PASS only when provenance/binary/ledger validation and the complete biome-pack, turtle, fourteen-species wildlife, exact twelve-track, exact six-bed, and required one-shot inventories all pass; `ASSET_LICENSES.md` exactly matches the registry.

- [ ] Verify the final capture matrix in `benchmarkScenarios.ts` contains all required conditions and selected Ultra heroes. Verify the six added cameras now target final Phase B-D geometry rather than foundation-safe positions.

- [ ] Run `pnpm capture:graphics`.

Expected: every High, Medium, Low, and Ultra scenario completes with no rejected camera, shader compile error, asset fallback hole, or missing output.

- [ ] Perform human review against the spec: foreground story, navigation anchor, layered middle distance, horizon/scale silhouette, coherent dry/wet material response, no stretched hero textures, no uncontrolled specular clipping, no empty nearby wildlife calls, and no hard biome borders.

- [ ] Update `ART_BIBLE.md` with final approved grade, fog, IBL, AO, wetness, texel-density, bloom, and atmosphere limits.

- [ ] Update `MANUAL_QA.md` with Reduced Motion, Quiet Mode, all tiers, all weather/time families, 90-second wildlife observations, context recovery, cell boundaries, long traversal, and produced/procedural soundtrack checks.

- [ ] Extend macOS and Windows release verifiers to enumerate registry assets inside the packaged artifact, verify checksums, launch offline, load a GLB/KTX2/environment path, and confirm coordinated shutdown/relaunch.

- [ ] Add `public/assets/**`, `src/game/assets/**`, `ASSET_LICENSES.md`, benchmark scripts, and visual scenarios to both release-workflow path triggers.

- [ ] Run `pnpm typecheck`.

Expected: PASS.

- [ ] Run `pnpm lint`.

Expected: PASS.

- [ ] Run `pnpm test`.

Expected: all unit tests PASS.

- [ ] Run `pnpm build`.

Expected: asset validation, strict TypeScript, and Vite production build PASS.

- [ ] Run `pnpm test:e2e`.

Expected: all browser application, traversal, media, asset, quality, atmosphere, wildlife, and fallback tests PASS.

- [ ] Build and verify the normal macOS release artifact separately: run `pnpm desktop:package:mac`, `pnpm desktop:smoke`, and `pnpm desktop:verify:mac`. Confirm it comes only from `release/`, has no diagnostics marker, and exposes no `window.__turtlebackDebug` mutation surface.

Expected: normal offline packaged lifecycle, security, identity/configuration, asset enumeration, persistence, recovery, and relaunch gates PASS without using diagnostic evidence.

- [ ] On the named High host, run `pnpm desktop:package:diagnostics`, `pnpm desktop:benchmark -- --reference=high-dedicated`, and `pnpm soak:graphics -- --reference=high-dedicated --minutes=30`. On the named Low host, run `pnpm desktop:package:diagnostics`, `pnpm desktop:benchmark -- --reference=low-integrated`, and `pnpm soak:graphics -- --reference=low-integrated --minutes=30`.

Expected: benchmark and soak launch only the current marked artifact under `release-diagnostics/`; the normal release app is never accepted as a fallback.

- [ ] On the declared Windows runner, run `pnpm desktop:package:win`, `pnpm desktop:installer:win`, `pnpm desktop:smoke`, and `pnpm desktop:verify:win`. If it is the named Low reference host, run `pnpm desktop:package:diagnostics`, `pnpm desktop:benchmark -- --reference=low-integrated`, and `pnpm soak:graphics -- --reference=low-integrated --minutes=30` against its separate diagnostics artifact.

Expected: Windows proof records native packaging, installation, offline assets, lifecycle, persistence, and uninstallation; do not infer Windows GPU performance unless that runner is the named performance reference.

- [ ] Commit the release-polish closeout.

```sh
git add src/game/assets/manifest.json src/game/assets/releaseInventory.node.ts src/game/assets/validate.node.ts scripts/validate-assets.ts tests/releaseAssetInventory.test.ts tests/assetValidator.test.ts ASSET_LICENSES.md ART_BIBLE.md MANUAL_QA.md README.md docs/performance-baseline.md visual/graphics.capture.ts src/game/config/benchmarkScenarios.ts scripts/verify-macos-release.mjs scripts/verify-windows-release.mjs .github/workflows/macos-arm64-release.yml .github/workflows/windows-x64-release.yml
git commit -m "docs: complete atmosphere release gate"
```

## Phase F dependency and risk notes

- Standard Three PBR materials do not natively blend two PMREM maps. This plan uses hysteretic environment-family switches with continuously blended direct light, fog, intensity, and grade; a dual-PMREM shader extension requires separate artifact and performance approval.
- Phase F must consume Phase B wake emitters. Inferring flipper strokes from bone names or world transforms would create a fragile cross-system dependency.
- Biome-aware mist and runoff require Phase C moisture/exposure and authored-anchor APIs. A second independent random field would desynchronize visuals, audio, and habitat behavior.
- Wildlife polish must preserve Phase D call ownership. Rendering substitutions may not allow nearby audio from an agent/group that is not represented.
- Grading cannot repair incorrect material values. Reject LUT/effect changes that merely hide broken albedo, roughness, exposure, or color-space errors.
- Height fog plus scene fog can double-density. Low uses scene fog; High/Ultra must deliberately rebalance the base fog when the depth effect is active.
- SSAO is optional. Disable or reduce it if it halos foliage, shows through fog/transparency, leaks NormalPass/effect targets during tier switches, or breaks the High p95 contract.
- PMREM maps, postprocessing render targets, material registrations, streamed cells, wildlife pools, and audio nodes all require explicit disposal and context-restoration tests.
- SwiftShader captures are correctness evidence, not release-GPU performance evidence.
- The current Apple M5 baseline is not automatically either approved slot. High/Low acceptance remains open until `high-dedicated` and `low-integrated` are fingerprinted in `docs/performance-reference-systems.json` and produce raw p95/soak evidence on matching machines.
- External asset availability and licensing remain release blockers. “Free,” downloadable, or streamable does not imply redistribution permission.
- Physical Windows/macOS display scaling, controller, audio device, sleep/wake, and credentialed signing/notarization remain manual or CI-environment gates even when automated rendering tests pass.
