import type { TurtleClipName } from './modelContract'
import type { TurtleAnimationInput, TurtleAnimationPlan, TurtleScaleEventKind } from './types'

const TAU = Math.PI * 2
const SECONDARY_MOTION_SCALE = 0.2
const GAZE_YAW_LIMIT = 0.16
const GAZE_PITCH_LIMIT = 0.08

function clamp(value: number, minimum: number, maximum: number, fallback = minimum): number {
  if (Number.isNaN(value)) return fallback
  return Math.min(maximum, Math.max(minimum, value))
}

function clampUnit(value: number): number {
  return clamp(value, 0, 1)
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function wave(time: number, period: number, phase = 0): number {
  return 0.5 + Math.sin((time / period) * TAU + phase) * 0.5
}

function eventStrength(input: TurtleAnimationInput, expectedKind: TurtleScaleEventKind): number {
  const event = input.event
  if (
    event?.kind !== expectedKind ||
    !Number.isFinite(event.startedAt) ||
    !Number.isFinite(event.duration) ||
    event.duration <= 0
  ) {
    return 0
  }

  const elapsed = finite(input.comfortTime) - event.startedAt
  if (elapsed <= 0 || elapsed >= event.duration) return 0

  const progress = elapsed / event.duration
  const envelope = Math.sin(progress * Math.PI)
  return clampUnit(event.intensity) * envelope
}

/**
 * Build a deterministic, renderer-independent pose and response plan.
 *
 * `comfortTime` owns phase. `dt` is intentionally not integrated here so the
 * same sanctuary time always produces the same pose regardless of frame rate.
 */
export function buildTurtleAnimationPlan(input: TurtleAnimationInput): TurtleAnimationPlan {
  void input.dt

  const time = finite(input.comfortTime)
  const secondaryScale = input.reducedMotion ? SECONDARY_MOTION_SCALE : 1
  const rain = clampUnit(input.rain)
  const wetness = rain * (2 - rain)

  const breathPhase = wave(time, 14, -Math.PI / 2)
  const strokePhase = wave(time, 12, -Math.PI / 2)
  const neckPhase = wave(time, 19, Math.PI / 3)
  const headPhase = wave(time, 31, -Math.PI / 5)
  const jawPhase = wave(time, 11, Math.PI / 7)
  const nostrilPhase = wave(time, 7, -Math.PI / 4)

  const deepBreath = eventStrength(input, 'deep-breath')
  const frontStroke = eventStrength(input, 'front-stroke')
  const headTurn = eventStrength(input, 'head-turn')
  const eyeContact = eventStrength(input, 'eye-contact')

  const primaryBreathing = clampUnit(0.56 + breathPhase * 0.16 + deepBreath * 0.28)
  const swimStroke = clampUnit(0.16 + strokePhase * 0.4 + frontStroke * 0.4)
  const neckDrift = clampUnit(0.08 + neckPhase * 0.16 + deepBreath * 0.08)
  const headTurnWeight = clampUnit(0.04 + headPhase * 0.1 + headTurn * 0.72)
  const jawMicro = clampUnit(0.02 + jawPhase * 0.035 + deepBreath * 0.08)
  const nostrilMicro = clampUnit(0.06 + nostrilPhase * 0.06 + deepBreath * 0.18)

  const clipWeights: Record<TurtleClipName, number> = {
    Idle_Breathe: primaryBreathing,
    Swim_Stroke: swimStroke * secondaryScale,
    Neck_Drift: neckDrift * secondaryScale,
    Blink: clampUnit(input.blink),
    Head_Turn: headTurnWeight * secondaryScale,
    Eye_Contact: clampUnit(eyeContact) * secondaryScale,
    Jaw_Micro: jawMicro * secondaryScale,
    Nostril_Micro: nostrilMicro * secondaryScale,
  }

  const playerX = clamp(input.player[0] / 420, -GAZE_YAW_LIMIT, GAZE_YAW_LIMIT, 0)
  const playerY = clamp((input.player[1] - 6) / 300, -GAZE_PITCH_LIMIT, GAZE_PITCH_LIMIT, 0)
  const gazeTarget = Object.freeze([playerX, playerY, -1]) as readonly [number, number, number]

  const wakeStrength = clampUnit(0.1 + strokePhase * 0.32 + frontStroke * 0.5) * secondaryScale
  const foliageImpulse = clampUnit(frontStroke * 0.72) * secondaryScale
  const resonanceStrength =
    clampUnit(primaryBreathing * 0.12 + deepBreath * 0.68 + frontStroke * 0.14) * secondaryScale
  const sprayStrength = clampUnit(frontStroke * (1 - wetness * 0.7)) * secondaryScale

  return Object.freeze({
    clipWeights: Object.freeze(clipWeights),
    gazeTarget,
    wetness,
    wakeStrength,
    foliageImpulse,
    resonanceStrength,
    sprayStrength,
  })
}
