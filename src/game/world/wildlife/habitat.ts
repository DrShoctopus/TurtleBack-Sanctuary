import { BUILDINGS, EXTRA_PADS, WATER_FEATURES } from '../../config/layout'
import { VILLAGE_PROP_EXCLUSION_ZONES } from '../../village/dressing/layout'
import { crownwoodInfluence } from '../../village/forest/layout'
import { distanceToPath, isInsideShell, terrainHeight } from '../shell/shellShape'
import type { WildlifeHabitat, WildlifePosition, WildlifeSpeciesId } from './types'
import { biomeWeightsAt } from '../biomes/layout'

export interface WildlifeHabitatAnchor {
  readonly id: string
  readonly speciesId: WildlifeSpeciesId
  readonly habitat: WildlifeHabitat
  readonly position: WildlifePosition
  readonly safeRadius: number
  readonly importance: number
}

const onShell = (x: number, z: number, lift: number): WildlifePosition => [x, terrainHeight(x, z) + lift, z]

/**
 * Authored discovery beats placed beside routes rather than on them. Their
 * IDs and positions are stable across quality tiers and frame chunking.
 */
export const SHOWCASE_WILDLIFE_ANCHORS: readonly WildlifeHabitatAnchor[] = Object.freeze([
  { id: 'songbird.arrival.1', speciesId: 'crownwood-songbird', habitat: 'crownwood', position: onShell(-18, -190, 9.8), safeRadius: 5, importance: 1 },
  { id: 'songbird.arrival.2', speciesId: 'crownwood-songbird', habitat: 'crownwood', position: onShell(23, -164, 11.5), safeRadius: 5, importance: 0.96 },
  { id: 'songbird.arrival.3', speciesId: 'crownwood-songbird', habitat: 'crownwood', position: onShell(-28, -132, 8.6), safeRadius: 5, importance: 0.94 },
  { id: 'songbird.west.1', speciesId: 'crownwood-songbird', habitat: 'crownwood', position: onShell(-114, -52, 12.2), safeRadius: 5, importance: 0.92 },
  { id: 'songbird.garden.1', speciesId: 'crownwood-songbird', habitat: 'crownwood', position: onShell(-88, 62, 9.4), safeRadius: 5, importance: 0.9 },

  { id: 'hare.west.1', speciesId: 'shell-hare', habitat: 'shell-meadow', position: onShell(-118, -74, 0.45), safeRadius: 4.2, importance: 1 },
  { id: 'hare.west.2', speciesId: 'shell-hare', habitat: 'shell-meadow', position: onShell(-132, -15, 0.45), safeRadius: 4.2, importance: 0.94 },
  { id: 'hare.garden.1', speciesId: 'shell-hare', habitat: 'shell-meadow', position: onShell(-96, 82, 0.45), safeRadius: 4.2, importance: 0.92 },
  { id: 'hare.arrival.1', speciesId: 'shell-hare', habitat: 'shell-meadow', position: onShell(40, -118, 0.45), safeRadius: 4.2, importance: 0.86 },

  { id: 'butterfly.arrival.1', speciesId: 'blossom-pollinators', habitat: 'crownwood', position: onShell(18, -150, 2.8), safeRadius: 4, importance: 1 },
  { id: 'butterfly.west.1', speciesId: 'blossom-pollinators', habitat: 'crownwood', position: onShell(-102, -36, 2.5), safeRadius: 4, importance: 0.9 },
  { id: 'butterfly.garden.1', speciesId: 'blossom-pollinators', habitat: 'garden-wetland', position: onShell(-77, 92, 2.2), safeRadius: 4, importance: 0.98 },
  { id: 'dragonfly.garden.1', speciesId: 'lumenfen-insects', habitat: 'garden-wetland', position: onShell(-52, 91, 2.7), safeRadius: 4, importance: 1 },
  { id: 'firefly.garden.1', speciesId: 'lumenfen-insects', habitat: 'garden-wetland', position: onShell(-70, 108, 2.4), safeRadius: 4, importance: 0.96 },

  { id: 'seabird.gale.1', speciesId: 'galecrest-seabird', habitat: 'galecrest', position: [138, 35, -210], safeRadius: 18, importance: 1 },
  { id: 'seabird.gale.2', speciesId: 'galecrest-seabird', habitat: 'galecrest', position: [171, 47, -164], safeRadius: 18, importance: 0.98 },
  { id: 'seabird.east.1', speciesId: 'galecrest-seabird', habitat: 'galecrest', position: [188, 31, -42], safeRadius: 18, importance: 0.9 },
  { id: 'seabird.west.1', speciesId: 'galecrest-seabird', habitat: 'galecrest', position: [-188, 38, -72], safeRadius: 18, importance: 0.88 },

  { id: 'ray.gale.1', speciesId: 'shell-ray', habitat: 'open-ocean', position: [190, 3.2, -180], safeRadius: 26, importance: 1 },
  { id: 'ray.gale.2', speciesId: 'shell-ray', habitat: 'open-ocean', position: [218, 2.4, -205], safeRadius: 26, importance: 0.96 },
  { id: 'ray.east.1', speciesId: 'shell-ray', habitat: 'open-ocean', position: [242, 2.1, 12], safeRadius: 26, importance: 0.9 },
  { id: 'ray.west.1', speciesId: 'shell-ray', habitat: 'open-ocean', position: [-244, 2.6, -82], safeRadius: 26, importance: 0.86 },

  { id: 'grazer.blossom.1', speciesId: 'blossom-grazer', habitat: 'blossomshade', position: onShell(90, 100, 0.82), safeRadius: 4.8, importance: 0.99 },
  { id: 'grazer.blossom.2', speciesId: 'blossom-grazer', habitat: 'blossomshade', position: onShell(82, 116, 0.82), safeRadius: 4.8, importance: 0.9 },
  { id: 'heron.lumenfen.1', speciesId: 'lumenfen-heron', habitat: 'lumenfen', position: onShell(-62, 92, 0.25), safeRadius: 3.2, importance: 0.98 },
  { id: 'heron.lumenfen.2', speciesId: 'lumenfen-heron', habitat: 'lumenfen', position: onShell(-70, 100, 0.25), safeRadius: 3.2, importance: 0.88 },
])

