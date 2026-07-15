import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { BUILDINGS, EXTRA_PADS, WATER_FEATURES } from '../src/game/config/layout'
import { distanceToPath } from '../src/game/world/shell/shellShape'
import { DEFAULT_SPATIAL_GRID } from '../src/game/world/spatial/types'
import { worldToCell, cellId } from '../src/game/world/spatial/cells'
import {
  buildCellVegetationPopulation,
  buildVegetationPopulation,
  VEGETATION_PLACEMENT_MARGINS,
} from '../src/game/village/vegetation/placement'
import {
  MAX_HORIZON_TREES_PER_CELL,
  partitionVegetationByCell,
} from '../src/game/village/vegetation/partition'
import {
  VEGETATION_LAYERS,
  type VegetationPopulation,
  type VegetationTransform,
} from '../src/game/village/vegetation/types'
import { crownwoodInfluence } from '../src/game/village/forest/layout'

const GOLDEN_SEED = 20260712
const GOLDEN_DENSITY_ONE_SHA256 = '59f22b5779e2a9c39a66cf4ee174daec31148dbdc0def82b42927705bdcf898f'

function legacyTransformFixture(population: VegetationPopulation): string {
  const fixture = Object.fromEntries(
    VEGETATION_LAYERS.map((layer) => [
      layer,
      population.layers[layer].map((transform) =>
        layer === 'trees'
          ? {
              x: transform.x,
              y: transform.y,
              z: transform.z,
              kind: transform.variant,
              s: transform.scale,
              ry: transform.yaw,
            }
          : {
              x: transform.x,
              y: transform.y,
              z: transform.z,
              s: transform.scale,
              ry: transform.yaw,
            },
      ),
    ]),
  )
  return createHash('sha256').update(JSON.stringify(fixture)).digest('hex')
}

function allTransforms(population: VegetationPopulation): readonly VegetationTransform[] {
  return VEGETATION_LAYERS.flatMap((layer) => population.layers[layer])
}

describe('vegetation placement', () => {
  it('matches the pre-extraction deterministic golden fixture', () => {
    const population = buildVegetationPopulation({ seed: GOLDEN_SEED, density: 1 })
    expect(legacyTransformFixture(population)).toBe(GOLDEN_DENSITY_ONE_SHA256)
    expect(VEGETATION_LAYERS.map((layer) => population.layers[layer].length)).toEqual([
      8200, 1400, 300, 29, 150,
    ])
  })

  it('is equal for the same seed and differs for another seed', () => {
    const first = buildVegetationPopulation({ seed: 71, density: 0.08 })
    const repeat = buildVegetationPopulation({ seed: 71, density: 0.08 })
    const different = buildVegetationPopulation({ seed: 72, density: 0.08 })
    expect(repeat).toEqual(first)
    expect(different.layers.grass).not.toEqual(first.layers.grass)
  })

  it('keeps every accepted point clear of paths, structures, pads, and water', () => {
    const population = buildVegetationPopulation({ seed: GOLDEN_SEED, density: 0.2 })
    for (const layer of VEGETATION_LAYERS) {
      for (const transform of population.layers[layer]) {
        const distanceSquared = (x: number, z: number) =>
          (transform.x - x) ** 2 + (transform.z - z) ** 2
        expect(distanceToPath(transform.x, transform.z)).toBeGreaterThanOrEqual(
          VEGETATION_PLACEMENT_MARGINS[layer],
        )
        for (const building of BUILDINGS) {
          expect(distanceSquared(building.x, building.z)).toBeGreaterThanOrEqual(
            (building.padR - 2) ** 2,
          )
        }
        for (const pad of EXTRA_PADS) {
          expect(distanceSquared(pad.x, pad.z)).toBeGreaterThanOrEqual(pad.r ** 2)
        }
        for (const feature of WATER_FEATURES) {
          expect(distanceSquared(feature.x, feature.z)).toBeGreaterThanOrEqual(
            (feature.r + 1.5) ** 2,
          )
        }
      }
    }
  })

  it('keeps canonical tree visuals and colliders quality-invariant', () => {
    const low = buildCellVegetationPopulation({ seed: GOLDEN_SEED, density: 0.45 })
    const ultra = buildCellVegetationPopulation({ seed: GOLDEN_SEED, density: 1.3 })
    expect(low.layers.trees).toEqual(ultra.layers.trees)
    expect(low.layers.trees.every((tree) => crownwoodInfluence(tree.x, tree.z) < 0.24)).toBe(true)
    expect(low.layers.grass.length).toBeLessThan(ultra.layers.grass.length)
  })
})

describe('vegetation cell partitioning', () => {
  it('partitions without losing or duplicating transforms', () => {
    const population = buildVegetationPopulation({ seed: GOLDEN_SEED, density: 1 })
    const cells = partitionVegetationByCell(population, DEFAULT_SPATIAL_GRID)
    const partitioned = [...cells.values()].flatMap((cell) =>
      VEGETATION_LAYERS.flatMap((layer) => cell.near[layer]),
    )
    const source = allTransforms(population)
    expect(partitioned).toHaveLength(source.length)
    expect(new Set(partitioned.map((transform) => transform.id)).size).toBe(source.length)
    expect(new Set(partitioned)).toEqual(new Set(source))
  })

  it('uses centred-cell membership and deterministic cell/transform ordering', () => {
    const population = buildVegetationPopulation({ seed: GOLDEN_SEED, density: 0.12 })
    const first = partitionVegetationByCell(population, DEFAULT_SPATIAL_GRID)
    const repeat = partitionVegetationByCell(population, DEFAULT_SPATIAL_GRID)
    expect([...repeat.keys()]).toEqual([...first.keys()])
    expect([...repeat.values()]).toEqual([...first.values()])
    for (const [key, cell] of first) {
      for (const layer of VEGETATION_LAYERS) {
        const ids = cell.near[layer].map((transform) => transform.id)
        expect(ids).toEqual([...ids].sort())
        for (const transform of cell.near[layer]) {
          expect(cellId(worldToCell(transform.x, transform.z, DEFAULT_SPATIAL_GRID))).toBe(key)
        }
      }
    }
  })

  it('retains one bounded horizon representation in every populated tree cell on Low', () => {
    const low = buildCellVegetationPopulation({ seed: GOLDEN_SEED, density: 0.45 })
    const cells = partitionVegetationByCell(low, DEFAULT_SPATIAL_GRID)
    const treeCells = [...cells.values()].filter((cell) => cell.near.trees.length > 0)
    expect(treeCells.length).toBeGreaterThan(0)
    for (const cell of treeCells) {
      expect(cell.horizonTrees.length).toBeGreaterThanOrEqual(1)
      expect(cell.horizonTrees.length).toBeLessThanOrEqual(MAX_HORIZON_TREES_PER_CELL)
      expect(cell.horizonTrees.every((tree) => cell.near.trees.includes(tree))).toBe(true)
    }
  })
})
