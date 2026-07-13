import { describe, expect, it } from 'vitest'
import {
  BENCHMARKS,
  BENCHMARK_SHORTCUTS,
  isBenchmarkId,
} from '../src/game/config/benchmarks'

describe('visual benchmark registry', () => {
  it('contains valid finite cameras', () => {
    expect(Object.keys(BENCHMARKS).length).toBeGreaterThanOrEqual(18)
    for (const [id, view] of Object.entries(BENCHMARKS)) {
      expect(isBenchmarkId(id)).toBe(true)
      const values =
        view.mode === 'fixed'
          ? [...view.position, ...view.lookAt]
          : [view.x, view.z, view.yaw, view.pitch]
      expect(values.every(Number.isFinite)).toBe(true)
    }
  })

  it('maps every shortcut to a registered view', () => {
    for (const id of Object.values(BENCHMARK_SHORTCUTS)) expect(isBenchmarkId(id)).toBe(true)
  })
})