export function isGroundWildlifeSafe(x: number, z: number, radius = 2.2): boolean {
  if (!isInsideShell(x, z, 0.9) || distanceToPath(x, z) < radius + 1.4) return false
  for (const building of BUILDINGS) {
    if (Math.hypot(x - building.x, z - building.z) < building.padR + radius + 1.2) return false
  }
  for (const pad of EXTRA_PADS) {
    if (Math.hypot(x - pad.x, z - pad.z) < pad.r + radius + 0.8) return false
  }
  for (const feature of WATER_FEATURES) {
    if (Math.hypot(x - feature.x, z - feature.z) < feature.r + radius + 0.8) return false
  }
  for (const zone of VILLAGE_PROP_EXCLUSION_ZONES) {
    if (Math.hypot(x - zone.x, z - zone.z) < zone.radius + radius + 0.6) return false
  }
  return true
}

export function habitatStrength(habitat: WildlifeHabitat, x: number, z: number): number {
  if (habitat === 'crownwood') return crownwoodInfluence(x, z)
  if (habitat === 'blossomshade' || habitat === 'lumenfen') return biomeWeightsAt(x, z)[habitat]
  if (habitat === 'garden-wetland') return Math.max(0, 1 - Math.hypot(x + 58, z - 88) / 56)
  if (habitat === 'galecrest') {
    const exposedRim = Math.max(0, (Math.abs(x) - 108) / 58)
    return Math.max(exposedRim, Math.max(0, 1 - Math.hypot(x - 160, z + 170) / 240))
  }
  if (habitat === 'open-ocean') return isInsideShell(x, z, 1.1) ? 0 : 1
  return isGroundWildlifeSafe(x, z) ? 1 : 0
}

export function validateShowcaseWildlifeAnchors(): readonly string[] {
  const errors: string[] = []
  for (const anchor of SHOWCASE_WILDLIFE_ANCHORS) {
    const [x, , z] = anchor.position
    if (
      (anchor.speciesId === 'shell-hare' ||
        anchor.speciesId === 'blossom-grazer' ||
        anchor.speciesId === 'lumenfen-heron') &&
      !isGroundWildlifeSafe(x, z, anchor.speciesId === 'blossom-grazer' ? 2.5 : 1.6)
    ) {
      errors.push(`${anchor.id} overlaps a traversal or structure clearance`)
    }
    if (habitatStrength(anchor.habitat, x, z) <= 0) {
      errors.push(`${anchor.id} is outside its authored habitat`)
    }
  }
  return errors
}
