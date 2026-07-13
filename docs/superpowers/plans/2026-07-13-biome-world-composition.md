# Biome and World Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the 500-metre shell into six continuous, richly authored biome families and cell-streamed village districts while preserving analytic shell physics, every route and interaction contract, deterministic world behavior, accessibility, and Low-through-Ultra identity.

**Architecture:** Derive immutable habitat fields from the existing analytic shell, authored masks, and stable layout data; convert those fields into normalized biome weights; then compose deterministic 50-metre cells from registered vegetation and prop catalogs. Generate a quality-independent canonical cell first and filter only decorative importance/LOD for each quality tier so colliders and geography never change. Keep React responsible for mounted cell resources while pure TypeScript owns field sampling, exclusions, composition, residency, and quality selection.

**Tech Stack:** React 19, TypeScript 5.9, React Three Fiber, Three.js instancing and LODs, Rapier simplified colliders, Vitest, Playwright, glTF/GLB, Meshopt, KTX2/Basis, the project asset registry, analytic shell fields, seeded RNG, mutable frame runtime, and existing village `BuildPlan` fallbacks.

---

## Scope and invariants

This plan consumes the Phase A spatial/vegetation foundation and implements Phase C biome/village composition from `docs/superpowers/specs/2026-07-13-sanctuary-graphics-audio-overhaul-design.md`. Tasks 1-7 extend that foundation into the contracts needed before the turtle plan assembles its complete bow vertical slice. The rendering/material foundation must land before Task 9 imports authored terrain texture arrays.

The implementation must preserve these contracts:

- `terrainHeight()` remains the only walkable height source. The visible shell grid and Rapier trimesh use identical positions and indices.
- Building IDs, kinds, interactions, interior definitions, zone IDs, media features, home settings, `HOME_SPAWN`, and save data remain stable.
- Existing route coordinates remain unchanged until a route-specific test and paintover justify a change. A route change updates map, splat, exclusions, traversal architecture, lamps, footsteps, safe positions, benchmarks, and E2E in one commit.
- Quality changes never add/remove a structural collider, route, biome, building, landmark, or major wildlife category.
- Reduced Motion affects wind, mist, water, hanging props, and event response, not geometry or collision.
- Every biome has three navigation silhouettes, canopy/mid-story/understory/ground/deadfall coverage on High, two prop-cluster families, characteristic wildlife, and a distinct ambient bed.
- Hard biome borders and whole-world non-culled instance meshes are release blockers.

### Authored environment asset contract

The following packs are required and registered before their biome task closes:

| Biome            | Vegetation pack                                               | Prop pack                                           | Material directory                            |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Crownwood        | `public/assets/models/vegetation/crownwood-vegetation.glb`    | `public/assets/models/props/crownwood-props.glb`    | `public/assets/textures/biomes/crownwood/`    |
| Lumenfen         | `public/assets/models/vegetation/lumenfen-vegetation.glb`     | `public/assets/models/props/lumenfen-props.glb`     | `public/assets/textures/biomes/lumenfen/`     |
| Blossomshade     | `public/assets/models/vegetation/blossomshade-vegetation.glb` | `public/assets/models/props/blossomshade-props.glb` | `public/assets/textures/biomes/blossomshade/` |
| Fernfall         | `public/assets/models/vegetation/fernfall-vegetation.glb`     | `public/assets/models/props/fernfall-props.glb`     | `public/assets/textures/biomes/fernfall/`     |
| Galecrest        | `public/assets/models/vegetation/galecrest-vegetation.glb`    | `public/assets/models/props/galecrest-props.glb`    | `public/assets/textures/biomes/galecrest/`    |
| Hearth Clearings | `public/assets/models/vegetation/hearth-vegetation.glb`       | `public/assets/models/props/hearth-props.glb`       | `public/assets/textures/biomes/hearth/`       |

Each vegetation pack supplies close/medium/distant nodes for every major plant family and stable node metadata for layer, footprint, wind behavior, wetness, shadow importance, and collider proxy. Each prop pack supplies stable cluster-anchor and footprint metadata. Crownwood additionally supplies `public/assets/textures/biomes/crownwood/crownwood-canopy-impostor.ktx2`. Every material directory contains mipmapped KTX2 base-color, normal, and roughness/AO/mask textures at the registry's Low/Medium/High/Ultra tiers.

All external or generated assets must have registry checksums, decoded-size estimates, source/generation records, redistribution-compatible licenses, attribution text, LOD chains, preload regions, material capabilities, and procedural fallbacks. `pnpm validate:assets`, `pnpm validate:assets:world`, and `pnpm write:asset-licenses` must fail on schema, registry, world-pack, binary, or ledger omissions; the global final-inventory gate remains reserved for Phase F.

## Task 1: Freeze the analytic terrain and layout baseline

**Files:**

- Create: `src/game/world/shell/terrainMesh.ts`
- Modify: `src/game/world/shell/ShellTerrain.tsx`
- Create: `tests/terrainContract.test.ts`
- Create: `tests/worldLayout.test.ts`

- [ ] Write `terrainContract.test.ts` with golden `terrainHeight()` samples at `HOME_SPAWN`, the plaza, every building centre, every deck centre, every water feature, and both endpoints of every `TRAVERSAL_SPANS` entry.

- [ ] Add a test that every generated shell mesh vertex has `y === terrainHeight(x, z)` inside the walkable rim and that the returned render positions are the exact array passed to the Rapier collider.

- [ ] Write `worldLayout.test.ts` to assert unique building/district/span/water IDs, all pads and route nodes stay on the shell, the home ID/kind and `HOME_SPAWN` relationship remain stable, and all current buildings connect to the route graph.

- [ ] Run `pnpm exec vitest run tests/terrainContract.test.ts tests/worldLayout.test.ts`; expected result is a missing `terrainMesh.ts` failure while existing layout assertions pass.

- [ ] Extract the private grid builder from `ShellTerrain.tsx` into this API without changing constants or arithmetic:

```ts
export interface ShellTerrainData {
  geometry: BufferGeometry
  vertices: Float32Array
  indices: Uint32Array
}

export interface ShellTerrainOptions {
  step: number
  margin: number
}

export function buildShellTerrainData(options: ShellTerrainOptions): ShellTerrainData
```

- [ ] Make `ShellTerrain.tsx` consume the returned `geometry`, `vertices`, and `indices` for both mesh and `TrimeshCollider`.

- [ ] Run `pnpm exec vitest run tests/terrainContract.test.ts tests/worldLayout.test.ts tests/traversal.test.ts`; expected result is all tests passing with golden heights unchanged.

- [ ] Commit the frozen world contract:

```bash
git add src/game/world/shell/terrainMesh.ts src/game/world/shell/ShellTerrain.tsx tests/terrainContract.test.ts tests/worldLayout.test.ts
git commit -m "test: lock analytic shell and layout contracts"
```

