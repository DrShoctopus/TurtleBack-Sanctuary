# Rendering and Asset Foundation Implementation Plan

**Status:** Superseded on 2026-07-14. Implemented foundation work remains valid, but do not execute unchecked tasks from this plan; use `2026-07-14-stylized-sanctuary-reset.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase A of the approved graphics overhaul: correct color handling, four explicit quality tiers, a validated authored-asset pipeline, glTF/KTX2/Meshopt loading with fallbacks and disposal, 50-metre spatial cells, chunked current vegetation, deterministic scene probes, and expanded benchmark tooling.

**Architecture:** Keep `FrameDriver` and the mutable `runtime` object authoritative for per-frame state. Add pure, unit-tested contracts for color, quality, assets, cell membership, and probes; wrap imperative GPU loaders and caches behind explicit leases; and let React observe only discrete quality/cell transitions. Preserve the analytic shell and Rapier collision as traversal truth while splitting render populations into independently culled cells.

**Tech Stack:** TypeScript 5.9, React 19, React Three Fiber 9, Three.js 0.182, Rapier, Zustand, Zod, Vite 7, Vitest, Playwright, Electron, `tsx`, and `vite-plugin-static-copy`.

---

## Scope and completion rules

This plan implements Phase A from `docs/superpowers/specs/2026-07-13-sanctuary-graphics-audio-overhaul-design.md`. It deliberately does not create the final turtle, six finished biomes, wildlife ecosystem, or produced soundtrack. It does create the contracts those phases consume.

Phase A is complete only when:

- palette sampling has one sRGB-to-linear conversion;
- renderer, authored textures, data textures, shader uniforms, and screenshots follow one documented color contract;
- Low, Medium, High, and Ultra have explicit monotonic budgets;
- production builds fail on invalid authored-asset metadata, paths, checksums, licenses, fallbacks, or LOD chains;
- a real GLB and KTX2 pipeline-smoke asset decode in browser and packaged Electron builds;
- Meshopt and Basis/KTX2 decoders resolve under both relative web bases and `app://turtleback`;
- current vegetation is partitioned into cells with real frustum culling and horizon retention;
- quality changes alter live resources rather than detached configuration;
- debug probes report cells, instances, LODs, assets, renderer counts, and estimated texture bytes;
- the complete repository verification gate is green.

## Task 1: Correct color handling and document the rendering contract

**Files:**

- Create: `src/game/rendering/colorContract.ts`
- Create: `tests/colorContract.test.ts`
- Create: `tests/palette.test.ts`
- Create: `docs/rendering-color-contract.md`
- Modify: `src/game/world/sky/palette.ts`
- Modify: `src/game/GameCanvas.tsx`
- Modify: `src/game/world/sky/SkyDome.tsx`
- Modify: `src/game/world/sky/Clouds.tsx`
- Modify: `src/game/world/sky/Aurora.tsx`
- Modify: `src/game/world/ocean/Ocean.tsx`
- Modify: `src/game/weather/Rain.tsx`
- Modify: `src/game/weather/AtmosphereDetails.tsx`
- Modify: `ART_BIBLE.md`

- [ ] Write `tests/palette.test.ts` with a regression that samples every exact stop in `SKY_TOP`, `SKY_HORIZON`, `FOG_COLOR`, and `SUN_COLOR` and compares it to the stop's already-linear tuple.

```ts
import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { SKY_TOP, sampleColor } from '@/game/world/sky/palette'

describe('time palette color space', () => {
  it('does not convert an already-linear stop a second time', () => {
    const target = new Color()
    for (const stop of SKY_TOP) {
      sampleColor(target, SKY_TOP, stop.t)
      expect(target.toArray()).toEqual(stop.color)
    }
  })
})
```

- [ ] Run `pnpm exec vitest run tests/palette.test.ts`.

Expected: FAIL because `sampleColor()` calls `convertSRGBToLinear()` after interpolating linear stop values.

- [ ] Write `tests/colorContract.test.ts` for renderer configuration and texture roles.

```ts
import { ACESFilmicToneMapping, DataTexture, NoColorSpace, SRGBColorSpace } from 'three'
import { describe, expect, it } from 'vitest'
import {
  configureRendererColor,
  markColorTexture,
  markDataTexture,
} from '@/game/rendering/colorContract'

describe('renderer color contract', () => {
  it('configures ACES and sRGB output explicitly', () => {
    const renderer = { outputColorSpace: NoColorSpace, toneMapping: 0, toneMappingExposure: 0 }
    configureRendererColor(renderer)
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace)
    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping)
    expect(renderer.toneMappingExposure).toBe(1.05)
  })

  it('marks color and data textures differently', () => {
    expect(markColorTexture(new DataTexture()).colorSpace).toBe(SRGBColorSpace)
    expect(markDataTexture(new DataTexture()).colorSpace).toBe(NoColorSpace)
  })
})
```

- [ ] Run `pnpm exec vitest run tests/colorContract.test.ts`.

Expected: FAIL because `src/game/rendering/colorContract.ts` does not exist.

- [ ] Create `src/game/rendering/colorContract.ts` with these exports.

```ts
import {
  ACESFilmicToneMapping,
  NoColorSpace,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from 'three'

export interface RendererColorTarget {
  outputColorSpace: WebGLRenderer['outputColorSpace']
  toneMapping: WebGLRenderer['toneMapping']
  toneMappingExposure: number
}

export const RENDERER_COLOR_CONTRACT = {
  outputColorSpace: SRGBColorSpace,
  toneMapping: ACESFilmicToneMapping,
  exposure: 1.05,
} as const

export function configureRendererColor(renderer: RendererColorTarget): void {
  renderer.outputColorSpace = RENDERER_COLOR_CONTRACT.outputColorSpace
  renderer.toneMapping = RENDERER_COLOR_CONTRACT.toneMapping
  renderer.toneMappingExposure = RENDERER_COLOR_CONTRACT.exposure
}

export function markColorTexture<T extends Texture>(texture: T): T {
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function markDataTexture<T extends Texture>(texture: T): T {
  texture.colorSpace = NoColorSpace
  return texture
}
```

- [ ] Replace `sampleColor()` in `src/game/world/sky/palette.ts` with `return target.setRGB(r, g, b)` and delete the shared scratch color and `convertSRGB()` helper.

- [ ] Call `configureRendererColor(gl)` from `GameCanvas`'s `onCreated` callback and remove its duplicated direct tone-mapping assignments.

- [ ] Audit every custom fragment shader named in this task. Add `#include <tonemapping_fragment>` immediately before `#include <colorspace_fragment>` when the material is tone mapped; add the output-color chunk to rain/weather shaders that currently write raw linear output.

- [ ] Write `docs/rendering-color-contract.md` with these enforceable rules: CSS/hex colors are sRGB inputs converted by Three; numeric RGB tuples and shader uniforms are linear; albedo/emissive textures are sRGB; normal/roughness/AO/masks are `NoColorSpace`; renderer output and screenshots are sRGB; ACES is applied exactly once.

- [ ] Update the color section of `ART_BIBLE.md` to link to `docs/rendering-color-contract.md` and require color-contract verification before palette authoring.

- [ ] Run `pnpm exec vitest run tests/colorContract.test.ts tests/palette.test.ts`.

Expected: PASS, including the exact-stop regression.

- [ ] Run `pnpm typecheck`.

Expected: PASS with no unused scratch import or shader-related TypeScript regression.

- [ ] Capture a temporary noon and night comparison with `pnpm capture:graphics` and inspect for broad exposure or clipping regressions caused by the corrected conversion. Do not retune palette values in this task.

- [ ] Commit the color-contract slice.

```sh
git add ART_BIBLE.md docs/rendering-color-contract.md src/game/rendering/colorContract.ts src/game/GameCanvas.tsx src/game/world/sky src/game/world/ocean/Ocean.tsx src/game/weather tests/colorContract.test.ts tests/palette.test.ts
git commit -m "fix: establish rendering color contract"
```

