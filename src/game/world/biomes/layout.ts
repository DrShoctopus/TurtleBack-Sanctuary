import { mulberry32 } from '../../core/rng'
import { clamp01 } from '../../core/mathUtils'
import { isInsideShell, shellRadius, terrainHeight, terrainNormal } from '../shell/shellShape'
import { isVegetationPlacementAllowed } from '../../village/vegetation/placement'

export type SanctuaryBiome = 'blossomshade' | 'lumenfen' | 'fernfall' | 'galecrest' | 'hearth'
export type BiomeLayer =
  | 'canopy'
  | 'midstory'
  | 'understory'
  | 'ground-cover'
  | 'geology'
  | 'atmosphere'

export interface BiomeDefinition {
  readonly id: SanctuaryBiome
  readonly label: string
  readonly anchor: readonly [number, number]
  readonly radius: readonly [number, number]
  readonly layers: readonly BiomeLayer[]
  readonly clusterFamilies: readonly [string, string]
  readonly colors: Readonly<Record<BiomeLayer | 'trunk', readonly [string, string, string]>>
}

export interface BiomeFields {
  readonly exposure: number
  readonly moisture: number
  readonly slope: number
  readonly elevation: number
  readonly district: number
}

export interface BiomeTransform {
  readonly id: string
  readonly biome: SanctuaryBiome
  readonly layer: BiomeLayer
  readonly clusterFamily: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly scale: number
  readonly variant: 0 | 1 | 2
}

export interface BiomeMosaicPlan {
  readonly seed: number
  readonly density: number
  readonly transforms: readonly BiomeTransform[]
  readonly layerCounts: Readonly<Record<SanctuaryBiome, Readonly<Record<BiomeLayer, number>>>>
  readonly clusterFamilies: Readonly<Record<SanctuaryBiome, readonly string[]>>
}

const LAYERS: readonly BiomeLayer[] = [
  'canopy',
  'midstory',
  'understory',
  'ground-cover',
  'geology',
  'atmosphere',
]

const palette = (
  trunk: readonly [string, string, string],
  canopy: readonly [string, string, string],
  midstory: readonly [string, string, string],
  understory: readonly [string, string, string],
  ground: readonly [string, string, string],
  geology: readonly [string, string, string],
  atmosphere: readonly [string, string, string],
): BiomeDefinition['colors'] => ({
  trunk,
  canopy,
  midstory,
  understory,
  'ground-cover': ground,
  geology,
  atmosphere,
})