## Task 2: Bind Phase A spatial cells to shell and biome context

**Files:**

- Read: `src/game/world/spatial/types.ts`
- Read: `src/game/world/spatial/cells.ts`
- Read: `src/game/world/spatial/SpatialCellProvider.tsx`
- Create: `src/game/world/biomes/cellContext.ts`
- Test: `tests/biomeCellContext.test.ts`

- [ ] Run the Phase A residency contract first with `pnpm exec vitest run tests/spatialCells.test.ts`; expected result is a passing canonical `CellKey`, `CellCoord { ix, iz }`, `SpatialGridConfig`, `SpatialCellTracker`, hysteresis, active-neighbor, retain-window, and deterministic-order suite. Stop if those prerequisites are absent or red.

- [ ] Write `tests/biomeCellContext.test.ts` to require a stable shell-cell enumeration, unique ordered keys, coverage of every sampled point for which `isInsideShell()` is true, exclusion of cells with zero shell coverage, and inclusion of every building, path node, water feature, traversal span, and biome anchor in exactly one descriptor.

- [ ] Run `pnpm exec vitest run tests/biomeCellContext.test.ts`; expected result is failure because `cellContext.ts` does not exist.

- [ ] Implement this API by importing the Phase A spatial types and functions; do not create a second cell coordinate or residency class:

```ts
export interface BiomeCellDescriptor {
  key: CellKey
  coord: CellCoord
  bounds: readonly [minX: number, minZ: number, maxX: number, maxZ: number]
  shellCoverage: number
  samplePoints: readonly (readonly [number, number])[]
  districtIds: readonly string[]
}

export function describeBiomeCell(coord: CellCoord): BiomeCellDescriptor | null
export function enumerateShellCells(): readonly BiomeCellDescriptor[]
```

- [ ] Derive bounds with Phase A `cellBounds()`, sample coverage with `isInsideShell()`, and sort descriptors by canonical `CellKey`. Keep descriptors immutable and independent of asset load order.

- [ ] Run `pnpm exec vitest run tests/spatialCells.test.ts tests/biomeCellContext.test.ts`; expected result is both the single residency implementation and biome descriptor coverage passing.

- [ ] Commit the biome cell-context seam:

```bash
git add src/game/world/biomes/cellContext.ts tests/biomeCellContext.test.ts
git commit -m "feat: bind spatial cells to biome context"
```

## Task 3: Define biome registry and continuous habitat fields

**Files:**

- Create: `src/game/world/biomes/types.ts`
- Create: `src/game/world/biomes/masks.ts`
- Create: `src/game/world/biomes/fields.ts`
- Create: `src/game/world/biomes/registry.ts`
- Test: `tests/biomeFields.test.ts`
- Test: `tests/biomeTransitions.test.ts`

- [ ] Write field tests for elevation, slope, moisture, exposure, rim distance, path distance, and district influence at representative shell coordinates.

- [ ] Write transition tests that sample 1 m steps across every authored mask, require weights to sum to one within `1e-6`, reject any single-step weight jump above `0.12`, and require all six biomes to dominate at least one valid shell sample.

- [ ] Run both test files; expected result is failure because the biome modules do not exist.

- [ ] Add the following core model:

```ts
export type BiomeId =
  'crownwood' | 'lumenfen' | 'blossomshade' | 'fernfall' | 'galecrest' | 'hearth-clearing'

export type VegetationLayer = 'canopy' | 'midstory' | 'understory' | 'ground' | 'deadfall'

export interface HabitatSample {
  elevation: number
  slope: number
  moisture: number
  exposure: number
  rimDistance: number
  pathDistance: number
  districtId: string | null
}

export type BiomeWeights = Readonly<Record<BiomeId, number>>

export interface BiomeDefinition {
  id: BiomeId
  terrainMaterials: readonly AssetId[]
  vegetationFamilies: readonly string[]
  propFamilies: readonly string[]
  wildlifeGroups: readonly string[]
  ambientBed: AssetId
  musicTags: readonly string[]
  transitionPartners: readonly BiomeId[]
  navigationSilhouettes: readonly string[]
}

export const BIOME_REGISTRY: Readonly<Record<BiomeId, BiomeDefinition>>
export function sampleHabitatFields(x: number, z: number): HabitatSample
export function sampleBiomeWeights(sample: HabitatSample): BiomeWeights
export function dominantBiome(weights: BiomeWeights): BiomeId
```

- [ ] Author immutable masks with these initial anchors: Crownwood along the raised central spine; Lumenfen around `(-52, 80)`, drainage, and bathhouse runoff; Blossomshade around home/cottages/gardens; Fernfall beside the observatory approach around `z=120..165`; Galecrest from rim/exposure; Hearth Clearings from civic/building/deliberate-vista influence.

- [ ] Blend masks through feathered signed-distance functions and shared-species transition weights; do not use nearest-region assignment.

- [ ] Run `pnpm exec vitest run tests/biomeFields.test.ts tests/biomeTransitions.test.ts`; expected result is normalized, continuous, deterministic fields with all biome coverage assertions passing.

- [ ] Commit the biome field model:

```bash
git add src/game/world/biomes/types.ts src/game/world/biomes/masks.ts src/game/world/biomes/fields.ts src/game/world/biomes/registry.ts tests/biomeFields.test.ts tests/biomeTransitions.test.ts
git commit -m "feat: define continuous shell biome fields"
```

## Task 4: Centralize placement exclusions and safe sightlines

**Files:**

- Create: `src/game/world/composition/exclusions.ts`
- Create: `src/game/config/composition.ts`
- Test: `tests/placementExclusions.test.ts`

- [ ] Write tests covering building pads, yaw-transformed door approaches, primary/secondary path widths, bridge/stair/ramp landings, interaction circles, water, `HOME_SPAWN`, safe respawn radius, and benchmark sightline polygons.

- [ ] Assert a structural tree footprint is rejected more conservatively than ground cover and that a decorative prop may never overlap a traversal landing.

- [ ] Run `pnpm exec vitest run tests/placementExclusions.test.ts`; expected result is a missing-module failure.

- [ ] Implement pure shape data and queries:

```ts
export type PlacementLayer = VegetationLayer | 'prop' | 'structural-tree' | 'wildlife'

export interface PlacementCandidate {
  x: number
  z: number
  radius: number
  layer: PlacementLayer
}

export interface PlacementExclusion {
  id: string
  kinds: readonly PlacementLayer[]
  contains(x: number, z: number, radius: number): boolean
}

export function buildWorldExclusions(): readonly PlacementExclusion[]
export function placementAllowed(
  candidate: PlacementCandidate,
  exclusions: readonly PlacementExclusion[],
): boolean
```

