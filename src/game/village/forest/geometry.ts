import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  PlaneGeometry,
  TorusGeometry,
} from 'three'
import { mergeGeometries } from '../kit/merge'
import { TREE_FORM_IDS } from './layout'

export interface ForestTreeGeometry {
  trunk: BufferGeometry
  canopy: BufferGeometry
}

function mergeAndDispose(geometries: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) throw new Error('Crownwood geometry merge failed')
  return merged
}

function trunkSegment(input: {
  height: number
  bottom: number
  top: number
  x?: number
  y?: number
  z?: number
  tiltZ?: number
  tiltX?: number
  radial?: number
}): BufferGeometry {
  const geometry = new CylinderGeometry(
    input.top,
    input.bottom,
    input.height,
    input.radial ?? 8,
    2,
  )
  geometry.rotateZ(input.tiltZ ?? 0)
  geometry.rotateX(input.tiltX ?? 0)
  geometry.translate(input.x ?? 0, input.y ?? input.height * 0.5, input.z ?? 0)
  return geometry
}

function canopyLobe(
  radius: number,
  x: number,
  y: number,
  z: number,
  scaleY: number,
  detail: 0 | 1,
): BufferGeometry {
  const geometry = new IcosahedronGeometry(radius, detail)
  geometry.scale(1, scaleY, 0.92)
  geometry.translate(x, y, z)
  return geometry
}

function coniferTier(
  y: number,
  radius: number,
  height: number,
  radial: number,
  offsetX = 0,
): BufferGeometry {
  const geometry = new ConeGeometry(radius, height, radial, 2)
  geometry.translate(offsetX, y, 0)
  return geometry
}

function makeAncientForm(index: number, lod: 0 | 1 | 2): ForestTreeGeometry {
  const fork = index === 1
  const broken = index === 2
  const radial = lod === 0 ? 9 : lod === 1 ? 7 : 5
  const height = broken ? 8.5 : 10.4
  const trunks: BufferGeometry[] = [
    trunkSegment({ height, bottom: 0.72, top: 0.31, radial }),
  ]
  if (lod < 2) {
    // Broad buttress roots and stable silhouette branches make old growth read
    // at player height instead of as uniformly tapered poles.
    for (let root = 0; root < (lod === 0 ? 5 : 3); root += 1) {
      const angle = (root / 5) * Math.PI * 2 + index * 0.31
      const rootGeometry = trunkSegment({
        height: 2.15,
        bottom: 0.3,
        top: 0.07,
        x: Math.cos(angle) * 0.58,
        y: 0.64,
        z: Math.sin(angle) * 0.58,
        tiltZ: Math.PI / 2 - angle * 0.12,
        tiltX: Math.sin(angle) * 0.7,
        radial: 6,
      })
      trunks.push(rootGeometry)
    }
    trunks.push(
      trunkSegment({
        height: 3.7,
        bottom: 0.22,
        top: 0.08,
        x: 0.78,
        y: 6.8,
        tiltZ: -0.9,
        radial: 6,
      }),
    )
    if (fork) {
      trunks.push(
        trunkSegment({
          height: 5.2,
          bottom: 0.35,
          top: 0.12,
          x: -0.56,
          y: 7.25,
          tiltZ: 0.24,
          radial: 7,
        }),
      )
    }
  }

  const lobes: BufferGeometry[] = []
  const detail = lod === 0 ? 1 : 0
  const lobeCount = lod === 0 ? 8 : lod === 1 ? 5 : 2
  for (let lobe = 0; lobe < lobeCount; lobe += 1) {
    const angle = lobe * 2.31 + index * 0.8
    const level = lobe % 3
    const radius = (lod === 2 ? 2.35 : 1.55 + (lobe % 2) * 0.36) * (broken ? 0.92 : 1)
    const spread = lod === 2 ? 0.25 : 1.15 + level * 0.2
    lobes.push(
      canopyLobe(
        radius,
        Math.cos(angle) * spread + (fork ? -0.22 : 0),
        6.5 + level * 1.28 + (broken ? -0.6 : 0),
        Math.sin(angle) * spread,
        0.54,
        detail,
      ),
    )
  }
  if (!broken && lod < 2) lobes.push(canopyLobe(1.25, 0, 10.1, 0, 0.72, detail))
  return { trunk: mergeAndDispose(trunks), canopy: mergeAndDispose(lobes) }
}

