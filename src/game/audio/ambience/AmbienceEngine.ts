/**
 * Procedural ambient soundscape: ocean surf, wind, rain, and represented
 * wildlife calls. An audio-zone low-pass muffles the outdoor bed
 * when the player is inside, and rain gets its own indoor/outdoor balance.
 */
import { mulberry32 } from '../../core/rng'
import { runtime } from '../../core/runtime'
import { publishAudioCue } from '../cues'
import { useSettings } from '../../state/settingsStore'
import { events } from '../../core/events'
import type { WildlifeCallEvent } from '../../world/wildlife/types'
import { BIOME_AMBIENT_BEDS, biomeAmbiencePlanAt, type AmbientHabitat } from './BiomeAmbiencePlan'

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
  private turtleResonanceGain!: GainNode
  private biomeGains = new Map<AmbientHabitat, GainNode>()
  private biomeWeights: Readonly<Record<AmbientHabitat, number>> = {
    crownwood: 0,
    blossomshade: 0,
    lumenfen: 0,
    fernfall: 0,
    galecrest: 0,
    hearth: 0,
  }

  private unsubscribeWildlife: (() => void) | null = null
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

    // One shared procedural texture branches into gently overlapping biome
    // filters. Moving through a threshold only crossfades gains; no source is
    // restarted and no binary ambience assets are required.
    const biomeSource = ctx.createBufferSource()
    biomeSource.buffer = this.noiseBuffer
    biomeSource.loop = true
    for (const bed of BIOME_AMBIENT_BEDS) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = bed.centerFrequency
      filter.Q.value = bed.q
      const gain = ctx.createGain()
      gain.gain.value = 0
      biomeSource.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterFilter)
      this.biomeGains.set(bed.id, gain)
    }
    biomeSource.start()

    // --- interior room tone (very low hum, on only when indoors) ---
    const toneOsc = ctx.createOscillator()
    toneOsc.type = 'sine'
    toneOsc.frequency.value = 58
    this.interiorTone = ctx.createGain()
    this.interiorTone.gain.value = 0
    toneOsc.connect(this.interiorTone)
    this.interiorTone.connect(this.out)
    toneOsc.start()

    // A barely tonal sub-bass pair makes a deep breath feel island-sized. It
    // is mixed as ambience and remains restrained by Quiet Mode and proximity.
    const turtleFundamental = ctx.createOscillator()
    turtleFundamental.type = 'sine'
    turtleFundamental.frequency.value = 34
    const turtlePartial = ctx.createOscillator()
    turtlePartial.type = 'sine'
    turtlePartial.frequency.value = 51
    const turtlePartialGain = ctx.createGain()
    turtlePartialGain.gain.value = 0.24
    const turtleFilter = ctx.createBiquadFilter()
    turtleFilter.type = 'lowpass'
    turtleFilter.frequency.value = 92
    this.turtleResonanceGain = ctx.createGain()
    this.turtleResonanceGain.gain.value = 0
    turtleFundamental.connect(turtleFilter)
    turtlePartial.connect(turtlePartialGain)
    turtlePartialGain.connect(turtleFilter)
    turtleFilter.connect(this.turtleResonanceGain)
    this.turtleResonanceGain.connect(this.masterFilter)
    turtleFundamental.start()
    turtlePartial.start()

    this.unsubscribeWildlife = events.on('wildlifeCall', (call) => this.wildlifeCall(call))
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
    const turtleDistance = Math.hypot(runtime.player.pos.x, runtime.player.pos.z + 238)
    const turtleProximity = 1 - Math.min(1, Math.max(0, (turtleDistance - 30) / 360))
    const turtleTarget =
      runtime.turtle.resonanceStrength *
      (0.003 + turtleProximity * 0.017) *
      quietLevel *
      (indoors ? 0.35 : 1)
    this.turtleResonanceGain.gain.setTargetAtTime(turtleTarget, t, 0.32)

    const biomePlan = biomeAmbiencePlanAt(runtime.player.pos.x, runtime.player.pos.z)
    this.biomeWeights = biomePlan.weights
    for (const bed of BIOME_AMBIENT_BEDS) {
      const habitatLevel = biomePlan.weights[bed.id]
      const rainShape = bed.id === 'lumenfen' || bed.id === 'fernfall' ? 0.86 + rain * 0.36 : 1
      const nightShape = bed.id === 'lumenfen' ? 0.9 + night * 0.34 : 1
      const target = indoors ? 0 : habitatLevel * bed.maxGain * quietLevel * rainShape * nightShape
      this.biomeGains.get(bed.id)?.gain.setTargetAtTime(target, t, 1.1)
    }

    // subtitle cue when rain begins
    if (rain > 0.25 && this.lastRainAnnounced < 0.25) publishAudioCue('🌧 Rain begins to fall')
    if (rain < 0.1 && this.lastRainAnnounced > 0.25) publishAudioCue('The rain eases')
    this.lastRainAnnounced = rain
  }

  snapshot(): {
    biomeBedCount: number
    activeBiomeBeds: readonly AmbientHabitat[]
    biomeBedWeights: Readonly<Record<AmbientHabitat, number>>
  } {
    return {
      biomeBedCount: BIOME_AMBIENT_BEDS.length,
      activeBiomeBeds: BIOME_AMBIENT_BEDS.map(({ id }) => id).filter(
        (id) => this.biomeWeights[id] > 0.025,
      ),
      biomeBedWeights: { ...this.biomeWeights },
    }
  }

  /** A call can only arrive from a represented wildlife emitter ID. */
  private wildlifeCall(call: WildlifeCallEvent): void {
    if (!this.started || runtime.player.indoors) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.05
    const rng = mulberry32(this.seed ^ call.tick ^ (call.variant * 0x9e37))
    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 9
    panner.maxDistance = call.speciesId === 'galecrest-seabird' ? 520 : 150
    panner.rolloffFactor = 0.72
    panner.positionX.value = call.position[0]
    panner.positionY.value = call.position[1]
    panner.positionZ.value = call.position[2]
    panner.connect(this.masterFilter)
    const notes = call.speciesId === 'galecrest-seabird' ? 2 : 3 + (call.variant % 2)
    const base = call.speciesId === 'galecrest-seabird' ? 980 : 2050 + call.variant * 190
    for (let i = 0; i < notes; i++) {
      const nt = t + i * (0.1 + rng() * 0.035)
      const oscillator = ctx.createOscillator()
      oscillator.type = call.speciesId === 'galecrest-seabird' ? 'triangle' : 'sine'
      const frequency = base * (0.9 + rng() * 0.28)
      oscillator.frequency.setValueAtTime(frequency, nt)
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * (call.speciesId === 'galecrest-seabird' ? 0.78 : 1.24),
        nt + 0.075,
      )
      const envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0.0001, nt)
      envelope.gain.exponentialRampToValueAtTime(0.026 * call.gain, nt + 0.012)
      envelope.gain.exponentialRampToValueAtTime(0.0001, nt + 0.12)
      oscillator.connect(envelope)
      envelope.connect(panner)
      oscillator.start(nt)
      oscillator.stop(nt + 0.14)
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
    this.unsubscribeWildlife?.()
    this.unsubscribeWildlife = null
    this.out.disconnect()
  }
}
