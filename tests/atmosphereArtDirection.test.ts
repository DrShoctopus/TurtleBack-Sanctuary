import { describe, expect, it } from 'vitest'
import { computeCelestials, TIME_PRESETS } from '@/game/time/timeMath'
import {
  atmosphereConditionAt,
  coolFillIntensityAt,
  sampleAtmosphereReadability,
  wetSurfaceResponse,
} from '@/game/weather/atmosphereArtDirection'
import { hemiIntensityAt } from '@/game/world/sky/palette'
import { TURTLE_ROUTE_SCALE_CUES } from '@/game/world/turtle/TurtleRouteScaleCues'

describe('authored time and weather readability', () => {
  it('classifies every final review family explicitly', () => {
    expect(atmosphereConditionAt(TIME_PRESETS.noon, 0)).toBe('noon')
    expect(atmosphereConditionAt(TIME_PRESETS.sunset, 0)).toBe('sunset')
    expect(atmosphereConditionAt(0.83, 0)).toBe('blue-hour')
    expect(atmosphereConditionAt(TIME_PRESETS.night, 0)).toBe('night')
    expect(atmosphereConditionAt(TIME_PRESETS.noon, 0.8)).toBe('rain')
  })

  it('keeps a colored indirect-light floor in day, sunset, night, and rain', () => {
    for (const [time, rain] of [
      [TIME_PRESETS.noon, 0],
      [TIME_PRESETS.sunset, 0],
      [TIME_PRESETS.night, 0],
      [TIME_PRESETS.noon, 1],
    ] as const) {
      const celestial = computeCelestials(time)
      const sample = sampleAtmosphereReadability(
        time,
        rain,
        celestial.dayFactor,
        celestial.nightFactor,
        celestial.duskFactor,
        celestial.moonPhaseVisible,
      )
      expect(sample.ambientIntensity).toBeGreaterThanOrEqual(0.2)
      expect(hemiIntensityAt(time) * (1 - rain * 0.12)).toBeGreaterThanOrEqual(0.72)
      expect(
        coolFillIntensityAt(celestial.duskFactor, celestial.nightFactor, rain),
      ).toBeGreaterThan(0.18)
      expect(sample.mistOpacity).toBeLessThan(0.22)
    }
  })

  it('keeps rain surfaces dark and matte enough to avoid fluorescent wetness', () => {
    const dry = wetSurfaceResponse(0)
    const wet = wetSurfaceResponse(1)
    expect(dry.puddleOpacity).toBe(0)
    expect(wet.puddleOpacity).toBeLessThanOrEqual(0.2)
    expect(wet.puddleRoughness).toBeGreaterThanOrEqual(0.3)
    expect(wet.exteriorDarkening).toBeLessThanOrEqual(0.16)
  })
})

describe('ordinary-route turtle scale cues', () => {
  it('repeats six different turtle features around normal traversal routes', () => {
    expect(TURTLE_ROUTE_SCALE_CUES).toHaveLength(6)
    expect(new Set(TURTLE_ROUTE_SCALE_CUES.map((cue) => cue.turtleFeature)).size).toBe(6)
    expect(new Set(TURTLE_ROUTE_SCALE_CUES.map((cue) => cue.id)).size).toBe(6)
    expect(
      TURTLE_ROUTE_SCALE_CUES.every((cue) => Math.hypot(cue.x / 170, cue.z / 250) < 1.06),
    ).toBe(true)
  })
})
