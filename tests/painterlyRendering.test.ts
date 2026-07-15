import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import {
  PAINTERLY_SURFACE_PROFILES,
  createPainterlyMaterial,
  decoratePainterlyShader,
  painterlyFamilyOf,
  applyPainterlySurface,
} from '../src/game/rendering/painterlyMaterials'
import {
  createPainterlyEnvironmentSample,
  samplePainterlyEnvironment,
} from '../src/game/rendering/painterlyPalette'
import { VegetationResourceOwner } from '../src/game/village/Vegetation'

describe('painterly material contract', () => {
  it('locks the six approved reusable surface families', () => {
    expect(Object.keys(PAINTERLY_SURFACE_PROFILES)).toEqual([
      'bark',
      'foliage',
      'rock',
      'soilPath',
      'paintedWood',
      'turtleSkin',
    ])
    for (const profile of Object.values(PAINTERLY_SURFACE_PROFILES)) {
      expect(profile.roughness).toBeGreaterThanOrEqual(0.8)
      expect(profile.tonalStrength).toBeLessThanOrEqual(0.3)
      expect(profile.rimStrength).toBeLessThanOrEqual(0.04)
    }
  })

  it('creates a material with stable family metadata and no outline pass', () => {
    const material = createPainterlyMaterial('foliage', { color: '#ffffff' })
    expect(painterlyFamilyOf(material)).toBe('foliage')
    expect(material.color.getHexString()).toBe(new Color('#ffffff').getHexString())
    expect(material.userData.outline).toBeUndefined()
    expect(material.customProgramCacheKey()).toContain('turtleback-painterly-v1:foliage')
    material.dispose()
  })

  it('restores shader decoration after Three.js clones only the family metadata', () => {
    const source = createPainterlyMaterial('paintedWood')
    const clone = source.clone()
    expect(painterlyFamilyOf(clone)).toBe('paintedWood')
    expect(clone.customProgramCacheKey()).not.toContain('turtleback-painterly-v1')

    applyPainterlySurface(clone, 'paintedWood')

    expect(clone.customProgramCacheKey()).toContain('turtleback-painterly-v1:paintedWood')
    source.dispose()
    clone.dispose()
  })

  it('injects soft tonal planes, macro variation, and directional fog bands', () => {
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main(){\n#include <project_vertex>\n}',
      fragmentShader:
        '#include <common>\nvoid main(){\nvec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\n#include <fog_fragment>\n}',
    }

    decoratePainterlyShader(shader, 'rock')

    expect(shader.vertexShader).toContain('vPainterlyWorldPosition')
    expect(shader.fragmentShader).toContain('smoothstep(0.12, 0.88, wrapped)')
    expect(shader.fragmentShader).toContain('macroField')
    expect(shader.fragmentShader).toContain('nearBand')
    expect(shader.fragmentShader).toContain('farBand')
    expect(shader.fragmentShader).not.toContain('#include <fog_fragment>')
    expect(Object.keys(shader.uniforms)).toContain('uPainterlyFogSun')
  })

  it('encodes explicit wind weights on every animated foliage family', () => {
    const owner = new VegetationResourceOwner()
    const resources = owner.resources
    const animated = [
      resources.grass.geometry,
      resources.flowers.geometry,
      resources.bushes.geometry,
      ...resources.trees.map((tree) => tree.geometry),
    ]
    for (const geometry of animated) {
      const weights = geometry.getAttribute('aWindWeight')
      expect(weights, geometry.uuid).toBeDefined()
      expect(weights.count).toBe(geometry.getAttribute('position').count)
      for (let index = 0; index < weights.count; index++) {
        expect(weights.getX(index)).toBeGreaterThanOrEqual(0)
        expect(weights.getX(index)).toBeLessThanOrEqual(1)
      }
    }
    expect(painterlyFamilyOf(resources.treeTrunkMaterial)).toBe('bark')
    expect(painterlyFamilyOf(resources.rocks.material)).toBe('rock')
    expect(resources.trees.every((tree) => painterlyFamilyOf(tree.material) === 'foliage')).toBe(
      true,
    )
    owner.dispose()
  })
})

describe('painterly atmosphere and grade', () => {
  it('keeps clear noon restrained and makes rain denser, cooler, and less saturated', () => {
    const clear = samplePainterlyEnvironment(createPainterlyEnvironmentSample(), 0.5, 0)
    const rain = samplePainterlyEnvironment(createPainterlyEnvironmentSample(), 0.5, 1)

    expect(clear.fogMid.getHexString()).toBe(new Color('#a3bbc0').getHexString())
    expect(clear.contrast).toBeGreaterThan(0)
    expect(Math.abs(clear.brightness)).toBeLessThan(0.03)
    expect(rain.fogDensity).toBeGreaterThan(clear.fogDensity)
    expect(rain.saturation).toBeLessThan(clear.saturation)
    expect(rain.fogMid.b).toBeGreaterThan(rain.fogMid.r)
  })

  it('retains readable lift at night without increasing saturation', () => {
    const noon = samplePainterlyEnvironment(createPainterlyEnvironmentSample(), 0.5, 0)
    const night = samplePainterlyEnvironment(createPainterlyEnvironmentSample(), 0.94, 0)

    expect(night.brightness).toBeGreaterThan(noon.brightness)
    expect(night.saturation).toBeLessThanOrEqual(0)
    expect(night.fogDensity).toBeGreaterThan(noon.fogDensity)
  })
})