## Task 2: Add Ultra and frame-time-based quality budgets

**Files:**

- Create: `src/game/core/frameTimeStats.ts`
- Create: `tests/frameTimeStats.test.ts`
- Modify: `src/game/core/quality.ts`
- Modify: `src/game/core/useQualityProfile.ts`
- Modify: `src/game/core/runtime.ts`
- Modify: `src/game/core/FrameDriver.tsx`
- Modify: `src/game/state/gameStore.ts`
- Modify: `src/game/data/settings.ts`
- Modify: `src/game/ui/menus/MenuOverlay.tsx`
- Modify: `src/game/GameCanvas.tsx`
- Modify: `tests/quality.test.ts`
- Modify: `tests/settings.test.ts`
- Modify: `e2e/app.spec.ts`

- [ ] Extend `tests/quality.test.ts` first so it expects four levels and monotonic texture, LOD, atmosphere, vegetation, wildlife, shadow, and water budgets.

```ts
it('scales every authored-content budget low to ultra', () => {
  const levels = ['low', 'medium', 'high', 'ultra'] as const
  const profiles = levels.map((level) => QUALITY_PROFILES[level])
  expect(profiles.map((p) => p.textureTier)).toEqual(['512', '1k', '2k', '4k'])
  expect(profiles.map((p) => p.atmosphereDetail)).toEqual([0, 1, 2, 3])
  expect(profiles.map((p) => p.vegetationDensity)).toEqual(
    [...profiles.map((p) => p.vegetationDensity)].sort((a, b) => a - b),
  )
  expect(profiles.every((p) => p.wildlifeDensity > 0)).toBe(true)
})
```

- [ ] Add a settings migration test that loads a version-2 High save unchanged and accepts an explicit Ultra choice after migration to version 3.

- [ ] Run `pnpm exec vitest run tests/quality.test.ts tests/settings.test.ts`.

Expected: FAIL because `QualityLevel`, the schema, and the profiles do not include Ultra or the new budgets.

- [ ] Create `tests/frameTimeStats.test.ts` with exact percentile and governor hysteresis cases.

```ts
it('uses p95 rather than a good average to detect stutter', () => {
  const frames = [...Array(94).fill(8), ...Array(6).fill(40)]
  expect(percentile(frames, 0.95)).toBe(40)
})

it('does not promote Auto to Ultra', () => {
  const governor = new QualityGovernor('high')
  for (let i = 0; i < 3_600; i++) governor.update(1 / 120)
  expect(governor.current).toBe('high')
})
```

- [ ] Run `pnpm exec vitest run tests/frameTimeStats.test.ts`.

Expected: FAIL because the percentile helper and revised governor do not exist.

- [ ] Add these core types to `src/game/core/quality.ts`.

```ts
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra'
export type AutoQualityLevel = Exclude<QualityLevel, 'ultra'>
export type TextureTier = '512' | '1k' | '2k' | '4k'

export interface QualityProfile {
  level: QualityLevel
  dprMax: number
  internalResolutionScale: number
  shadowMapSize: number
  shadowDistance: number
  shadowsEnabled: boolean
  textureTier: TextureTier
  lodBias: number
  cellLoadRadius: number
  cellRetainRadius: number
  vegetationDensity: number
  wildlifeDensity: number
  atmosphereDetail: 0 | 1 | 2 | 3
  ssaoAllowed: boolean
  iblResolution: 0 | 64 | 128 | 256
  oceanDetail: 0 | 1 | 2 | 3
  oceanSegments: number
  rainMax: number
  drawDistance: number
  reflections: 0 | 1 | 2 | 3
  bloomAllowed: boolean
  cloudDetail: 0 | 1 | 2 | 3
  landmarkDetail: 0 | 1 | 2 | 3
  maxDynamicLights: number
  updateHz: number
}

export interface QualityDecision {
  previous: AutoQualityLevel
  next: AutoQualityLevel
  p95FrameMs: number
  reason: 'over-budget' | 'sustained-headroom'
}
```

- [ ] Define explicit Low/Medium/High/Ultra profiles. Preserve current Low/Medium/High live geometry values until later measurement, and give Ultra strictly richer content budgets without gameplay differences.

- [ ] Create `src/game/core/frameTimeStats.ts` with one nearest-rank `percentile(values, p)` implementation (copy-sort inputs; select index `Math.max(0, Math.ceil(p * n) - 1)`; reject empty/non-finite samples and `p` outside `[0, 1]`) and a bounded 180-frame window used by `QualityGovernor`.

- [ ] Change `QualityGovernor.current` and `setAutoQuality` to `AutoQualityLevel`; cap automatic promotion at High. Base demotion on p95 above the current tier's target and promotion on sustained p95 headroom, retaining longer promotion than demotion cooldowns.

- [ ] Add `'ultra'` to `QualityChoice`, settings Zod schema, Graphics menu, and `resolveQuality()`. Increment `SETTINGS_VERSION` from 2 to 3; the migration needs no destructive rewrite because the nested shape is unchanged.

- [ ] Update every quality consumer so four-way detail choices are exhaustive. In particular, remove conditions that treat every non-Low value as High.

- [ ] Update `e2e/app.spec.ts` to assert that a Low-to-Ultra switch changes live ocean/rain/atmosphere resources in the expected direction. Stop asserting exact hard-coded vertex totals that cell and LOD work will invalidate.

- [ ] Run `pnpm exec vitest run tests/quality.test.ts tests/frameTimeStats.test.ts tests/settings.test.ts`.

Expected: PASS with Auto capped at High and explicit Ultra resolving correctly.

- [ ] Run `pnpm typecheck` and `pnpm test:e2e -- e2e/app.spec.ts`.

Expected: both PASS; the browser test observes real resource changes after selecting Ultra.

- [ ] Commit the quality-budget slice.

```sh
git add src/game/core src/game/state/gameStore.ts src/game/data/settings.ts src/game/ui/menus/MenuOverlay.tsx src/game/GameCanvas.tsx tests/quality.test.ts tests/frameTimeStats.test.ts tests/settings.test.ts e2e/app.spec.ts
git commit -m "feat: expand graphics quality budgets"
```

## Task 3: Add the typed authored-asset registry and production validator

**Files:**

- Create: `src/game/assets/schema.ts`
- Create: `src/game/assets/manifest.json`
- Create: `src/game/assets/registry.ts`
- Create: `src/game/assets/validate.node.ts`
- Create: `src/game/assets/licenseLedger.ts`
- Create: `src/game/assets/urls.ts`
- Create: `scripts/validate-assets.ts`
- Create: `tests/assetRegistry.test.ts`
- Create: `tests/assetValidator.test.ts`
- Create: `tests/assetUrls.test.ts`
- Create: `tests/assetLicenseLedger.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Modify: `ASSET_LICENSES.md`

- [ ] Install the typed script runner.

Run: `pnpm add -D tsx`

Expected: `package.json` and `pnpm-lock.yaml` record `tsx`; no runtime dependency changes.

- [ ] Write `tests/assetRegistry.test.ts` with invalid duplicate IDs, missing quality coverage, invalid LOD order, incompatible fallbacks, fallback cycles, unregistered procedural keys, absolute paths, traversal paths, absent attribution, unsupported licenses, and a kind/extension mismatch.

```ts
it('rejects a fallback cycle', () => {
  expect(() =>
    createAssetRegistry(
      [
        modelRecord({ id: 'model.a', fallback: { kind: 'asset', id: 'model.b' } }),
        modelRecord({ id: 'model.b', fallback: { kind: 'asset', id: 'model.a' } }),
      ],
      { proceduralFallbackKeys: new Set() },
    ),
  ).toThrow(/fallback cycle/i)
})
```

- [ ] Write `tests/assetUrls.test.ts` for a root site, a GitHub Pages-style subpath, and Electron's `app://turtleback/index.html`; reject leading slashes, protocols, query injection, and `..`.