- [ ] Put authored safe vista polygons and route widths in `config/composition.ts`; derive building, span, water, and spawn exclusions from their existing source data.

- [ ] Run `pnpm exec vitest run tests/placementExclusions.test.ts tests/traversal.test.ts`; expected result is all exclusions passing without changing current traversal.

- [ ] Commit the shared exclusion contract:

```bash
git add src/game/world/composition/exclusions.ts src/game/config/composition.ts tests/placementExclusions.test.ts
git commit -m "feat: protect traversal and composed sightlines"
```

## Task 5: Compose canonical deterministic biome cells

**Files:**

- Create: `src/game/world/biomes/compositor.ts`
- Create: `src/game/world/biomes/qualitySelection.ts`
- Test: `tests/biomeCompositor.test.ts`
- Test: `tests/worldQuality.test.ts`

- [ ] Write tests that compose the same cell twice, compose cells in reversed order, and compose neighboring cells through independent calls. Require identical transforms and no duplicate stable instance IDs.

- [ ] Test clustered rather than uniform placement, exclusion compliance, terrain-height alignment, slope limits, stable biome/layer quotas, and invariant collidable-instance IDs across all quality tiers.

- [ ] Test that Low retains each biome's navigation silhouettes, five layer identities through reduced representatives, and both signature prop families.

- [ ] Run both tests; expected result is failure for missing compositor exports.

- [ ] Implement this canonical output:

```ts
export type Importance = 0 | 1 | 2 | 3

export interface ColliderProxy {
  kind: 'cylinder' | 'box'
  size: readonly [number, number, number]
  offset: readonly [number, number, number]
}

export interface ComposedInstance {
  id: string
  assetId: AssetId
  layer: VegetationLayer | 'prop'
  position: readonly [number, number, number]
  yaw: number
  scale: number
  importance: Importance
  collider?: ColliderProxy
}

export interface ComposedCell {
  key: CellKey
  biomeWeights: BiomeWeights
  instances: readonly ComposedInstance[]
}

export interface ComposeBiomeCellInput {
  worldSeed: number
  coord: CellCoord
  exclusions: readonly PlacementExclusion[]
}

export function composeBiomeCell(input: ComposeBiomeCellInput): ComposedCell
export function selectCellForQuality(
  cell: ComposedCell,
  budget: VegetationQualityBudget,
): ComposedCell
```

- [ ] Seed each cell/family/layer from `worldSeed`, `CellKey`, biome ID, and family ID. Never consume one global sequential RNG across cells.

- [ ] Generate the canonical cell without a quality argument. Mark structural navigation/collision instances `importance: 0`; quality selection may filter only non-structural instances and choose LOD/texture/shadow policy later.

- [ ] Run `pnpm exec vitest run tests/biomeCompositor.test.ts tests/worldQuality.test.ts`; expected result is deterministic output, load-order independence, no exclusion violations, and invariant colliders.

- [ ] Commit deterministic composition:

```bash
git add src/game/world/biomes/compositor.ts src/game/world/biomes/qualitySelection.ts tests/biomeCompositor.test.ts tests/worldQuality.test.ts
git commit -m "feat: compose deterministic biome cells"
```

## Task 6: Add structured world budgets to every quality profile

**Files:**

- Modify: `src/game/core/quality.ts`
- Modify: `tests/quality.test.ts`

- [ ] Run `pnpm exec vitest run tests/quality.test.ts tests/settings.test.ts`; expected result is the Phase A four-level settings migration, p95 governor, explicit Ultra, monotonic base budgets, and Auto-at-High ceiling all passing. Do not add those contracts a second time.

- [ ] Extend failing quality tests to cover monotonic canopy, mid-story, understory, ground, deadfall, shadow-radius, wind-radius, and impostor-distance budgets, plus structural collider invariance and no biome identity loss.

- [ ] Run `pnpm exec vitest run tests/quality.test.ts tests/worldQuality.test.ts`; expected result is failure because Phase A exposes broad density/LOD/cell budgets but not per-layer world-composition budgets.

- [ ] Extend the existing Phase A public types without redefining `QualityLevel`, settings, or the governor:

```ts
export interface VegetationQualityBudget {
  densityByLayer: Readonly<Record<VegetationLayer, number>>
  lodBias: 0 | 1 | 2
  shadowRadius: number
  windRadius: number
  impostorStart: number
}

export interface QualityProfile {
  // Preserve every Phase A field, including level, textureTier,
  // cellLoadRadius, cellRetainRadius, and broad density/LOD budgets.
  vegetation: VegetationQualityBudget
}
```

- [ ] Map the existing Phase A broad vegetation density and LOD bias into the nested layer budget, retain the Phase A cell load/retain values as the sole streaming budget, and keep canonical structural-tree collider IDs identical across all four profiles.

- [ ] Run `pnpm exec vitest run tests/quality.test.ts tests/settings.test.ts tests/worldQuality.test.ts`; expected result is passing Phase A settings/governor tests plus the new layer monotonicity and collider-invariance tests.

- [ ] Commit world quality budgets:

```bash
git add src/game/core/quality.ts tests/quality.test.ts tests/worldQuality.test.ts
git commit -m "feat: add scalable world quality budgets"
```

## Task 7: Publish live biome context and cell-chunk existing vegetation

**Files:**

- Create: `src/game/world/vegetation/proceduralFallbackCatalog.ts`
- Create: `src/game/world/vegetation/VegetationCell.tsx`
- Create: `src/game/world/vegetation/VegetationWorld.tsx`
- Create: `src/game/world/biomes/BiomeWorld.tsx`
- Modify: `src/game/core/runtime.ts`
- Modify: `src/game/core/FrameDriver.tsx`
- Modify: `src/game/village/Vegetation.tsx`
- Modify: `src/game/world/TurtleWorld.tsx`
- Test: `tests/vegetationCells.test.ts`
- Test: `tests/biomeRuntimeContext.test.ts`
- Test: `e2e/worldResources.spec.ts`

- [ ] Run the Phase A `tests/vegetationCells.test.ts` first; expected result is parity for the current procedural grass, flowers, bushes, rocks, and trees, deterministic 50 m partitions, real bounds/frustum culling, horizon retention, and disposal. Stop if the prerequisite is absent or red.

- [ ] Extend that suite with failing catalog-adapter tests: every Phase A procedural family maps to a stable fallback catalog ID, composed biome transforms preserve Phase A exclusions, and the compatibility wrapper renders no parallel whole-world mesh.

- [ ] Write `tests/biomeRuntimeContext.test.ts` first. Assert that a fixed low-frequency update maps the prior authoritative player transform to the Phase A `CellKey`, normalized six-biome weights, dominant `BiomeId`, and bounded resident-cell list; verify a biome threshold changes weights continuously and repeated ticks allocate no unbounded history.

