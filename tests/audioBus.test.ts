import { describe, it, expect } from 'vitest'
import { volumeToGain, clamp01, damp, sampleCycle, wrappedDelta01 } from '@/game/core/mathUtils'

describe('volumeToGain', () => {
  it('maps 0→0 and 1→1', () => {
    expect(volumeToGain(0)).toBe(0)
    expect(volumeToGain(1)).toBe(1)
  })
  it('is a perceptual (square) curve', () => {
    expect(volumeToGain(0.5)).toBeCloseTo(0.25, 6)
  })
  it('clamps out-of-range input', () => {
    expect(volumeToGain(-1)).toBe(0)
    expect(volumeToGain(2)).toBe(1)
  })
  it('is monotonic', () => {
    expect(volumeToGain(0.3)).toBeLessThan(volumeToGain(0.6))
  })
})

describe('bus gain composition', () => {
  // master × bus, as AudioManager composes them for the TV volume target
  it('composes multiplicatively', () => {
    const master = 0.8
    const tv = 0.5
    const composed = volumeToGain(tv) * volumeToGain(master)
    expect(composed).toBeCloseTo(0.25 * 0.64, 6)
  })
  it('mute (0) silences regardless of bus level', () => {
    expect(volumeToGain(1) * volumeToGain(0)).toBe(0)
  })
})

describe('clamp01', () => {
  it('clamps', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(0.3)).toBe(0.3)
  })
})

describe('damp', () => {
  it('returns target when halfLife is 0', () => {
    expect(damp(0, 10, 0, 0.016)).toBe(10)
  })
  it('moves toward the target', () => {
    const next = damp(0, 10, 0.1, 0.1)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(10)
  })
  it('halves the gap over one half-life', () => {
    const next = damp(0, 10, 0.5, 0.5)
    expect(next).toBeCloseTo(5, 5)
  })
})

describe('wrappedDelta01', () => {
  it('takes the short way around midnight', () => {
    expect(wrappedDelta01(0.95, 0.05)).toBeCloseTo(0.1, 6)
    expect(wrappedDelta01(0.05, 0.95)).toBeCloseTo(-0.1, 6)
  })
})

describe('sampleCycle', () => {
  const stops = [
    { t: 0, color: [0, 0, 0] as [number, number, number] },
    { t: 0.5, color: [1, 1, 1] as [number, number, number] },
  ]
  it('returns exact stop colors at the stops', () => {
    expect(sampleCycle(stops, 0)[0]).toBeCloseTo(0, 3)
  })
  it('interpolates between stops', () => {
    const mid = sampleCycle(stops, 0.25)
    expect(mid[0]).toBeGreaterThan(0)
    expect(mid[0]).toBeLessThan(1)
  })
  it('wraps around the cycle', () => {
    const v = sampleCycle(stops, 0.75)
    expect(v[0]).toBeGreaterThanOrEqual(0)
    expect(v[0]).toBeLessThanOrEqual(1)
  })
})
