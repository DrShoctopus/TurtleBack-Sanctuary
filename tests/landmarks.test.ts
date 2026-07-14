import { describe, it, expect } from 'vitest'
import { buildSchedule, LANDMARK_TYPES } from '@/game/world/landmarks/schedule'

describe('landmark schedule', () => {
  it('is deterministic for a seed', () => {
    expect(buildSchedule(123, 40)).toEqual(buildSchedule(123, 40))
  })

  it('differs across seeds', () => {
    const a = buildSchedule(1, 20)
    const b = buildSchedule(2, 20)
    expect(a).not.toEqual(b)
  })

  it('produces increasing, spaced distances', () => {
    const events = buildSchedule(5, 30)
    for (let i = 1; i < events.length; i++) {
      const gap = events[i].atDistance - events[i - 1].atDistance
      expect(gap).toBeGreaterThanOrEqual(300)
      expect(gap).toBeLessThanOrEqual(560)
    }
  })

  it('uses all landmark types before repeating (bag shuffle)', () => {
    const events = buildSchedule(9, LANDMARK_TYPES.length)
    const kinds = new Set(events.map((e) => e.type))
    expect(kinds.size).toBe(LANDMARK_TYPES.length)
  })

  it('assigns valid sides and positive scale', () => {
    for (const e of buildSchedule(3, 20)) {
      expect([-1, 1]).toContain(e.side)
      expect(e.scale).toBeGreaterThan(0)
      expect(e.offset).toBeGreaterThan(0)
      expect(LANDMARK_TYPES).toContain(e.type)
    }
  })
})
