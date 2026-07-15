import { describe, expect, it } from 'vitest'
import { TurtleEventDirector } from '../src/game/world/turtle/TurtleEventDirector'
import type { TurtleScaleEvent } from '../src/game/world/turtle/types'

function trace(
  seed: number,
  seconds: number,
  input: { playerInVista?: boolean; rain?: number; reducedMotion?: boolean } = {},
): TurtleScaleEvent[] {
  const director = new TurtleEventDirector(seed)
  const unique: TurtleScaleEvent[] = []
  let lastId = 0
  for (let elapsedTime = 0; elapsedTime <= seconds; elapsedTime += 1) {
    const event = director.update(1, {
      elapsedTime,
      playerInVista: input.playerInVista ?? true,
      rain: input.rain ?? 0,
      reducedMotion: input.reducedMotion ?? false,
    })
    if (event && event.id !== lastId) {
      unique.push(event)
      lastId = event.id
    }
  }
  return unique
}

describe('turtle scale event director', () => {
  it('produces identical rare-event traces from identical seeds', () => {
    expect(trace(4477, 2_400)).toEqual(trace(4477, 2_400))
  })

  it('does not repeat one acknowledgement kind inside twelve minutes', () => {
    const events = trace(91, 4_000)
    const lastByKind = new Map<string, number>()
    for (const event of events) {
      const previous = lastByKind.get(event.kind)
      if (previous !== undefined) expect(event.startedAt - previous).toBeGreaterThanOrEqual(12 * 60)
      lastByKind.set(event.kind, event.startedAt)
    }
  })

  it('requires the Galecrest vista for eye contact', () => {
    expect(trace(12, 4_000, { playerInVista: false }).some((event) => event.kind === 'eye-contact')).toBe(false)
    expect(trace(12, 4_000, { playerInVista: true }).some((event) => event.kind === 'eye-contact')).toBe(true)
  })

  it('suppresses spray-heavy front strokes in rain', () => {
    expect(trace(33, 4_000, { rain: 0.8 }).some((event) => event.kind === 'front-stroke')).toBe(false)
  })

  it('retains deep breaths while reducing acknowledgement intensity', () => {
    const regular = trace(56, 4_000)
    const reduced = trace(56, 4_000, { reducedMotion: true })
    expect(reduced.some((event) => event.kind === 'deep-breath')).toBe(true)
    for (let index = 0; index < Math.min(regular.length, reduced.length); index += 1) {
      expect(reduced[index].kind).toBe(regular[index].kind)
      expect(reduced[index].intensity).toBeLessThan(regular[index].intensity)
    }
  })
})
