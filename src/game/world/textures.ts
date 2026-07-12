/**
 * Procedural CanvasTexture factory — every texture in the game is generated
 * here at runtime from seeded noise (no binary assets, nothing copyrighted).
 * Textures are cached; call disposeAllTextures() on teardown.
 */
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three'
import { mulberry32, type Rng } from '../core/rng'

const cache = new Map<string, CanvasTexture>()
const surfaceCache = new Map<string, { normalMap: CanvasTexture; roughnessMap: CanvasTexture }>()

export type SurfaceDetailName =
  'plaster' | 'woodFine' | 'woodPlanks' | 'concrete' | 'fabric' | 'brushedMetal' | 'ground'

function makeCanvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  return { c, ctx }
}

function finish(c: HTMLCanvasElement, colorSpace = true): CanvasTexture {
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  if (colorSpace) tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function speckle(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  size: number,
  count: number,
  rMin: number,
  rMax: number,
  colors: string[],
  alpha: number,
): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)]
    ctx.globalAlpha = alpha * (0.4 + rng() * 0.6)
    const r = rMin + rng() * (rMax - rMin)
    ctx.beginPath()
    ctx.arc(rng() * size, rng() * size, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function getTexture(name: string): CanvasTexture {
  const cached = cache.get(name)
  if (cached) return cached
  const gen = GENERATORS[name]
  if (!gen) throw new Error(`Unknown procedural texture "${name}"`)
  const tex = gen()
  cache.set(name, tex)
  return tex
}

export function disposeAllTextures(): void {
  for (const t of cache.values()) t.dispose()
  for (const detail of surfaceCache.values()) {
    detail.normalMap.dispose()
    detail.roughnessMap.dispose()
  }
  cache.clear()
  surfaceCache.clear()
}

/** Seeded, tileable tangent-space normal + roughness detail for PBR materials. */
export function getSurfaceDetail(name: SurfaceDetailName): {
  normalMap: CanvasTexture
  roughnessMap: CanvasTexture
} {
  const cached = surfaceCache.get(name)
  if (cached) return cached
  const generated = generateSurfaceDetail(SURFACE_CONFIG[name])
  surfaceCache.set(name, generated)
  return generated
}

interface SurfaceConfig {
  seed: number
  kind: 'mineral' | 'wood' | 'weave' | 'brushed'
  normalStrength: number
  roughness: number
  roughnessVariance: number
}

const SURFACE_CONFIG: Record<SurfaceDetailName, SurfaceConfig> = {
  plaster: {
    seed: 1606,
    kind: 'mineral',
    normalStrength: 2.2,
    roughness: 0.92,
    roughnessVariance: 0.08,
  },
  woodFine: {
    seed: 1505,
    kind: 'wood',
    normalStrength: 3.2,
    roughness: 0.68,
    roughnessVariance: 0.16,
  },
  woodPlanks: {
    seed: 1404,
    kind: 'wood',
    normalStrength: 4,
    roughness: 0.76,
    roughnessVariance: 0.18,
  },
  concrete: {
    seed: 1707,
    kind: 'mineral',
    normalStrength: 4.4,
    roughness: 0.88,
    roughnessVariance: 0.12,
  },
  fabric: {
    seed: 1808,
    kind: 'weave',
    normalStrength: 2.4,
    roughness: 0.96,
    roughnessVariance: 0.06,
  },
  brushedMetal: {
    seed: 1901,
    kind: 'brushed',
    normalStrength: 1.8,
    roughness: 0.42,
    roughnessVariance: 0.2,
  },
  ground: {
    seed: 2012,
    kind: 'mineral',
    normalStrength: 3.4,
    roughness: 0.92,
    roughnessVariance: 0.1,
  },
}

function generateSurfaceDetail(config: SurfaceConfig): {
  normalMap: CanvasTexture
  roughnessMap: CanvasTexture
} {
  const size = 128
  const rng = mulberry32(config.seed)
  const waves = Array.from({ length: 7 }, (_, i) => ({
    fx: 1 + Math.floor(rng() * (5 + i * 2)),
    fy: 1 + Math.floor(rng() * (5 + i * 2)),
    phase: rng() * Math.PI * 2,
    amp: Math.pow(0.58, i),
  }))
  const heights = new Float32Array(size * size)
  let min = Infinity
  let max = -Infinity
  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      let h = 0
      for (const wave of waves) {
        h += Math.sin(Math.PI * 2 * (u * wave.fx + v * wave.fy) + wave.phase) * wave.amp
      }
      if (config.kind === 'wood') {
        h += Math.sin(Math.PI * 2 * (v * 18 + Math.sin(u * Math.PI * 4) * 0.16)) * 0.72
        h += Math.sin(Math.PI * 2 * v * 37) * 0.18
      } else if (config.kind === 'weave') {
        h += Math.sin(Math.PI * 2 * u * 32) * 0.52 + Math.sin(Math.PI * 2 * v * 32) * 0.52
      } else if (config.kind === 'brushed') {
        h += Math.sin(Math.PI * 2 * v * 52) * 0.45 + Math.sin(Math.PI * 2 * v * 91) * 0.16
      }
      heights[y * size + x] = h
      min = Math.min(min, h)
      max = Math.max(max, h)
    }
  }
  const span = Math.max(0.0001, max - min)
  for (let i = 0; i < heights.length; i++) heights[i] = (heights[i] - min) / span

  const normalCanvas = makeCanvas(size)
  const roughCanvas = makeCanvas(size)
  const normalData = normalCanvas.ctx.createImageData(size, size)
  const roughData = roughCanvas.ctx.createImageData(size, size)
  const at = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * config.normalStrength
      const dy = (at(x, y + 1) - at(x, y - 1)) * config.normalStrength
      const invLen = 1 / Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      normalData.data[i] = Math.round((-dx * invLen * 0.5 + 0.5) * 255)
      normalData.data[i + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255)
      normalData.data[i + 2] = Math.round((invLen * 0.5 + 0.5) * 255)
      normalData.data[i + 3] = 255
      const local = at(x, y) - 0.5
      const rough = Math.min(1, Math.max(0.08, config.roughness + local * config.roughnessVariance))
      const grey = Math.round(rough * 255)
      roughData.data[i] = grey
      roughData.data[i + 1] = grey
      roughData.data[i + 2] = grey
      roughData.data[i + 3] = 255
    }
  }
  normalCanvas.ctx.putImageData(normalData, 0, 0)
  roughCanvas.ctx.putImageData(roughData, 0, 0)
  return {
    normalMap: finish(normalCanvas.c, false),
    roughnessMap: finish(roughCanvas.c, false),
  }
}

