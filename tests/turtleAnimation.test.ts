import { describe, expect, it } from 'vitest'
import { buildTurtleAnimationPlan } from '../src/game/world/turtle/animationPlan'
import type {
  TurtleAnimationInput,
  TurtleAnimationPlan,
  TurtleScaleEvent,
} from '../src/game/world/turtle/types'

const BASE_INPUT: TurtleAnimationInput = {
  dt: 1 / 60,
  comfortTime: 42.25,
  reducedMotion: false,
  player: [18, 7, -190],
  rain: 0.35,
  blink: 0,
  event: null,
}

function activeEvent(kind: TurtleScaleEvent['kind'], intensity = 0.8): TurtleScaleEvent {
  return {
    id: 7,
    kind,
    startedAt: BASE_INPUT.comfortTime - 1,
    duration: 2,
    intensity,
  }
}

function plan(overrides: Partial<TurtleAnimationInput> = {}): TurtleAnimationPlan {
  return buildTurtleAnimationPlan({ ...BASE_INPUT, ...overrides })
}

describe('turtle animation plan', () => {
  it('returns identical output for identical input', () => {
    const input = { ...BASE_INPUT, event: activeEvent('front-stroke') }

    expect(buildTurtleAnimationPlan(input)).toEqual(buildTurtleAnimationPlan(input))
  })

  it('bounds player attention to a restrained cone without forcing eye contact', () => {
    const distantTargets = [
      plan({ player: [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE] }),
      plan({ player: [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE] }),
    ]

    for (const result of distantTargets) {
      expect(Math.abs(result.gazeTarget[0])).toBeLessThanOrEqual(0.16)
      expect(Math.abs(result.gazeTarget[1])).toBeLessThanOrEqual(0.08)
      expect(result.gazeTarget[2]).toBe(-1)
      expect(result.clipWeights.Eye_Contact).toBe(0)
    }

    expect(plan({ event: activeEvent('eye-contact') }).clipWeights.Eye_Contact).toBeGreaterThan(0)
  })

  it('maps rain to monotonic bounded wetness', () => {
    const wetness = [-1, 0, 0.25, 0.5, 0.75, 1, 2].map((rain) => plan({ rain }).wetness)

    expect(wetness[0]).toBe(0)
    expect(wetness.at(-1)).toBe(1)
    for (let index = 1; index < wetness.length; index += 1) {
      expect(wetness[index]).toBeGreaterThanOrEqual(wetness[index - 1])
    }
  })

  it('derives a stable stroke phase from comfort time rather than frame delta', () => {
    const first = plan({ dt: 1 / 30, comfortTime: 15.75 })
    const second = plan({ dt: 1 / 144, comfortTime: 15.75 })
    const advanced = plan({ dt: 1 / 144, comfortTime: 16.75 })

    expect(second.clipWeights.Swim_Stroke).toBe(first.clipWeights.Swim_Stroke)
    expect(second.wakeStrength).toBe(first.wakeStrength)
    expect(advanced.clipWeights.Swim_Stroke).not.toBe(first.clipWeights.Swim_Stroke)
  })

  it('blinks only from the explicit trigger', () => {
    expect(plan({ comfortTime: 0, blink: 0 }).clipWeights.Blink).toBe(0)
    expect(plan({ comfortTime: 9_999, blink: 0 }).clipWeights.Blink).toBe(0)
    expect(plan({ blink: 0.72 }).clipWeights.Blink).toBe(0.72)
    expect(plan({ blink: -1 }).clipWeights.Blink).toBe(0)
    expect(plan({ blink: 2 }).clipWeights.Blink).toBe(1)
  })

  it('maps scale events to their named animation channels', () => {
    const deepBreath = plan({ event: activeEvent('deep-breath') })
    const frontStroke = plan({ event: activeEvent('front-stroke') })
    const headTurn = plan({ event: activeEvent('head-turn') })
    const eyeContact = plan({ event: activeEvent('eye-contact') })
    const idle = plan()

    expect(deepBreath.clipWeights.Idle_Breathe).toBeGreaterThan(idle.clipWeights.Idle_Breathe)
    expect(deepBreath.resonanceStrength).toBeGreaterThan(idle.resonanceStrength)
    expect(frontStroke.clipWeights.Swim_Stroke).toBeGreaterThan(idle.clipWeights.Swim_Stroke)
    expect(frontStroke.sprayStrength).toBeGreaterThan(idle.sprayStrength)
    expect(headTurn.clipWeights.Head_Turn).toBeGreaterThan(idle.clipWeights.Head_Turn)
    expect(eyeContact.clipWeights.Eye_Contact).toBeGreaterThan(idle.clipWeights.Eye_Contact)
  })

  it('preserves breathing and explicit blinks under Reduced Motion', () => {
    const regular = plan({ blink: 0.6, event: activeEvent('deep-breath') })
    const reduced = plan({
      blink: 0.6,
      event: activeEvent('deep-breath'),
      reducedMotion: true,
    })

    expect(reduced.clipWeights.Idle_Breathe).toBe(regular.clipWeights.Idle_Breathe)
    expect(reduced.clipWeights.Idle_Breathe).toBeGreaterThan(0)
    expect(reduced.clipWeights.Blink).toBe(regular.clipWeights.Blink)
  })

  it('caps every secondary response at 20 percent under Reduced Motion', () => {
    const regular = plan({ event: activeEvent('front-stroke') })
    const reduced = plan({ event: activeEvent('front-stroke'), reducedMotion: true })
    const secondaryClips = [
      'Swim_Stroke',
      'Neck_Drift',
      'Head_Turn',
      'Eye_Contact',
      'Jaw_Micro',
      'Nostril_Micro',
    ] as const
    const secondarySignals = [
      'wakeStrength',
      'foliageImpulse',
      'resonanceStrength',
      'sprayStrength',
    ] as const

    for (const clip of secondaryClips) {
      expect(reduced.clipWeights[clip]).toBeLessThanOrEqual(regular.clipWeights[clip] * 0.2)
    }
    for (const signal of secondarySignals) {
      expect(reduced[signal]).toBeLessThanOrEqual(regular[signal] * 0.2)
    }
  })
})