```ts
expect(resolveStaticAssetUrl('app://turtleback/', 'assets/models/tree.glb')).toBe(
  'app://turtleback/assets/models/tree.glb',
)
expect(resolveStaticAssetUrl('https://host/game/', 'assets/models/tree.glb')).toBe(
  'https://host/game/assets/models/tree.glb',
)
```

- [ ] Write `tests/assetLicenseLedger.test.ts` so original/generated content, CC0 content, and attribution-required content render deterministic ledger rows between `<!-- BEGIN GENERATED ASSET LICENSES -->` and `<!-- END GENERATED ASSET LICENSES -->` markers.

- [ ] Write `tests/assetValidator.test.ts` with temporary fixture roots for missing files, wrong encoded sizes, checksum mismatches, invalid GLB/KTX2 magic bytes, generated-ledger drift, rendering-slice filtering, and `final: true` rejecting a record without a source URL or generation record.

- [ ] Run `pnpm exec vitest run tests/assetRegistry.test.ts tests/assetValidator.test.ts tests/assetUrls.test.ts tests/assetLicenseLedger.test.ts`.

Expected: FAIL because the asset modules do not exist.

- [ ] Create `src/game/assets/schema.ts` with a Zod schema and these public types.

```ts
export type AssetKind =
  | 'model'
  | 'texture'
  | 'environment'
  | 'animation'
  | 'music-track'
  | 'ambience-bed'
  | 'ambient-detail'
  | 'wildlife-call'
  | 'turtle-sound'
export type AssetLicense = 'Original' | 'CC0-1.0' | 'CC-BY-4.0'
export type AssetId = string

export interface AssetVariant {
  id: AssetId
  path: string
  quality: readonly QualityLevel[]
  lod?: 0 | 1 | 2
  sha256: string
  encodedBytes: number
  decodedBytes: number
}

export type AssetFallback = { kind: 'asset'; id: AssetId } | { kind: 'procedural'; key: string }

export interface BaseAssetRecord {
  id: AssetId
  slice: 'rendering' | 'world' | 'audio'
  variants: readonly AssetVariant[]
  sourceUrl?: string
  generationRecord?: string
  author: string
  license: AssetLicense
  attribution: string
  preloadRegions: readonly string[]
  fallback: AssetFallback
  capabilities: {
    wetness?: boolean
    wind?: boolean
    animation?: boolean
    materialFamily?: string
  }
}

export type ModelAssetRecord = BaseAssetRecord & {
  kind: 'model'
  capabilities: BaseAssetRecord['capabilities'] & { animation: boolean }
}
export type TextureAssetRecord = BaseAssetRecord & {
  kind: 'texture'
  textureRole: 'color' | 'normal' | 'roughness' | 'ao' | 'emissive' | 'mask'
}
export type EnvironmentAssetRecord = BaseAssetRecord & { kind: 'environment' }
export type AnimationAssetRecord = BaseAssetRecord & { kind: 'animation' }
export type TimedAudioAssetRecord<K extends AssetKind> = BaseAssetRecord & {
  kind: K
  durationSec: number
}
export interface AssetByKind {
  model: ModelAssetRecord
  texture: TextureAssetRecord
  environment: EnvironmentAssetRecord
  animation: AnimationAssetRecord
  'music-track': TimedAudioAssetRecord<'music-track'>
  'ambience-bed': TimedAudioAssetRecord<'ambience-bed'>
  'ambient-detail': TimedAudioAssetRecord<'ambient-detail'>
  'wildlife-call': TimedAudioAssetRecord<'wildlife-call'>
  'turtle-sound': TimedAudioAssetRecord<'turtle-sound'>
}
export type AssetRecord = AssetByKind[keyof AssetByKind]

export interface AssetRegistry {
  get(id: AssetId): AssetRecord
  has(id: AssetId): boolean
  getByKind<K extends AssetKind>(kind: K): readonly AssetByKind[K][]
  values(): readonly AssetRecord[]
}
```

`assetRecordSchema` must be `z.discriminatedUnion('kind', [...])`, with one schema member for every `AssetByKind` key. `assetManifestSchema` must remain the root `z.object({ schemaVersion: z.literal(1), assets: z.array(assetRecordSchema) })`. Adding a future kind therefore requires one type-map entry and one matching record-schema member rather than weakening root validation.

- [ ] Export `AssetId`, `AssetRegistry`, and the exact `get()`/`has()`/`getByKind()`/`values()` signatures above from the shared schema/registry boundary. Implement `createAssetRegistry(records, options)` and `resolveAssetVariant(record, quality, requestedLod)` in `src/game/assets/registry.ts`. `options.proceduralFallbackKeys` is a readonly set of registered factory keys; reject an unregistered procedural fallback while building the graph. Validation must be deterministic and must report the stable asset ID in every error. Return registry arrays in stable asset-ID order so later world, wildlife, and audio catalogs do not add parallel lookup types.

```ts
export function createAssetRegistry(
  records: readonly AssetRecord[],
  options?: { proceduralFallbackKeys: ReadonlySet<string> },
): AssetRegistry
```

- [ ] Implement `resolveStaticAssetUrl(baseUrl, path)` in `src/game/assets/urls.ts` with a strict relative static-boundary check before constructing `new URL(path, baseUrl)`.

- [ ] Implement `renderAssetLicenseLedger(records)` in `src/game/assets/licenseLedger.ts`. Sort by asset ID so generated Markdown is stable.

- [ ] Create `src/game/assets/manifest.json` as the one cross-phase manifest, initially with the exact valid shape below. Parse it through `assetManifestSchema` in `registry.ts`; do not maintain a TypeScript mirror.

```json
{
  "schemaVersion": 1,
  "assets": []
}
```

- [ ] Create `src/game/assets/validate.node.ts` as the Node-only validation implementation. Keep filesystem/crypto imports out of browser modules and expose this exact API so the CLI and tests share one implementation.

```ts
export interface AssetValidationOptions {
  slice?: 'rendering' | 'world' | 'audio'
  final: boolean
  writeLicenses: boolean
}

export interface AssetValidationReport {
  assetCount: number
  variantCount: number
  verifiedBytes: number
  generatedLedger: string
}

export async function validateAssetRegistry(
  rootDirectory: string,
  options: AssetValidationOptions,
): Promise<AssetValidationReport>
```

- [ ] Create `scripts/validate-assets.ts`. Parse only `--slice=<rendering|world|audio>`, `--final`, and `--write-licenses`, map them to `AssetValidationOptions`, and exit nonzero on unknown flags. The Node implementation must parse the shared schema, verify each `public/` file exists, stream SHA-256, compare encoded byte counts, inspect GLB and KTX2 magic bytes, validate kind/extension compatibility and the registry graph, and compare the generated authored-asset section of `ASSET_LICENSES.md`. `--write-licenses` may rewrite only the generated ledger section; `--final` additionally requires provenance and attribution completeness for every shipped record.

- [ ] Add scripts to `package.json`.

```json
"validate:assets": "tsx scripts/validate-assets.ts",
"validate:assets:rendering": "tsx scripts/validate-assets.ts --slice=rendering",
"validate:assets:final": "tsx scripts/validate-assets.ts --final",
"write:asset-licenses": "tsx scripts/validate-assets.ts --write-licenses",
"build": "pnpm validate:assets && tsc --noEmit && vite build"
```

`validate:assets:final` is installed in Phase A for the shared pipeline but is reserved for the Phase F/master closeout. Phase A build and closeout use generic `validate:assets` plus the rendering slice; they must not claim that later world/audio provenance is final.

- [ ] Add `scripts/**/*.ts` to `tsconfig.json` so strict TypeScript checks the validator.

- [ ] Replace the absolute “zero binary media assets” claim in `ASSET_LICENSES.md` with a stable generated-ledger section and retain the dependency-license section below it.

- [ ] Run the four focused test files again.

Expected: PASS for pure schema, graph, URL, and ledger behavior.

- [ ] Run `pnpm validate:assets`.

Expected: PASS for the current empty authored-file set and matching ledger.

