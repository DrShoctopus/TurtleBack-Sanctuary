import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { FOG_COLOR, SKY_HORIZON, SKY_TOP, SUN_COLOR, sampleColor } from '@/game/world/sky/palette'

const COLOR_CYCLES = [
  ['SKY_TOP', SKY_TOP],
  ['SKY_HORIZON', SKY_HORIZON],
  ['FOG_COLOR', FOG_COLOR],
  ['SUN_COLOR', SUN_COLOR],
] as const

describe('time palette color space', () => {
  for (const [name, cycle] of COLOR_CYCLES) {
    it(`does not convert already-linear ${name} stops a second time`, () => {
      const target = new Color()
      for (const stop of cycle) {
        sampleColor(target, cycle, stop.t)
        target.toArray().forEach((value, index) => {
          expect(value).toBeCloseTo(stop.color[index], 14)
        })
      }
    })
  }
})
