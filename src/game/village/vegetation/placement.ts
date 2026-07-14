import { BUILDINGS, EXTRA_PADS, WATER_FEATURES } from '../../config/layout'
import { mulberry32, type Rng } from '../../core/rng'
import {
  distanceToPath,
  isInsideShell,
  splatWeights,
  terrainHeight,
} from '../../world/shell/shellShape'
import type { VegetationLayer, VegetationPopulation, VegetationTransform } from './types'

export const VEGETATION_PLACEMENT_MARGINS: Readonly<Record<VegetationLayer, number>> = {
  grass: 1.6,
  flowers: 1.8,
  bushes: 2.4,
  rocks: 2.2,
  trees: 3.4,
}

/** True when a point is clear of paths, buildings, pads, and water features. */
export function isVegetationPlacementAllowed(x: number, z: number, margin: number): boolean {
  if (distanceToPath(x, z) < margin) return false
  for (const building of BUILDINGS) {
    const dx = x - building.x
    const dz = z - building.z
    if (dx * dx + dz * dz < (building.padR - 2) * (building.padR - 2)) return false
  }
  for (const pad of EXTRA_PADS) {
    const dx = x - pad.x
    const dz = z - pad.z
    if (dx * dx + dz * dz < pad.r * pad.r) return false
  }
  for (const feature of WATER_FEATURES) {
    const dx = x - feature.x
    const dz = z - feature.z
    if (dx * dx + dz * dz < (feature.r + 1.5) * (feature.r + 1.5)) return false
  }
  return true
}

function scatter(
  rng: Rng,
  count: number,
  accept: (x: number, z: number) => boolean,
): Array<readonly [number, number]> {
  const points: Array<readonly [number, number]> = []
  let attempts = count * 6
  while (points.length < count && attempts-- > 0) {
    const x = (rng() * 2 - 1) * 168
    const z = (rng() * 2 - 1) * 248
    if (!isInsideShell(x, z, 0.93)) continue
    if (!accept(x, z)) continue
    points.push([x, z])
  }
  return points
}

/** Broad deterministic habitat fields create meadows, clearings, and thickets. */
function habitatDensity(x: number, z: number): number {
  const broad = Math.sin(x * 0.047 + z * 0.021) * 0.28
  const cross = Math.sin(z * 0.064 - x * 0.033 + 1.7) * 0.22
  const pockets = Math.sin(Math.hypot(x + 22, z - 35) * 0.075) * 0.16
  return Math.min(1, Math.max(0, 0.52 + broad + cross + pockets))
}

function transformId(layer: VegetationLayer, index: number): string {
  return `${layer}:${index.toString().padStart(6, '0')}`
}

function placedTransform(
  layer: VegetationLayer,
  index: number,
  point: readonly [number, number],
  y: number,
  scale: number,
  yaw: number,
  variant: number,
): VegetationTransform {
  return {
    id: transformId(layer, index),
    x: point[0],
    y,
    z: point[1],
    scale,
    yaw,
    variant,
  }
}

/**
 * Reproduces the original analytic vegetation sequence exactly. Keep layer
 * generation in this order: each layer consumes the shared RNG before the next.
 */