- [ ] Commit the registry slice.

```sh
git add package.json pnpm-lock.yaml tsconfig.json ASSET_LICENSES.md scripts/validate-assets.ts src/game/assets tests/assetRegistry.test.ts tests/assetValidator.test.ts tests/assetUrls.test.ts tests/assetLicenseLedger.test.ts
git commit -m "feat: validate authored asset registry"
```

## Task 4: Add GLB, KTX2, Meshopt, fallback, and cache infrastructure

**Files:**

- Create: `src/game/assets/loaders.ts`
- Create: `src/game/assets/AssetManager.ts`
- Create: `src/game/assets/AssetProvider.tsx`
- Create: `src/game/assets/AssetFailureRouter.ts`
- Create: `src/game/assets/diagnostics.ts`
- Create: `src/game/assets/proceduralFallbacks.ts`
- Create: `tests/assetManager.test.ts`
- Create: `tests/assetFailureRouter.test.ts`
- Create: `tests/buildFlags.test.ts`
- Create: `tests/pipelineSmokeRecords.test.ts`
- Create: `assets-src/system/pipeline-smoke.png`
- Create: `scripts/authoring/generate-pipeline-smoke-sources.mjs`
- Create: `scripts/authoring/generate-pipeline-smoke-ktx2.sh`
- Create: `scripts/authoring/register-pipeline-smoke.ts`
- Create: `docs/assets/generation/pipeline-smoke.md`
- Create: `public/assets/system/pipeline-smoke.glb`
- Create: `public/assets/system/pipeline-smoke.ktx2`
- Modify: `src/game/assets/manifest.json`
- Modify: `src/game/assets/validate.node.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/game/GameCanvas.tsx`
- Modify: `src/game/world/TurtleWorld.tsx`
- Modify: `src/main.tsx`
- Modify: `vite.config.ts`
- Modify: `src/desktop/main/index.ts`
- Modify: `tests/desktopSecurity.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Install the build-time decoder-copy plugin.

Run: `pnpm add -D vite-plugin-static-copy`

Expected: the dev dependency and lockfile update without changing runtime dependencies.

- [ ] Write `tests/assetManager.test.ts` against injected fake loaders. Cover request de-duplication, reference counts, delayed disposal until the final release, failed-primary fallback, failed-fallback procedural fallback, stable diagnostics, model/texture failure routing, and idempotent manager disposal.

```ts
it('disposes a cached resource only after the final lease releases it', async () => {
  const dispose = vi.fn()
  const manager = makeManagerWithFakeModel({ dispose })
  const first = await manager.acquireModel('model.pipeline-smoke', 'high')
  const second = await manager.acquireModel('model.pipeline-smoke', 'high')
  first.release()
  expect(dispose).not.toHaveBeenCalled()
  second.release()
  expect(dispose).toHaveBeenCalledOnce()
})
```

- [ ] Write `tests/pipelineSmokeRecords.test.ts` with fixed fake SHA-256/size inputs and assert the complete two-record structure, all four quality levels, exact variant/fallback IDs, model LOD 0, color texture role, decoded byte estimates, provenance, author, and license.

- [ ] Write `tests/assetFailureRouter.test.ts` before either loader consumes the seam. Cover disabled-mode immutability, rejection of an unknown ID, one pending failure per ID, exact-once consumption through each of the four channels, wrong-channel non-consumption, a deterministic bounded history of the latest 32 consumptions, `reset()`, and the common `InjectedAssetFailure` payload. Write `tests/buildFlags.test.ts` for the exact truth table: development enables the router, `VITE_TURTLEBACK_DIAGNOSTICS=1` enables it in a diagnostic production bundle, and an ordinary production bundle leaves it disabled.

- [ ] Run `pnpm exec vitest run tests/assetManager.test.ts tests/assetFailureRouter.test.ts tests/buildFlags.test.ts tests/pipelineSmokeRecords.test.ts`.

Expected: FAIL because `AssetManager` and `AssetFailureRouter` do not exist.

- [ ] Create `src/game/assets/loaders.ts` using `GLTFLoader`, `KTX2Loader`, `MeshoptDecoder`, and `SkeletonUtils` from the installed Three package. Expose a factory that receives the live `WebGLRenderer` and resolved Basis-transcoder URL. Construct `KTX2Loader`, call `setTranscoderPath(transcoderPath)` and `detectSupport(renderer)`, then construct `GLTFLoader` and call both `setKTX2Loader(ktx2)` and `setMeshoptDecoder(MeshoptDecoder)` before returning either loader.

```ts
export interface AuthoredAssetLoaders {
  gltf: GLTFLoader
  ktx2: KTX2Loader
  cloneModel(gltf: GLTF): ModelAsset
  dispose(): void
}

export interface ModelAsset {
  scene: Object3D
  animations: readonly AnimationClip[]
}

export function createAuthoredAssetLoaders(input: {
  renderer: WebGLRenderer
  transcoderPath: string
  manager?: LoadingManager
}): AuthoredAssetLoaders
```

- [ ] Create `src/game/assets/AssetManager.ts` with this public API.

```ts
export interface AssetLease<T> {
  readonly id: AssetId
  readonly value: T
  release(): void
}

export interface AssetPreloadLease {
  readonly ids: readonly AssetId[]
  release(): void
}

export interface AssetDiagnostics {
  loadedIds: readonly AssetId[]
  pendingIds: readonly AssetId[]
  fallbackIds: readonly AssetId[]
  decodedBytesById: Readonly<Record<string, number>>
  estimatedDecodedBytes: number
}

export interface ProceduralFallbackFactories {
  models: Readonly<Record<string, () => ModelAsset>>
  textures: Readonly<Record<string, () => Texture>>
}

export type AssetFailureChannel = 'model' | 'texture' | 'streaming-media' | 'audio-buffer'

export interface ConsumedAssetFailure {
  id: AssetId
  channel: AssetFailureChannel
  sequence: number
}

export interface AssetFailureSnapshot {
  enabled: boolean
  pendingIds: readonly AssetId[]
  consumed: readonly ConsumedAssetFailure[]
}

export class InjectedAssetFailure extends Error {
  constructor(assetId: AssetId, channel: AssetFailureChannel)
  readonly assetId: AssetId
  readonly channel: AssetFailureChannel
}

export class AssetFailureRouter {
  constructor(input: { enabled: boolean; kindFor(id: AssetId): AssetKind | null })
  failNext(id: AssetId): boolean
  consume(id: AssetId, channel: AssetFailureChannel): boolean
  snapshot(): AssetFailureSnapshot
  reset(): void
}

export const assetFailureRouter: AssetFailureRouter

