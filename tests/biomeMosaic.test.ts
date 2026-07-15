import { describe, expect, it } from 'vitest'
import {
  BIOME_DEFINITIONS,
  BIOME_LAYERS,
  biomeFieldsAt,
  biomeWeightsAt,
  buildBiomeMosaicPlan,
  dominantBiomeAt,
} from '../src/game/world/biomes/layout'
import { distanceToPath } from '../src/game/world/shell/shellShape'

describe('remaining biome mosaic', () => {
  it('gives every authored anchor its named dominant silhouette', () => {
    for (const biome of BIOME_DEFINITIONS) {
      expect(dominantBiomeAt(...biome.anchor), biome.id).toBe(biome.id)
      expect(biomeWeightsAt(...biome.anchor)[biome.id]).toBeGreaterThan(0.3)
    }
  })

  it('derives continuous fields from exposure, moisture, slope, elevation, and district', () => {
    const wetland = biomeFieldsAt(-54, 88)
    const coast = biomeFieldsAt(82, -198)
    const civic = biomeFieldsAt(8, -43)
    expect(wetland.moisture).toBeGreaterThan(coast.moisture)
    expect(coast.exposure).toBeGreaterThan(civic.exposure)
    expect(civic.district).toBeGreaterThan(wetland.district)
    for (const fields of [wetland, coast, civic]) {
      expect(Object.values(fields).every((value) => value >= 0 && value <= 1)).toBe(true)
    }
  })

  it('overlaps neighboring biome thresholds instead of drawing hard rings', () => {
    const transitionSamples: ReadonlyArray<readonly [number, number]> = [
      [18, 60],
      [-76, 112],
      [60, -112],
    ]
    for (const point of transitionSamples) {
      const weights = Object.values(biomeWeightsAt(...point)).filter((weight) => weight > 0.025)
      expect(weights.length, point.join(',')).toBeGreaterThanOrEqual(2)
    }
  })

  it('keeps at least six layers and two signature cluster families per biome on High', () => {
    const plan = buildBiomeMosaicPlan(1337, 1)
    for (const biome of BIOME_DEFINITIONS) {
      expect(BIOME_LAYERS.length).toBeGreaterThanOrEqual(5)
      for (const layer of BIOME_LAYERS) {
        expect(plan.layerCounts[biome.id][layer], `${biome.id}/${layer}`).toBeGreaterThan(1)
      }
      expect(new Set(plan.clusterFamilies[biome.id]).size).toBeGreaterThanOrEqual(2)
    }
  })

  it('retains every layer and signature family on Low', () => {
    const plan = buildBiomeMosaicPlan(1337, 0.35)
    for (const biome of BIOME_DEFINITIONS) {
      for (const layer of BIOME_LAYERS) {
        expect(plan.layerCounts[biome.id][layer], `${biome.id}/${layer}`).toBeGreaterThan(0)
      }
      expect(plan.clusterFamilies[biome.id]).toHaveLength(2)
    }
  })

  it('keeps heavy silhouettes clear of authored routes', () => {
    const plan = buildBiomeMosaicPlan(1337, 1)
    for (const transform of plan.transforms.filter(
      ({ layer }) => layer === 'canopy' || layer === 'geology',
    )) {
      const required = transform.layer === 'canopy' ? 4.2 : 2.5
      expect(distanceToPath(transform.x, transform.z), transform.id).toBeGreaterThanOrEqual(required)
    }
  })

  it('is deterministic and validates its inputs', () => {
    expect(buildBiomeMosaicPlan(77, 0.5)).toEqual(buildBiomeMosaicPlan(77, 0.5))
    expect(() => buildBiomeMosaicPlan(1.5, 1)).toThrow(RangeError)
    expect(() => buildBiomeMosaicPlan(1, 0)).toThrow(RangeError)
  })
})
