import { describe, expect, it } from 'vitest'
import { selectTurtleLod, turtleTextureTierForLod } from '../src/game/world/turtle/lod'

describe('monumental turtle LOD selection', () => {
  it('reserves LOD0 and the 2K face tier for High and Ultra', () => {
    expect(selectTurtleLod(40, 'low', 2)).toBe(2)
    expect(selectTurtleLod(40, 'medium', 2)).toBe(1)
    expect(selectTurtleLod(40, 'high', 2)).toBe(0)
    expect(selectTurtleLod(40, 'ultra', 2)).toBe(0)
    expect(turtleTextureTierForLod(selectTurtleLod(40, 'ultra', 2))).toBe('2k')
  })

  it('uses head distance for near, mid, and distant silhouettes', () => {
    expect(selectTurtleLod(80, 'high', 2)).toBe(0)
    expect(selectTurtleLod(260, 'high', 2)).toBe(1)
    expect(selectTurtleLod(680, 'high', 2)).toBe(2)
  })

  it('holds the previous level across hysteresis bands', () => {
    expect(selectTurtleLod(158, 'high', 0)).toBe(0)
    expect(selectTurtleLod(158, 'high', 1)).toBe(1)
    expect(selectTurtleLod(455, 'high', 1)).toBe(1)
    expect(selectTurtleLod(455, 'high', 2)).toBe(2)
  })

  it('falls back safely for invalid distances', () => {
    expect(selectTurtleLod(Number.NaN, 'ultra', 0)).toBe(2)
    expect(selectTurtleLod(Number.POSITIVE_INFINITY, 'high', 1)).toBe(2)
  })
})
