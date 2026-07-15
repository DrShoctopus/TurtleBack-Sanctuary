import { BoxGeometry, DataTexture, Group, Mesh, MeshStandardMaterial } from 'three'
import { markColorTexture } from '../rendering/colorContract'
import type { ProceduralFallbackFactories } from './AssetManager'

function createDebugBox() {
  const scene = new Group()
  scene.name = 'procedural.debug-box'
  scene.add(
    new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: 0xff00ff, roughness: 0.72, metalness: 0 }),
    ),
  )
  return { scene, animations: [] }
}

function createDebugChecker(): DataTexture {
  const magenta = [255, 0, 255, 255]
  const black = [0, 0, 0, 255]
  const texture = markColorTexture(
    new DataTexture(new Uint8Array([...magenta, ...black, ...black, ...magenta]), 2, 2),
  )
  texture.name = 'procedural.debug-checker'
  texture.needsUpdate = true
  return texture
}

export const proceduralFallbacks = {
  models: {
    'procedural.debug-box': createDebugBox,
  },
  textures: {
    'procedural.debug-checker': createDebugChecker,
  },
} satisfies ProceduralFallbackFactories

export const PROCEDURAL_FALLBACK_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(proceduralFallbacks.models),
  ...Object.keys(proceduralFallbacks.textures),
  // Buffered audio consumers treat this key as an intentional no-op rather
  // than substituting an unrelated sound when an optional cue cannot decode.
  'procedural.silence',
])