function makeWindPineForm(index: number, lod: 0 | 1 | 2): ForestTreeGeometry {
  const local = index - 3
  const radial = lod === 0 ? 8 : lod === 1 ? 6 : 5
  const lean = local === 0 ? -0.14 : local === 1 ? 0.1 : -0.04
  const height = 9.2 + local * 0.62
  const trunks: BufferGeometry[] = [
    trunkSegment({ height, bottom: 0.42, top: 0.14, tiltZ: lean, radial }),
  ]
  if (lod < 2) {
    const branchCount = lod === 0 ? 5 : 3
    for (let branch = 0; branch < branchCount; branch += 1) {
      const side = branch % 2 === 0 ? 1 : -1
      trunks.push(
        trunkSegment({
          height: 2.8 - branch * 0.15,
          bottom: 0.14,
          top: 0.035,
          x: side * (0.55 + branch * 0.08),
          y: 4.2 + branch * 0.92,
          z: ((branch % 3) - 1) * 0.3,
          tiltZ: side * -1.05,
          radial: 5,
        }),
      )
    }
  }

  const tiers: BufferGeometry[] = []
  const count = lod === 0 ? 7 : lod === 1 ? 5 : 3
  for (let tier = 0; tier < count; tier += 1) {
    const normalized = tier / Math.max(1, count - 1)
    const fan = local === 1 ? 1.24 : 1
    tiers.push(
      coniferTier(
        3.7 + normalized * 5.7,
        (1.95 - normalized * 1.1) * fan,
        lod === 2 ? 2.55 : 1.7 + (1 - normalized) * 0.7,
        lod === 0 ? 11 : lod === 1 ? 8 : 6,
        lean * (3.2 + normalized * 4.8) + (local === 1 ? normalized * 0.72 : 0),
      ),
    )
  }
  return { trunk: mergeAndDispose(trunks), canopy: mergeAndDispose(tiers) }
}

function makeBroadleafForm(index: number, lod: 0 | 1 | 2): ForestTreeGeometry {
  const local = index - 6
  const radial = lod === 0 ? 9 : lod === 1 ? 7 : 5
  const trunks: BufferGeometry[] = [
    trunkSegment({ height: 7.2, bottom: 0.58, top: 0.24, radial }),
  ]
  if (lod < 2) {
    const branchPairs = lod === 0 ? 3 : 2
    for (let branch = 0; branch < branchPairs; branch += 1) {
      const side = branch % 2 === 0 ? 1 : -1
      trunks.push(
        trunkSegment({
          height: 3.8 - branch * 0.25,
          bottom: 0.24,
          top: 0.075,
          x: side * 0.82,
          y: 5.45 + branch * 0.52,
          z: (branch - 1) * 0.42,
          tiltZ: side * -0.72,
          tiltX: (branch - 1) * 0.14,
          radial: 6,
        }),
      )
    }
    if (local === 1) {
      trunks.push(
        trunkSegment({
          height: 5.2,
          bottom: 0.36,
          top: 0.12,
          x: -0.72,
          y: 5.8,
          tiltZ: 0.3,
          radial: 7,
        }),
      )
    }
  }

  const lobes: BufferGeometry[] = []
  const count = lod === 0 ? 10 : lod === 1 ? 6 : 2
  const detail = lod === 0 ? 1 : 0
  for (let lobe = 0; lobe < count; lobe += 1) {
    const angle = lobe * 2.17 + local * 0.67
    const ring = lobe % 3
    const archOffset = local === 2 ? Math.sin(angle) * 0.7 : 0
    lobes.push(
      canopyLobe(
        lod === 2 ? 2.75 : 1.55 + (lobe % 2) * 0.42,
        Math.cos(angle) * (1.25 + ring * 0.34) + archOffset,
        6.5 + ring * 0.72,
        Math.sin(angle) * (1.2 + ring * 0.28),
        local === 0 ? 0.68 : 0.58,
        detail,
      ),
    )
  }
  return { trunk: mergeAndDispose(trunks), canopy: mergeAndDispose(lobes) }
}

export function makeForestTreeForms(lod: 0 | 1 | 2): readonly ForestTreeGeometry[] {
  return TREE_FORM_IDS.map((_, index) => {
    if (index < 3) return makeAncientForm(index, lod)
    if (index < 6) return makeWindPineForm(index, lod)
    return makeBroadleafForm(index, lod)
  })
}

/** Stable base-to-tip response shared by every living Crownwood silhouette. */
export function addForestWindWeight(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position')
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let index = 0; index < position.count; index += 1) {
    minY = Math.min(minY, position.getY(index))
    maxY = Math.max(maxY, position.getY(index))
  }
  const weights = new Float32Array(position.count)
  const span = Math.max(0.001, maxY - minY)
  for (let index = 0; index < position.count; index += 1) {
    const normalized = (position.getY(index) - minY) / span
    weights[index] = normalized * normalized
  }
  geometry.setAttribute('aWindWeight', new BufferAttribute(weights, 1))
}

function leafBlade(height: number, width: number): BufferGeometry {
  const geometry = new PlaneGeometry(width, height, 1, 2)
  geometry.translate(0, height * 0.5, 0)
  return geometry
}