export class AssetManager {
  constructor(input: {
    registry: AssetRegistry
    loaders: AuthoredAssetLoaders
    proceduralFallbacks: ProceduralFallbackFactories
    failureRouter?: AssetFailureRouter
  })
  acquireModel(id: AssetId, quality: QualityLevel, lod?: number): Promise<AssetLease<ModelAsset>>
  acquireTexture(id: AssetId, quality: QualityLevel): Promise<AssetLease<Texture>>
  preload(ids: readonly AssetId[], quality: QualityLevel): Promise<AssetPreloadLease>
  diagnostics(): AssetDiagnostics
  dispose(): void
}
```

- [ ] Implement `AssetFailureRouter.ts` as the one cross-system development/diagnostic failure seam. The exported singleton resolves IDs and kinds from canonical `manifest.json`; test-created routers may receive a fake `kindFor`. Map `model|animation` to channel `model`, `texture|environment` to `texture`, `music-track|ambience-bed` to `streaming-media`, and `ambient-detail|wildlife-call|turtle-sound` to `audio-buffer`. Enable the singleton only when `import.meta.env.DEV || import.meta.env.VITE_TURTLEBACK_DIAGNOSTICS === '1'`. Declare `VITE_TURTLEBACK_DIAGNOSTICS?: '1'` in `src/vite-env.d.ts` and keep the enablement predicate as a small pure export so `tests/buildFlags.test.ts` can prove the truth table. In disabled mode `failNext()` and `consume()` return false, mutate neither pending nor history state, and never cause a window debug handle to be installed. `failNext()` returns false for unknown IDs and stores at most one pending failure per ID. `consume()` returns false without consuming when the channel does not match the asset kind; the matching call removes that ID exactly once while recording the chosen channel and a monotonic sequence. Sort pending IDs in snapshots, cap consumed history at 32 entries, and clear both queues plus the sequence in `reset()`.

- [ ] Make `AssetManager` accept `failureRouter: AssetFailureRouter = assetFailureRouter`; `AssetProvider` passes that singleton explicitly so model, texture, later DOM-media, and later AudioBuffer consumers share one queue. Immediately before each real model or texture request, call `consume(id, 'model')` or `consume(id, 'texture')`; when true, throw the common `InjectedAssetFailure(id, channel)` into the same registered fallback path used by a network/decode error. Do not add `injectFailure()` or any other failure registry to `AssetManager`. Phase E's `ProducedTrackPlayer`/`AmbienceBedPlayer` consume `streaming-media`, and `AudioBufferCache` consumes `audio-buffer`; the canonical window method stays ID-only and the consumer selects the channel.

- [ ] Ensure model acquisition returns a safe scene clone for each consumer while cached immutable geometry and textures remain shared. A lease release decrements the exact resolved variant; zero references dispose GPU resources unless the entry is held by an `AssetPreloadLease`. Releasing a preload lease must unpin every resolved variant exactly once.

- [ ] Create `proceduralFallbacks.ts` with registered factories `procedural.debug-box` and `procedural.debug-checker`. Factories return a `ModelAsset` containing a one-metre `BoxGeometry`/`MeshStandardMaterial` and a 2x2 magenta/black `DataTexture` respectively, both marked with the Phase A color contract and both independently disposable. Export `PROCEDURAL_FALLBACK_KEYS` from the factory-map keys, pass it to `createAssetRegistry()` in both `AssetProvider` and `validate.node.ts`, and reject an unknown key before loading or rendering.

- [ ] Create `AssetProvider.tsx` and `useAssetManager()` so the manager is constructed only after R3F supplies the renderer. Dispose it on Canvas teardown and coordinated Electron shutdown.

- [ ] Call `KTX2Loader.detectSupport(renderer)` before the first KTX2 request. Add `viteStaticCopy()` targets for `node_modules/three/examples/jsm/libs/basis/basis_transcoder.js` and `.wasm`, outputting to `assets/decoders/basis/` in dev and production; resolve the trailing-slash transcoder URL through `resolveStaticAssetUrl(document.baseURI, 'assets/decoders/basis/')`.

- [ ] On the canonical Darwin arm64 authoring machine, install the signed [Khronos KTX-Software 4.4.2](https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2) package with the exact release digest. This is a one-time authoring dependency; CI, other developers, and production builds consume the committed output.

```sh
curl -fsSL https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Darwin-arm64.pkg -o /tmp/KTX-Software-4.4.2-Darwin-arm64.pkg
echo "500bd8f9d63358c3f3a0d83b724c8574436a72c37dc0e4bad90ec1ca38032c3c  /tmp/KTX-Software-4.4.2-Darwin-arm64.pkg" | shasum -a 256 -c -
sudo installer -pkg /tmp/KTX-Software-4.4.2-Darwin-arm64.pkg -target /
toktx --version
ktx --version
```

Expected: checksum verification passes and both version commands report 4.4.2. Do not add KTX-Software to runtime dependencies or production-build prerequisites.

- [ ] Create `scripts/authoring/generate-pipeline-smoke-sources.mjs` using only `node:fs`, `node:path`, and `node:zlib`. It must deterministically create directories, write a 4x4 opaque magenta/black sRGB checker PNG to `assets-src/system/pipeline-smoke.png`, and write a glTF 2.0 GLB containing exactly one node and one 1-metre triangle with positions `(0,0,0)`, `(1,0,0)`, `(0,1,0)` and indices `0,1,2` to `public/assets/system/pipeline-smoke.glb`. Encode the GLB with fixed JSON insertion order, four-byte JSON/BIN padding, magic `glTF`, version 2, and no timestamps or external buffers.

- [ ] Add this executable texture-authoring script at `scripts/authoring/generate-pipeline-smoke-ktx2.sh`.

```sh
#!/bin/sh
set -eu

required_version='4.4.2'
for tool in toktx ktx; do
  case "$("$tool" --version 2>&1)" in
    *"$required_version"*) ;;
    *) echo "KTX-Software $required_version is required for $tool" >&2; exit 1 ;;
  esac
done

mkdir -p public/assets/system

toktx \
  --t2 \
  --encode uastc \
  --threads 1 \
  --genmipmap \
  --assign_oetf srgb \
  --assign_primaries bt709 \
  public/assets/system/pipeline-smoke.ktx2 \
  assets-src/system/pipeline-smoke.png

ktx validate public/assets/system/pipeline-smoke.ktx2
```

- [ ] Run `node scripts/authoring/generate-pipeline-smoke-sources.mjs`.

Expected: the exact 4x4 source PNG and one-triangle GLB are created without external packages; a second run produces byte-identical PNG/GLB hashes.

- [ ] Run `sh scripts/authoring/generate-pipeline-smoke-ktx2.sh`.

Expected: KTX-Software 4.4.2 creates and validates `public/assets/system/pipeline-smoke.ktx2`; any other encoder version fails before writing output.

- [ ] Write `docs/assets/generation/pipeline-smoke.md` with the deterministic PNG/GLB generator algorithm and command, exact Darwin arm64 package URL/digest, both tool versions, full KTX2 command, source-file hashes, and generated-file hashes. Record that KTX-Software documents Basis/UASTC output as potentially cross-platform-nondeterministic, so the checked-in KTX2 hash—not re-encoding in CI—is the runtime contract.

- [ ] Create `scripts/authoring/register-pipeline-smoke.ts`. Export `buildPipelineSmokeRecords(input)` for a focused unit test, stream both committed files through SHA-256, read encoded sizes from `stat`, and upsert exactly these two records into the shared manifest before sorting by ID. The only measured values are `sha256` and `encodedBytes`; model decoded bytes are the fixed 42-byte position/index payload and the 4x4 RGBA mip chain is fixed at 84 decoded bytes.

```ts
export interface MeasuredSmokeFiles {
  model: { sha256: string; encodedBytes: number }
  texture: { sha256: string; encodedBytes: number }
}