export function buildVegetationPopulation(input: {
  seed: number
  density: number
}): VegetationPopulation {
  const { seed, density } = input
  if (!Number.isSafeInteger(seed)) throw new RangeError('vegetation seed must be a safe integer')
  if (!Number.isFinite(density) || density < 0) {
    throw new RangeError('vegetation density must be finite and non-negative')
  }

  const rng = mulberry32(seed ^ 0x7e61)

  const grassSpots = scatter(rng, Math.floor(8200 * density), (x, z) => {
    if (!isVegetationPlacementAllowed(x, z, VEGETATION_PLACEMENT_MARGINS.grass)) return false
    const habitat = habitatDensity(x, z)
    return splatWeights(x, z).grass > 0.3 + rng() * 0.3 && rng() < 0.24 + habitat * 0.9
  })
  const grass = grassSpots.map(([x, z], index) =>
    placedTransform(
      'grass',
      index,
      [x, z],
      terrainHeight(x, z) - 0.02,
      0.66 + rng() * 0.62,
      rng() * Math.PI,
      index % 4,
    ),
  )

  const flowerSpots = scatter(rng, Math.floor(1400 * density), (x, z) => {
    if (!isVegetationPlacementAllowed(x, z, VEGETATION_PLACEMENT_MARGINS.flowers)) return false
    const gardenPull = Math.hypot(x + 58, z - 74) < 45 ? 0.25 : 0.62
    return (
      splatWeights(x, z).grass > 0.3 &&
      rng() > gardenPull &&
      rng() < 0.36 + habitatDensity(x, z) * 0.72
    )
  })
  const flowers = flowerSpots.map(([x, z], index) =>
    placedTransform(
      'flowers',
      index,
      [x, z],
      terrainHeight(x, z),
      0.8 + rng() * 0.7,
      rng() * Math.PI,
      index % 5,
    ),
  )

  const bushSpots = scatter(rng, Math.floor(300 * density), (x, z) => {
    return (
      isVegetationPlacementAllowed(x, z, VEGETATION_PLACEMENT_MARGINS.bushes) &&
      splatWeights(x, z).grass > 0.4 &&
      rng() < 0.18 + habitatDensity(x, z) * 0.88
    )
  })
  const bushes = bushSpots.map(([x, z], index) => {
    const scale = 0.5 + rng() * 0.7
    return placedTransform(
      'bushes',
      index,
      [x, z],
      terrainHeight(x, z) + scale * 0.28,
      scale,
      rng() * Math.PI,
      index % 4,
    )
  })

  const rockSpots = scatter(rng, Math.floor(240 * density), (x, z) => {
    return (
      isVegetationPlacementAllowed(x, z, VEGETATION_PLACEMENT_MARGINS.rocks) &&
      splatWeights(x, z).rock > 0.32
    )
  })
  const rocks = rockSpots.map(([x, z], index) => {
    const scale = 0.4 + rng() * 1
    return placedTransform(
      'rocks',
      index,
      [x, z],
      terrainHeight(x, z) + scale * 0.12,
      scale,
      rng() * Math.PI,
      index % 3,
    )
  })

  const treeSpots = scatter(rng, Math.floor(150 * Math.max(0.55, density)), (x, z) => {
    if (!isVegetationPlacementAllowed(x, z, VEGETATION_PLACEMENT_MARGINS.trees)) return false
    const weights = splatWeights(x, z)
    return weights.grass > 0.25 && weights.rock < 0.4 && rng() < 0.12 + habitatDensity(x, z)
  })
  const trees = treeSpots.map(([x, z], index) => {
    // Keep the legacy random-consumption order: kind, scale, then yaw.
    const variant = Math.floor(rng() * 3)
    return placedTransform(
      'trees',
      index,
      [x, z],
      terrainHeight(x, z),
      0.8 + rng() * 0.6,
      rng() * Math.PI * 2,
      variant,
    )
  })

  return { seed, layers: { grass, flowers, bushes, rocks, trees } }
}

/**
 * Render population used by the cell renderer. Trees are fixed at the legacy
 * density-one layout so their visual trunks and gameplay colliders never drift
 * when the graphics tier changes; only low-cost detail layers scale by quality.
 */
export function buildCellVegetationPopulation(input: {
  seed: number
  density: number
}): VegetationPopulation {
  const details = buildVegetationPopulation(input)
  const canonicalTrees =
    input.density === 1
      ? details.layers.trees
      : buildVegetationPopulation({ seed: input.seed, density: 1 }).layers.trees
  return {
    ...details,
    layers: { ...details.layers, trees: canonicalTrees },
  }
}
