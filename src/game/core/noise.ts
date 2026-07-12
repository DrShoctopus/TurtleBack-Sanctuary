/** Seeded 2D value noise + fBm. Pure and deterministic. */
import { mulberry32 } from './rng'

export class ValueNoise2D {
  private perm: Uint8Array

  constructor(seed: number) {
    const rng = mulberry32(seed)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[p[i], p[j]] = [p[j], p[i]]
    }
    this.perm = new Uint8Array(512)
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
  }

  private hash(x: number, y: number): number {
    return this.perm[(this.perm[x & 255] + y) & 255] / 255
  }

  /** Smooth value noise in [0,1]. */
  sample(x: number, y: number): number {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = this.hash(xi, yi)
    const b = this.hash(xi + 1, yi)
    const c = this.hash(xi, yi + 1)
    const d = this.hash(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }

  /** Fractal Brownian motion, roughly [0,1]. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 0.5
    let freq = 1
    let sum = 0
    let norm = 0
    for (let i = 0; i < octaves; i++) {
      sum += this.sample(x * freq, y * freq) * amp
      norm += amp
      amp *= gain
      freq *= lacunarity
    }
    return sum / norm
  }
}
