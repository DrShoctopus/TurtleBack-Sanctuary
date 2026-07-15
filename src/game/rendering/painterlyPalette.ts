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
  [0, '#263a3a'],
  [0.27, '#776d64'],
  [0.5, '#7f9891'],
  [0.77, '#756a65'],
  [0.94, '#2b4147'],
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
  [0, '#263844'],
  [0.27, '#40515a'],
  [0.5, '#3d5552'],
  [0.77, '#4b4d50'],
  [0.94, '#263844'],
])

const HIGHLIGHT = stops([
  [0, '#9eb4bb'],
  [0.27, '#e1ac6f'],
  [0.5, '#e7bd73'],
  [0.77, '#e7a35d'],
  [0.94, '#8ea7b3'],
])

const SKY_FILL = stops([
  [0, '#324b5a'],
  [0.27, '#91a3a3'],
  [0.5, '#b8d1d8'],
  [0.77, '#ad8e82'],
  [0.94, '#324b5a'],
])

const GROUND_FILL = stops([
  [0, '#293d43'],
  [0.27, '#536057'],
  [0.5, '#526b57'],
  [0.77, '#625852'],
  [0.94, '#293d43'],
])

const FOG_DENSITY: Array<[number, number]> = [
  [0, 0.00245],
  [0.27, 0.0018],
  [0.5, 0.00135],
  [0.77, 0.00172],
  [0.94, 0.0024],
]

const BRIGHTNESS: Array<[number, number]> = [
  [0, 0.028],
  [0.27, 0.022],
  [0.5, 0.018],
  [0.77, 0.026],
  [0.94, 0.03],
]

const CONTRAST: Array<[number, number]> = [
  [0, 0.018],
  [0.27, 0.028],
  [0.5, 0.024],
  [0.77, 0.032],
  [0.94, 0.02],
]

const SATURATION: Array<[number, number]> = [
  [0, -0.018],
  [0.27, 0.045],
  [0.5, 0.035],
  [0.77, 0.052],
  [0.94, -0.012],
]

const RAIN_FOG_NEAR = new Color('#496762')
const RAIN_FOG_MID = new Color('#6f8989')
const RAIN_FOG_FAR = new Color('#81979a')
const RAIN_FOG_SUN = new Color('#c39261')
const RAIN_SHADOW = new Color('#263a3b')
const RAIN_HIGHLIGHT = new Color('#c39261')
const RAIN_SKY_FILL = new Color('#7f989c')
const RAIN_GROUND_FILL = new Color('#405c51')
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

  target.fogDensity = sampleScalarCycle(FOG_DENSITY, time) + wet * 0.00128
  target.brightness = sampleScalarCycle(BRIGHTNESS, time) * (1 - wet * 0.35) + wet * 0.012
  target.contrast = sampleScalarCycle(CONTRAST, time) * (1 - wet * 0.72) + wet * 0.018
  target.saturation = sampleScalarCycle(SATURATION, time) * (1 - wet) - wet * 0.028
  if (sunDirection) target.sunDirection.set(...sunDirection).normalize()
  return target
}
