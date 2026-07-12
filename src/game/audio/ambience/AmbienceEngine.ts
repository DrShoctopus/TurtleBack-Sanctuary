/**
 * Procedural ambient soundscape: ocean surf, wind, rain, and sparse bird/insect
 * details — all synthesized. An audio-zone low-pass muffles the outdoor bed
 * when the player is inside, and rain gets its own indoor/outdoor balance.
 */
import { mulberry32 } from '../../core/rng'
import { runtime } from '../../core/runtime'
import { publishAudioCue } from '../cues'
import { useSettings } from '../../state/settingsStore'

export interface AmbienceInputs {
  rain: number
  wind: number
  indoors: boolean
  zoneFlavor: string
  night: number
}

export class AmbienceEngine {
  private ctx: AudioContext
  private out: GainNode
  private noiseBuffer: AudioBuffer
  private seed: number

  // beds
  private oceanGain!: GainNode
  private oceanLfoGain!: GainNode
  private windGain!: GainNode
  private windFilter!: BiquadFilterNode
  private rainGain!: GainNode
  private rainFilter!: BiquadFilterNode
  private masterFilter!: BiquadFilterNode
  private interiorTone!: GainNode

  private birdTimer: number | null = null
  private started = false
  private lastRainAnnounced = 0

  constructor(ctx: AudioContext, destination: AudioNode, seed: number) {
    this.ctx = ctx
    this.seed = seed
    this.out = ctx.createGain()
    this.out.connect(destination)
    this.noiseBuffer = this.makeNoise(3)
  }

  start(): void {
    if (this.started) return
    this.started = true
    const ctx = this.ctx

    // master zone filter — lowers highs when indoors
    this.masterFilter = ctx.createBiquadFilter()
    this.masterFilter.type = 'lowpass'
    this.masterFilter.frequency.value = 18000
    this.masterFilter.connect(this.out)

    // --- ocean: filtered looping noise with slow swell LFO ---
    const oceanSrc = ctx.createBufferSource()
    oceanSrc.buffer = this.noiseBuffer
    oceanSrc.loop = true
    const oceanFilter = ctx.createBiquadFilter()
    oceanFilter.type = 'lowpass'
    oceanFilter.frequency.value = 650
    oceanFilter.Q.value = 0.6
    this.oceanGain = ctx.createGain()
    this.oceanGain.gain.value = 0.12
    const swellLfo = ctx.createOscillator()
    swellLfo.frequency.value = 0.12
    this.oceanLfoGain = ctx.createGain()
    this.oceanLfoGain.gain.value = 0.07
    swellLfo.connect(this.oceanLfoGain)
    this.oceanLfoGain.connect(this.oceanGain.gain)
    oceanSrc.connect(oceanFilter)
    oceanFilter.connect(this.oceanGain)
    this.oceanGain.connect(this.masterFilter)
    oceanSrc.start()
    swellLfo.start()

    // --- wind: band-passed noise with drifting cutoff ---
    const windSrc = ctx.createBufferSource()
    windSrc.buffer = this.noiseBuffer
    windSrc.loop = true
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'bandpass'
    this.windFilter.frequency.value = 500
    this.windFilter.Q.value = 0.8
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0.05
    const windLfo = ctx.createOscillator()
    windLfo.frequency.value = 0.07
    const windLfoGain = ctx.createGain()
    windLfoGain.gain.value = 260
    windLfo.connect(windLfoGain)
    windLfoGain.connect(this.windFilter.frequency)
    windSrc.connect(this.windFilter)
    this.windFilter.connect(this.windGain)
    this.windGain.connect(this.masterFilter)
    windSrc.start()
    windLfo.start()

    // --- rain: high noise bed, level driven by weather ---
    const rainSrc = ctx.createBufferSource()
    rainSrc.buffer = this.noiseBuffer
    rainSrc.loop = true
    this.rainFilter = ctx.createBiquadFilter()
    this.rainFilter.type = 'highpass'
    this.rainFilter.frequency.value = 1400
    this.rainGain = ctx.createGain()
    this.rainGain.gain.value = 0
    rainSrc.connect(this.rainFilter)
    this.rainFilter.connect(this.rainGain)
    // rain routes AFTER the master filter so indoor muffling is handled explicitly
    this.rainGain.connect(this.out)
    rainSrc.start()

    // --- interior room tone (very low hum, on only when indoors) ---
    const toneOsc = ctx.createOscillator()
    toneOsc.type = 'sine'
    toneOsc.frequency.value = 58
    this.interiorTone = ctx.createGain()
    this.interiorTone.gain.value = 0
    toneOsc.connect(this.interiorTone)
    this.interiorTone.connect(this.out)
    toneOsc.start()

    this.scheduleBird()
  }

