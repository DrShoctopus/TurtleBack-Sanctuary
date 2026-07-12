/** Pure day/night math. t ∈ [0,1): 0 = midnight, 0.25 = 6:00, 0.5 = noon, 0.75 = 18:00. */
import { clamp01, smoothstep, wrap01 } from '../core/mathUtils'

export interface CelestialState {
  t: number
  /** sine of solar elevation, -1..1 */
  sunSin: number
  sunDir: [number, number, number]
  moonDir: [number, number, number]
  /** 1 in full daylight, 0 at night */
  dayFactor: number
  /** 1 deep night */
  nightFactor: number
  /** peaks around sunrise/sunset */
  duskFactor: number
  moonPhaseVisible: number
  starIntensity: number
}

export function advanceTime(t: number, dtSec: number, dayLengthSec: number, speed: number): number {
  return wrap01(t + (dtSec * speed) / dayLengthSec)
}

export function computeCelestials(tIn: number): CelestialState {
  const t = wrap01(tIn)
  const ang = (t - 0.25) * Math.PI * 2 // 0 at sunrise
  const sunSin = Math.sin(ang)
  // Sun path: rises east (+x), arcs over, sets west (-x); slight southward tilt for interest.
  const el = ang
  const sunDir: [number, number, number] = [
    Math.cos(el) * 0.92,
    Math.sin(el),
    Math.cos(el) * 0.28 - 0.22,
  ]
  const moonAng = ang + Math.PI * 0.94 // nearly opposite, slightly offset
  const moonDir: [number, number, number] = [
    Math.cos(moonAng) * 0.85,
    Math.sin(moonAng),
    Math.cos(moonAng) * 0.2 + 0.3,
  ]
  const dayFactor = smoothstep(-0.04, 0.16, sunSin)
  const nightFactor = smoothstep(0.05, -0.18, sunSin)
  const duskFactor = clamp01(1 - Math.abs(sunSin) / 0.24) * (1 - 0.25 * nightFactor)
  const moonSin = Math.sin(moonAng)
  const moonPhaseVisible = smoothstep(-0.02, 0.14, moonSin)
  const starIntensity = smoothstep(-0.02, -0.22, sunSin)
  return {
    t,
    sunSin,
    sunDir: normalize3(sunDir),
    moonDir: normalize3(moonDir),
    dayFactor,
    nightFactor,
    duskFactor,
    moonPhaseVisible,
    starIntensity,
  }
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

export function formatClock(t: number): string {
  const minutes = Math.floor(wrap01(t) * 24 * 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const TIME_PRESETS = {
  dawn: 0.265,
  noon: 0.5,
  sunset: 0.77,
  night: 0.94,
} as const

export type TimePreset = keyof typeof TIME_PRESETS
