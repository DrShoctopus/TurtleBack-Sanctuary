import { describe, expect, it } from 'vitest'
import {
  ComfortMotionClock,
  REDUCED_MOTION_SCALE,
  advanceComfortMotionTime,
  comfortMotionScale,
} from '@/game/core/comfortMotion'

describe('comfortMotionScale', () => {
  it('uses normal speed and a strongly reduced ambient speed', () => {
    expect(comfortMotionScale(false)).toBe(1)
    expect(comfortMotionScale(true)).toBe(REDUCED_MOTION_SCALE)
    expect(REDUCED_MOTION_SCALE).toBeLessThanOrEqual(0.15)
  })

  it('clamps reduced scales to a safe range', () => {
    expect(comfortMotionScale(true, -1)).toBe(0)
    expect(comfortMotionScale(true, 2)).toBe(1)
    expect(comfortMotionScale(true, Number.NaN)).toBe(REDUCED_MOTION_SCALE)
  })
})

describe('ComfortMotionClock', () => {
  it('preserves phase when reduced motion is toggled', () => {
    const clock = new ComfortMotionClock()
    expect(clock.advance(2, false)).toBe(2)
    expect(clock.advance(1, true)).toBeCloseTo(2 + REDUCED_MOTION_SCALE)
    expect(clock.advance(1, false)).toBeCloseTo(3 + REDUCED_MOTION_SCALE)
  })

  it('ignores invalid deltas and supports reset', () => {
    expect(advanceComfortMotionTime(3, 0, false)).toBe(3)
    expect(advanceComfortMotionTime(3, Number.NaN, false)).toBe(3)
    const clock = new ComfortMotionClock(5)
    clock.reset(1.5)
    expect(clock.time).toBe(1.5)
  })
})
