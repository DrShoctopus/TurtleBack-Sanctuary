import { describe, expect, it } from 'vitest'
import {
  BIOME_AMBIENT_BEDS,
  biomeAmbiencePlanAt,
} from '../src/game/audio/ambience/BiomeAmbiencePlan'
import { BIOME_DEFINITIONS } from '../src/game/world/biomes/layout'

describe('biome ambient beds', () => {
  it('owns one procedural bed per forest and remaining biome', () => {
    expect(BIOME_AMBIENT_BEDS.map(({ id }) => id)).toEqual([
      'crownwood',
      'blossomshade',
      'lumenfen',
      'fernfall',
      'galecrest',
      'hearth',
    ])
    expect(BIOME_AMBIENT_BEDS.every(({ maxGain }) => maxGain > 0 && maxGain < 0.04)).toBe(true)
  })

  it('activates the matching layer at every authored biome anchor', () => {
    for (const biome of BIOME_DEFINITIONS) {
      const plan = biomeAmbiencePlanAt(...biome.anchor)
      expect(plan.activeBeds, biome.id).toContain(biome.id)
      expect(plan.weights[biome.id]).toBeGreaterThan(0.3)
    }
  })

  it('supports overlapping beds at visual transition thresholds', () => {
    const transition = biomeAmbiencePlanAt(18, 60)
    expect(transition.activeBeds.length).toBeGreaterThanOrEqual(2)
    expect(Object.values(transition.weights).every((weight) => weight >= 0 && weight <= 1)).toBe(true)
  })
})
