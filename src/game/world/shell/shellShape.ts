/**
 * The turtle shell's walkable surface as an analytic height function.
 * Everything (visual mesh, physics trimesh, building pads, footstep surfaces,
 * vegetation scattering) samples this one source of truth.
 */
import { clamp01, smoothstep } from '../../core/mathUtils'
import { ValueNoise2D } from '../../core/noise'
import { BUILDINGS, EXTRA_PADS, PATHS, type Pad } from '../../config/layout'
import { WORLD } from '../../config/constants'

export const SHELL_SEMI_X = WORLD.shellWidth / 2 // 170
export const SHELL_SEMI_Z = WORLD.shellLength / 2 // 250

const noise = new ValueNoise2D(911)
const ridgeNoise = new ValueNoise2D(517)

const ALL_PADS: Pad[] = [
  ...EXTRA_PADS,
  ...BUILDINGS.map((b) => ({ x: b.x, z: b.z, r: b.padR, h: b.padH, feather: 7 })),
]

/** Normalized elliptical radius: 0 at center, 1 at rim. */
export function shellRadius(x: number, z: number): number {
  const nx = x / SHELL_SEMI_X
  const nz = z / SHELL_SEMI_Z
  return Math.sqrt(nx * nx + nz * nz)
}

export function isInsideShell(x: number, z: number, margin = 1): boolean {
  return shellRadius(x, z) < margin
}

function gauss(d2: number, sigma: number): number {
  return Math.exp(-d2 / (2 * sigma * sigma))
}

/** Terrain before pad flattening. */
function baseHeight(x: number, z: number): number {
  const r = shellRadius(x, z)
  const rc = clamp01(r)
  // broad dome
  let h = WORLD.rimHeight + 7 * Math.pow(1 - rc * rc, 1.2)
  // central keel ridge along the spine, strongest mid-shell
  const spine = gauss(x * x, 26) * smoothstep(1, 0.35, Math.abs(z) / SHELL_SEMI_Z) * 1.9
  // two lateral ridges (costal scutes)
  const lat =
    (gauss((Math.abs(x) - 92) ** 2, 30) * 1.15 + gauss((Math.abs(x) - 150) ** 2, 18) * 0.5) *
    smoothstep(1, 0.45, Math.abs(z) / SHELL_SEMI_Z)
  // stern observatory mound
  const mound = gauss((x - 10) ** 2 + (z - 196) ** 2, 34) * 6.2
  // garden valley dip
  const valley = -gauss((x + 58) ** 2 + (z - 74) ** 2, 42) * 1.7
  // gentle scute undulation
  const scutes = (ridgeNoise.fbm(x * 0.012 + 7, z * 0.012, 3) - 0.5) * 2.6
  const micro = (noise.fbm(x * 0.05, z * 0.05, 3) - 0.5) * 0.55
  h += spine + lat + mound + valley + scutes * smoothstep(0.15, 0.55, rc) + micro
  // roll off toward the rim so the outer deck reads as the shell lip
  h = h * smoothstep(1.06, 0.985, rc) + WORLD.rimHeight * (1 - smoothstep(1.06, 0.985, rc))
  return h
}

function padBlend(x: number, z: number, h: number): number {
  let out = h
  for (const p of ALL_PADS) {
    const dx = x - p.x
    const dz = z - p.z
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d < p.r + p.feather) {
      const w = 1 - smoothstep(p.r, p.r + p.feather, d)
      out = out + (p.h - out) * w
    }
  }
  return out
}

/** Walkable terrain height at (x,z). */
export function terrainHeight(x: number, z: number): number {
  return padBlend(x, z, baseHeight(x, z))
}

/** Approximate surface normal via central differences. */
export function terrainNormal(x: number, z: number, eps = 0.6): [number, number, number] {
  const hl = terrainHeight(x - eps, z)
  const hr = terrainHeight(x + eps, z)
  const hd = terrainHeight(x, z - eps)
  const hu = terrainHeight(x, z + eps)
  const nx = hl - hr
  const nz = hd - hu
  const ny = 2 * eps
  const l = Math.hypot(nx, ny, nz) || 1
  return [nx / l, ny / l, nz / l]
}

// ---------------------------------------------------------------------------
// Path splat: distance to route polylines → stone-path weight
// ---------------------------------------------------------------------------

interface Seg {
  ax: number
  az: number
  bx: number
  bz: number
}

const SEGS: Seg[] = []
for (const line of PATHS) {
  for (let i = 0; i < line.length - 1; i++) {
    SEGS.push({ ax: line[i].x, az: line[i].z, bx: line[i + 1].x, bz: line[i + 1].z })
  }
}

export function distanceToPath(x: number, z: number): number {
  let best = Infinity
  for (const s of SEGS) {
    const vx = s.bx - s.ax
    const vz = s.bz - s.az
    const wx = x - s.ax
    const wz = z - s.az
    const len2 = vx * vx + vz * vz || 1
    const t = clamp01((wx * vx + wz * vz) / len2)
    const dx = wx - vx * t
    const dz = wz - vz * t
    const d2 = dx * dx + dz * dz
    if (d2 < best) best = d2
  }
  return Math.sqrt(best)
}

export interface SplatWeights {
  path: number
  grass: number
  rock: number
}

/** Terrain material weights at a point (path stone / grass / bare shell). */
export function splatWeights(x: number, z: number): SplatWeights {
  const r = shellRadius(x, z)
  const dPath = distanceToPath(x, z)
  let path = 1 - smoothstep(1.7, 3.1, dPath)
  // plaza disc is fully paved
  const dPlaza = Math.hypot(x - 0, z + 40)
  path = Math.max(path, 1 - smoothstep(22, 26, dPlaza))
  const slope = 1 - terrainNormal(x, z)[1]
  let rock = smoothstep(0.86, 0.99, r) + smoothstep(0.16, 0.34, slope)
  rock = clamp01(rock + (ridgeNoise.fbm(x * 0.02, z * 0.02, 2) - 0.62) * 0.9)
  const lushness = noise.fbm(x * 0.008 + 3, z * 0.008, 3)
  let grass = clamp01(0.35 + lushness * 0.9 - rock)
  const gardenBoost = gauss((x + 58) ** 2 + (z - 74) ** 2, 55) * 0.5
  grass = clamp01(grass + gardenBoost)
  const total = Math.max(1, path + rock + grass)
  return { path: path, grass: clamp01(grass * (1 - path)), rock: clamp01(rock * (1 - path)) * (1 / total) }
}

// ---------------------------------------------------------------------------
// Footstep surface sampling (village registers deck/interior overrides)
// ---------------------------------------------------------------------------

export type FootSurface = 'grass' | 'stone' | 'wood' | 'shell' | 'interior'

interface SurfaceBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  surface: FootSurface
}

const surfaceBoxes: SurfaceBox[] = []

export function registerSurfaceBox(box: SurfaceBox): () => void {
  surfaceBoxes.push(box)
  return () => {
    const i = surfaceBoxes.indexOf(box)
    if (i >= 0) surfaceBoxes.splice(i, 1)
  }
}

export function sampleSurfaceAt(x: number, z: number, indoors: boolean): FootSurface {
  if (indoors) return 'interior'
  for (const b of surfaceBoxes) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return b.surface
  }
  const w = splatWeights(x, z)
  if (w.path > 0.45) return 'stone'
  if (w.rock > 0.5) return 'shell'
  return 'grass'
}