- [ ] Add E2E resource assertions for active cell keys, per-cell family counts, non-empty bounds, `frustumCulled === true`, and disposal after walking beyond retain hysteresis.

- [ ] Extract the Phase A procedural geometry/material factories into `proceduralFallbackCatalog.ts`; preserve their appearance and make each family addressable through the same catalog interface as authored assets.

- [ ] Render one bounded instanced mesh per active cell/family/LOD in `VegetationCell.tsx`. Compute geometry bounds, allow real frustum culling, lease registry resources, and dispose leases/instance buffers on cell unload.

- [ ] `VegetationWorld.tsx` subscribes to the Phase A `SpatialCellProvider`, composes canonical cells, quality-filters them, and mounts only active/retained cell components. It does not create another tracker or store transforms in Zustand.

- [ ] Add the shared runtime contract now, before the Phase B music/ambience pilot:

```ts
export interface RuntimeWorldContext {
  currentCell: CellKey
  activeBiomeWeights: BiomeWeights
  dominantBiome: BiomeId
  residentCells: readonly CellKey[]
}
```

- [ ] Create one `BiomeWorld` that samples the prior authoritative player transform at a fixed 5 Hz, queries the Task 3 biome field and Phase A spatial snapshot, and mutates `runtime.world` in place. Mount it in `TurtleWorld` before vegetation, wildlife, and ambience consumers. This is the only live biome-context producer; later phases extend it rather than adding an audio-only or wildlife-only context loop.

- [ ] Change the old `Vegetation()` export into a temporary compatibility wrapper around `VegetationWorld`, update `TurtleWorld`, and do not raise counts in this task.

- [ ] Run `pnpm exec vitest run tests/vegetationCells.test.ts tests/biomeCompositor.test.ts tests/biomeRuntimeContext.test.ts` and `pnpm exec playwright test e2e/worldResources.spec.ts`; expected result is parity counts, active culling, live Crownwood/Galecrest context for later pilot consumers, and observed disposal.

- [ ] Commit the prerequisite chunking pass:

```bash
git add src/game/world/vegetation/proceduralFallbackCatalog.ts src/game/world/vegetation/VegetationCell.tsx src/game/world/vegetation/VegetationWorld.tsx src/game/world/biomes/BiomeWorld.tsx src/game/core/runtime.ts src/game/core/FrameDriver.tsx src/game/village/Vegetation.tsx src/game/world/TurtleWorld.tsx tests/vegetationCells.test.ts tests/biomeRuntimeContext.test.ts e2e/worldResources.spec.ts
git commit -m "refactor: stream vegetation with live biome context"
```

## Task 8: Establish the authored-pack pipeline and import the hero-slice biomes

**Files:**

- Create: `src/game/world/vegetation/catalog.ts`
- Create: `src/game/world/props/catalog.ts`
- Create: `scripts/blender/export-world-packs.py`
- Create: `scripts/validate-world-packs.mjs`
- Add: Crownwood/Galecrest Blender scenes, provenance, and export settings under `art-source/world/`
- Add: Crownwood/Galecrest contact sheets and signoffs under `docs/art-review/world/`
- Modify: `src/game/assets/manifest.json`
- Modify: `ASSET_LICENSES.md`
- Modify: `package.json`
- Add: Crownwood and Galecrest GLB/KTX2 paths from the authored environment asset table
- Test: `tests/worldAssetCatalog.test.ts`

- [ ] Write catalog tests that accept an explicit required-biome set. For the hero-slice gate, require every Crownwood/Galecrest vegetation and prop family to resolve to a real pack node, three ordered LODs for major plant families, valid footprints, a procedural fallback, allowed license, and material capabilities. Also require registered definitions and procedural fallbacks for the remaining four biomes without pretending their authored binaries already exist.

- [ ] Run `pnpm exec vitest run tests/worldAssetCatalog.test.ts`; expected result is failure listing unresolved families.

- [ ] Before modeling, create `art-source/world/<kind>/<biome>/SOURCE.md` for Crownwood and Galecrest vegetation/props. Record either original/generated provenance with retained prompts, references, generation settings, author, and edit history, or redistributable-source author, URL, license text, attribution, download date, and modifications. Mirror the approved provenance in `src/game/assets/manifest.json`.

- [ ] Retain one source scene and settings record at `art-source/world/vegetation/<biome>/<biome>-vegetation.blend`, `art-source/world/vegetation/<biome>/export-settings.json`, `art-source/world/props/<biome>/<biome>-props.blend`, and `art-source/world/props/<biome>/export-settings.json` for `crownwood` and `galecrest`. Tasks 13 and 14 apply the identical contract to the other four biomes.

- [ ] Freeze this complete required family-ID roster before allowing optional variants. Deliver the Crownwood/Galecrest rows in this task; deliver Lumenfen/Fernfall in Task 13 and Blossomshade/Hearth in Task 14:

  - Crownwood: `crownwood-conifer-a`, `crownwood-conifer-b`, `crownwood-conifer-c`, `crownwood-sapling`, `crownwood-fern-a`, `crownwood-fern-b`, `crownwood-moss`, `crownwood-nurse-log`, `crownwood-root-shelf`, `crownwood-mushroom-colony`, `crownwood-stone-outcrop`.
  - Lumenfen: `lumenfen-willow`, `lumenfen-reed`, `lumenfen-cattail`, `lumenfen-lily`, `lumenfen-water-plant`, `lumenfen-luminous-fungi`, `lumenfen-wet-stone`, `lumenfen-driftwood`, `lumenfen-drainage-cluster`.
  - Blossomshade: `blossom-oak-a`, `blossom-oak-b`, `blossom-orchard-tree`, `blossom-hedge`, `blossom-sapling`, `blossom-flower-drift`, `blossom-planter-cluster`, `blossom-garden-clutter`.
  - Fernfall: `fernfall-canopy-tree`, `fernfall-giant-fern-a`, `fernfall-giant-fern-b`, `fernfall-fern-bank`, `fernfall-moss-ground`, `fernfall-root-steps`, `fernfall-fallen-timber`, `fernfall-fissure-rock`, `fernfall-runnel-cluster`.
  - Galecrest: `galecrest-wind-pine-a`, `galecrest-wind-pine-b`, `galecrest-salt-grass`, `galecrest-edge-shrub`, `galecrest-salt-rock`, `galecrest-shell-fragments`, `galecrest-driftwood`.
  - Hearth Clearings: `hearth-shade-tree`, `hearth-orchard-tree`, `hearth-hedge`, `hearth-flower-border`, `hearth-market-goods`, `hearth-cart`, `hearth-bench-lantern-sign`, `hearth-woodpile-tools`, `hearth-planter-cluster`.