export function buildPipelineSmokeRecords(
  input: MeasuredSmokeFiles,
): readonly [ModelAssetRecord, TextureAssetRecord]
```

The model record is `model.pipeline-smoke`, kind `model`, slice `rendering`, author `Turtleback Sanctuary contributors`, license `Original`, generation record `docs/assets/generation/pipeline-smoke.md`, preload region `system`, procedural fallback `procedural.debug-box`, animation capability false, and one variant `model.pipeline-smoke.lod0` at `assets/system/pipeline-smoke.glb`, LOD 0, decoded bytes 42, covering Low/Medium/High/Ultra. The texture record uses the same author/license/generation/preload/quality values, ID `texture.pipeline-smoke`, kind `texture`, slice `rendering`, role `color`, procedural fallback `procedural.debug-checker`, and one no-LOD variant `texture.pipeline-smoke.color` at `assets/system/pipeline-smoke.ktx2` with decoded bytes 84.

- [ ] Run `pnpm exec tsx scripts/authoring/register-pipeline-smoke.ts`, then run `shasum -a 256 public/assets/system/pipeline-smoke.glb public/assets/system/pipeline-smoke.ktx2` and `wc -c public/assets/system/pipeline-smoke.glb public/assets/system/pipeline-smoke.ktx2` as an independent review of the exact values written to `src/game/assets/manifest.json`.

- [ ] Confirm that `pnpm build` consumes the committed `.ktx2` file and never invokes `toktx`, `ktx`, or the authoring script. CI and end-user runtime require only the committed KTX2 plus Three's copied Basis transcoder.

- [ ] Run `pnpm write:asset-licenses` followed by `pnpm validate:assets:rendering`.

Expected: the generated ledger lists both pipeline-smoke assets and validation confirms paths, hashes, sizes, and magic bytes.

- [ ] Add explicit Electron MIME mappings in `rendererContentType()`:

```ts
case '.glb': return 'model/gltf-binary'
case '.gltf': return 'model/gltf+json; charset=utf-8'
case '.ktx2': return 'image/ktx2'
case '.hdr': return 'image/vnd.radiance'
case '.exr': return 'image/x-exr'
case '.bin': return 'application/octet-stream'
```

- [ ] Extend `tests/desktopSecurity.test.ts` to prove `resolveRendererFile()` accepts valid nested asset paths and still rejects encoded traversal.

- [ ] Hold an `AssetPreloadLease` for the registered pipeline-smoke model and texture through `AssetProvider` before `SceneReadyProbe` resolves, on browser and packaged builds. Release and reacquire it on resolved-quality changes, then release it on provider teardown. Task 7 will expose their decoded state through the canonical debug probe.

- [ ] Run `pnpm exec vitest run tests/assetManager.test.ts tests/assetFailureRouter.test.ts tests/buildFlags.test.ts tests/pipelineSmokeRecords.test.ts tests/desktopSecurity.test.ts`.

Expected: PASS.

- [ ] Run `pnpm build` and inspect `dist/assets/decoders/basis/` plus `dist/assets/system/`.

Expected: both Basis files and both smoke assets exist under the relative static boundary.

- [ ] Run `pnpm desktop:package` followed by `pnpm desktop:smoke`.

Expected: packaged `app://turtleback` startup has no decoder/asset MIME or path error.

- [ ] Commit the loader slice.

```sh
git add package.json pnpm-lock.yaml vite.config.ts ASSET_LICENSES.md assets-src/system/pipeline-smoke.png docs/assets/generation/pipeline-smoke.md scripts/authoring/generate-pipeline-smoke-sources.mjs scripts/authoring/generate-pipeline-smoke-ktx2.sh scripts/authoring/register-pipeline-smoke.ts public/assets/system src/game/assets src/game/GameCanvas.tsx src/game/world/TurtleWorld.tsx src/main.tsx src/desktop/main/index.ts tests/assetManager.test.ts tests/pipelineSmokeRecords.test.ts tests/desktopSecurity.test.ts
git commit -m "feat: load compressed authored assets"
```

## Task 5: Add deterministic 50-metre spatial-cell state

**Files:**

- Create: `src/game/world/spatial/types.ts`
- Create: `src/game/world/spatial/cells.ts`
- Create: `src/game/world/spatial/SpatialCellProvider.tsx`
- Create: `tests/spatialCells.test.ts`
- Modify: `src/game/core/runtime.ts`
- Modify: `src/game/world/TurtleWorld.tsx`

- [ ] Write `tests/spatialCells.test.ts` for positive and negative coordinates, exact boundaries, active 3x3 neighborhoods, retain windows, deterministic key order, six-metre boundary hysteresis, and no repeated transition when the player remains in one cell.

```ts
it('retains the prior center until boundary hysteresis is crossed', () => {
  const tracker = new SpatialCellTracker(DEFAULT_SPATIAL_GRID)
  expect(tracker.update(24, 0)?.center).toEqual({ ix: 0, iz: 0 })
  expect(tracker.update(26, 0)).toBeNull()
  expect(tracker.update(32, 0)?.center).toEqual({ ix: 1, iz: 0 })
})
```

- [ ] Run `pnpm exec vitest run tests/spatialCells.test.ts`.

Expected: FAIL because the spatial modules do not exist.

- [ ] Create the spatial types and defaults.

```ts
export interface SpatialGridConfig {
  cellSize: number
  originX: number
  originZ: number
  loadRadius: number
  retainRadius: number
  boundaryHysteresis: number
}

export interface CellCoord {
  ix: number
  iz: number
}
export type CellKey = `${number}:${number}`

export interface CellTransition {
  center: CellCoord
  active: readonly CellKey[]
  retained: readonly CellKey[]
  entered: readonly CellKey[]
  exited: readonly CellKey[]
}

export const DEFAULT_SPATIAL_GRID: SpatialGridConfig = {
  cellSize: 50,
  originX: 0,
  originZ: 0,
  loadRadius: 1,
  retainRadius: 2,
  boundaryHysteresis: 6,
}
```

`originX`/`originZ` are the centre of cell `{ ix: 0, iz: 0 }`; therefore that cell spans `[-25, 25)` on each axis before hysteresis. `worldToCell()` must use centred-cell arithmetic consistently for positive and negative coordinates.

- [ ] Implement these pure exports in `cells.ts`.

```ts
export function cellId(coord: CellCoord): CellKey
export function worldToCell(x: number, z: number, config?: SpatialGridConfig): CellCoord
export function cellBounds(coord: CellCoord, config?: SpatialGridConfig): Box2
export function cellNeighborhood(center: CellCoord, radius: number): readonly CellKey[]

export class SpatialCellTracker {
  constructor(config?: SpatialGridConfig)
  update(x: number, z: number): CellTransition | null
  snapshot(): CellTransition
}
```

- [ ] Create `SpatialCellProvider.tsx`. Tick at 10 Hz in `useFrame`, call the pure tracker with `runtime.player.pos`, and notify React subscribers only when `update()` returns a transition. Do not store player position in React.

- [ ] Keep `SpatialCellTracker` as the sole residency implementation. Export its snapshot through the provider/runtime for later biome and wildlife consumers; do not introduce a second `CellResidency`, `CellBudget`, or parallel load/retain tracker in later phases.

- [ ] Add `runtime.spatial` with center, active, and retained cell IDs for imperative consumers and probes.

- [ ] Mount `SpatialCellProvider` above cell consumers in `TurtleWorld.tsx`.

- [ ] Run `pnpm exec vitest run tests/spatialCells.test.ts`.

Expected: PASS with deterministic ordering and no boundary churn.

- [ ] Run `pnpm typecheck`.

Expected: PASS; per-frame runtime remains mutable and cell transitions remain discrete.

- [ ] Commit the spatial-state slice.

```sh
git add src/game/world/spatial src/game/core/runtime.ts src/game/world/TurtleWorld.tsx tests/spatialCells.test.ts
git commit -m "feat: add deterministic world cells"
```

## Task 6: Partition current vegetation and retain a low-cost horizon

**Files:**

- Create: `src/game/village/vegetation/types.ts`
- Create: `src/game/village/vegetation/placement.ts`
- Create: `src/game/village/vegetation/partition.ts`
- Create: `src/game/village/vegetation/VegetationCell.tsx`
- Create: `tests/vegetationCells.test.ts`
- Modify: `src/game/village/Vegetation.tsx`
- Modify: `tests/geometry.test.ts`

- [ ] Extract test fixtures from the current deterministic scatter and write `tests/vegetationCells.test.ts`. Assert same-seed equality, different-seed difference, no loss or duplication during partitioning, path/building/water exclusion, correct cell membership, and Low retaining at least one tree representation in every populated tree cell.

```ts
it('partitions without losing or duplicating transforms', () => {
  const population = buildVegetationPopulation({ seed: 20260712, density: 1 })
  const cells = partitionVegetationByCell(population, DEFAULT_SPATIAL_GRID)
  expect(sumCellTransforms(cells)).toEqual(countPopulationTransforms(population))
  expect(allTransformKeys(cells).size).toBe(countPopulationTransforms(population))
})
```

- [ ] Run `pnpm exec vitest run tests/vegetationCells.test.ts`.

Expected: FAIL because placement and partitioning are private inside `Vegetation.tsx`.

- [ ] Define render-neutral population types in `vegetation/types.ts`.

