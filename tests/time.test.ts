import { describe, it, expect } from 'vitest'
import { advanceTime, computeCelestials, formatClock, TIME_PRESETS } from '@/game/time/timeMath'

describe('advanceTime', () => {
  it('advances proportionally to dt and speed', () => {
    // 24-min day → advancing 720s at 1x = half a day
    expect(advanceTime(0, 720, 1440, 1)).toBeCloseTo(0.5, 6)
  })
  it('wraps past midnight', () => {
    expect(advanceTime(0.9, 1440, 1440, 1)).toBeCloseTo(0.9, 6)
    const wrapped = advanceTime(0.95, 720, 1440, 1)
    expect(wrapped).toBeGreaterThanOrEqual(0)
    expect(wrapped).toBeLessThan(1)
    expect(wrapped).toBeCloseTo(0.45, 6)
  })
  it('respects speed multiplier', () => {
    expect(advanceTime(0, 100, 1440, 2)).toBeCloseTo(advanceTime(0, 200, 1440, 1), 6)
  })
})

describe('computeCelestials', () => {
  it('is daytime at noon and night at midnight', () => {
    const noon = computeCelestials(TIME_PRESETS.noon)
    const midnight = computeCelestials(0)
    expect(noon.dayFactor).toBeGreaterThan(0.9)
    expect(noon.sunSin).toBeGreaterThan(0.9)
    expect(midnight.nightFactor).toBeGreaterThan(0.9)
    expect(midnight.sunSin).toBeLessThan(0)
  })
  it('produces a normalized sun direction', () => {
    const c = computeCelestials(0.4)
    const len = Math.hypot(...c.sunDir)
    expect(len).toBeCloseTo(1, 5)
  })
  it('shows stars only at night', () => {
    expect(computeCelestials(TIME_PRESETS.noon).starIntensity).toBeLessThan(0.05)
    expect(computeCelestials(TIME_PRESETS.night).starIntensity).toBeGreaterThan(0.5)
  })
  it('sun and moon are roughly opposed', () => {
    const c = computeCelestials(0.5)
    const dot = c.sunDir[0] * c.moonDir[0] + c.sunDir[1] * c.moonDir[1] + c.sunDir[2] * c.moonDir[2]
    expect(dot).toBeLessThan(0) // opposite hemispheres
  })
  it('wraps input consistently', () => {
    const a = computeCelestials(0.25)
    const b = computeCelestials(1.25)
    expect(a.sunSin).toBeCloseTo(b.sunSin, 6)
  })
})

describe('formatClock', () => {
  it('formats fractions to HH:MM', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(0.5)).toBe('12:00')
    expect(formatClock(0.25)).toBe('06:00')
    expect(formatClock(0.75)).toBe('18:00')
  })
  it('wraps values >= 1', () => {
    expect(formatClock(1.5)).toBe('12:00')
  })
})