- [ ] Build believable metre-scale silhouettes with grounded pivots and separate `LOD0`, `LOD1`, and `LOD2` collections for every major tree/plant family. Use measured retopology budgets: hero canopy trees LOD0 35k-70k triangles, LOD1 10k-22k, LOD2 2k-5k; secondary trees LOD0 20k-40k, LOD1 6k-14k, LOD2 1k-3k; shrubs/ferns LOD0 3k-12k, LOD1 1k-4k, LOD2 300-1k; individual rocks/logs/cluster pieces LOD0 at or below 20k with LOD1 at or below 40 percent and LOD2 at or below 12 percent of LOD0.

- [ ] UV hero bark/rock/walking-height props at 512 px per metre and secondary vegetation/ground props at 256 px per metre. Bake source base color, tangent-space normal, and packed roughness/AO/masks; use 4K source/runtime only for selected Ultra hero trees/rocks, 2K for High and most Ultra assets, 1K Medium, and 512 Low. Derive lower tiers from the approved source bake and encode mipmapped KTX2 through the pinned repository texture toolchain.

- [ ] Encode wind and grounding consistently: `COLOR_0.r` is wind weight, `COLOR_0.g` is branch/leaf phase, `COLOR_0.b` is baked grounding/AO, and `COLOR_0.a` is wetness response. Validate vertex channels, normals, tangents, alpha cutout margins, leaf-shell thickness, billboard orientation, and collider-proxy metadata. Close/medium foliage may use shaped alpha cutouts but may not expose opaque rectangular cards, bright mip halos, or backface disappearance from normal walking angles.

- [ ] Implement the deterministic Blender exporter and run both pack kinds for each biome. Example commands:

```bash
blender --background art-source/world/vegetation/crownwood/crownwood-vegetation.blend --python scripts/blender/export-world-packs.py -- vegetation crownwood
blender --background art-source/world/props/crownwood/crownwood-props.blend --python scripts/blender/export-world-packs.py -- props crownwood
```

The exporter writes only the exact `public/assets/models/vegetation/` and `public/assets/models/props/` pack paths and fails on unapplied transforms, wrong units, missing required family/LOD collections, invalid vertex channels, missing footprints/collider proxies, or non-decreasing LOD counts. Run the equivalent two commands for Galecrest in this task; Tasks 13 and 14 run the remaining four biomes. If the implementing environment cannot run the approved Blender version and pinned texture encoder, stop at this named external-authoring gate and do not substitute procedural primitives as final authored packs.

- [ ] Optimize exported geometry with Meshopt while preserving node/family names, pivots, attributes, bounds, and metadata. Generate the Crownwood canopy impostor only after LOD2 approval and validate its view angles, alpha, lighting response, and horizon color against the real crown geometry.

- [ ] Render `silhouette-contact-sheet.png`, `materials-contact-sheet.png`, and `lod-wind-contact-sheet.png` for Crownwood and Galecrest into `docs/art-review/world/<biome>/` plus a signed `README.md` review record. Review metre scale, recognizable silhouettes, texture stretching, wet/dry response, alpha/mip halos, wind deformation, grounding, collider footprint, shadow behavior, and LOD/impostor pop under noon, rain, sunset, night, and Low/High profiles.

- [ ] Implement `validate-world-packs.mjs` to parse pack nodes and fail on missing LODs, duplicate family IDs, increasing triangle counts, bounds drift above 5 percent, missing fallback, unsupported texture format, missing license, or paths outside `public/assets/`.

- [ ] Export immutable catalogs:

```ts
export interface VegetationFamily {
  id: string
  biomeIds: readonly BiomeId[]
  layer: VegetationLayer
  lodAssetIds: readonly [AssetId, AssetId, AssetId]
  fallbackAssetId: AssetId
  footprintRadius: number
  slopeLimit: number
  wind: 'none' | 'branch' | 'leaf' | 'grass'
  collider?: ColliderProxy
}

export const VEGETATION_CATALOG: ReadonlyMap<string, VegetationFamily>
export const PROP_CATALOG: ReadonlyMap<string, PropFamily>
```

- [ ] Add the exact package script `"validate:assets:world": "node scripts/validate-world-packs.mjs"`. Make `validate-world-packs.mjs` accept an optional leading `--` delimiter followed only by `--required-biomes=<comma-separated world-pack slugs>` and reject every other flag. The allowed pack slugs are exactly `crownwood`, `galecrest`, `lumenfen`, `fernfall`, `blossomshade`, and `hearth`; `hearth` maps to runtime `BiomeId` `hearth-clearing`. This is the specialized GLB/catalog/review gate; it must not forward biome flags to Phase A's shared CLI, whose slice values remain only `rendering|world|audio`. Run `pnpm validate:assets`, `pnpm validate:assets:world -- --required-biomes=crownwood,galecrest`, `pnpm write:asset-licenses`, and `pnpm exec vitest run tests/worldAssetCatalog.test.ts`; expected result is every hero-slice pack, LOD, texture, license, fallback, and generated ledger entry passing while absent later-biome binaries remain explicit procedural fallbacks.

- [ ] Commit the authored world vocabulary:

```bash
git add art-source/world docs/art-review/world scripts/blender/export-world-packs.py public/assets/models/vegetation public/assets/models/props public/assets/textures/biomes src/game/world/vegetation/catalog.ts src/game/world/props/catalog.ts src/game/assets/manifest.json scripts/validate-world-packs.mjs ASSET_LICENSES.md package.json pnpm-lock.yaml tests/worldAssetCatalog.test.ts
git commit -m "assets: add validated hero-slice world packs"
```

## Task 9: Feed biome blends into shell terrain materials

**Files:**

- Create: `src/game/world/shell/biomeAttributes.ts`
- Modify: `src/game/world/shell/terrainMesh.ts`
- Modify: `src/game/world/shell/ShellTerrain.tsx`
- Modify: `src/game/world/shell/shellShape.ts`
- Test: `tests/terrainBiomeAttributes.test.ts`
- Test: `tests/terrainContract.test.ts`

- [ ] Write tests that every shell vertex receives two valid biome indices plus a blend factor, path overlay remains independent, neighboring vertex blends are continuous, and positions/indices remain bit-identical to the frozen baseline.

- [ ] Run both tests; expected result is failure only for missing biome attributes.

- [ ] Implement:

```ts
export interface PackedBiomeBlend {
  primary: BiomeId
  secondary: BiomeId
  blend: number
  path: number
  rock: number
}

export function samplePackedBiomeBlend(x: number, z: number): PackedBiomeBlend
export function buildBiomeAttributes(vertices: Float32Array): {
  indices: Uint8Array
  weights: Float32Array
}
```

- [ ] Add attributes to the existing geometry without changing vertex positions. Blend registered terrain material arrays in the shell shader with projection-safe world scale, macro variation, wetness, and path overlays.