```ts
export type VegetationLayer = 'grass' | 'flowers' | 'bushes' | 'rocks' | 'trees'

export interface VegetationTransform {
  id: string
  x: number
  y: number
  z: number
  scale: number
  yaw: number
  variant: number
}

export interface VegetationPopulation {
  seed: number
  layers: Readonly<Record<VegetationLayer, readonly VegetationTransform[]>>
}

export interface VegetationCellPopulation {
  cellId: CellKey
  near: VegetationPopulation['layers']
  horizonTrees: readonly VegetationTransform[]
}
```

- [ ] Move `clearOfStructures`, `scatter`, `habitatDensity`, and placement generation into `placement.ts` without changing current counts or seed behavior.

```ts
export function buildVegetationPopulation(input: {
  seed: number
  density: number
}): VegetationPopulation

export function isVegetationPlacementAllowed(x: number, z: number, margin: number): boolean
```

- [ ] Implement `partitionVegetationByCell()` in `partition.ts`; sort transforms by stable ID within each cell.

- [ ] Build one `VegetationCell` per retained cell. Near active cells render all layers and collision; retained non-active cells render horizon trees/crown masses only. Set `frustumCulled={true}` and compute bounding boxes/spheres after instance matrices are populated.

- [ ] Keep simplified tree colliders loaded throughout the retain radius. Ensure the active radius is wider than the distance a player can cross during the 10 Hz cell tick.

- [ ] Reduce `Vegetation.tsx` to material/geometry ownership, deterministic population memoization, cell selection, and comfort-clock wind updates.

- [ ] Run `pnpm exec vitest run tests/vegetationCells.test.ts tests/geometry.test.ts`.

Expected: PASS with current placement semantics preserved.

- [ ] Run `pnpm test:e2e -- e2e/app.spec.ts` and walk across at least two cell boundaries using the existing debug teleport plus keyboard movement.

Expected: no missing tree collision, no instance disappearance around the player, and no page error.

- [ ] Capture `arrival-bridge`, `garden-pond`, `east-edge`, and `turtle-portrait` at Low and High.

Expected: near vegetation changes density while horizon identity remains present on Low.

- [ ] Commit the vegetation-cell slice.

```sh
git add src/game/village/Vegetation.tsx src/game/village/vegetation tests/vegetationCells.test.ts tests/geometry.test.ts e2e/app.spec.ts
git commit -m "refactor: chunk vegetation into spatial cells"
```

## Task 7: Add deterministic scene probes and benchmark scenarios

**Files:**

- Create: `src/game/debug/probes.ts`
- Create: `src/game/debug/performanceMath.ts`
- Create: `src/game/config/benchmarkScenarios.ts`
- Create: `scripts/lib/graphicsCli.ts`
- Create: `tests/graphicsCli.test.ts`
- Create: `tests/sceneProbes.test.ts`
- Create: `tests/performanceMath.test.ts`
- Create: `visual/graphics.matrix.ts`
- Create: `scripts/benchmark-graphics.ts`
- Create: `e2e/assets.spec.ts`
- Modify: `src/game/world/WorldSystems.tsx`
- Modify: `src/game/config/benchmarks.ts`
- Modify: `visual/graphics.capture.ts`
- Modify: `playwright.visual.config.ts`
- Modify: `src/game/ui/hud/PerfOverlay.tsx`
- Modify: `tests/benchmarks.test.ts`
- Modify: `e2e/app.spec.ts`
- Modify: `package.json`

- [ ] Write `tests/sceneProbes.test.ts` for stable contributor merge order, duplicate contributor-ID rejection, unregister behavior, sorted asset/cell IDs, multiple named contributors within `sections.world`, duplicate section-leaf rejection, and a snapshot containing zero values instead of omitted render counters.

- [ ] Write `tests/performanceMath.test.ts` for p50/p95/p99 and renderer-memory estimates from texture variants. Import the nearest-rank `percentile()` implementation from `src/game/core/frameTimeStats.ts`; do not create a second percentile algorithm in the debug module.

- [ ] Run `pnpm exec vitest run tests/sceneProbes.test.ts tests/performanceMath.test.ts`.

Expected: FAIL because the debug modules do not exist.

- [ ] Add the probe contracts.

```ts
export interface SceneProbeSnapshot {
  activeCells: readonly CellKey[]
  retainedCells: readonly CellKey[]
  instancesByFamily: Readonly<Record<string, number>>
  lodsByFamily: Readonly<Record<string, Readonly<Record<string, number>>>>
  loadedAssetIds: readonly string[]
  fallbackAssetIds: readonly string[]
  decodedAssetBytesById: Readonly<Record<string, number>>
  renderer: {
    calls: number
    triangles: number
    points: number
    geometries: number
    textures: number
  }
  estimatedTextureBytes: number
  sections: ProbeSections
}

export interface TurtleProbeSection {
  readonly __sectionBrand?: 'turtle'
}
export interface WildlifeProbeSection {
  readonly __sectionBrand?: 'wildlife'
}
export interface AudioProbeSection {
  readonly __sectionBrand?: 'audio'
}
export interface AtmosphereProbeSection {
  readonly __sectionBrand?: 'atmosphere'
}
export interface WorldProbeSection {
  centerCell: CellKey
  activeCellCount: number
  retainedCellCount: number
  vegetationInstances: number
}

export interface ProbeSectionMap {
  turtle: TurtleProbeSection
  world: WorldProbeSection
  wildlife: WildlifeProbeSection
  audio: AudioProbeSection
  atmosphere: AtmosphereProbeSection
}

export type ProbeSections = { [K in keyof ProbeSectionMap]?: ProbeSectionMap[K] }
export type ProbeSectionName = keyof ProbeSectionMap
export type ProbeSectionContributor<K extends ProbeSectionName> = () => Partial<ProbeSectionMap[K]>

export type ProbeContributor = () => Partial<Omit<SceneProbeSnapshot, 'sections'>>
export function registerProbeContributor(name: string, contributor: ProbeContributor): () => void
export function registerProbeSection<K extends ProbeSectionName>(
  section: K,
  contributorId: string,
  contributor: ProbeSectionContributor<K>,
): () => void
export function collectSceneProbe(base: SceneProbeSnapshot): SceneProbeSnapshot
```

- [ ] Define the initial section interfaces with only Phase A fields (`WorldProbeSection` owns cell/vegetation counts; the other four contain only their optional brand). Later phases declaration-merge fields into the named section interface rather than adding unrelated top-level fields or casting contributor payloads; `ProbeSectionMap` remains the stable namespace map. Sort section contributors by ID before merging and throw if two contributors return the same leaf key, so Phase A spatial/vegetation and Phase C biome contributors can safely share `sections.world` without an ownership replacement.

- [ ] Register `sections.world` contributors as `registerProbeSection('world', 'spatial', ...)` and `registerProbeSection('world', 'vegetation', ...)`; register the asset manager through root contributor ID `assets`. Leave the optional turtle, wildlife, audio, and atmosphere sections absent until their phases register typed contributors. The asset contributor copies `decodedBytesById` into `decodedAssetBytesById` so browser tests prove that a resource decoded instead of merely fetching.

- [ ] Extend the one `TurtlebackDebug` interface in `WorldSystems.tsx` with `probe(): SceneProbeSnapshot`, `failAsset(id: string): boolean`, and `setBenchmarkVariant(variant: GraphicsBenchmarkVariant): boolean`. `failAsset()` delegates only to `assetFailureRouter.failNext(id)`; for the Phase A model/texture smoke records it also invalidates the smoke preload so the next quality transition reacquires it. `setBenchmarkVariant()` accepts only the shared CLI variant and changes only registered diagnostic presentation toggles. Install this global only when `import.meta.env.DEV || import.meta.env.VITE_TURTLEBACK_DIAGNOSTICS === '1'`; ordinary production browser and Electron bundles expose no mutation surface.

- [ ] Create `e2e/assets.spec.ts`: enter the sanctuary, await `window.__turtlebackDebug`, assert `model.pipeline-smoke` and `texture.pipeline-smoke` each have positive decoded bytes through `probe()`, call `failAsset('model.pipeline-smoke')`, switch quality to force preload reacquisition, and assert `procedural.debug-box` appears in `fallbackAssetIds` without a page error.