export const BIOME_DEFINITIONS: readonly BiomeDefinition[] = Object.freeze([
  {
    id: 'blossomshade',
    label: 'Blossomshade',
    anchor: [92, 103],
    radius: [92, 104],
    layers: LAYERS,
    clusterFamilies: ['flowering-arch', 'petal-glade'],
    colors: palette(
      ['#624737', '#75523e', '#513b32'],
      ['#9b727a', '#bd8991', '#687858'],
      ['#b97886', '#d4969e', '#8f697a'],
      ['#6f8d59', '#8aa86a', '#526f4b'],
      ['#dd9aae', '#f2c1c8', '#b77791'],
      ['#8a827c', '#a99b91', '#716b67'],
      ['#f0b5c3', '#d792aa', '#ffe0dd'],
    ),
  },
  {
    id: 'lumenfen',
    label: 'Lumenfen',
    anchor: [-54, 88],
    radius: [102, 96],
    layers: LAYERS,
    clusterFamilies: ['reed-islands', 'lily-lights'],
    colors: palette(
      ['#4b4937', '#625a3f', '#3a4033'],
      ['#496f5d', '#5d8068', '#365a50'],
      ['#577b67', '#75947a', '#3e6258'],
      ['#6f956c', '#8aad79', '#50745d'],
      ['#86a86c', '#a9bd77', '#628c68'],
      ['#66766e', '#84948a', '#52645e'],
      ['#65d5c0', '#9af0ce', '#60a8b4'],
    ),
  },
  {
    id: 'fernfall',
    label: 'Fernfall Ravine',
    anchor: [-105, 132],
    radius: [86, 94],
    layers: LAYERS,
    clusterFamilies: ['root-bridge', 'fall-stones'],
    colors: palette(
      ['#493a31', '#5d4737', '#382f2a'],
      ['#355948', '#476b50', '#29483d'],
      ['#476d52', '#5d815f', '#345845'],
      ['#4f7d5c', '#6d996a', '#3e674e'],
      ['#5e8b61', '#7ca172', '#477453'],
      ['#5e6968', '#78817c', '#465555'],
      ['#86b9a7', '#abc9b8', '#618f86'],
    ),
  },
  {
    id: 'galecrest',
    label: 'Galecrest',
    anchor: [82, -198],
    radius: [104, 108],
    layers: LAYERS,
    clusterFamilies: ['windbreak-pines', 'saltstone-beacons'],
    colors: palette(
      ['#5c5143', '#736351', '#48423a'],
      ['#3f6558', '#55766a', '#31534b'],
      ['#5e765a', '#748768', '#485f4e'],
      ['#708568', '#8c9874', '#5d715b'],
      ['#8e9c78', '#b0aa82', '#6d8269'],
      ['#9a9486', '#bab09c', '#77766e'],
      ['#b9d5d0', '#e0dfc9', '#8db6bd'],
    ),
  },
  {
    id: 'hearth',
    label: 'Hearth Commons',
    anchor: [8, -43],
    radius: [104, 132],
    layers: LAYERS,
    clusterFamilies: ['lantern-court', 'civic-gardens'],
    colors: palette(
      ['#654a36', '#795943', '#513d31'],
      ['#607a4f', '#788c5d', '#4e6745'],
      ['#7b8256', '#969367', '#616f4c'],
      ['#778c5c', '#96a36c', '#5f754e'],
      ['#d18f67', '#e4b477', '#b86f5d'],
      ['#8d8070', '#aa9b83', '#71685d'],
      ['#f0b26f', '#ffd49a', '#d88361'],
    ),
  },
])

