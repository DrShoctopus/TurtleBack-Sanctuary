/**
 * Geometry composition kit. Buildings and props append transformed primitive
 * "parts" to a BuildPlan; merge() collapses them into one BufferGeometry per
 * material so a fully furnished building renders in <10 draw calls.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from './merge'
import type { MatKey } from './materials'

// -- primitive cache ---------------------------------------------------------

const geoCache = new Map<string, BufferGeometry>()

export function boxGeo(): BufferGeometry {
  let g = geoCache.get('box')
  if (!g) {
    g = new BoxGeometry(1, 1, 1)
    geoCache.set('box', g)
  }
  return g
}

export function cylGeo(segments = 16): BufferGeometry {
  const key = `cyl${segments}`
  let g = geoCache.get(key)
  if (!g) {
    g = new CylinderGeometry(0.5, 0.5, 1, segments)
    geoCache.set(key, g)
  }
  return g
}

export function coneGeo(segments = 12): BufferGeometry {
  const key = `cone${segments}`
  let g = geoCache.get(key)
  if (!g) {
    g = new CylinderGeometry(0.02, 0.5, 1, segments)
    geoCache.set(key, g)
  }
  return g
}

export function sphereGeo(detail = 14): BufferGeometry {
  const key = `sph${detail}`
  let g = geoCache.get(key)
  if (!g) {
    g = new SphereGeometry(0.5, detail, Math.max(8, Math.floor(detail * 0.75)))
    geoCache.set(key, g)
  }
  return g
}

// -- build plan ---------------------------------------------------------------

export interface ColliderSpec {
  pos: [number, number, number]
  size: [number, number, number]
  rotY?: number
}

export interface PartTransform {
  pos: [number, number, number]
  size?: [number, number, number]
  rot?: [number, number, number]
}

const tmpMat = new Matrix4()
const tmpPos = new Vector3()
const tmpQuat = new Quaternion()
const tmpEuler = new Euler()
const tmpScale = new Vector3()

export class BuildPlan {
  private parts = new Map<MatKey, BufferGeometry[]>()
  colliders: ColliderSpec[] = []

  /** Append a primitive at pos with size (scale) and rotation. */
  add(geo: BufferGeometry, mat: MatKey, t: PartTransform): void {
    const clone = geo.clone()
    tmpPos.set(...t.pos)
    tmpEuler.set(t.rot?.[0] ?? 0, t.rot?.[1] ?? 0, t.rot?.[2] ?? 0)
    tmpQuat.setFromEuler(tmpEuler)
    tmpScale.set(...(t.size ?? [1, 1, 1]))
    tmpMat.compose(tmpPos, tmpQuat, tmpScale)
    clone.applyMatrix4(tmpMat)
    let list = this.parts.get(mat)
    if (!list) {
      list = []
      this.parts.set(mat, list)
    }
    list.push(clone)
  }

  box(mat: MatKey, t: PartTransform): void {
    this.add(boxGeo(), mat, t)
  }

  cyl(mat: MatKey, t: PartTransform, segments = 16): void {
    this.add(cylGeo(segments), mat, t)
  }

  sphere(mat: MatKey, t: PartTransform, detail = 14): void {
    this.add(sphereGeo(detail), mat, t)
  }

  solid(mat: MatKey, t: PartTransform & { size: [number, number, number] }, collide = true): void {
    this.box(mat, t)
    if (collide) this.colliders.push({ pos: t.pos, size: t.size, rotY: t.rot?.[1] })
  }

  collider(spec: ColliderSpec): void {
    this.colliders.push(spec)
  }

  /** Collapse into one geometry per material key. Source clones are disposed. */
  merge(): Array<{ mat: MatKey; geometry: BufferGeometry }> {
    const out: Array<{ mat: MatKey; geometry: BufferGeometry }> = []
    for (const [mat, list] of this.parts) {
      if (list.length === 0) continue
      const merged = mergeGeometries(list, false)
      if (merged) {
        merged.computeBoundingSphere()
        out.push({ mat, geometry: merged })
      }
      for (const g of list) g.dispose()
    }
    this.parts.clear()
    return out
  }
}

// -- composite helpers ---------------------------------------------------------

export interface Opening {
  /** center offset along the wall from its center */
  x: number
  w: number
  h: number
  /** bottom of opening above floor */
  sill: number
}

/**
 * Axis-aligned wall (local +x along its length) with rectangular openings.
 * Emits solid boxes (visual + collider) that leave the openings clear.
 */
export function wallWithOpenings(
  plan: BuildPlan,
  mat: MatKey,
  opts: {
    length: number
    height: number
    thickness: number
    /** wall center position (y = floor level) */
    pos: [number, number, number]
    rotY?: number
    openings?: Opening[]
  },
): void {
  const { length, height, thickness } = opts
  const [cx, floorY, cz] = opts.pos
  const rotY = opts.rotY ?? 0
  const openings = [...(opts.openings ?? [])].sort((a, b) => a.x - b.x)
  const cos = Math.cos(rotY)
  const sin = Math.sin(rotY)
  const place = (localX: number, y: number, w: number, h: number) => {
    const px = cx + localX * cos
    const pz = cz - localX * sin
    plan.solid(mat, {
      pos: [px, floorY + y, pz],
      size: [w, h, thickness],
      rot: [0, rotY, 0],
    })
  }
  let cursor = -length / 2
  for (const o of openings) {
    const left = o.x - o.w / 2
    if (left > cursor + 0.01) {
      const w = left - cursor
      place(cursor + w / 2, height / 2, w, height)
    }
    // below sill
    if (o.sill > 0.01) place(o.x, o.sill / 2, o.w, o.sill)
    // above header
    const top = o.sill + o.h
    if (top < height - 0.01) place(o.x, (height + top) / 2, o.w, height - top)
    cursor = o.x + o.w / 2
  }
  if (cursor < length / 2 - 0.01) {
    const w = length / 2 - cursor
    place(cursor + w / 2, height / 2, w, height)
  }
}