- [ ] Add these stable camera IDs to `BENCHMARKS`: `forest-interior`, `biome-threshold`, `wildlife-grouping`, `waterfall-rim`, `flipper-scale`, and `turtle-material-close`. Use safe current-shell coordinates now; Phases B-D must update the camera transforms when target geometry lands.

- [ ] Create scenario types in `benchmarkScenarios.ts`.

```ts
export type BenchmarkWeather = 'clear' | 'rain'

export interface BenchmarkScenario {
  id: string
  view: BenchmarkId
  quality: QualityLevel
  time: number
  weather: BenchmarkWeather
  warmupMs: number
  tags: readonly string[]
}

export const BENCHMARK_SCENARIOS: readonly BenchmarkScenario[]

export type GraphicsBenchmarkVariant = 'default' | 'no-ao'

export interface GraphicsBenchmarkCli {
  scenario: BenchmarkScenario['id'] | null
  variant: GraphicsBenchmarkVariant
}
```

- [ ] Encode the approved matrix: High noon clear/noon rain/sunset clear/night clear; Medium noon clear/night clear; Low noon-clear smoke plus dense-forest traversal; selected Ultra turtle/forest/wetland/village/ocean hero views. Tag only AO-review scenarios with `ao-review`; the canonical final turtle material scenario ID is `turtle-material-close-high-noon-clear`.

- [ ] Refactor `visual/graphics.capture.ts` to consume scenario data and save paths as `<quality>/<condition>/<view>.png`. Keep `visual/graphics.matrix.ts` pure so unit tests can verify coverage without launching a browser.

- [ ] Create the only graphics CLI parser in `scripts/lib/graphicsCli.ts` and test it in `tests/graphicsCli.test.ts`. Strip at most one leading package-manager `--`, then accept only zero or one `--scenario=<registered BENCHMARK_SCENARIOS ID>` and zero or one `--variant=default|no-ao`; absence means the full matrix and `default`. Reject unknown flags, positional arguments, duplicate flags, empty/unregistered scenario IDs, unsupported variants, and `no-ao` on a scenario without the `ao-review` tag before launching a browser. Export the parser and shared reference-ID parsing primitives for Phase F; desktop and soak scripts must extend this parser rather than create their own.

- [ ] Create `scripts/benchmark-graphics.ts` to parse arguments through that helper, warm the selected scenario or full matrix, apply the parsed variant through the canonical diagnostic seam, collect 60 seconds of frame deltas and scene probes, and write JSON under `test-results/graphics-benchmarks/`. Record both `scenarioId` and `variant` in every result so a no-AO artifact cannot be mistaken for default release evidence.

- [ ] Add package scripts.

```json
"benchmark:graphics": "tsx scripts/benchmark-graphics.ts",
"capture:graphics": "playwright test -c playwright.visual.config.ts"
```

- [ ] Update `PerfOverlay` to show p95 frame time, draw calls, triangles, active/retained cells, loaded assets, and estimated texture bytes at its existing low-frequency DOM refresh.

- [ ] Update `e2e/app.spec.ts` to call `probe()` before and after quality changes and assert live cell/resource/LOD differences.

- [ ] Run `pnpm exec vitest run tests/sceneProbes.test.ts tests/performanceMath.test.ts tests/benchmarks.test.ts tests/graphicsCli.test.ts`.

Expected: PASS and every scenario references a registered camera.

- [ ] Run `pnpm test:e2e -- e2e/app.spec.ts e2e/assets.spec.ts`.

Expected: PASS with live probe changes and fallback IDs visible after injection.

- [ ] Run `pnpm capture:graphics`.

Expected: the full matrix completes with deterministic directory names and no rejected camera IDs.

- [ ] Commit the probe/benchmark slice.

```sh
git add src/game/debug src/game/config/benchmarks.ts src/game/config/benchmarkScenarios.ts src/game/world/WorldSystems.tsx src/game/ui/hud/PerfOverlay.tsx visual playwright.visual.config.ts scripts/benchmark-graphics.ts scripts/lib/graphicsCli.ts package.json tests/sceneProbes.test.ts tests/performanceMath.test.ts tests/benchmarks.test.ts tests/graphicsCli.test.ts e2e/app.spec.ts e2e/assets.spec.ts
git commit -m "feat: expose deterministic graphics probes"
```

## Task 8: Close Phase A across web and packaged Electron

**Files:**

- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `DEPLOYMENT.md`
- Modify: `MANUAL_QA.md`
- Modify: `docs/performance-baseline.md`
- Modify: `scripts/smoke-desktop.mjs`

- [ ] Update `ARCHITECTURE.md` with the asset manager/lease lifecycle, spatial-cell subscription boundary, authored/static path resolution, and probe contributors.

- [ ] Update `README.md` and `DEPLOYMENT.md` to remove the zero-binary-asset claim, document `pnpm validate:assets`, and explain that authored assets remain relative under browser subpaths and Electron's secure `app:` origin.

- [ ] Add manual QA rows for Low/Medium/High/Ultra, cell-boundary traversal, fallback appearance, context loss/recovery, and GLB/KTX2 packaged loading.

- [ ] Extend `scripts/smoke-desktop.mjs` to verify the two pipeline-smoke assets are fetchable from `app://turtleback`, the KTX2 decoder initializes, and coordinated shutdown disposes the asset manager without renderer errors.

- [ ] Run `pnpm validate:assets:rendering`.

Expected: PASS with a synchronized license ledger and both smoke assets verified.

- [ ] Run `pnpm typecheck`.

Expected: PASS.

- [ ] Run `pnpm lint`.

Expected: PASS with no new warning promoted to an error.

- [ ] Run `pnpm test`.

Expected: all unit tests PASS.

- [ ] Run `pnpm build`.

Expected: strict typecheck, asset validation, decoder copy, and Vite production build all PASS.

- [ ] Run `pnpm test:e2e`.

Expected: all browser application, media, asset, quality, and traversal tests PASS.

- [ ] Run `pnpm capture:graphics`.

Expected: the approved scenario matrix completes; human review finds no missing horizon cells, broken color output, or fallback holes.

- [ ] Run `pnpm desktop:package` and `pnpm desktop:smoke`.

Expected: packaged startup/relaunch succeeds offline and the app protocol loads GLB, KTX2, Basis JS/WASM, and fallbacks.

- [ ] Run `pnpm benchmark:graphics` and append the measured Phase A scenario summary to `docs/performance-baseline.md` without claiming untested integrated/dedicated hardware acceptance.

- [ ] Commit the Phase A documentation and packaged gate.

```sh
git add README.md ARCHITECTURE.md DEPLOYMENT.md MANUAL_QA.md docs/performance-baseline.md scripts/smoke-desktop.mjs
git commit -m "docs: close rendering foundation phase"
```

## Phase A dependency and risk notes

- Auto is intentionally capped at High. Promoting Auto to Ultra requires measured headroom on named release hardware.
- Correct color handling changes all existing palette output; do not approve new palette values from pre-fix screenshots.
- The two pipeline-smoke binaries must be original/generated and registered; copied unlicensed test assets are not acceptable.
- Basis transcoder files are dependency runtime data, not authored content, but their Three.js license remains covered in the dependency ledger.
- A cached skinned GLTF scene cannot be mounted twice. Clone scene graphs per consumer and retain shared resources through leases.
- Current/neighbor-only loading would erase distant forest. Horizon-tree retention is part of this phase, not deferred polish.
- Cell tick rate, player maximum speed, and collider retain radius must preserve collision before reachability.
- SwiftShader captures prove shader/path correctness only. They are not evidence for the High 16.7 ms or Low 33.3 ms hardware contracts.
- The current Apple M5 fixed-view baseline remains useful comparison data but cannot substitute for the approved integrated- and dedicated-GPU reference paths.
