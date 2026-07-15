import { BUILDINGS, EXTRA_PADS, WATER_FEATURES } from '../../config/layout'
import { type QualityLevel } from '../../core/quality'
import { mulberry32, type Rng } from '../../core/rng'
import { distanceToPath, isInsideShell, terrainHeight } from '../../world/shell/shellShape'
import { cellId, worldToCell } from '../../world/spatial/cells'
import { DEFAULT_SPATIAL_GRID, type CellKey } from '../../world/spatial/types'
import { VILLAGE_PROP_EXCLUSION_ZONES } from '../dressing/layout'

export const TREE_FORM_IDS = [
  'ancient-column',
  'ancient-fork',
  'ancient-broken-crown',
  'wind-pine-lean',
  'wind-pine-fan',
  'wind-pine-sentinel',
  'broadleaf-dome',
  'broadleaf-split',
  'broadleaf-arch',
] as const

export type ForestLayer =
  'trees' | 'midstory' | 'understory' | 'groundCover' | 'deadfall' | 'boulders' | 'mist'

export const FOREST_LAYERS: readonly ForestLayer[] = [
  'trees',
  'midstory',
  'understory',
  'groundCover',
  'deadfall',
  'boulders',
  'mist',
]

export type ForestDiscoveryKind =
  | 'nurse-log'
  | 'root-arch'
  | 'fern-bank'
  | 'mushroom-ring'
  | 'lichen-rock'
  | 'sapling-grove'
  | 'flower-pocket'
  | 'fallen-branch'

export interface ForestTransform {
  id: string
  cell: CellKey
  x: number
  y: number
  z: number
  scale: number
  yaw: number
  variant: number
  importance: number
}

export interface ForestDiscovery extends ForestTransform {
  kind: ForestDiscoveryKind
}

export interface CrownwoodLayout {
  seed: number
  layers: Readonly<Record<ForestLayer, readonly ForestTransform[]>>
  discoveries: readonly ForestDiscovery[]
}

export interface CrownwoodSelection {
  near: Readonly<Record<ForestLayer, readonly ForestTransform[]>>
  horizonTrees: readonly ForestTransform[]
}

const LAYER_TARGETS: Readonly<Record<Exclude<ForestLayer, 'mist'>, number>> = {
  trees: 430,
  midstory: 960,
  understory: 3_400,
  groundCover: 2_700,
  deadfall: 82,
  boulders: 96,
}

const QUALITY_KEEP: Readonly<Record<QualityLevel, Readonly<Record<ForestLayer, number>>>> = {
  low: {
    trees: 0.64,
    midstory: 0.2,
    understory: 0.24,
    groundCover: 0.16,
    deadfall: 0.46,
    boulders: 0.58,
    mist: 0.42,
  },
  medium: {
    trees: 0.82,
    midstory: 0.52,
    understory: 0.56,
    groundCover: 0.46,
    deadfall: 0.72,
    boulders: 0.78,
    mist: 0.7,
  },
  high: {
    trees: 1,
    midstory: 1,
    understory: 1,
    groundCover: 1,
    deadfall: 1,
    boulders: 1,
    mist: 1,
  },
  ultra: {
    trees: 1,
    midstory: 1,
    understory: 1,
    groundCover: 1,
    deadfall: 1,
    boulders: 1,
    mist: 1,
  },
}

const DISCOVERY_KINDS: readonly ForestDiscoveryKind[] = [
  'nurse-log',
  'fern-bank',
  'root-arch',
  'mushroom-ring',
  'lichen-rock',
  'sapling-grove',
  'flower-pocket',
  'fallen-branch',
]

/** Deliberate 20–30 m beats along the Arrival-to-plaza corridor. */
export const ARRIVAL_DISCOVERY_ANCHORS: readonly Readonly<{
  x: number
  z: number
  yaw: number
}>[] = [
  { x: 7.8, z: -211, yaw: 0.18 },
  { x: 8.4, z: -187, yaw: -0.32 },
  { x: -9.1, z: -163, yaw: 0.44 },
  { x: 7.8, z: -139, yaw: -0.18 },
  { x: 9.8, z: -115, yaw: 0.62 },
  { x: 8.8, z: -91, yaw: -0.46 },
  { x: -9.4, z: -68, yaw: 0.28 },
] as const

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function smoothBand(value: number, min: number, max: number, feather: number): number {
  const inner = value >= min && value <= max ? 1 : 0
  if (inner) return 1
  const distance = value < min ? min - value : value - max
  const t = clamp01(1 - distance / feather)
  return t * t * (3 - 2 * t)
}

