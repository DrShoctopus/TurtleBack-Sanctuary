import { mulberry32 } from '../../core/rng'
import { terrainHeight } from '../shell/shellShape'
import type { SanctuaryBiome } from './layout'

export type HabitatFeatureKind =
  | 'reed'
  | 'lily'
  | 'glow-bulb'
  | 'root-arch'
  | 'fall-stone'
  | 'blossom-sprig'
  | 'coastal-scrub'
  | 'saltstone'
  | 'lantern'
  | 'civic-planter'

export interface HabitatSignatureCluster {
  readonly id: string
  readonly biome: SanctuaryBiome
  readonly family: string
  readonly center: readonly [number, number]
  readonly radius: number
  readonly primary: HabitatFeatureKind
  readonly secondary: HabitatFeatureKind
}

export interface HabitatFeatureTransform {
  readonly id: string
  readonly clusterId: string
  readonly biome: SanctuaryBiome
  readonly family: string
  readonly kind: HabitatFeatureKind
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly scale: number
  readonly variant: 0 | 1 | 2
}

export interface HabitatSignaturePlan {
  readonly seed: number
  readonly density: number
  readonly features: readonly HabitatFeatureTransform[]
  readonly clusterCount: number
  readonly familiesByBiome: Readonly<Record<SanctuaryBiome, readonly string[]>>
}

export const HABITAT_SIGNATURE_CLUSTERS: readonly HabitatSignatureCluster[] = Object.freeze([
  { id: 'blossomshade.arch', biome: 'blossomshade', family: 'flowering-arch', center: [88, 100], radius: 9, primary: 'blossom-sprig', secondary: 'root-arch' },
  { id: 'blossomshade.glade', biome: 'blossomshade', family: 'petal-glade', center: [72, 119], radius: 12, primary: 'blossom-sprig', secondary: 'glow-bulb' },
  { id: 'lumenfen.reeds', biome: 'lumenfen', family: 'reed-islands', center: [-52, 80], radius: 8, primary: 'reed', secondary: 'lily' },
  { id: 'lumenfen.lights', biome: 'lumenfen', family: 'lily-lights', center: [-55, 81], radius: 5, primary: 'lily', secondary: 'glow-bulb' },
  { id: 'fernfall.roots', biome: 'fernfall', family: 'root-bridge', center: [-104, 132], radius: 12, primary: 'root-arch', secondary: 'reed' },
  { id: 'fernfall.stones', biome: 'fernfall', family: 'fall-stones', center: [-116, 146], radius: 11, primary: 'fall-stone', secondary: 'glow-bulb' },
  { id: 'galecrest.windbreak', biome: 'galecrest', family: 'windbreak-pines', center: [92, -204], radius: 14, primary: 'coastal-scrub', secondary: 'root-arch' },
  { id: 'galecrest.beacons', biome: 'galecrest', family: 'saltstone-beacons', center: [122, -188], radius: 12, primary: 'saltstone', secondary: 'coastal-scrub' },
  { id: 'hearth.lanterns', biome: 'hearth', family: 'lantern-court', center: [0, -40], radius: 9, primary: 'lantern', secondary: 'civic-planter' },
  { id: 'hearth.gardens', biome: 'hearth', family: 'civic-gardens', center: [20, -49], radius: 10, primary: 'civic-planter', secondary: 'blossom-sprig' },
])

function featureCount(cluster: HabitatSignatureCluster, density: number): number {
  const base = cluster.primary === 'lily' || cluster.primary === 'reed' ? 28 : 18
  return Math.max(4, Math.floor(base * density))
}

export function buildHabitatSignaturePlan(seed: number, density: number): HabitatSignaturePlan {
  if (!Number.isSafeInteger(seed)) throw new RangeError('habitat signature seed must be safe')
  if (!Number.isFinite(density) || density <= 0) {
    throw new RangeError('habitat signature density must be positive and finite')
  }
  const rng = mulberry32(seed ^ 0x68616269)
  const features: HabitatFeatureTransform[] = []
  const families: Record<SanctuaryBiome, Set<string>> = {
    blossomshade: new Set(),
    lumenfen: new Set(),
    fernfall: new Set(),
    galecrest: new Set(),
    hearth: new Set(),
  }
  for (const cluster of HABITAT_SIGNATURE_CLUSTERS) {
    families[cluster.biome].add(cluster.family)
    const count = featureCount(cluster, density)
    for (let index = 0; index < count; index++) {
      const angle = rng() * Math.PI * 2
      const radial = Math.sqrt(rng()) * cluster.radius
      const x = cluster.center[0] + Math.cos(angle) * radial
      const z = cluster.center[1] + Math.sin(angle) * radial
      const kind = index % 3 === 0 ? cluster.secondary : cluster.primary
      const waterFeature = kind === 'lily' || (kind === 'reed' && cluster.biome === 'lumenfen')
      features.push({
        id: `${cluster.id}:${index.toString().padStart(3, '0')}`,
        clusterId: cluster.id,
        biome: cluster.biome,
        family: cluster.family,
        kind,
        x,
        y: waterFeature ? 13.18 : terrainHeight(x, z),
        z,
        yaw: rng() * Math.PI * 2,
        scale: 0.72 + rng() * 0.68,
        variant: (index % 3) as 0 | 1 | 2,
      })
    }
  }
  const familiesByBiome: Readonly<Record<SanctuaryBiome, readonly string[]>> = {
    blossomshade: [...families.blossomshade].sort(),
    lumenfen: [...families.lumenfen].sort(),
    fernfall: [...families.fernfall].sort(),
    galecrest: [...families.galecrest].sort(),
    hearth: [...families.hearth].sort(),
  }
  return { seed, density, features, clusterCount: HABITAT_SIGNATURE_CLUSTERS.length, familiesByBiome }
}
