import type { BuildingSpec } from '../config/layout'
import { mulberry32 } from '../core/rng'

export interface WeatherAnchor {
  x: number
  y: number
  z: number
  seed: number
  fall: number
}

export interface PuddleAnchor extends WeatherAnchor {
  scaleX: number
  scaleZ: number
  rotation: number
}

interface RoofProfile {
  halfX: number
  halfZ: number
  eaveY: number
  mode: 'rect' | 'lowZ' | 'valley' | 'gable' | 'circle'
}

/** Matches the authored shell dimensions and overhangs in interiors/shellKit. */
const ROOF_PROFILE: Record<BuildingSpec['kind'], RoofProfile | null> = {
  home: { halfX: 6.08, halfZ: 4.58, eaveY: 3.62, mode: 'rect' },
  cafe: { halfX: 5.2, halfZ: 4.05, eaveY: 3.74, mode: 'valley' },
  bookshop: { halfX: 4.7, halfZ: 4.05, eaveY: 3.92, mode: 'lowZ' },
  records: { halfX: 4.33, halfZ: 3.58, eaveY: 3.62, mode: 'rect' },
  plants: { halfX: 4.48, halfZ: 5.05, eaveY: 3.5, mode: 'gable' },
  gallery: { halfX: 5.58, halfZ: 4.33, eaveY: 4.42, mode: 'rect' },
  bathhouse: { halfX: 5.83, halfZ: 4.83, eaveY: 4.02, mode: 'rect' },
  observatory: { halfX: 4.33, halfZ: 4.33, eaveY: 3.62, mode: 'circle' },
  store: { halfX: 4.7, halfZ: 3.8, eaveY: 3.52, mode: 'lowZ' },
  pavilion: null,
  cottage: { halfX: 3.43, halfZ: 2.93, eaveY: 3.25, mode: 'rect' },
}

/** Deterministic eave points, transformed with each building's actual yaw. */
export function makeRoofDripAnchors(
  buildings: readonly BuildingSpec[],
  perBuilding: number,
  seed = 8801,
): WeatherAnchor[] {
  const rng = mulberry32(seed)
  const anchors: WeatherAnchor[] = []
  const count = Math.max(0, Math.floor(perBuilding))
  for (const building of buildings) {
    const roof = ROOF_PROFILE[building.kind]
    if (!roof) continue
    const cos = Math.cos(building.yaw)
    const sin = Math.sin(building.yaw)
    for (let i = 0; i < count; i++) {
      const side = i % 4
      const t = rng() * 2 - 1
      let lx = side < 2 ? t * roof.halfX : side === 2 ? roof.halfX : -roof.halfX
      let lz = side >= 2 ? t * roof.halfZ : side === 0 ? roof.halfZ : -roof.halfZ
      const cottageShed = building.kind === 'cottage' && building.id.charCodeAt(building.id.length - 1) % 3 === 1
      const mode = cottageShed ? 'lowZ' : roof.mode
      if (mode === 'lowZ') {
        lx = t * roof.halfX
        lz = roof.halfZ
      } else if (mode === 'valley') {
        lx = i % 2 === 0 ? roof.halfX : -roof.halfX
        lz = t * 0.32
      } else if (mode === 'gable') {
        lx = i % 2 === 0 ? roof.halfX : -roof.halfX
        lz = t * roof.halfZ
      } else if (mode === 'circle') {
        const angle = (i / count) * Math.PI * 2
        lx = Math.cos(angle) * roof.halfX
        lz = Math.sin(angle) * roof.halfZ
      }
      anchors.push({
        x: building.x + lx * cos + lz * sin,
        y: building.padH + roof.eaveY,
        z: building.z - lx * sin + lz * cos,
        seed: rng(),
        fall: roof.eaveY - 0.08,
      })
    }
  }
  return anchors
}

/** Shallow runoff pools sit outside footprints, never under interior furniture. */
export function makePuddleAnchors(
  buildings: readonly BuildingSpec[],
  seed = 8802,
): PuddleAnchor[] {
  const rng = mulberry32(seed)
  return buildings.flatMap((building, index) => {
    if (building.kind === 'pavilion') return []
    const side = index % 2 === 0 ? 1 : -1
    const roof = ROOF_PROFILE[building.kind]
    if (!roof) return []
    const localX = side * (roof.halfX + 0.7 + rng() * 0.7)
    const localZ = (rng() * 2 - 1) * roof.halfZ * 0.72
    const cos = Math.cos(building.yaw)
    const sin = Math.sin(building.yaw)
    return [
      {
        x: building.x + localX * cos + localZ * sin,
        y: building.padH + 0.035,
        z: building.z - localX * sin + localZ * cos,
        seed: rng(),
        fall: 0,
        scaleX: 0.65 + rng() * 1.15,
        scaleZ: 0.35 + rng() * 0.65,
        rotation: rng() * Math.PI,
      },
    ]
  })
}

/** Evenly retain coverage across the full authored list at lower quality. */
export function selectEvenly<T>(items: readonly T[], count: number): T[] {
  const nextCount = Math.max(0, Math.min(items.length, Math.floor(count)))
  if (nextCount === items.length) return [...items]
  if (nextCount === 0) return []
  return Array.from({ length: nextCount }, (_, index) =>
    items[Math.floor((index * items.length) / nextCount)],
  )
}
