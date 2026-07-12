/** Deterministic, seedable PRNG utilities (mulberry32). Pure — safe for tests. */

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function rngInt(rng: Rng, min: number, maxInclusive: number): number {
  return Math.floor(rngRange(rng, min, maxInclusive + 1 - 1e-9))
}

export function rngPick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]
}

/** Fisher–Yates shuffle (returns a new array). */
export function rngShuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
