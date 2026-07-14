import { describe, it, expect } from 'vitest'
import { mulberry32, hashString, rngRange, rngInt, rngPick, rngShuffle } from '@/game/core/rng'
import { ValueNoise2D } from '@/game/core/noise'

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })
  it('produces values in [0,1)', () => {
    const r = mulberry32(1)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
})

describe('hashString', () => {
  it('is stable and differs by input', () => {
    expect(hashString('dawn')).toBe(hashString('dawn'))
    expect(hashString('dawn')).not.toBe(hashString('night'))
  })
})

describe('rng helpers', () => {
  it('rngRange stays within bounds', () => {
    const r = mulberry32(3)
    for (let i = 0; i < 500; i++) {
      const v = rngRange(r, 5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThan(10)
    }
  })
  it('rngInt is inclusive and integral', () => {
    const r = mulberry32(4)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const v = rngInt(r, 1, 3)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(3)
      seen.add(v)
    }
    expect(seen).toEqual(new Set([1, 2, 3]))
  })
  it('rngPick returns an element', () => {
    const r = mulberry32(5)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) expect(arr).toContain(rngPick(r, arr))
  })
  it('rngShuffle is a permutation and deterministic', () => {
    const arr = [1, 2, 3, 4, 5, 6]
    const s1 = rngShuffle(mulberry32(9), arr)
    const s2 = rngShuffle(mulberry32(9), arr)
    expect(s1).toEqual(s2)
    expect([...s1].sort()).toEqual(arr)
  })
})

describe('ValueNoise2D', () => {
  it('is deterministic and bounded', () => {
    const n = new ValueNoise2D(7)
    for (let i = 0; i < 200; i++) {
      const v = n.sample(i * 0.3, i * 0.7)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    const m = new ValueNoise2D(7)
    expect(n.sample(1.5, 2.5)).toBe(m.sample(1.5, 2.5))
  })
  it('fbm stays in range', () => {
    const n = new ValueNoise2D(11)
    for (let i = 0; i < 100; i++) {
      const v = n.fbm(i * 0.1, i * 0.2, 4)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