- [ ] Keep `sampleSurfaceAt()` compatible and extend `FootSurface` only when a new audible surface has a corresponding tested SFX implementation.

- [ ] Run `pnpm exec vitest run tests/terrainBiomeAttributes.test.ts tests/terrainContract.test.ts tests/wetness.test.ts`; expected result is correct blends, unchanged physics, and working rain response.

- [ ] Commit biome terrain presentation:

```bash
git add src/game/world/shell/biomeAttributes.ts src/game/world/shell/terrainMesh.ts src/game/world/shell/ShellTerrain.tsx src/game/world/shell/shellShape.ts tests/terrainBiomeAttributes.test.ts tests/terrainContract.test.ts
git commit -m "feat: blend biome materials on analytic terrain"
```

## Task 10: Give paths stable IDs and retain compatibility

**Files:**

- Modify: `src/game/config/layout.ts`
- Modify: `src/game/world/shell/shellShape.ts`
- Modify: `src/game/ui/menus/MapPanel.tsx`
- Modify: `src/game/village/Village.tsx`
- Modify: `tests/worldLayout.test.ts`
- Modify: `tests/traversal.test.ts`

- [ ] Add failing tests for unique path IDs, positive widths, connected route graph, exact compatibility between `PATH_SPECS.map(nodes)` and `PATHS`, and stable current coordinates.

- [ ] Run `pnpm exec vitest run tests/worldLayout.test.ts tests/traversal.test.ts`; expected result is failure because `PATH_SPECS` does not exist.

- [ ] Add the public migration shape:

```ts
export interface PathSpec {
  id: string
  nodes: readonly PathNode[]
  width: number
  role: 'primary' | 'secondary' | 'ravine' | 'deck'
}

export const PATH_SPECS: readonly PathSpec[]
export const PATHS: readonly (readonly PathNode[])[] = PATH_SPECS.map((path) => path.nodes)
```

- [ ] Name every current route, including `bow-overlook-spine`, `home-bow-shortcut`, `plaza-market-loop`, `garden-observatory`, and every deck connection. Preserve all coordinates in this commit.

- [ ] Make path splatting, map rendering, lamp collection, and exclusions consume `PATH_SPECS` widths/roles rather than implicit global margins.

- [ ] Run `pnpm exec vitest run tests/worldLayout.test.ts tests/traversal.test.ts tests/benchmarks.test.ts`; expected result is compatibility and connectivity passing.

- [ ] Commit path identity migration:

```bash
git add src/game/config/layout.ts src/game/world/shell/shellShape.ts src/game/ui/menus/MapPanel.tsx src/game/village/Village.tsx tests/worldLayout.test.ts tests/traversal.test.ts
git commit -m "refactor: give sanctuary routes stable identities"
```

## Task 11: Stream outdoor village composition by cell

**Files:**

- Create: `src/game/village/composition/types.ts`
- Create: `src/game/village/composition/registry.ts`
- Create: `src/game/village/composition/composeVillageCell.ts`
- Create: `src/game/village/composition/VillageComposition.tsx`
- Modify: `src/game/village/Village.tsx`
- Modify: `src/game/village/traversal.ts`
- Test: `tests/villageComposition.test.ts`

- [ ] Write tests that migrate every current `buildDistrictDressing()` cluster to a stable anchor, assign it to one cell, preserve seats/chime/surfaces/interactions, reject exclusion overlap, and keep each district's three navigation silhouettes.

- [ ] Run `pnpm exec vitest run tests/villageComposition.test.ts`; expected result is failure because the composition registry is absent.

- [ ] Define stable data:

```ts
export interface PropClusterAnchor {
  id: string
  family: string
  districtId: string
  position: readonly [number, number]
  yaw: number
  exclusionRadius: number
  importance: Importance
}

export interface VillageCellComposition {
  key: CellKey
  anchors: readonly PropClusterAnchor[]
  surfaces: readonly TraversalSurface[]
}

export function composeVillageCell(
  coord: CellCoord,
  anchors: readonly PropClusterAnchor[],
): VillageCellComposition
```

- [ ] Move plaza, market, garden, residential, arts, wellness, observatory, deck, bench, lamp, drainage, and traversal dressing out of private whole-world builders into immutable anchors and per-cell `BuildPlan` or authored-pack output.

- [ ] Keep buildings individually mounted by stable ID. Register/unregister cell footstep surface boxes and interactions on mount/unmount without duplicating handlers during cell churn.

- [ ] Make only structural/collision-backed outdoor content quality invariant; scale small story props by importance and preserve district identity on Low.

- [ ] Run `pnpm exec vitest run tests/villageComposition.test.ts tests/geometry.test.ts tests/traversal.test.ts`; expected result is interaction/surface/collider parity.

- [ ] Commit streamed village dressing:

```bash
git add src/game/village/composition src/game/village/Village.tsx src/game/village/traversal.ts tests/villageComposition.test.ts
git commit -m "refactor: stream village composition by cell"
```

## Task 12: Author Crownwood, Galecrest, and the turtle corridor

**Files:**

- Modify: `src/game/world/biomes/registry.ts`
- Modify: `src/game/world/biomes/masks.ts`
- Modify: `src/game/world/biomes/compositor.ts`
- Create: `src/game/world/biomes/verticalSlice.ts`
- Test: `tests/turtleVerticalSlice.test.ts`

- [ ] Add the complete vertical-slice assertions specified in the turtle plan and run them; expected result is failure until both biome catalogs are populated.

- [ ] Populate Crownwood with immense conifers, moss, ferns, saplings, nurse logs, root shelves, mushrooms, stone outcrops, and suspended mist across all five layers.

- [ ] Populate Galecrest with wind-shaped pines, tough grasses, salt-worn rock, exposed shell, mist, and three ocean-facing silhouettes.

- [ ] Compose the Crownwood-to-Galecrest bow corridor inside `x=-50..50`, `z=-225..-100`, protecting both primary paths and the turtle vista mask.

- [ ] Run `pnpm exec vitest run tests/turtleVerticalSlice.test.ts tests/biomeCompositor.test.ts tests/traversal.test.ts`; expected result is full slice identity, transition, exclusion, and traversal success.

- [ ] Commit the first complete biome corridor:

```bash
git add src/game/world/biomes/registry.ts src/game/world/biomes/masks.ts src/game/world/biomes/compositor.ts src/game/world/biomes/verticalSlice.ts tests/turtleVerticalSlice.test.ts
git commit -m "feat: build Crownwood and Galecrest corridor"
```

## Task 13: Author Lumenfen and Fernfall Ravine

**Files:**

