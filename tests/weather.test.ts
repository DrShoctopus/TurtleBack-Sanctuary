import { describe, it, expect } from 'vitest'
import { WeatherSim, WEATHER_FADE_SECONDS } from '@/game/weather/weatherMath'

describe('WeatherSim', () => {
  it('crossfades toward rain over the fade window, never popping', () => {
    const sim = new WeatherSim(1, 0)
    sim.setMode('rain')
    const steps: number[] = []
    for (let i = 0; i < 10; i++) {
      const { rain } = sim.update(1, 'rain')
      steps.push(rain)
    }
    // monotonically increasing, reaching ~1 only after the fade window
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1])
    expect(steps[0]).toBeLessThan(0.3) // no instant pop
    expect(steps[WEATHER_FADE_SECONDS]).toBeGreaterThan(0.9)
  })

  it('crossfades back to clear', () => {
    const sim = new WeatherSim(1, 1)
    sim.setMode('clear')
    let last = 1
    for (let i = 0; i < WEATHER_FADE_SECONDS + 1; i++) {
      last = sim.update(1, 'clear').rain
    }
    expect(last).toBeLessThan(0.05)
  })

  it('wetness lags rain (soaks fast, dries slow)', () => {
    const sim = new WeatherSim(1, 0)
    sim.setMode('rain')
    for (let i = 0; i < WEATHER_FADE_SECONDS; i++) sim.update(1, 'rain')
    const wetWhenRaining = sim.wetness
    sim.setMode('clear')
    for (let i = 0; i < WEATHER_FADE_SECONDS + 2; i++) sim.update(1, 'clear')
    // rain is basically gone but ground is still damp
    expect(sim.rain).toBeLessThan(0.1)
    expect(sim.wetness).toBeGreaterThan(0.3)
    expect(wetWhenRaining).toBeGreaterThan(0.5)
  })

  it('auto mode is deterministic for a given seed', () => {
    const run = () => {
      const sim = new WeatherSim(42, 0)
      const out: number[] = []
      for (let i = 0; i < 2000; i++) out.push(Number(sim.update(1, 'auto').rain.toFixed(4)))
      return out
    }
    expect(run()).toEqual(run())
  })

  it('auto mode eventually produces some rain', () => {
    const sim = new WeatherSim(7, 0)
    let maxRain = 0
    for (let i = 0; i < 5000; i++) {
      maxRain = Math.max(maxRain, sim.update(1, 'auto').rain)
    }
    expect(maxRain).toBeGreaterThan(0.3)
  })
})
