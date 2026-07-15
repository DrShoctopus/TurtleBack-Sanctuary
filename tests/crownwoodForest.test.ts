import { describe, expect, it } from 'vitest'
import { BUILDINGS, EXTRA_PADS, WATER_FEATURES } from '../src/game/config/layout'
import { distanceToPath } from '../src/game/world/shell/shellShape'
import { cellNeighborhood, worldToCell } from '../src/game/world/spatial/cells'
import { DEFAULT_SPATIAL_GRID } from '../src/game/world/spatial/types'
import {
  ARRIVAL_DISCOVERY_ANCHORS,
  FOREST_LAYERS,
  TREE_FORM_IDS,
  buildCrownwoodLayout,
  crownwoodInfluence,
  selectCrownwoodLayout,
  treeLodForQuality,
} from '../src/game/village/forest/layout'
import {
  makeBoulderClusterGeometry,
  makeDeadfallGeometry,
  makeFernGeometry,
  makeForestTreeForms,
  makeGroundCoverGeometry,
  makeMushroomClusterGeometry,
  makeRootArchGeometry,
  makeSaplingGeometry,
} from '../src/game/village/forest/geometry'

const SEED = 20260712

describe('Crownwood authored biome', () => {
  it('assembles every modular mesh with compatible runtime attributes', () => {
    const trees = ([0, 1, 2] as const).flatMap((lod) => makeForestTreeForms(lod))
    const details = [
      makeSaplingGeometry(),
      makeFernGeometry(),
      makeGroundCoverGeometry(),
      makeDeadfallGeometry(),
      makeBoulderClusterGeometry(),
      makeRootArchGeometry(),
      makeMushroomClusterGeometry(),
    ]
    for (const tree of trees) {
      expect(tree.trunk.getAttribute('position').count).toBeGreaterThan(0)
      expect(tree.canopy.getAttribute('position').count).toBeGreaterThan(0)
      tree.trunk.dispose()
      tree.canopy.dispose()
    }
    for (const geometry of details) {
      expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
      geometry.dispose()
    }
  })

  it('is deterministic and includes all nine modular tree silhouettes', () => {
    const first = buildCrownwoodLayout(SEED)
    const repeat = buildCrownwoodLayout(SEED)
    const different = buildCrownwoodLayout(SEED + 1)

    expect(repeat).toEqual(first)
    expect(different.layers.trees).not.toEqual(first.layers.trees)
    expect(new Set(first.layers.trees.map((tree) => tree.variant))).toEqual(
      new Set(TREE_FORM_IDS.map((_, index) => index)),
    )
  })

  it('builds every required forest layer at showcase density', () => {
    const layout = buildCrownwoodLayout(SEED)
    expect(FOREST_LAYERS).toEqual([
      'trees',
      'midstory',
      'understory',
      'groundCover',
      'deadfall',
      'boulders',
      'mist',
    ])
    expect(layout.layers.trees).toHaveLength(438)
    expect(layout.layers.midstory).toHaveLength(960)
    expect(layout.layers.understory).toHaveLength(3_400)
    expect(layout.layers.groundCover).toHaveLength(2_700)
    expect(layout.layers.deadfall).toHaveLength(82)
    expect(layout.layers.boulders).toHaveLength(96)
    expect(layout.layers.mist).toHaveLength(24)
  })

  it('uses clearings and soft biome thresholds instead of uniform density', () => {
    expect(crownwoodInfluence(0, -150)).toBeGreaterThan(0.85)
    expect(crownwoodInfluence(-112, -30)).toBeGreaterThan(0.8)
    expect(crownwoodInfluence(0, -40)).toBeLessThan(0.3)
    expect(crownwoodInfluence(124, 110)).toBeLessThan(0.08)
  })

  it('keeps trunks and heavy clusters outside traversal and authored clearances', () => {
    const layout = buildCrownwoodLayout(SEED)
    for (const tree of layout.layers.trees) {
      expect(distanceToPath(tree.x, tree.z)).toBeGreaterThanOrEqual(5.3)
      for (const building of BUILDINGS) {
        expect(Math.hypot(tree.x - building.x, tree.z - building.z)).toBeGreaterThanOrEqual(
          building.padR + 1.8,
        )
      }
      for (const pad of EXTRA_PADS) {
        expect(Math.hypot(tree.x - pad.x, tree.z - pad.z)).toBeGreaterThanOrEqual(pad.r + 1.3)
      }
      for (const feature of WATER_FEATURES) {
        expect(Math.hypot(tree.x - feature.x, tree.z - feature.z)).toBeGreaterThanOrEqual(
          feature.r + 6.1,
        )
      }
    }
  })

  it('places a deliberate discovery every 20–30 metres down Arrival', () => {
    const layout = buildCrownwoodLayout(SEED)
    const arrivals = layout.discoveries.slice(0, ARRIVAL_DISCOVERY_ANCHORS.length)
    expect(arrivals).toHaveLength(7)
    expect(new Set(arrivals.map((discovery) => discovery.kind)).size).toBe(7)
    expect(arrivals.every((discovery) => distanceToPath(discovery.x, discovery.z) > 5)).toBe(true)
    for (let index = 1; index < arrivals.length; index += 1) {
      const previous = arrivals[index - 1]
      const current = arrivals[index]
      expect(Math.hypot(current.x - previous.x, current.z - previous.z)).toBeGreaterThanOrEqual(20)
      expect(Math.hypot(current.x - previous.x, current.z - previous.z)).toBeLessThanOrEqual(30)
    }
  })

  it('streams near layers, retains horizon walls, and keeps Low biome identity', () => {
    const layout = buildCrownwoodLayout(SEED)
    const center = worldToCell(-110, -38, DEFAULT_SPATIAL_GRID)
    const low = selectCrownwoodLayout(
      layout,
      cellNeighborhood(center, 1),
      cellNeighborhood(center, 2),
      'low',
    )
    const high = selectCrownwoodLayout(
      layout,
      cellNeighborhood(center, 3),
      cellNeighborhood(center, 4),
      'high',
    )

    expect(low.near.trees.length).toBeGreaterThan(0)
    expect(low.horizonTrees.length).toBeGreaterThan(0)
    for (const layer of FOREST_LAYERS) {
      expect(low.near[layer].length, layer).toBeGreaterThan(0)
      expect(high.near[layer].length, layer).toBeGreaterThan(low.near[layer].length)
    }
    const lowActive = new Set(cellNeighborhood(center, 1))
    const lowRetained = new Set(cellNeighborhood(center, 2))
    expect(low.near.trees.every((tree) => lowActive.has(tree.cell))).toBe(true)
    expect(
      low.horizonTrees.every((tree) => lowRetained.has(tree.cell) && !lowActive.has(tree.cell)),
    ).toBe(true)
  })

  it('maps graphics tiers to the authored three-LOD contract', () => {
    expect(treeLodForQuality('ultra')).toBe(0)
    expect(treeLodForQuality('high')).toBe(0)
    expect(treeLodForQuality('medium')).toBe(1)
    expect(treeLodForQuality('low')).toBe(2)
  })
})
