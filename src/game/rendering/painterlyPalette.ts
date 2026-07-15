import { Color, Vector3 } from 'three'
import { sampleScalarCycle, sampleColor } from '../world/sky/palette'
import type { ColorStop } from '../core/mathUtils'

function stops(list: Array<[number, string]>): ColorStop[] {
  return list.map(([t, hex]) => {
    const color = new Color(hex)
    return { t, color: [color.r, color.g, color.b] }
  })
}

const FOG_NEAR = stops([
  [0, '#1b2b27'],
  [0.27, '#6f665d'],
  [0.5, '#6f8984'],
  [0.77, '#725c55'],
  [0.94, '#22343a'],
])

const FOG_MID = stops([
  [0, '#263a44'],
  [0.27, '#a38773'],
  [0.5, '#a3bbc0'],
  [0.77, '#977f77'],
  [0.94, '#354c59'],
])

const FOG_FAR = stops([
  [0, '#314957'],
  [0.27, '#c5a17d'],
  [0.5, '#b8d1d8'],
  [0.77, '#d88961'],
  [0.94, '#48616d'],
])

const FOG_SUN = stops([
  [0, '#5d7882'],
  [0.27, '#e2a666'],
  [0.5, '#e7bd73'],
  [0.77, '#e7a35d'],
  [0.94, '#6f8790'],
])

const SHADOW = stops([
  [0, '#101c25'],
  [0.27, '#293743'],
  [0.5, '#294044'],
  [0.77, '#293743'],
  [0.94, '#101c25'],
])

const HIGHLIGHT = stops([
  [0, '#9eb4bb'],
  [0.27, '#e1ac6f'],
  [0.5, '#e7bd73'],
  [0.77, '#e7a35d'],
  [0.94, '#8ea7b3'],
])

const SKY_FILL = stops([
  [0, '#1a2c3d'],
  [0.27, '#7d9295'],
  [0.5, '#b8d1d8'],
  [0.77, '#a67d70'],
  [0.94, '#1a2c3d'],
])

const GROUND_FILL = stops([
  [0, '#101c25'],
  [0.27, '#3d433b'],
  [0.5, '#30483a'],
  [0.77, '#443b38'],
  [0.94, '#101c25'],
])

const FOG_DENSITY: Array<[number, number]> = [
  [0, 0.00245],
  [0.27, 0.0018],
  [0.5, 0.00135],
  [0.77, 0.00172],
  [0.94, 0.0024],
]

const BRIGHTNESS: Array<[number, number]> = [
  [0, 0.008],
  [0.27, -0.008],
  [0.5, -0.012],
  [0.77, -0.018],
  [0.94, 0.008],
]

const CONTRAST: Array<[number, number]> = [
  [0, 0.035],
  [0.27, 0.06],
  [0.5, 0.055],
  [0.77, 0.075],
  [0.94, 0.04],
]

const SATURATION: Array<[number, number]> = [
  [0, -0.018],
  [0.27, 0.045],
  [0.5, 0.035],
  [0.77, 0.075],
  [0.94, -0.012],
]

const RAIN_FOG_NEAR = new Color('#526c69')
const RAIN_FOG_MID = new Color('#82989a')
const RAIN_FOG_FAR = new Color('#92a6aa')
const RAIN_FOG_SUN = new Color('#c39261')
const RAIN_SHADOW = new Color('#263a3b')
const RAIN_HIGHLIGHT = new Color('#c39261')
const RAIN_SKY_FILL = new Color('#92a6aa')
const RAIN_GROUND_FILL = new Color('#293f38')
const WHITE = new Color(1, 1, 1)

export interface PainterlyEnvironmentSample {
  readonly fogNear: Color
  readonly fogMid: Color
  readonly fogFar: Color
  readonly fogSun: Color
  readonly shadowTint: Color
  readonly highlightTint: Color
  readonly skyFill: Color
  readonly groundFill: Color
  readonly sunDirection: Vector3
  fogDensity: number
  brightness: number
  contrast: number
  saturation: number
}

export function createPainterlyEnvironmentSample(): PainterlyEnvironmentSample {
  return {
    fogNear: new Color(),
    fogMid: new Color(),
    fogFar: new Color(),
    fogSun: new Color(),
    shadowTint: new Color(),
    highlightTint: new Color(),
    skyFill: new Color(),
    groundFill: new Color(),
    sunDirection: new Vector3(0, 1, 0),
    fogDensity: 0.00135,
    brightness: 0,
    contrast: 0,
    saturation: 0,
  }
}

/** Samples the approved time/weather families without allocating per frame. */
export function samplePainterlyEnvironment(
  target: PainterlyEnvironmentSample,
  time: number,
  rain: number,
  sunDirection?: readonly [number, number, number],
): PainterlyEnvironmentSample {
  const wet = Math.min(1, Math.max(0, rain))
  sampleColor(target.fogNear, FOG_NEAR, time).lerp(RAIN_FOG_NEAR, wet * 0.72)
  sampleColor(target.fogMid, FOG_MID, time).lerp(RAIN_FOG_MID, wet * 0.78)
  sampleColor(target.fogFar, FOG_FAR, time).lerp(RAIN_FOG_FAR, wet * 0.82)
  sampleColor(target.fogSun, FOG_SUN, time).lerp(RAIN_FOG_SUN, wet * 0.46)
  sampleColor(target.shadowTint, SHADOW, time).lerp(RAIN_SHADOW, wet * 0.7)
  sampleColor(target.highlightTint, HIGHLIGHT, time).lerp(RAIN_HIGHLIGHT, wet * 0.54)
  sampleColor(target.skyFill, SKY_FILL, time).lerp(RAIN_SKY_FILL, wet * 0.74)
  sampleColor(target.groundFill, GROUND_FILL, time).lerp(RAIN_GROUND_FILL, wet * 0.78)

  // These two colors act as restrained light multipliers in the surface shader,
  // so move them toward white rather than applying the palette anchors raw.
  target.shadowTint.lerp(WHITE, 0.6)
  target.highlightTint.lerp(WHITE, 0.78)

  target.fogDensity = sampleScalarCycle(FOG_DENSITY, time) + wet * 0.00172
  target.brightness = sampleScalarCycle(BRIGHTNESS, time) * (1 - wet) - wet * 0.008
  target.contrast = sampleScalarCycle(CONTRAST, time) * (1 - wet * 0.72) + wet * 0.018
  target.saturation = sampleScalarCycle(SATURATION, time) * (1 - wet) - wet * 0.028
  if (sunDirection) target.sunDirection.set(...sunDirection).normalize()
  return target
}