  /** Called ~10×/sec from the audio update. */
  update(): void {
    if (!this.started) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const rain = runtime.weather.rain
    const wind = runtime.weather.wind
    const indoors = runtime.player.indoors
    const night = runtime.time.celest.nightFactor
    const quiet = useSettings.getState().quietMode
    const quietLevel = quiet ? 0.62 : 1

    // indoor muffling: drop the outdoor bed's highs and level
    const cutoff = indoors ? 900 : 18000
    this.masterFilter.frequency.setTargetAtTime(cutoff, t, 0.4)
    this.oceanGain.gain.setTargetAtTime(
      ((indoors ? 0.05 : 0.13) + rain * 0.02) * quietLevel,
      t,
      0.5,
    )
    this.windGain.gain.setTargetAtTime((indoors ? 0.015 : 0.05) * (0.6 + wind) * quietLevel, t, 0.5)

    // rain balance: outside crisp & loud, inside muffled (roof patter)
    const rainTarget = rain * (indoors ? 0.09 : 0.22)
    this.rainGain.gain.setTargetAtTime(rainTarget, t, 0.5)
    this.rainFilter.frequency.setTargetAtTime(indoors ? 500 : 1400, t, 0.5)

    this.interiorTone.gain.setTargetAtTime(indoors ? 0.015 : 0, t, 0.6)

    // subtitle cue when rain begins
    if (rain > 0.25 && this.lastRainAnnounced < 0.25) publishAudioCue('🌧 Rain begins to fall')
    if (rain < 0.1 && this.lastRainAnnounced > 0.25) publishAudioCue('The rain eases')
    this.lastRainAnnounced = rain
    void night
  }

  private scheduleBird(): void {
    if (!this.started) return
    const night = runtime.time.celest.nightFactor
    const rain = runtime.weather.rain
    const indoors = runtime.player.indoors
    const quiet = useSettings.getState().quietMode
    // birds by day, crickets by night; quieter in rain / indoors
    const chance = quiet ? 0 : (night > 0.5 ? 0.5 : 0.6) * (1 - rain * 0.7) * (indoors ? 0.3 : 1)
    if (Math.random() < chance) {
      if (night > 0.5) this.chirp('cricket')
      else this.chirp('bird')
    }
    const delay = 1500 + Math.random() * 4500
    this.birdTimer = window.setTimeout(() => this.scheduleBird(), delay)
  }

  private chirp(kind: 'bird' | 'cricket'): void {
    const ctx = this.ctx
    const t = ctx.currentTime + 0.05
    const rng = mulberry32((Math.random() * 1e9) | 0)
    if (kind === 'bird') {
      const notes = 2 + Math.floor(rng() * 3)
      const baseF = 1800 + rng() * 1400
      for (let i = 0; i < notes; i++) {
        const nt = t + i * (0.08 + rng() * 0.06)
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        const f = baseF * (0.9 + rng() * 0.4)
        osc.frequency.setValueAtTime(f, nt)
        osc.frequency.exponentialRampToValueAtTime(f * 1.3, nt + 0.05)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.0001, nt)
        env.gain.exponentialRampToValueAtTime(0.03, nt + 0.01)
        env.gain.exponentialRampToValueAtTime(0.0001, nt + 0.09)
        osc.connect(env)
        env.connect(this.masterFilter)
        osc.start(nt)
        osc.stop(nt + 0.12)
      }
    } else {
      // cricket: short buzzy pulses
      for (let i = 0; i < 3; i++) {
        const nt = t + i * 0.09
        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.value = 2400 + rng() * 300
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.0001, nt)
        env.gain.exponentialRampToValueAtTime(0.012, nt + 0.005)
        env.gain.exponentialRampToValueAtTime(0.0001, nt + 0.03)
        osc.connect(env)
        env.connect(this.masterFilter)
        osc.start(nt)
        osc.stop(nt + 0.04)
      }
    }
  }

  private makeNoise(seconds: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    const rng = mulberry32(this.seed ^ 0x2c1a)
    // brownish noise for a softer ocean/wind bed
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = rng() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    return buffer
  }

  dispose(): void {
    this.started = false
    if (this.birdTimer !== null) clearTimeout(this.birdTimer)
    this.out.disconnect()
  }
}
