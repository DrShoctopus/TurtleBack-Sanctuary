import { describe, expect, it } from 'vitest'
import {
  HABITAT_SIGNATURE_CLUSTERS,
  buildHabitatSignaturePlan,
} from '../src/game/world/biomes/signatureClusters'

describe('biome signature clusters', () => {
  it('authors two different cluster families for every remaining biome', () => {
    const plan = buildHabitatSignaturePlan(1337, 1)
    expect(HABITAT_SIGNATURE_CLUSTERS).toHaveLength(10)
    for (const biome of ['blossomshade', 'lumenfen', 'fernfall', 'galecrest', 'hearth'] as const) {
      expect(new Set(plan.familiesByBiome[biome]).size, biome).toBe(2)
      expect(plan.features.filter((feature) => feature.biome === biome).length).toBeGreaterThan(20)
    }
  })

  it('includes the required wetland, ravine, flowering, coast, and civic reads', () => {
    const kinds = new Set(buildHabitatSignaturePlan(1337, 1).features.map(({ kind }) => kind))
    expect(kinds).toEqual(
      new Set([
        'reed',
        'lily',
        'glow-bulb',
        'root-arch',
        'fall-stone',
        'blossom-sprig',
        'coastal-scrub',
        'saltstone',
        'lantern',
        'civic-planter',
      ]),
    )
  })

  it('retains every family and feature kind on Low', () => {
    const high = buildHabitatSignaturePlan(1337, 1)
    const low = buildHabitatSignaturePlan(1337, 0.4)
    expect(new Set(low.features.map(({ kind }) => kind))).toEqual(
      new Set(high.features.map(({ kind }) => kind)),
    )
    expect(low.clusterCount).toBe(high.clusterCount)
    expect(low.features.length).toBeLessThan(high.features.length)
  })

  it('is deterministic and validates inputs', () => {
    expect(buildHabitatSignaturePlan(42, 0.75)).toEqual(buildHabitatSignaturePlan(42, 0.75))
    expect(() => buildHabitatSignaturePlan(1.2, 1)).toThrow(RangeError)
    expect(() => buildHabitatSignaturePlan(1, Number.NaN)).toThrow(RangeError)
  })
})