export function makeFernGeometry(): BufferGeometry {
  const leaves: BufferGeometry[] = []
  for (let leaf = 0; leaf < 11; leaf += 1) {
    const angle = (leaf / 11) * Math.PI * 2
    const blade = leafBlade(0.82 + (leaf % 3) * 0.12, 0.23)
    blade.rotateX(-0.56 - (leaf % 2) * 0.14)
    blade.rotateY(angle)
    blade.translate(Math.cos(angle) * 0.17, 0.05, Math.sin(angle) * 0.17)
    leaves.push(blade)
  }
  const geometry = mergeAndDispose(leaves)
  addForestWindWeight(geometry)
  return geometry
}

export function makeSaplingGeometry(): BufferGeometry {
  const indexedStem = new CylinderGeometry(0.035, 0.06, 1.8, 5)
  const stem = indexedStem.toNonIndexed()
  indexedStem.dispose()
  stem.translate(0, 0.9, 0)
  const crownA = canopyLobe(0.56, 0, 1.65, 0, 0.75, 0)
  const crownB = canopyLobe(0.42, 0.28, 1.38, 0.08, 0.62, 0)
  // The faceted crowns are non-indexed; normalize the stem above while keeping
  // the compatible UV channel supplied by both primitive families.
  const geometry = mergeAndDispose([stem, crownA, crownB])
  addForestWindWeight(geometry)
  return geometry
}

export function makeGroundCoverGeometry(): BufferGeometry {
  const patches: BufferGeometry[] = []
  for (let patch = 0; patch < 5; patch += 1) {
    const angle = patch * 2.24
    const leaf = new IcosahedronGeometry(0.24 + (patch % 2) * 0.08, 0)
    leaf.scale(1.6, 0.22, 0.82)
    leaf.rotateY(angle)
    leaf.translate(Math.cos(angle) * 0.32, 0.08, Math.sin(angle) * 0.32)
    patches.push(leaf)
  }
  return mergeAndDispose(patches)
}

export function makeDeadfallGeometry(): BufferGeometry {
  const log = new CylinderGeometry(0.34, 0.44, 3.8, 8, 2)
  log.rotateZ(Math.PI / 2)
  log.translate(0, 0.38, 0)
  const branchA = trunkSegment({
    height: 1.7,
    bottom: 0.12,
    top: 0.025,
    x: 0.65,
    y: 0.55,
    tiltZ: -1.05,
    tiltX: 0.45,
    radial: 5,
  })
  const branchB = trunkSegment({
    height: 1.2,
    bottom: 0.09,
    top: 0.02,
    x: -0.82,
    y: 0.48,
    tiltZ: 1.08,
    tiltX: -0.32,
    radial: 5,
  })
  return mergeAndDispose([log, branchA, branchB])
}

export function makeBoulderClusterGeometry(): BufferGeometry {
  const specs = [
    [0, 0.54, 0, 1.1, 0.86, 0.94],
    [0.72, 0.32, 0.18, 0.62, 0.52, 0.68],
    [-0.62, 0.28, -0.12, 0.56, 0.46, 0.61],
  ] as const
  return mergeAndDispose(
    specs.map(([x, y, z, sx, sy, sz]) => {
      const boulder = new IcosahedronGeometry(0.72, 1)
      boulder.scale(sx, sy, sz)
      boulder.rotateY(x * 0.8 + z)
      boulder.translate(x, y, z)
      return boulder
    }),
  )
}

export function makeRootArchGeometry(): BufferGeometry {
  const arch = new TorusGeometry(1.45, 0.18, 6, 18, Math.PI)
  arch.rotateX(Math.PI / 2)
  arch.rotateZ(Math.PI)
  arch.translate(0, 0.12, 0)
  const left = trunkSegment({ height: 0.85, bottom: 0.27, top: 0.17, x: -1.45, radial: 6 })
  const right = trunkSegment({ height: 0.85, bottom: 0.27, top: 0.17, x: 1.45, radial: 6 })
  return mergeAndDispose([arch, left, right])
}

export function makeMushroomClusterGeometry(): BufferGeometry {
  const pieces: BufferGeometry[] = []
  for (let mushroom = 0; mushroom < 7; mushroom += 1) {
    const angle = mushroom * 2.36
    const radius = 0.22 + (mushroom % 3) * 0.08
    const height = 0.2 + (mushroom % 2) * 0.12
    const stem = new CylinderGeometry(radius * 0.2, radius * 0.28, height, 6)
    stem.translate(Math.cos(angle) * 0.44, height * 0.5, Math.sin(angle) * 0.44)
    const cap = new ConeGeometry(radius, radius * 0.42, 8)
    cap.translate(Math.cos(angle) * 0.44, height + radius * 0.12, Math.sin(angle) * 0.44)
    pieces.push(stem, cap)
  }
  return mergeAndDispose(pieces)
}