- Add: `art-source/world/vegetation/{lumenfen,fernfall}/`
- Add: `art-source/world/props/{lumenfen,fernfall}/`
- Add: `docs/art-review/world/{lumenfen,fernfall}/`
- Add: `public/assets/models/vegetation/{lumenfen,fernfall}-vegetation.glb`
- Add: `public/assets/models/props/{lumenfen,fernfall}-props.glb`
- Add: `public/assets/textures/biomes/{lumenfen,fernfall}/`
- Modify: `src/game/assets/manifest.json`
- Modify: `ASSET_LICENSES.md`
- Modify: `src/game/world/vegetation/catalog.ts`
- Modify: `src/game/world/props/catalog.ts`
- Modify: `src/game/world/biomes/registry.ts`
- Modify: `src/game/world/biomes/masks.ts`
- Modify: `src/game/config/layout.ts`
- Modify: `src/game/village/traversal.ts`
- Modify: `src/game/village/Village.tsx`
- Modify: `src/game/world/shell/shellShape.ts`
- Test: `tests/lumenfenFernfall.test.ts`
- Modify: `tests/traversal.test.ts`

- [ ] Write tests for Lumenfen moisture dependence, pond/drainage continuity, Fernfall slope/shade dependence, shared transition species, protected bridge/steps, and a collision-safe route from gardens through ravine to observatory.

- [ ] Run the new and existing traversal tests; expected result is failure for missing biome populations while current traversal remains green.

- [ ] Complete Lumenfen/Fernfall source provenance, metre-scale Blender scenes, LOD collections, footprints/collider proxies, vertex wind/grounding/wetness channels, 2K source bakes, 1K/512 derivatives, and signed silhouette/material/LOD-wind contact sheets at the exact paths above. Apply the Task 8 numeric triangle, texel-density, bounds, alpha, KTX2, licensing, and review limits without relaxing them for these biomes.

- [ ] Export and validate both vegetation and prop packs:

```bash
blender --background art-source/world/vegetation/lumenfen/lumenfen-vegetation.blend --python scripts/blender/export-world-packs.py -- vegetation lumenfen
blender --background art-source/world/props/lumenfen/lumenfen-props.blend --python scripts/blender/export-world-packs.py -- props lumenfen
blender --background art-source/world/vegetation/fernfall/fernfall-vegetation.blend --python scripts/blender/export-world-packs.py -- vegetation fernfall
blender --background art-source/world/props/fernfall/fernfall-props.blend --python scripts/blender/export-world-packs.py -- props fernfall
pnpm validate:assets:world -- --required-biomes=crownwood,galecrest,lumenfen,fernfall
```

Expected result: all four new packs, LODs, KTX2 sets, source records, contact-sheet signoffs, fallbacks, and generated license rows pass before composition begins.

- [ ] Populate Lumenfen with reeds, luminous fungi, water plants, wet stone, reflected village light, and drainage/outflow prop clusters.

- [ ] Populate Fernfall with fern banks, root shelves/steps, fallen timber, fissure rocks, trickling water, bridge framing, and shafts-of-light anchors.

- [ ] If the ravine needs terrain change, use broad analytic terms in `baseHeight()` and update golden heights, slopes, building pads, traversal structures, and safe-position coverage in the same task. Do not overlay a second collision surface.

- [ ] Run `pnpm exec vitest run tests/lumenfenFernfall.test.ts tests/terrainContract.test.ts tests/traversal.test.ts` and `pnpm exec playwright test e2e/app.spec.ts -g "collision-backed"`; expected result is continuous habitat and grounded route traversal.

- [ ] Commit wetland/ravine composition:

```bash
git add art-source/world/vegetation/lumenfen art-source/world/vegetation/fernfall art-source/world/props/lumenfen art-source/world/props/fernfall docs/art-review/world/lumenfen docs/art-review/world/fernfall public/assets/models/vegetation/lumenfen-vegetation.glb public/assets/models/vegetation/fernfall-vegetation.glb public/assets/models/props/lumenfen-props.glb public/assets/models/props/fernfall-props.glb public/assets/textures/biomes/lumenfen public/assets/textures/biomes/fernfall src/game/assets/manifest.json ASSET_LICENSES.md src/game/world/vegetation/catalog.ts src/game/world/props/catalog.ts src/game/world/biomes/registry.ts src/game/world/biomes/masks.ts src/game/config/layout.ts src/game/village/traversal.ts src/game/village/Village.tsx src/game/world/shell/shellShape.ts tests/lumenfenFernfall.test.ts tests/terrainContract.test.ts tests/traversal.test.ts
git commit -m "feat: compose Lumenfen and Fernfall Ravine"
```

## Task 14: Author Blossomshade and Hearth Clearings, then recompose districts

**Files:**

- Add: `art-source/world/vegetation/{blossomshade,hearth}/`
- Add: `art-source/world/props/{blossomshade,hearth}/`
- Add: `docs/art-review/world/{blossomshade,hearth}/`
- Add: `public/assets/models/vegetation/{blossomshade,hearth}-vegetation.glb`
- Add: `public/assets/models/props/{blossomshade,hearth}-props.glb`
- Add: `public/assets/textures/biomes/{blossomshade,hearth}/`
- Modify: `src/game/assets/manifest.json`
- Modify: `ASSET_LICENSES.md`
- Modify: `src/game/world/vegetation/catalog.ts`
- Modify: `src/game/world/props/catalog.ts`
- Modify: `src/game/world/biomes/registry.ts`
- Modify: `src/game/world/biomes/masks.ts`
- Modify: `src/game/config/layout.ts`
- Modify: `src/game/config/constants.ts`
- Modify: `src/game/village/composition/registry.ts`
- Modify: `src/game/ui/menus/MapPanel.tsx`
- Modify: `src/game/village/zones.ts`
- Modify: `src/game/weather/atmosphereLayout.ts`
- Test: `tests/blossomshadeHearth.test.ts`
- Modify: `tests/worldLayout.test.ts`

- [ ] Write tests for layered Blossomshade planting around homes/gardens, authored open-space intent in Hearth Clearings, three district anchors, door/path/interaction clearance, stable building IDs/kinds, connected route graph, and updated home spawn safety if the home moves.

- [ ] Run the tests; expected result is failure until both biome populations and district anchor sets are complete.

- [ ] Complete Blossomshade/Hearth source provenance, metre-scale Blender scenes, LOD collections, footprints/collider proxies, vertex wind/grounding/wetness channels, 2K source bakes, 1K/512 derivatives, and signed silhouette/material/LOD-wind contact sheets at the exact paths above. Apply the Task 8 numeric triangle, texel-density, bounds, alpha, KTX2, licensing, and review limits.

- [ ] Export and validate both vegetation and prop packs, then require the full six-biome world inventory:

```bash
blender --background art-source/world/vegetation/blossomshade/blossomshade-vegetation.blend --python scripts/blender/export-world-packs.py -- vegetation blossomshade
blender --background art-source/world/props/blossomshade/blossomshade-props.blend --python scripts/blender/export-world-packs.py -- props blossomshade
blender --background art-source/world/vegetation/hearth/hearth-vegetation.blend --python scripts/blender/export-world-packs.py -- vegetation hearth
blender --background art-source/world/props/hearth/hearth-props.blend --python scripts/blender/export-world-packs.py -- props hearth
pnpm validate:assets:world -- --required-biomes=crownwood,galecrest,lumenfen,fernfall,blossomshade,hearth
```

Expected result: all six biome packs, texture tiers, source records, review signoffs, fallbacks, and license rows pass.

- [ ] Populate Blossomshade with flowering broadleaf/orchard trees, hedges, warm gardens, petals, pollinator planting, and shared Lumenfen/Crownwood transition families.

- [ ] Populate Hearth Clearings with authored plaza/courtyard/garden edges, market goods, carts, benches, lanterns, signs, tools, wood piles, planters, and deliberate openings. Do not fill designated social or benchmark sightline space.

- [ ] Recompose building positions only where a paintover shows a material sightline/navigation benefit. Preserve every building ID/kind and update pad heights, zones, weather anchors, map, benchmarks, interactions, paths, and `HOME_SPAWN` atomically for each moved building.

- [ ] Run `pnpm exec vitest run tests/blossomshadeHearth.test.ts tests/worldLayout.test.ts tests/atmosphereLayout.test.ts tests/settings.test.ts` and the full `e2e/app.spec.ts`; expected result is stable IDs/features and navigable recomposed districts.

- [ ] Commit the village biome completion:

```bash
git add art-source/world/vegetation/blossomshade art-source/world/vegetation/hearth art-source/world/props/blossomshade art-source/world/props/hearth docs/art-review/world/blossomshade docs/art-review/world/hearth public/assets/models/vegetation/blossomshade-vegetation.glb public/assets/models/vegetation/hearth-vegetation.glb public/assets/models/props/blossomshade-props.glb public/assets/models/props/hearth-props.glb public/assets/textures/biomes/blossomshade public/assets/textures/biomes/hearth src/game/assets/manifest.json ASSET_LICENSES.md src/game/world/vegetation/catalog.ts src/game/world/props/catalog.ts src/game/world/biomes/registry.ts src/game/world/biomes/masks.ts src/game/config/layout.ts src/game/config/constants.ts src/game/village/composition/registry.ts src/game/ui/menus/MapPanel.tsx src/game/village/zones.ts src/game/weather/atmosphereLayout.ts tests/blossomshadeHearth.test.ts tests/worldLayout.test.ts
git commit -m "feat: compose Blossomshade and Hearth districts"
```

## Task 15: Add shared runtime context, probes, captures, and final gates

**Files:**

- Modify: `src/game/world/biomes/BiomeWorld.tsx`
- Modify: `src/game/core/runtime.ts`
- Modify: `src/game/core/FrameDriver.tsx`
- Modify: `src/game/world/TurtleWorld.tsx`
- Modify: `src/game/debug/probes.ts`
- Modify: `src/game/world/WorldSystems.tsx`
- Modify: `src/game/config/benchmarks.ts`
- Modify: `visual/graphics.capture.ts`
- Create: `e2e/worldComposition.spec.ts`
- Modify: `docs/performance-baseline.md`
- Modify: `MANUAL_QA.md`

- [ ] Extend the Task 7 `runtime.world` context with bounded diagnostics only; preserve its current cell, active biome weights, dominant biome, resident cells, 5 Hz update cadence, and mount ordering. Do not place composed transforms in runtime or create a second producer.

- [ ] Declaration-merge the Phase A `WorldProbeSection` with dominant biome, blend weights, per-layer/per-biome counts, collider counts, and disposal counters. Register it through `registerProbeSection('world', 'biomes', contributor)` so biome diagnostics appear at `window.__turtlebackDebug.probe().sections.world`; retain shared cells, LODs, loaded assets, draw calls, triangles, and texture estimates in their Phase A fields. Unregister it when `BiomeWorld` unmounts.

- [ ] Add benchmark IDs `crownwood-interior`, `crownwood-galecrest-threshold`, `lumenfen-water`, `blossomshade-homes`, `fernfall-ravine`, `galecrest-edge`, `hearth-plaza`, and `waterfall-rim`.

- [ ] Write E2E tests that traverse cell boundaries, observe hysteresis, switch all four qualities, verify real resource/count/LOD changes through `probe()`, retain invariant collider IDs, and call the dev-only `window.__turtlebackDebug.failAsset(id)` for one vegetation pack, prop pack, and biome texture to prove procedural fallbacks preserve play.

- [ ] Run `pnpm exec playwright test e2e/worldComposition.spec.ts`; expected result is every residency, quality, collider, and fallback assertion passing without console errors.

- [ ] Capture the spec matrix: High noon clear/rain, sunset, and night; Medium noon/night; Low noon smoke and dense-forest traversal; Ultra turtle, forest, wetland, village, and ocean hero views.

- [ ] Manually review each biome without the map for identity, transition continuity, foreground/navigation/middle-distance/horizon composition, path clarity, collision snags, material stretching, wet response, Low category retention, and Reduced Motion behavior. Record named captures and review hardware in `MANUAL_QA.md`.

- [ ] Benchmark dense Crownwood, Lumenfen water, busy Hearth clearing, rain, night, and cell-boundary traversal after warm-up. Record frame-time percentiles, draw calls, triangles, visible instances, renderer/process memory, and asset churn in `docs/performance-baseline.md`.

- [ ] Run a 30-minute traversal soak. After minute 10, process/renderer memory growth over the final 20 minutes must stay below 10 percent; cell leases, colliders, textures, interactions, and surface registrations must return to a stable plateau.

- [ ] Run the complete phase gate:

```bash
pnpm validate:assets
pnpm validate:assets:world
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm capture:graphics
pnpm desktop:package:mac
pnpm desktop:smoke
```

Expected result: all commands exit zero, all six biomes are identifiable and connected, existing buildings/activities/save/recovery remain green, Low retains geography and identity, High/Low hit their recorded reference frame-time targets, and the soak reaches the required plateau.

- [ ] Commit the verified biome/world closeout:

```bash
git add src/game/world/biomes/BiomeWorld.tsx src/game/core/runtime.ts src/game/core/FrameDriver.tsx src/game/world/TurtleWorld.tsx src/game/debug/probes.ts src/game/world/WorldSystems.tsx src/game/config/benchmarks.ts visual/graphics.capture.ts e2e/worldComposition.spec.ts docs/performance-baseline.md MANUAL_QA.md
git commit -m "test: verify biome world composition"
```
