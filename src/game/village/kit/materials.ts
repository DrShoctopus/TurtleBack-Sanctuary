/**
 * The shared architectural material palette. Every merged building mesh pulls
 * from these keys so the whole village stays within a handful of draw calls
 * per structure and reads as one coherent place.
 */
import { Color, DoubleSide, MeshStandardMaterial } from 'three'
import { getTexture } from '../../world/textures'

export type MatKey =
  | 'plasterWarm'
  | 'plasterCool'
  | 'plasterSage'
  | 'woodWarm'
  | 'woodDeck'
  | 'woodDark'
  | 'woodPale'
  | 'concrete'
  | 'stoneCounter'
  | 'metalBrushed'
  | 'metalDark'
  | 'glass'
  | 'fabricSand'
  | 'fabricTeal'
  | 'fabricRust'
  | 'rugWeave'
  | 'paperShade'
  | 'ceramicWhite'
  | 'ceramicTerracotta'
  | 'leafGreen'
  | 'leafDeep'
  | 'paint.coral'
  | 'paint.night'
  | 'water'

let cache: Map<MatKey, MeshStandardMaterial> | null = null

export function villageMaterials(): Map<MatKey, MeshStandardMaterial> {
  if (cache) return cache
  const m = new Map<MatKey, MeshStandardMaterial>()
  const mk = (key: MatKey, mat: MeshStandardMaterial) => {
    mat.name = key
    m.set(key, mat)
  }

  mk(
    'plasterWarm',
    new MeshStandardMaterial({ map: getTexture('plaster'), color: '#efe4d0', roughness: 0.94 }),
  )
  mk(
    'plasterCool',
    new MeshStandardMaterial({ map: getTexture('plaster'), color: '#dde4e2', roughness: 0.94 }),
  )
  mk(
    'plasterSage',
    new MeshStandardMaterial({ map: getTexture('plaster'), color: '#cdd8c4', roughness: 0.94 }),
  )
  mk(
    'woodWarm',
    new MeshStandardMaterial({ map: getTexture('woodFine'), color: '#c89a6d', roughness: 0.62 }),
  )
  mk(
    'woodDeck',
    new MeshStandardMaterial({ map: getTexture('woodPlanks'), color: '#b98f68', roughness: 0.78 }),
  )
  mk(
    'woodDark',
    new MeshStandardMaterial({ map: getTexture('woodFine'), color: '#6d4f38', roughness: 0.66 }),
  )
  mk(
    'woodPale',
    new MeshStandardMaterial({ map: getTexture('woodFine'), color: '#e2c9a4', roughness: 0.6 }),
  )
  mk(
    'concrete',
    new MeshStandardMaterial({ map: getTexture('concrete'), color: '#b7b3a8', roughness: 0.9 }),
  )
  mk(
    'stoneCounter',
    new MeshStandardMaterial({ map: getTexture('concrete'), color: '#8d9295', roughness: 0.35 }),
  )
  mk(
    'metalBrushed',
    new MeshStandardMaterial({ color: '#9aa4ab', roughness: 0.38, metalness: 0.8 }),
  )
  mk('metalDark', new MeshStandardMaterial({ color: '#3c444c', roughness: 0.5, metalness: 0.6 }))
  mk(
    'glass',
    new MeshStandardMaterial({
      color: '#a8c8d4',
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.32,
      side: DoubleSide,
      depthWrite: false,
    }),
  )
  mk(
    'fabricSand',
    new MeshStandardMaterial({ map: getTexture('fabric'), color: '#d6c4a8', roughness: 0.95 }),
  )
  mk(
    'fabricTeal',
    new MeshStandardMaterial({ map: getTexture('fabric'), color: '#7fa8a0', roughness: 0.95 }),
  )
  mk(
    'fabricRust',
    new MeshStandardMaterial({ map: getTexture('fabric'), color: '#c08560', roughness: 0.95 }),
  )
  mk(
    'rugWeave',
    new MeshStandardMaterial({ map: getTexture('fabric'), color: '#a9917a', roughness: 1 }),
  )
  mk('paperShade', new MeshStandardMaterial({ color: '#f6ead2', roughness: 0.9, side: DoubleSide }))
  mk('ceramicWhite', new MeshStandardMaterial({ color: '#eef0ec', roughness: 0.22 }))
  mk('ceramicTerracotta', new MeshStandardMaterial({ color: '#b06a4a', roughness: 0.8 }))
  mk('leafGreen', new MeshStandardMaterial({ color: '#5f8a4e', roughness: 0.95 }))
  mk('leafDeep', new MeshStandardMaterial({ color: '#3f6b42', roughness: 0.95 }))
  mk('paint.coral', new MeshStandardMaterial({ color: '#cf7f63', roughness: 0.85 }))
  mk('paint.night', new MeshStandardMaterial({ color: '#31465a', roughness: 0.85 }))
  mk(
    'water',
    new MeshStandardMaterial({
      color: '#4e93a8',
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.82,
    }),
  )

  cache = m
  return m
}

/**
 * Per-building window glow: a thin emissive pane just inside each window.
 * Transparent and invisible by day (you see straight through the glass to the
 * exterior); at night its opacity + emissive rise so windows read warm from
 * outside. Cloned per building so warmth can vary with the home setting.
 */
export function makeWindowGlowMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: '#2a2018',
    emissive: new Color('#ffbe78'),
    emissiveIntensity: 0,
    roughness: 1,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
}