/**
 * Broad authored biome masks: Arrival walls, deep western Crownwood, and a
 * softer northern transition. Village pads and the plaza remain real clearings.
 */
export function crownwoodInfluence(x: number, z: number): number {
  const arrival = smoothBand(z, -224, -62, 28) * smoothBand(x, -58, 58, 34)
  const westernInterior = smoothBand(x, -162, -42, 30) * smoothBand(z, -172, 74, 36)
  const northTransition = smoothBand(x, -86, 54, 38) * smoothBand(z, 42, 146, 30) * 0.44
  let influence = Math.max(arrival * 0.96, westernInterior, northTransition)

  const plazaDistance = Math.hypot(x, z + 40)
  influence *= 0.24 + 0.76 * clamp01((plazaDistance - 26) / 18)
  const homeDistance = Math.hypot(x + 62, z + 132)
  influence *= 0.34 + 0.66 * clamp01((homeDistance - 17) / 13)
  return clamp01(influence)
}

export function isForestPlacementAllowed(x: number, z: number, margin: number): boolean {
  if (!isInsideShell(x, z, 0.925) || distanceToPath(x, z) < margin) return false
  for (const building of BUILDINGS) {
    if (Math.hypot(x - building.x, z - building.z) < building.padR + Math.max(1.2, margin * 0.34)) {
      return false
    }
  }
  for (const pad of EXTRA_PADS) {
    if (Math.hypot(x - pad.x, z - pad.z) < pad.r + Math.max(0.8, margin * 0.25)) return false
  }
  for (const feature of WATER_FEATURES) {
    if (Math.hypot(x - feature.x, z - feature.z) < feature.r + margin + 0.8) return false
  }
  for (const zone of VILLAGE_PROP_EXCLUSION_ZONES) {
    if (Math.hypot(x - zone.x, z - zone.z) < zone.radius + Math.max(0.65, margin * 0.4)) {
      return false
    }
  }
  return true
}

function pointId(layer: ForestLayer, index: number): string {
  return `crownwood:${layer}:${index.toString().padStart(5, '0')}`
}

function makeTransform(
  layer: ForestLayer,
  index: number,
  x: number,
  z: number,
  scale: number,
  yaw: number,
  variant: number,
  importance: number,
): ForestTransform {
  return {
    id: pointId(layer, index),
    cell: cellId(worldToCell(x, z, DEFAULT_SPATIAL_GRID)),
    x,
    y: terrainHeight(x, z),
    z,
    scale,
    yaw,
    variant,
    importance,
  }
}

function scatterLayer(input: {
  layer: Exclude<ForestLayer, 'mist'>
  target: number
  margin: number
  rng: Rng
  scale: (rng: Rng, x: number, z: number) => number
  variant: (rng: Rng, x: number, z: number, index: number) => number
}): readonly ForestTransform[] {
  const output: ForestTransform[] = []
  let attempts = input.target * 32
  while (output.length < input.target && attempts-- > 0) {
    const x = (input.rng() * 2 - 1) * 168
    const z = (input.rng() * 2 - 1) * 242
    const influence = crownwoodInfluence(x, z)
    const edgeTexture = 0.72 + Math.sin(x * 0.071 - z * 0.043) * 0.18
    if (input.rng() > influence * edgeTexture) continue
    if (!isForestPlacementAllowed(x, z, input.margin)) continue
    if (input.layer !== 'trees' && input.layer !== 'deadfall' && input.layer !== 'boulders') {
      const edgeDistance = Math.max(0, distanceToPath(x, z) - input.margin)
      const pathEdgeBias = 0.28 + 0.72 * clamp01(1 - edgeDistance / 34)
      if (input.rng() > pathEdgeBias) continue
    }
    const index = output.length
    output.push(
      makeTransform(
        input.layer,
        index,
        x,
        z,
        input.scale(input.rng, x, z),
        input.rng() * Math.PI * 2,
        input.variant(input.rng, x, z, index),
        clamp01(influence * 0.72 + input.rng() * 0.28),
      ),
    )
  }
  return output
}

