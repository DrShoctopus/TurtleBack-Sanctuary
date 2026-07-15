/** Time-of-day color script. All cycles sampled with wraparound smoothing. */
import { Color } from 'three'
import { sampleCycle, wrap01, type ColorStop } from '../../core/mathUtils'

function stops(list: Array<[number, string]>): ColorStop[] {
  return list.map(([t, hex]) => {
    const c = new Color(hex)
    return { t, color: [c.r, c.g, c.b] as [number, number, number] }
  })
}

export const SKY_TOP = stops([
  [0.0, '#0f2230'],
  [0.22, '#172938'],
  [0.27, '#4d5c65'],
  [0.33, '#7899a0'],
  [0.42, '#89afb7'],
  [0.5, '#8fb8c0'],
  [0.63, '#88aab1'],
  [0.72, '#a67663'],
  [0.78, '#93594c'],
  [0.85, '#263a4b'],
  [0.91, '#132534'],
])

export const SKY_HORIZON = stops([
  [0.0, '#1a2c3d'],
  [0.22, '#354c59'],
  [0.27, '#c39261'],
  [0.33, '#d8b784'],
  [0.42, '#adcad0'],
  [0.5, '#b8d1d8'],
  [0.63, '#aec7cd'],
  [0.72, '#d8a06f'],
  [0.78, '#d88961'],
  [0.85, '#536873'],
  [0.91, '#263a48'],
])

export const FOG_COLOR = stops([
  [0.0, '#263a44'],
  [0.22, '#354c59'],
  [0.27, '#a38773'],
  [0.33, '#b49b82'],
  [0.42, '#9eb6ba'],
  [0.5, '#a3bbc0'],
  [0.63, '#9fb6bb'],
  [0.72, '#a98879'],
  [0.78, '#977f77'],
  [0.85, '#405662'],
  [0.91, '#2c424d'],
])

export const SUN_COLOR = stops([
  [0.0, '#0a0a12'],
  [0.24, '#4a352b'],
  [0.27, '#d99555'],
  [0.33, '#e5b775'],
  [0.42, '#e8c987'],
  [0.5, '#e7bd73'],
  [0.63, '#e2b46f'],
  [0.72, '#e0a15d'],
  [0.78, '#e28b55'],
  [0.84, '#6b5964'],
  [0.9, '#0a0a12'],
])

const SUN_INTENSITY: Array<[number, number]> = [
  [0.0, 0],
  [0.24, 0.05],
  [0.28, 1.35],
  [0.34, 2.35],
  [0.42, 2.75],
  [0.5, 2.9],
  [0.63, 2.65],
  [0.72, 2.15],
  [0.78, 1.3],
  [0.83, 0.25],
  [0.87, 0],
]

const HEMI_INTENSITY: Array<[number, number]> = [
  [0.0, 0.4],
  [0.23, 0.42],
  [0.3, 0.6],
  [0.45, 0.76],
  [0.5, 0.8],
  [0.7, 0.74],
  [0.78, 0.56],
  [0.85, 0.44],
  [0.92, 0.4],
]

export function sampleScalarCycle(list: Array<[number, number]>, t: number): number {
  const tt = wrap01(t)
  const cs: ColorStop[] = list.map(([tp, v]) => ({ t: tp, color: [v, 0, 0] }))
  return sampleCycle(cs, tt)[0]
}

export function sunIntensityAt(t: number): number {
  return sampleScalarCycle(SUN_INTENSITY, t)
}

export function hemiIntensityAt(t: number): number {
  return sampleScalarCycle(HEMI_INTENSITY, t)
}

export function sampleColor(target: Color, cycle: ColorStop[], t: number): Color {
  const [r, g, b] = sampleCycle(cycle, t)
  return target.setRGB(r, g, b)
}
