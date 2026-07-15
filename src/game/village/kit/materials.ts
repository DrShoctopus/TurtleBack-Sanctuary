/**
 * The shared architectural material palette. Every merged building mesh pulls
 * from these keys so the whole village stays within a handful of draw calls
 * per structure and reads as one coherent place.
 */
import { Color, DoubleSide, MeshStandardMaterial, Vector2 } from 'three'
import { getSurfaceDetail, getTexture, type SurfaceDetailName } from '../../world/textures'
import { registerWetMaterial } from '../../weather/simpleWet'
import {
  applyPainterlySurface,
  painterlyFamilyOf,
  type PainterlySurfaceFamily,
} from '../../rendering/painterlyMaterials'

export type MatKey =
  | 'plasterWarm'
  | 'plasterCool'
  | 'plasterCeiling'
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

const PAINTERLY_MATERIAL_FAMILIES: Partial<Record<MatKey, PainterlySurfaceFamily>> = {
  woodWarm: 'paintedWood',
  woodDeck: 'paintedWood',
  woodDark: 'paintedWood',
  woodPale: 'paintedWood',
  concrete: 'rock',
  stoneCounter: 'rock',
  leafGreen: 'foliage',
  leafDeep: 'foliage',
  'paint.coral': 'paintedWood',
  'paint.night': 'paintedWood',
}

let cache: Map<MatKey, MeshStandardMaterial> | null = null
let exteriorCache: Map<MatKey, MeshStandardMaterial> | null = null

