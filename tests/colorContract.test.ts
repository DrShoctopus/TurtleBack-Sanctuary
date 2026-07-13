import {
  ACESFilmicToneMapping,
  DataTexture,
  NoColorSpace,
  NoToneMapping,
  SRGBColorSpace,
} from 'three'
import { describe, expect, it } from 'vitest'
import {
  configureRendererColor,
  markColorTexture,
  markDataTexture,
  type RendererColorTarget,
} from '@/game/rendering/colorContract'

describe('renderer color contract', () => {
  it('configures ACES and sRGB output explicitly', () => {
    const renderer: RendererColorTarget = {
      outputColorSpace: NoColorSpace,
      toneMapping: NoToneMapping,
      toneMappingExposure: 0,
    }

    configureRendererColor(renderer)

    expect(renderer.outputColorSpace).toBe(SRGBColorSpace)
    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping)
    expect(renderer.toneMappingExposure).toBe(1.05)
  })

  it('marks color and data textures differently while preserving identity', () => {
    const colorTexture = new DataTexture()
    const dataTexture = new DataTexture()

    expect(markColorTexture(colorTexture)).toBe(colorTexture)
    expect(colorTexture.colorSpace).toBe(SRGBColorSpace)
    expect(markDataTexture(dataTexture)).toBe(dataTexture)
    expect(dataTexture.colorSpace).toBe(NoColorSpace)
  })
})
