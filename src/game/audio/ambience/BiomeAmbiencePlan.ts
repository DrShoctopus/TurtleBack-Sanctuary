import { crownwoodInfluence } from '../../village/forest/layout'
import { biomeWeightsAt, type SanctuaryBiome } from '../../world/biomes/layout'

export type AmbientHabitat = 'crownwood' | SanctuaryBiome

export interface BiomeAmbientBed {
  readonly id: AmbientHabitat
  readonly label: string
  readonly centerFrequency: number
  readonly q: number
  readonly maxGain: number
}

export interface BiomeAmbiencePlan {
  readonly weights: Readonly<Record<AmbientHabitat, number>>
  readonly activeBeds: readonly AmbientHabitat[]
}

export const BIOME_AMBIENT_BEDS: readonly BiomeAmbientBed[] = Object.freeze([
  { id: 'crownwood', label: 'Canopy leaves and old-growth hush', centerFrequency: 720, q: 0.72, maxGain: 0.026 },
  { id: 'blossomshade', label: 'Petals and soft flowering boughs', centerFrequency: 1040, q: 1.1, maxGain: 0.018 },
  { id: 'lumenfen', label: 'Reeds, pool lap, and small insects', centerFrequency: 1680, q: 0.84, maxGain: 0.022 },
  { id: 'fernfall', label: 'Ravine water and root-cave air', centerFrequency: 430, q: 0.66, maxGain: 0.028 },
  { id: 'galecrest', label: 'Salt wind and exposed scrub', centerFrequency: 1280, q: 0.58, maxGain: 0.026 },
  { id: 'hearth', label: 'Courtyard cloth and distant chimes', centerFrequency: 2280, q: 1.42, maxGain: 0.014 },
])

export function biomeAmbiencePlanAt(x: number, z: number): BiomeAmbiencePlan {
  const mosaic = biomeWeightsAt(x, z)
  const weights: Record<AmbientHabitat, number> = {
    crownwood: crownwoodInfluence(x, z),
    ...mosaic,
  }
  return {
    weights,
    activeBeds: BIOME_AMBIENT_BEDS.map(({ id }) => id).filter((id) => weights[id] > 0.025),
  }
}