export function villageMaterials(): Map<MatKey, MeshStandardMaterial> {
  if (cache) return cache
  const m = new Map<MatKey, MeshStandardMaterial>()
  const mk = (key: MatKey, mat: MeshStandardMaterial) => {
    const family = PAINTERLY_MATERIAL_FAMILIES[key]
    if (family) applyPainterlySurface(mat, family)
    mat.name = key
    m.set(key, mat)
  }
  const detail = (name: SurfaceDetailName, scale: number) => ({
    ...getSurfaceDetail(name),
    normalScale: new Vector2(scale, scale),
  })

  mk(
    'plasterWarm',
    new MeshStandardMaterial({
      map: getTexture('plaster'),
      color: '#efe4d0',
      roughness: 0.94,
      ...detail('plaster', 0.2),
    }),
  )
  mk(
    'plasterCool',
    new MeshStandardMaterial({
      map: getTexture('plaster'),
      color: '#dde4e2',
      roughness: 0.94,
      ...detail('plaster', 0.2),
    }),
  )
  mk(
    'plasterCeiling',
    new MeshStandardMaterial({
      color: '#e8e8e0',
      roughness: 0.96,
    }),
  )
  mk(
    'plasterSage',
    new MeshStandardMaterial({
      map: getTexture('plaster'),
      color: '#cdd8c4',
      roughness: 0.94,
      ...detail('plaster', 0.2),
    }),
  )
  mk(
    'woodWarm',
    new MeshStandardMaterial({
      map: getTexture('woodFine'),
      color: '#c89a6d',
      roughness: 0.7,
      ...detail('woodFine', 0.34),
    }),
  )
  mk(
    'woodDeck',
    new MeshStandardMaterial({
      map: getTexture('woodPlanks'),
      color: '#b98f68',
      roughness: 0.82,
      ...detail('woodPlanks', 0.42),
    }),
  )
  mk(
    'woodDark',
    new MeshStandardMaterial({
      map: getTexture('woodFine'),
      color: '#6d4f38',
      roughness: 0.72,
      ...detail('woodFine', 0.36),
    }),
  )
  mk(
    'woodPale',
    new MeshStandardMaterial({
      map: getTexture('woodFine'),
      color: '#e2c9a4',
      roughness: 0.68,
      ...detail('woodFine', 0.3),
    }),
  )
  mk(
    'concrete',
    new MeshStandardMaterial({
      map: getTexture('concrete'),
      color: '#b7b3a8',
      roughness: 0.94,
      ...detail('concrete', 0.38),
    }),
  )
  mk(
    'stoneCounter',
    new MeshStandardMaterial({
      map: getTexture('concrete'),
      color: '#8d9295',
      roughness: 0.42,
      ...detail('concrete', 0.22),
    }),
  )
  mk(
    'metalBrushed',
    new MeshStandardMaterial({
      color: '#a7b0b5',
      roughness: 0.46,
      metalness: 0.82,
      ...detail('brushedMetal', 0.2),
    }),
  )
  mk(
    'metalDark',
    new MeshStandardMaterial({
      color: '#3c444c',
      roughness: 0.58,
      metalness: 0.62,
      ...detail('brushedMetal', 0.16),
    }),
  )
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
    new MeshStandardMaterial({
      map: getTexture('fabric'),
      color: '#d6c4a8',
      roughness: 0.98,
      ...detail('fabric', 0.32),
    }),
  )
  mk(
    'fabricTeal',
    new MeshStandardMaterial({
      map: getTexture('fabric'),
      color: '#7fa8a0',
      roughness: 0.98,
      ...detail('fabric', 0.32),
    }),
  )
  mk(
    'fabricRust',
    new MeshStandardMaterial({
      map: getTexture('fabric'),
      color: '#c08560',
      roughness: 0.98,
      ...detail('fabric', 0.32),
    }),
  )
  mk(
    'rugWeave',
    new MeshStandardMaterial({
      map: getTexture('fabric'),
      color: '#a9917a',
      roughness: 1,
      ...detail('fabric', 0.4),
    }),
  )
  mk('paperShade', new MeshStandardMaterial({ color: '#f6ead2', roughness: 0.9, side: DoubleSide }))
  mk('ceramicWhite', new MeshStandardMaterial({ color: '#eef0ec', roughness: 0.22 }))
  mk('ceramicTerracotta', new MeshStandardMaterial({ color: '#b06a4a', roughness: 0.8 }))
  mk('leafGreen', new MeshStandardMaterial({ color: '#5f8a4e', roughness: 0.95 }))
  mk('leafDeep', new MeshStandardMaterial({ color: '#3f6b42', roughness: 0.95 }))
  mk(
    'paint.coral',
    new MeshStandardMaterial({
      map: getTexture('plaster'),
      color: '#cf7f63',
      roughness: 0.9,
      ...detail('plaster', 0.18),
    }),
  )
  mk(
    'paint.night',
    new MeshStandardMaterial({
      map: getTexture('plaster'),
      color: '#31465a',
      roughness: 0.9,
      ...detail('plaster', 0.18),
    }),
  )
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
 * Exterior-only clones share texture memory with the interior palette but own
 * their color and roughness state, allowing rain response without wetting the
 * contents of every building.
 */
export function exteriorVillageMaterials(): Map<MatKey, MeshStandardMaterial> {
  if (exteriorCache) return exteriorCache
  const wettable = new Set<MatKey>([
    'plasterWarm',
    'plasterCool',
    'plasterSage',
    'woodWarm',
    'woodDeck',
    'woodDark',
    'woodPale',
    'concrete',
    'stoneCounter',
    'metalBrushed',
    'metalDark',
    'fabricSand',
    'fabricTeal',
    'fabricRust',
    'ceramicTerracotta',
    'paint.coral',
    'paint.night',
  ])
  exteriorCache = new Map()
  for (const [key, source] of villageMaterials()) {
    const material = source.clone()
    const family = painterlyFamilyOf(source)
    if (family) applyPainterlySurface(material, family)
    material.name = `${key}.exterior`
    exteriorCache.set(key, material)
    if (!wettable.has(key)) continue
    const isMetal = key === 'metalBrushed' || key === 'metalDark'
    const isFabric = key === 'fabricSand' || key === 'fabricTeal' || key === 'fabricRust'
    registerWetMaterial(material, {
      wetRoughness: isMetal
        ? Math.max(0.18, source.roughness * 0.62)
        : Math.max(0.28, source.roughness * 0.48),
      darken: isMetal ? 0.1 : isFabric ? 0.18 : 0.24,
    })
  }
  return exteriorCache
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