function buildArrivalSentinels(seed: number): readonly ForestTransform[] {
  const rng = mulberry32(seed ^ 0x5e471)
  const gates = [-187, -159, -131, -103] as const
  return gates.flatMap((z, gateIndex) =>
    ([-1, 1] as const).map((side, sideIndex) => {
      const centreX = z > -142 ? -5.5 : 0
      const x = gateIndex === 3 && side < 0 ? -26 : centreX + side * (11.8 + gateIndex * 0.65)
      const transform = makeTransform(
        'trees',
        LAYER_TARGETS.trees + gateIndex * 2 + sideIndex,
        x,
        z,
        2.12 + rng() * 0.48,
        side < 0 ? 0.18 : -0.22,
        (gateIndex * 2 + sideIndex) % TREE_FORM_IDS.length,
        1,
      )
      return { ...transform, id: `crownwood:arrival-sentinel:${gateIndex}:${sideIndex}` }
    }),
  )
}

function treeVariant(rng: Rng, x: number, z: number, index: number): number {
  // Prime the first nine accepted forms so the authored kit contract can never
  // disappear for an unlucky seed; habitat weighting governs the remainder.
  if (index < TREE_FORM_IDS.length) return index
  const west = x < -48
  const coastal = Math.abs(x) > 105 || z < -185
  const roll = rng()
  if (coastal) return 3 + Math.floor(roll * 3)
  if (west && roll < 0.58) return Math.floor(rng() * 3)
  if (roll < 0.46) return 6 + Math.floor(rng() * 3)
  return Math.floor(rng() * TREE_FORM_IDS.length)
}

function buildMist(seed: number): readonly ForestTransform[] {
  const rng = mulberry32(seed ^ 0x6d157)
  const anchors = [
    [-22, -184],
    [18, -151],
    [-28, -119],
    [19, -86],
    [-86, -65],
    [-119, -25],
    [-78, 18],
    [-45, 54],
  ] as const
  return anchors.flatMap(([baseX, baseZ], anchorIndex) =>
    Array.from({ length: 3 }, (_, localIndex) => {
      const x = baseX + (rng() - 0.5) * 18
      const z = baseZ + (rng() - 0.5) * 14
      return makeTransform(
        'mist',
        anchorIndex * 3 + localIndex,
        x,
        z,
        0.8 + rng() * 0.55,
        rng() * Math.PI,
        localIndex,
        0.7 + rng() * 0.3,
      )
    }),
  )
}

function buildDiscoveries(seed: number): readonly ForestDiscovery[] {
  const rng = mulberry32(seed ^ 0xd15c0)
  const route = ARRIVAL_DISCOVERY_ANCHORS.map((anchor, index) => ({
    ...anchor,
    kind: DISCOVERY_KINDS[index % DISCOVERY_KINDS.length],
  }))
  const interior = [
    { x: -80, z: -112, yaw: 0.7, kind: 'sapling-grove' as const },
    { x: -111, z: -72, yaw: -0.35, kind: 'nurse-log' as const },
    { x: -118, z: -31, yaw: 1.1, kind: 'root-arch' as const },
    { x: -111, z: 8, yaw: -0.72, kind: 'mushroom-ring' as const },
    { x: -91, z: 39, yaw: 0.25, kind: 'lichen-rock' as const },
    { x: -65, z: 52, yaw: -0.4, kind: 'fern-bank' as const },
  ]
  return [...route, ...interior].map((anchor, index) => ({
    ...makeTransform(
      'deadfall',
      LAYER_TARGETS.deadfall + index,
      anchor.x,
      anchor.z,
      0.9 + rng() * 0.34,
      anchor.yaw,
      index % 4,
      1,
    ),
    id: `crownwood:discovery:${index.toString().padStart(2, '0')}`,
    kind: anchor.kind,
  }))
}

