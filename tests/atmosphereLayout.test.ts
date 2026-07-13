import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '../src/game/config/layout'
import {
  makePuddleAnchors,
  makeRoofDripAnchors,
  selectEvenly,
} from '../src/game/weather/atmosphereLayout'

describe('weather atmosphere placement', () => {
  it('creates deterministic eave anchors above every building', () => {
    const anchors = makeRoofDripAnchors(BUILDINGS, 4)
    expect(anchors).toHaveLength((BUILDINGS.length - 1) * 4)
    expect(anchors).toEqual(makeRoofDripAnchors(BUILDINGS, 4))
    for (const anchor of anchors) {
      expect(Number.isFinite(anchor.x + anchor.y + anchor.z + anchor.seed + anchor.fall)).toBe(true)
      expect(anchor.fall).toBeGreaterThan(3)
    }
  })

  it('keeps puddles outside occupied pavilion and interior footprints', () => {
    const puddles = makePuddleAnchors(BUILDINGS)
    expect(puddles).toHaveLength(BUILDINGS.length - 1)
    for (const puddle of puddles) {
      const nearest = BUILDINGS.reduce(
        (best, building) => {
          const distance = Math.hypot(puddle.x - building.x, puddle.z - building.z)
          return distance < best.distance ? { building, distance } : best
        },
        { building: BUILDINGS[0], distance: Infinity },
      )
      expect(nearest.building.kind).not.toBe('pavilion')
      expect(nearest.distance).toBeGreaterThan(nearest.building.padR * 0.28)
    }
  })

  it('keeps lower-quality samples distributed across the full village list', () => {
    expect(selectEvenly(['a', 'b', 'c', 'd', 'e', 'f'], 3)).toEqual(['a', 'c', 'e'])
    expect(selectEvenly(['a', 'b'], 5)).toEqual(['a', 'b'])
  })
})