const GENERATORS: Record<string, () => CanvasTexture> = {
  grass: () => {
    const size = 256
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(101)
    ctx.fillStyle = '#5d7a44'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, rng, size, 900, 1, 3, ['#6d8b4f', '#52703c', '#7a9a58', '#49653a'], 0.5)
    // blade strokes
    for (let i = 0; i < 700; i++) {
      const x = rng() * size
      const y = rng() * size
      const len = 3 + rng() * 6
      const hue = rng()
      ctx.strokeStyle = hue < 0.5 ? '#74945a' : hue < 0.8 ? '#5c7a45' : '#88a468'
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rng() - 0.5) * 2, y - len)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    return finish(c)
  },

  stonePath: () => {
    const size = 256
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(202)
    ctx.fillStyle = '#8b8578'
    ctx.fillRect(0, 0, size, size)
    // large pale pavers with grout, drawn on a jittered grid (tileable via wrap draw)
    const cell = 64
    for (let gy = 0; gy < size / cell; gy++) {
      for (let gx = 0; gx < size / cell; gx++) {
        const cx = gx * cell + cell / 2 + (rng() - 0.5) * 8
        const cy = gy * cell + cell / 2 + (rng() - 0.5) * 8
        const w = cell * (0.82 + rng() * 0.12)
        const h = cell * (0.82 + rng() * 0.12)
        const shade = 0.9 + rng() * 0.2
        ctx.fillStyle = `rgb(${Math.floor(168 * shade)},${Math.floor(160 * shade)},${Math.floor(146 * shade)})`
        for (const [ox, oy] of [
          [0, 0],
          [-size, 0],
          [size, 0],
          [0, -size],
          [0, size],
        ]) {
          roundRect(ctx, cx - w / 2 + ox, cy - h / 2 + oy, w, h, 10)
          ctx.fill()
        }
      }
    }
    speckle(ctx, rng, size, 500, 0.5, 2, ['#7d776b', '#9a9385', '#6e685e'], 0.4)
    return finish(c)
  },

  shellRock: () => {
    const size = 256
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(303)
    ctx.fillStyle = '#6f6354'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, rng, size, 700, 1, 4, ['#7d7060', '#5f5546', '#877a67', '#55483c'], 0.45)
    // keratin growth arcs
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = rng() < 0.5 ? '#5c5142' : '#7f7362'
      ctx.globalAlpha = 0.28
      ctx.lineWidth = 1.5 + rng() * 2
      ctx.beginPath()
      const cx = rng() * size
      const cy = rng() * size
      ctx.arc(cx, cy, 18 + rng() * 60, rng() * Math.PI * 2, rng() * Math.PI * 2 + 1.5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    return finish(c)
  },

  woodPlanks: () => {
    const size = 256
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(404)
    const plankH = 32
    for (let y = 0; y < size / plankH; y++) {
      const tone = 0.85 + rng() * 0.3
      const base = new Color('#9a6f4c').multiplyScalar(tone)
      ctx.fillStyle = `#${base.getHexString()}`
      ctx.fillRect(0, y * plankH, size, plankH)
      // grain
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = rng() < 0.5 ? 'rgba(70,45,28,0.25)' : 'rgba(150,110,80,0.25)'
        ctx.lineWidth = 0.8 + rng()
        ctx.beginPath()
        const yy = y * plankH + rng() * plankH
        ctx.moveTo(0, yy)
        ctx.bezierCurveTo(
          size * 0.3,
          yy + (rng() - 0.5) * 4,
          size * 0.7,
          yy + (rng() - 0.5) * 4,
          size,
          yy,
        )
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(40,25,15,0.5)'
      ctx.fillRect(0, y * plankH, size, 2)
    }
    return finish(c)
  },

  woodFine: () => {
    const size = 256
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(505)
    ctx.fillStyle = '#b98d63'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = rng() < 0.6 ? 'rgba(120,80,50,0.2)' : 'rgba(210,175,135,0.22)'
      ctx.lineWidth = 0.7 + rng() * 1.4
      ctx.beginPath()
      const yy = rng() * size
      ctx.moveTo(0, yy)
      ctx.bezierCurveTo(
        size * 0.33,
        yy + (rng() - 0.5) * 7,
        size * 0.66,
        yy + (rng() - 0.5) * 7,
        size,
        yy,
      )
      ctx.stroke()
    }
    return finish(c)
  },

  plaster: () => {
    const size = 256
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(606)
    ctx.fillStyle = '#e6ddcd'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, rng, size, 1400, 0.5, 2.2, ['#ded4c2', '#efe7d8', '#d5cab6'], 0.5)
    return finish(c)
  },

  concrete: () => {
    const size = 256
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(707)
    ctx.fillStyle = '#a8a49b'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, rng, size, 1600, 0.5, 2, ['#9b978e', '#b3afa6', '#8f8b82'], 0.5)
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = 'rgba(90,88,82,0.25)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(rng() * size, rng() * size)
      ctx.lineTo(rng() * size, rng() * size)
      ctx.stroke()
    }
    return finish(c)
  },

  fabric: () => {
    const size = 128
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(808)
    ctx.fillStyle = '#cbbfae'
    ctx.fillRect(0, 0, size, size)
    for (let y = 0; y < size; y += 3) {
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(60,50,40,0.08)'
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
    }
    for (let x = 0; x < size; x += 3) {
      ctx.strokeStyle = 'rgba(60,50,40,0.06)'
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, size)
      ctx.stroke()
    }
    return finish(c)
  },

  sand: () => {
    const size = 128
    const { c, ctx } = makeCanvas(size)
    const rng = mulberry32(909)
    ctx.fillStyle = '#cdb891'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, rng, size, 1200, 0.4, 1.4, ['#c2ad86', '#d8c49d', '#b5a07c'], 0.5)
    return finish(c)
  },
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
