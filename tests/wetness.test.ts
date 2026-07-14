import { describe, expect, it } from 'vitest'
import { MeshStandardMaterial } from 'three'
import { applySimpleWetness, registerWetMaterial } from '../src/game/weather/simpleWet'

describe('exterior material wetness', () => {
  it('darkens and smooths registered materials, then restores the dry state', () => {
    const material = new MeshStandardMaterial({ color: '#8090a0', roughness: 0.8 })
    const dryColor = material.color.clone()
    const wetColor = dryColor.clone().multiplyScalar(0.76)
    registerWetMaterial(material, { wetRoughness: 0.3, darken: 0.24 })

    applySimpleWetness(1)
    expect(material.roughness).toBeCloseTo(0.3)
    expect(material.color.r).toBeCloseTo(wetColor.r)
    expect(material.color.g).toBeCloseTo(wetColor.g)
    expect(material.color.b).toBeCloseTo(wetColor.b)

    applySimpleWetness(0)
    expect(material.roughness).toBeCloseTo(0.8)
    expect(material.color.r).toBeCloseTo(dryColor.r)
    expect(material.color.g).toBeCloseTo(dryColor.g)
    expect(material.color.b).toBeCloseTo(dryColor.b)
  })
})
