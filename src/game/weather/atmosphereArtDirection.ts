import { sampleScalarCycle } from '../world/sky/palette'

export type AuthoredAtmosphereCondition = 'noon' | 'sunset' | 'blue-hour' | 'night' | 'rain'

const AMBIENT_INTENSITY: Array<[number, number]> = [
  [0, 0.28],
  [0.24, 0.3],
  [0.3, 0.25],
  [0.5, 0.22],
  [0.7, 0.25],
  [0.77, 0.3],
  [0.85, 0.34],
  [0.94, 0.3],
]

export interface WetSurfaceResponse {
  puddleOpacity: number
  puddleRoughness: number
  exteriorDarkening: number
}

export interface AtmosphereReadabilitySample {
  condition: AuthoredAtmosphereCondition
  ambientIntensity: number
  moonIntensity: number
  mistOpacity: number
  lightRayOpacity: number
  wetSurface: WetSurfaceResponse
}

export function atmosphereConditionAt(time: number, rain: number): AuthoredAtmosphereCondition {
  if (rain >= 0.35) return 'rain'
  if (time >= 0.865 || time < 0.235) return 'night'
  if (time >= 0.805) return 'blue-hour'
  if (time >= 0.675) return 'sunset'
  return 'noon'
}

/** Minimum bounced light required to keep paths and silhouettes out of black. */
export function ambientIntensityAt(time: number, rain: number): number {
  const wet = Math.min(1, Math.max(0, rain))
  return sampleScalarCycle(AMBIENT_INTENSITY, time) + wet * 0.065
}

export function moonIntensityAt(
  nightFactor: number,
  moonPhaseVisible: number,
  rain: number,
): number {
  return (
    0.44 *
    Math.min(1, Math.max(0, nightFactor)) *
    Math.min(1, Math.max(0, moonPhaseVisible)) *
    (1 - Math.min(1, Math.max(0, rain)) * 0.38)
  )
}

/** Cool opposite-side fill protects detail when the warm sun is low or absent. */
export function coolFillIntensityAt(duskFactor: number, nightFactor: number, rain: number): number {
  const dusk = Math.min(1, Math.max(0, duskFactor))
  const night = Math.min(1, Math.max(0, nightFactor))
  const wet = Math.min(1, Math.max(0, rain))
  return (0.22 + dusk * 0.32 + night * 0.08) * (1 - wet * 0.15)
}

export function mistOpacityAt(rain: number, nightFactor: number): number {
  const wet = Math.min(1, Math.max(0, rain))
  const night = Math.min(1, Math.max(0, nightFactor))
  return 0.062 + wet * 0.125 + night * 0.024
}

export function lightRayOpacityAt(dayFactor: number, duskFactor: number, rain: number): number {
  const wet = Math.min(1, Math.max(0, rain))
  return (
    (0.045 + Math.min(1, Math.max(0, duskFactor)) * 0.085) *
    Math.min(1, Math.max(0, dayFactor)) *
    (1 - wet * 0.74)
  )
}

export function wetSurfaceResponse(wetness: number): WetSurfaceResponse {
  const wet = Math.min(1, Math.max(0, wetness))
  return {
    puddleOpacity: wet * 0.2,
    puddleRoughness: 0.3 + (1 - wet) * 0.3,
    exteriorDarkening: wet * 0.16,
  }
}

export function sampleAtmosphereReadability(
  time: number,
  rain: number,
  dayFactor: number,
  nightFactor: number,
  duskFactor: number,
  moonPhaseVisible: number,
  wetness = rain,
): AtmosphereReadabilitySample {
  return {
    condition: atmosphereConditionAt(time, rain),
    ambientIntensity: ambientIntensityAt(time, rain),
    moonIntensity: moonIntensityAt(nightFactor, moonPhaseVisible, rain),
    mistOpacity: mistOpacityAt(rain, nightFactor),
    lightRayOpacity: lightRayOpacityAt(dayFactor, duskFactor, rain),
    wetSurface: wetSurfaceResponse(wetness),
  }
}