/** Pure deterministic Crownwood population. Runtime geometry is built elsewhere. */
export function buildCrownwoodLayout(seed: number): CrownwoodLayout {
  if (!Number.isSafeInteger(seed)) throw new RangeError('forest seed must be a safe integer')
  const rng = mulberry32(seed ^ 0xc20a4)
  const scatteredTrees = scatterLayer({
    layer: 'trees',
    target: LAYER_TARGETS.trees,
    margin: 5.3,
    rng,
    scale: (next, x, z) => {
      const oldGrowth = x < -58 && z > -160 ? 1.18 : 1
      return (1.28 + next() * 1.22) * oldGrowth
    },
    variant: treeVariant,
  })
  const trees = [...scatteredTrees, ...buildArrivalSentinels(seed)]
  const midstory = scatterLayer({
    layer: 'midstory',
    target: LAYER_TARGETS.midstory,
    margin: 3.15,
    rng,
    scale: (next) => 0.72 + next() * 0.95,
    variant: (next) => Math.floor(next() * 4),
  })
  const understory = scatterLayer({
    layer: 'understory',
    target: LAYER_TARGETS.understory,
    margin: 2.35,
    rng,
    scale: (next) => 0.58 + next() * 0.82,
    variant: (_next, _x, _z, index) => index % 4,
  })
  const groundCover = scatterLayer({
    layer: 'groundCover',
    target: LAYER_TARGETS.groundCover,
    margin: 1.95,
    rng,
    scale: (next) => 0.6 + next() * 1.18,
    variant: (next) => Math.floor(next() * 5),
  })
  const deadfall = scatterLayer({
    layer: 'deadfall',
    target: LAYER_TARGETS.deadfall,
    margin: 4.25,
    rng,
    scale: (next) => 0.75 + next() * 0.86,
    variant: (next) => Math.floor(next() * 4),
  })
  const boulders = scatterLayer({
    layer: 'boulders',
    target: LAYER_TARGETS.boulders,
    margin: 3.75,
    rng,
    scale: (next) => 0.72 + next() * 1.12,
    variant: (next) => Math.floor(next() * 3),
  })
  return {
    seed,
    layers: {
      trees,
      midstory,
      understory,
      groundCover,
      deadfall,
      boulders,
      mist: buildMist(seed),
    },
    discoveries: buildDiscoveries(seed),
  }
}

function retainedHorizonTrees(
  trees: readonly ForestTransform[],
  active: ReadonlySet<CellKey>,
  retained: ReadonlySet<CellKey>,
): readonly ForestTransform[] {
  const perCell = new Map<CellKey, ForestTransform[]>()
  for (const tree of trees) {
    if (active.has(tree.cell) || !retained.has(tree.cell)) continue
    const cellTrees = perCell.get(tree.cell) ?? []
    cellTrees.push(tree)
    perCell.set(tree.cell, cellTrees)
  }
  return [...perCell.values()].flatMap((cellTrees) => {
    const cap = Math.min(8, cellTrees.length)
    return Array.from(
      { length: cap },
      (_, index) => cellTrees[Math.floor((index * cellTrees.length) / cap)],
    )
  })
}

function qualityFiltered(
  transforms: readonly ForestTransform[],
  keep: number,
): readonly ForestTransform[] {
  if (keep >= 1) return transforms
  return transforms.filter((transform, index) => {
    if (transform.importance >= 0.9) return true
    const stable = ((index * 1_103 + transform.variant * 197) % 10_000) / 10_000
    return stable < keep
  })
}

/** Selects streamed near detail and retained-cell tree walls without randomness. */
export function selectCrownwoodLayout(
  layout: CrownwoodLayout,
  activeCells: readonly CellKey[],
  retainedCells: readonly CellKey[],
  quality: QualityLevel,
): CrownwoodSelection {
  const active = new Set(activeCells)
  const retained = new Set(retainedCells)
  const near = Object.fromEntries(
    FOREST_LAYERS.map((layer) => {
      const activeTransforms = layout.layers[layer].filter((transform) =>
        active.has(transform.cell),
      )
      return [layer, qualityFiltered(activeTransforms, QUALITY_KEEP[quality][layer])]
    }),
  ) as Record<ForestLayer, readonly ForestTransform[]>
  return {
    near,
    horizonTrees: qualityFiltered(
      retainedHorizonTrees(layout.layers.trees, active, retained),
      quality === 'low' ? 0.78 : 1,
    ),
  }
}

export function treeLodForQuality(quality: QualityLevel): 0 | 1 | 2 {
  if (quality === 'ultra' || quality === 'high') return 0
  if (quality === 'medium') return 1
  return 2
}
