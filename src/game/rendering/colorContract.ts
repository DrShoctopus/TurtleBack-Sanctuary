import {
  ACESFilmicToneMapping,
  NoColorSpace,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from 'three'

export interface RendererColorTarget {
  outputColorSpace: WebGLRenderer['outputColorSpace']
  toneMapping: WebGLRenderer['toneMapping']
  toneMappingExposure: number
}

export const RENDERER_COLOR_CONTRACT = {
  outputColorSpace: SRGBColorSpace,
  toneMapping: ACESFilmicToneMapping,
  exposure: 1.1,
} as const

export function configureRendererColor(renderer: RendererColorTarget): void {
  renderer.outputColorSpace = RENDERER_COLOR_CONTRACT.outputColorSpace
  renderer.toneMapping = RENDERER_COLOR_CONTRACT.toneMapping
  renderer.toneMappingExposure = RENDERER_COLOR_CONTRACT.exposure
}

export function markColorTexture<T extends Texture>(texture: T): T {
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function markDataTexture<T extends Texture>(texture: T): T {
  texture.colorSpace = NoColorSpace
  return texture
}
