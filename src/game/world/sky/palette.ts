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
  [0.0, '#0b1426'],
  [0.22, '#101c33'],
  [0.27, '#33507c'],
  [0.33, '#5d88b5'],
  [0.42, '#6ea7d6'],
  [0.5, '#79b4e2'],
  [0.63, '#6fa5d6'],
  [0.72, '#5e7fae'],
  [0.78, '#45507f'],
  [0.85, '#232f56'],
  [0.91, '#0d1730'],
])

export const SKY_HORIZON = stops([
  [0.0, '#17293f'],
  [0.22, '#2c3a55'],
  [0.27, '#f0a468'],
  [0.33, '#ffd9a8'],
  [0.42, '#d8ecf4'],
  [0.5, '#e2f1f6'],
  [0.63, '#dfeaf0'],
  [0.72, '#ffcf96'],
  [0.78, '#f98e64'],
  [0.85, '#4c5c8f'],
  [0.91, '#1b2c46'],
])

export const FOG_COLOR = stops([
  [0.0, '#0e1a28'],
  [0.22, '#16202f'],
  [0.27, '#b08a70'],
  [0.33, '#c8b198'],
  [0.42, '#c3d8e2'],
  [0.5, '#cfe3ea'],
  [0.63, '#c8dbe4'],
  [0.72, '#d4b494'],
  [0.78, '#b9838a'],
  [0.85, '#33405c'],
  [0.91, '#101c2c'],
])

export const SUN_COLOR = stops([
  [0.0, '#0a0a12'],
  [0.24, '#402a20'],
  [0.27, '#ffb066'],
  [0.33, '#ffd9a4'],
  [0.42, '#fff0d4'],
  [0.5, '#fff6e4'],
  [0.63, '#ffedcc'],
  [0.72, '#ffc275'],
  [0.78, '#ff9a5e'],
  [0.84, '#66557a'],
  [0.9, '#0a0a12'],
])

const SUN_INTENSITY: Array<[number, number]> = [
  [0.0, 0],
  [0.24, 0.05],
  [0.28, 1.5],
  [0.34, 2.7],
  [0.42, 3.2],
  [0.5, 3.4],
  [0.63, 3.1],
  [0.72, 2.4],
  [0.78, 1.4],
  [0.83, 0.25],
  [0.87, 0],
]

const HEMI_INTENSITY: Array<[number, number]> = [
  [0.0, 0.42],
  [0.23, 0.45],
  [0.3, 0.68],
  [0.45, 0.88],
  [0.5, 0.92],
  [0.7, 0.84],
  [0.78, 0.62],
  [0.85, 0.48],
  [0.92, 0.42],
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
