import { describe, expect, it } from 'vitest'
import { FrameTimeWindow, percentile } from '@/game/core/frameTimeStats'

describe('percentile', () => {
  it('uses nearest-rank p95 rather than a good average to detect stutter', () => {
    const frames = [...Array(94).fill(8), ...Array(6).fill(40)]
    expect(percentile(frames, 0.95)).toBe(40)
  })

  it('copies before sorting and handles both percentile endpoints', () => {
    const values = [3, 1, 2]
    expect(percentile(values, 0)).toBe(1)
    expect(percentile(values, 1)).toBe(3)
    expect(values).toEqual([3, 1, 2])
  })

  it('rejects empty, non-finite, and out-of-range inputs', () => {
    expect(() => percentile([], 0.5)).toThrow()
    expect(() => percentile([1, Number.NaN], 0.5)).toThrow()
    expect(() => percentile([1, Number.POSITIVE_INFINITY], 0.5)).toThrow()
    expect(() => percentile([1], -0.01)).toThrow()
    expect(() => percentile([1], 1.01)).toThrow()
    expect(() => percentile([1], Number.NaN)).toThrow()
  })
})

describe('FrameTimeWindow', () => {
  it('retains only its newest bounded millisecond samples', () => {
    const window = new FrameTimeWindow(3)
    window.add(1)
    window.add(2)
    window.add(3)
    window.add(4)
    expect(window.size).toBe(3)
    expect(window.snapshot()).toEqual([2, 3, 4])
  })

  it('rejects invalid frame times and clears explicitly', () => {
    const window = new FrameTimeWindow(2)
    expect(() => window.add(0)).toThrow()
    expect(() => window.add(Number.NaN)).toThrow()
    window.add(8)
    window.clear()
    expect(window.size).toBe(0)
  })
})