const DEFINITIONS_BY_ID = Object.fromEntries(
  BIOME_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Readonly<Record<SanctuaryBiome, BiomeDefinition>>

function smoothBell(value: number): number {
  const t = clamp01(1 - value)
  return t * t * (3 - 2 * t)
}

export function biomeFieldsAt(x: number, z: number): BiomeFields {
  const radius = shellRadius(x, z)
  const height = terrainHeight(x, z)
  const normal = terrainNormal(x, z)
  const gardenWet = Math.exp(-Math.hypot(x + 54, z - 88) / 48)
  const ravineWet = Math.exp(-Math.hypot(x + 105, z - 132) / 62)
  const civic = Math.exp(-Math.hypot(x - 8, z + 43) / 43)
  return {
    exposure: clamp01((radius - 0.42) / 0.53),
    moisture: clamp01(gardenWet * 0.78 + ravineWet * 0.46),
    slope: clamp01(1 - normal[1]),
    elevation: clamp01((height - 7.5) / 11),
    district: clamp01(civic),
  }
}

export function biomeWeightsAt(x: number, z: number): Readonly<Record<SanctuaryBiome, number>> {
  const fields = biomeFieldsAt(x, z)
  const weights = {} as Record<SanctuaryBiome, number>
  for (const definition of BIOME_DEFINITIONS) {
    const dx = (x - definition.anchor[0]) / definition.radius[0]
    const dz = (z - definition.anchor[1]) / definition.radius[1]
    const footprint = smoothBell(Math.hypot(dx, dz))
    let fieldFit = 0.5
    if (definition.id === 'blossomshade') fieldFit = 0.56 + fields.moisture * 0.2 - fields.exposure * 0.08
    if (definition.id === 'lumenfen') fieldFit = 0.34 + fields.moisture * 0.72
    if (definition.id === 'fernfall') fieldFit = 0.4 + fields.moisture * 0.38 + fields.slope * 0.34
    if (definition.id === 'galecrest') fieldFit = 0.34 + fields.exposure * 0.72 + fields.elevation * 0.12
    if (definition.id === 'hearth') fieldFit = 0.34 + fields.district * 0.76 - fields.moisture * 0.12
    weights[definition.id] = clamp01(footprint * fieldFit)
  }
  return weights
}

export function dominantBiomeAt(x: number, z: number): SanctuaryBiome | null {
  const entries = Object.entries(biomeWeightsAt(x, z)) as Array<[SanctuaryBiome, number]>
  entries.sort((left, right) => right[1] - left[1])
  return entries[0][1] >= 0.08 ? entries[0][0] : null
}

const BASE_LAYER_COUNTS: Readonly<Record<BiomeLayer, number>> = {
  canopy: 28,
  midstory: 64,
  understory: 118,
  'ground-cover': 220,
  geology: 38,
  atmosphere: 34,
}

function emptyLayerCounts(): Record<BiomeLayer, number> {
  return {
    canopy: 0,
    midstory: 0,
    understory: 0,
    'ground-cover': 0,
    geology: 0,
    atmosphere: 0,
  }
}

export function buildBiomeMosaicPlan(seed: number, density: number): BiomeMosaicPlan {
  if (!Number.isSafeInteger(seed)) throw new RangeError('biome seed must be a safe integer')
  if (!Number.isFinite(density) || density <= 0) {
    throw new RangeError('biome density must be positive and finite')
  }
  const rng = mulberry32(seed ^ 0x62696f6d)
  const transforms: BiomeTransform[] = []
  const layerCounts = {} as Record<SanctuaryBiome, Record<BiomeLayer, number>>
  const clusterFamilies = {} as Record<SanctuaryBiome, readonly string[]>

  for (const definition of BIOME_DEFINITIONS) {
    const counts = emptyLayerCounts()
    layerCounts[definition.id] = counts
    clusterFamilies[definition.id] = definition.clusterFamilies
    for (const layer of LAYERS) {
      const count = Math.max(2, Math.floor(BASE_LAYER_COUNTS[layer] * density))
      let accepted = 0
      let attempts = count * 16
      while (accepted < count && attempts-- > 0) {
        const angle = rng() * Math.PI * 2
        const radius = Math.sqrt(rng())
        const x = definition.anchor[0] + Math.cos(angle) * definition.radius[0] * radius
        const z = definition.anchor[1] + Math.sin(angle) * definition.radius[1] * radius
        if (!isInsideShell(x, z, 0.955)) continue
        const margin = layer === 'canopy' ? 4.2 : layer === 'geology' ? 2.5 : 1.55
        if (!isVegetationPlacementAllowed(x, z, margin)) continue
        const weight = biomeWeightsAt(x, z)[definition.id]
        if (weight < 0.055 || rng() > clamp01(weight * 1.75 + 0.12)) continue
        const clusterFamily = definition.clusterFamilies[accepted % definition.clusterFamilies.length]
        transforms.push({
          id: `${definition.id}:${layer}:${accepted.toString().padStart(4, '0')}`,
          biome: definition.id,
          layer,
          clusterFamily,
          x,
          y: terrainHeight(x, z),
          z,
          yaw: rng() * Math.PI * 2,
          scale: 0.76 + rng() * 0.62,
          variant: (accepted % 3) as 0 | 1 | 2,
        })
        counts[layer]++
        accepted++
      }
    }
  }
  return { seed, density, transforms, layerCounts, clusterFamilies }
}

export function biomeDefinition(id: SanctuaryBiome): BiomeDefinition {
  return DEFINITIONS_BY_ID[id]
}

export const BIOME_LAYERS = LAYERS
