/** Deterministic landmark scheduling along the voyage. Pure — unit tested. */
import { mulberry32, rngRange, rngShuffle } from '../../core/rng'

export const LANDMARK_TYPES = [
  'moonGate',
  'stiltLighthouse',
  'ringIsland',
  'jellyfishProcession',
  'skyStation',
  'whaleConstellation',
  'glassMonoliths',
  'invertedIsland',
  'lanternField',
  'mirrorCity',
] as const

export type LandmarkType = (typeof LANDMARK_TYPES)[number]

export interface LandmarkEvent {
  /** travel distance (m) at which the landmark is abeam of the turtle */
  atDistance: number
  type: LandmarkType
  /** -1 = passes on the west side, +1 = east */
  side: -1 | 1
  /** lateral offset from the route, m */
  offset: number
  scale: number
}

/** average spacing ≈ 420 m ≈ 3 minutes at cruise speed */
const SPACING_MIN = 300
const SPACING_MAX = 560
const FIRST_AT = 150

/**
 * Generate the first `count` landmark events for a seed. Types deal from
 * reshuffled bags so all ten kinds appear before any repeats.
 */
export function buildSchedule(seed: number, count: number): LandmarkEvent[] {
  const rng = mulberry32(seed ^ 0x51ab)
  const events: LandmarkEvent[] = []
  let distance = FIRST_AT + rngRange(rng, 0, 120)
  let bag: LandmarkType[] = []
  for (let i = 0; i < count; i++) {
    if (bag.length === 0) bag = rngShuffle(rng, LANDMARK_TYPES as readonly LandmarkType[])
    const type = bag.pop()!
    events.push({
      atDistance: Math.round(distance),
      type,
      side: rng() < 0.5 ? -1 : 1,
      offset: rngRange(rng, 260, 430),
      scale: rngRange(rng, 0.85, 1.25),
    })
    distance += rngRange(rng, SPACING_MIN, SPACING_MAX)
  }
  return events
}
