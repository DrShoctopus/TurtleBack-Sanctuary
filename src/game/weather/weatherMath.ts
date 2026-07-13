/** Pure weather state machine: crossfading rain amount + seeded auto schedule. */
import { clamp01, moveToward } from '../core/mathUtils'
import { mulberry32, rngRange, type Rng } from '../core/rng'

export type WeatherModeSim = 'auto' | 'clear' | 'rain'

export const WEATHER_FADE_SECONDS = 8

export class WeatherSim {
  /** 0 = clear, 1 = full rain (before user intensity scaling). */
  rain = 0
  /** ground/roof wetness lags behind rain */
  wetness = 0
  private target = 0
  private autoTimer: number
  private rng: Rng
  private autoTarget = 0

  constructor(seed = 1, initialRain = 0, initialWetness = initialRain) {
    this.rng = mulberry32(seed)
    this.rain = clamp01(initialRain)
    this.wetness = clamp01(initialWetness)
    this.target = this.rain
    this.autoTimer = rngRange(this.rng, 120, 300)
  }

  setMode(mode: WeatherModeSim): void {
    if (mode === 'clear') this.target = 0
    else if (mode === 'rain') this.target = 1
    else this.target = this.autoTarget
  }

  update(dt: number, mode: WeatherModeSim): { rain: number; wetness: number } {
    if (mode === 'auto') {
      this.autoTimer -= dt
      if (this.autoTimer <= 0) {
        // alternate dry and rainy spells; rain ~35% of the time, gentle by default
        this.autoTarget = this.autoTarget > 0 ? 0 : rngRange(this.rng, 0.45, 1)
        const dur =
          this.autoTarget > 0 ? rngRange(this.rng, 100, 240) : rngRange(this.rng, 200, 460)
        this.autoTimer = dur
        this.target = this.autoTarget
      }
    }
    this.rain = moveToward(this.rain, this.target, dt / WEATHER_FADE_SECONDS)
    // wet surfaces soak fast, dry slowly
    const wetTarget = this.rain > 0.02 ? 1 : 0
    const rate = wetTarget > this.wetness ? dt / 12 : dt / 45
    this.wetness = clamp01(moveToward(this.wetness, wetTarget, rate))
    return { rain: this.rain, wetness: this.wetness }
  }
}
