/**
 * Adaptive generative lo-fi engine (Web Audio). A pure, deterministic two-hour
 * event plan supplies long-form structure while live world context colours the
 * orchestration. Everything is synthesized, so the richer score adds no asset
 * download weight.
 */
import { mulberry32 } from '../../core/rng'
import { midiToFreq, chordFromDegree, quantizeToScale } from './theory'
import { MOODS, scaleIntervals, type MusicMood, type MoodConfig } from './moods'
import { bindMusicPlayer, bindMusicPreview } from './engineHandle'
import {
  buildMusicalEventPlan,
  sectionAtBar,
  type LeadTimbre,
  type MusicBiome,
  type MusicContext,
  type MusicalSection,
} from './MusicalEventPlan'

interface MoodState {
  mood: MusicMood
  config: MoodConfig
  gain: GainNode
}

const LOOKAHEAD = 0.1 // s of scheduler tick
const SCHEDULE_AHEAD = 0.5 // s scheduled in advance

export class MusicEngine {
  private ctx: AudioContext
  private out: GainNode
  private moods = new Map<MusicMood, MoodState>()
  private current: MusicMood = 'day'
  private previewUntil = 0
  private previewMood: MusicMood | null = null
  private playerEngaged = false
  private playerMood: MusicMood | null = null
  private playerPlaying = false
  private nextNoteTime = 0
  private step = 0 // sixteenth counter
  private timer: number | null = null
  private noiseBuffer: AudioBuffer
  private started = false
  private seed: number
  private readonly plan: ReturnType<typeof buildMusicalEventPlan>
  private worldContext: MusicContext = { mood: 'day', biome: 'village', turtleEvent: false }
  private scheduledEvents = 0
  private crackleRng: ReturnType<typeof mulberry32>

  constructor(ctx: AudioContext, destination: AudioNode, seed: number) {
    this.ctx = ctx
    this.seed = seed
    this.plan = buildMusicalEventPlan(seed, 120)
    this.crackleRng = mulberry32(seed ^ 0x63726163)
    this.out = ctx.createGain()
    this.out.gain.value = 1
    this.out.connect(destination)
    this.noiseBuffer = this.makeNoiseBuffer()
    for (const mood of Object.keys(MOODS) as MusicMood[]) {
      const config = MOODS[mood]
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(this.out)
      this.moods.set(mood, {
        mood,
        config,
        gain,
      })
    }
    bindMusicPreview((m) => this.preview(m))
    bindMusicPlayer((mood, playing) => this.setPlayerState(mood, playing))
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.nextNoteTime = this.ctx.currentTime + 0.15
    this.step = 0
    this.startTapeTexture()
    this.tick()
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.started = false
  }

  /** Set the active mood; gains crossfade over ~4s. */
  setMood(mood: MusicMood): void {
    this.current = mood
    this.worldContext = { ...this.worldContext, mood }
  }

  /** Update biome and turtle colour without resetting the musical timeline. */
  setWorldContext(context: { biome: MusicBiome; turtleEvent: boolean }): void {
    this.worldContext = { ...this.worldContext, ...context }
  }

  /** Play a mood briefly regardless of world state (record-shop station). */
  preview(mood: MusicMood): void {
    this.previewMood = mood
    this.previewUntil = this.ctx.currentTime + 30
  }

  /** Persistent home-stereo selection. A null mood intentionally ducks the
   * generated score while local audio or radio is active. */
  setPlayerState(mood: MusicMood | null, playing: boolean): void {
    this.playerEngaged = true
    this.playerMood = mood
    this.playerPlaying = playing
  }

  private activeMood(): MusicMood {
    if (this.playerEngaged && this.playerMood) return this.playerMood
    if (this.previewMood && this.ctx.currentTime < this.previewUntil) return this.previewMood
    this.previewMood = null
    return this.current
  }

  private tick = () => {
    if (!this.started) return
    const active = this.activeMood()
    // crossfade mood gains
    const now = this.ctx.currentTime
    for (const [mood, state] of this.moods) {
      const playerMuted = this.playerEngaged && !this.playerPlaying
      const target = !playerMuted && mood === active ? state.config.gain : 0
      state.gain.gain.setTargetAtTime(target, now, 1.4)
    }
    // schedule notes
    const secPer16th = 60 / this.plan.bpm / 4
    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(active, this.step, this.nextNoteTime)
      this.nextNoteTime += secPer16th
      this.step++
    }
    this.timer = window.setTimeout(this.tick, LOOKAHEAD * 1000)
  }

  private scheduleStep(mood: MusicMood, step: number, time: number): void {
    const state = this.moods.get(mood)!
    const cfg = state.config
    const bar = Math.floor(step / 16)
    const sixteenth = step % 16
    const section = sectionAtBar(this.plan, bar)
    const localBar = bar - section.startBar
    const sectionContext = { ...this.worldContext, mood }
    const rng = mulberry32(
      this.seed ^
        hashMood(mood) ^
        Math.imul(section.index + 1, 0x45d9f3b) ^
        Math.imul(step + 1, 0x119de1f3),
    )
    const scale = scaleIntervals(cfg)
    const chordBarsIdx =
      Math.floor(localBar / Math.max(1, cfg.chordBars)) % section.motif.progression.length
    const degree = section.motif.progression[chordBarsIdx]
    const instruments = new Set(section.palette.instruments)
    const resting = section.form === 'outro-rest'
    const bridging = section.form === 'ambient-bridge'
    const sparse = section.form === 'intro' || section.form === 'breakdown' || bridging
    if (resting) return

    const keyTimbre: LeadTimbre | 'electric-piano' = instruments.has('nylon-guitar')
      ? 'nylon-guitar'
      : instruments.has('felt-piano')
        ? 'felt-piano'
        : instruments.has('soft-mallets')
          ? 'soft-mallets'
          : 'electric-piano'

    // --- palette-specific chord voice on beat 1 and, in fuller forms, beat 3 ---
    if (sixteenth === 0 || (!sparse && sixteenth === 8 && rng() < 0.62)) {
      const chord = chordFromDegree(cfg.rootMidi, scale, degree, {
        seventh: true,
        add9: section.voicing > 1,
      })
      chord.forEach((midi, i) => {
        this.playKeys(
          state,
          keyTimbre,
          midiToFreq(midi - 12 + (i > 2 ? 12 : 0)),
          time + i * (0.009 + (section.microTimingPattern % 4) * 0.002),
          keyTimbre === 'nylon-guitar' ? 1.25 : 1.9,
          cfg.padLevel * (bridging ? 0.18 : 0.4),
        )
      })
    }

    // --- pad (sustained sine stack) refreshed each chord change ---
    if (instruments.has('tape-pad') && sixteenth === 0 && localBar % cfg.chordBars === 0) {
      const chord = chordFromDegree(cfg.rootMidi, scale, degree, { seventh: true })
      const dur = (60 / cfg.bpm) * 4 * cfg.chordBars
      chord.forEach((midi) => this.playPad(state, midiToFreq(midi), time, dur, cfg.padLevel * 0.16))
    }

    // --- bass on beats ---
    if (instruments.has('bass') && !sparse && (sixteenth === 0 || sixteenth === 10)) {
      const bassMidi =
        cfg.rootMidi - 24 + scale[((degree % scale.length) + scale.length) % scale.length]
      this.playBass(
        state,
        midiToFreq(bassMidi),
        time,
        sixteenth === 0 ? 1.4 : 0.7,
        cfg.bassLevel * 0.5,
      )
    }

    // --- brushed kit or hand percussion ---
    if (
      cfg.percLevel > 0 &&
      !sparse &&
      (instruments.has('brushed-kit') || instruments.has('hand-percussion'))
    ) {
      const hand = instruments.has('hand-percussion')
      if (sixteenth % 8 === 4)
        this.playPerc(state, time, hand ? 'hand' : 'snareBrush', cfg.percLevel * 0.5)
      if (sixteenth % 4 === 2 && rng() < 0.6)
        this.playPerc(state, time, hand ? 'shaker' : 'hat', cfg.percLevel * 0.3)
      if (sixteenth === 0) this.playPerc(state, time, 'kick', cfg.percLevel * 0.6)
    }

    // --- authored motif rhythm, varied by section ---
    const motifStep = (sixteenth + section.rhythmVariation) % 16
    const motifIndex = section.motif.rhythm.indexOf(motifStep)
    if (
      motifIndex >= 0 &&
      rng() < cfg.melodyDensity * section.density * (bridging ? 0.52 : 1.65)
    ) {
      const interval = section.motif.intervals[motifIndex % section.motif.intervals.length]
      let midi = quantizeToScale(
        cfg.rootMidi + 12 + interval + section.register * 5,
        cfg.rootMidi,
        scale,
      )
      const hi = cfg.rootMidi + 20
      const lo = cfg.rootMidi + 4
      if (midi > hi) midi -= 12
      if (midi < lo) midi += 12
      this.playMelody(state, section.lead, midiToFreq(midi), time, 0.5 + rng() * 0.6, 0.16)
    }

    // World accents colour a section in place; they never reset the timeline.
    if (sixteenth === 12 && localBar % 2 === 0) {
      this.playContextOverlay(state, section, sectionContext, degree, scale, time)
    }
    this.scheduledEvents++
  }

  private playContextOverlay(
    state: MoodState,
    section: MusicalSection,
    context: MusicContext,
    degree: number,
    scale: readonly number[],
    time: number,
  ): void {
    const root = state.config.rootMidi + scale[((degree % scale.length) + scale.length) % scale.length]
    if (context.turtleEvent) {
      this.playPad(state, midiToFreq(root - 12), time, 3.4, state.config.padLevel * 0.11)
      return
    }
    if (context.biome === 'forest') {
      this.playMelody(state, 'air-flute', midiToFreq(root + 12), time, 1.8, 0.065)
    } else if (context.biome === 'edge') {
      this.playMelody(state, 'air-flute', midiToFreq(root + 19), time, 2.2, 0.052)
    } else if (section.form !== 'ambient-bridge') {
      this.playKeys(state, 'soft-mallets', midiToFreq(root + 12), time, 1.1, 0.052)
    }
  }

  /** Lightweight live diagnostics; no AudioNodes or mutable plan data escape. */
  snapshot(): {
    form: MusicalSection['form']
    palette: MusicalSection['palette']['id']
    lead: LeadTimbre
    sectionIndex: number
    globalBar: number
    scheduledEvents: number
    schedulerTimers: number
    biome: MusicBiome
    turtleEvent: boolean
  } {
    const globalBar = Math.floor(this.step / 16)
    const section = sectionAtBar(this.plan, globalBar)
    return {
      form: section.form,
      palette: section.palette.id,
      lead: section.lead,
      sectionIndex: section.index,
      globalBar,
      scheduledEvents: this.scheduledEvents,
      schedulerTimers: Number(this.timer !== null) + Number(this.crackleTimer !== null),
      biome: this.worldContext.biome,
      turtleEvent: this.worldContext.turtleEvent,
    }
  }

  // --- voices -------------------------------------------------------------

  private lowpass(freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = freq
    f.Q.value = q
    return f
  }

  private playKeys(
    state: MoodState,
    timbre: LeadTimbre | 'electric-piano',
    freq: number,
    time: number,
    dur: number,
    level: number,
  ): void {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type =
      timbre === 'nylon-guitar' ? 'sawtooth' : timbre === 'soft-mallets' ? 'sine' : 'triangle'
    osc.frequency.value = freq
    const osc2 = ctx.createOscillator()
    osc2.type = timbre === 'felt-piano' ? 'triangle' : 'sine'
    osc2.frequency.value = freq * 2.002 // subtle beating shimmer
    const g = ctx.createGain()
    const g2 = ctx.createGain()
    g2.gain.value =
      timbre === 'nylon-guitar' ? 0.08 : timbre === 'soft-mallets' ? 0.42 : 0.25
    const cutoff =
      timbre === 'felt-piano'
        ? state.config.cutoff * 0.62
        : timbre === 'nylon-guitar'
          ? 1700
          : state.config.cutoff
    const filter = this.lowpass(cutoff)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.exponentialRampToValueAtTime(level, time + (timbre === 'felt-piano' ? 0.025 : 0.012))
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(g)
    osc2.connect(g2)
    g.connect(filter)
    g2.connect(filter)
    filter.connect(env)
    env.connect(state.gain)
    osc.start(time)
    osc2.start(time)
    osc.stop(time + dur + 0.05)
    osc2.stop(time + dur + 0.05)
  }

  private playPad(state: MoodState, freq: number, time: number, dur: number, level: number): void {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const detune = ctx.createOscillator()
    detune.type = 'sawtooth'
    detune.frequency.value = freq * 1.005
    const filter = this.lowpass(state.config.cutoff * 0.7)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.exponentialRampToValueAtTime(level, time + 1.2)
    env.gain.setValueAtTime(level, time + dur - 1.2)
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(filter)
    detune.connect(filter)
    filter.connect(env)
    env.connect(state.gain)
    osc.start(time)
    detune.start(time)
    osc.stop(time + dur + 0.1)
    detune.stop(time + dur + 0.1)
  }

  private playBass(state: MoodState, freq: number, time: number, dur: number, level: number): void {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.exponentialRampToValueAtTime(level, time + 0.04)
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(env)
    env.connect(state.gain)
    osc.start(time)
    osc.stop(time + dur + 0.05)
  }

  private playMelody(
    state: MoodState,
    timbre: LeadTimbre,
    freq: number,
    time: number,
    dur: number,
    level: number,
  ): void {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = timbre === 'nylon-guitar' || timbre === 'felt-piano' ? 'triangle' : 'sine'
    osc.frequency.value = freq
    const brightness = timbre === 'felt-piano' ? 0.68 : timbre === 'nylon-guitar' ? 0.82 : 1.3
    const filter = this.lowpass(state.config.cutoff * brightness)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.exponentialRampToValueAtTime(level, time + 0.03)
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    // slight vibrato
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = timbre === 'air-flute' ? freq * 0.006 : freq * 0.0015
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    osc.connect(filter)
    filter.connect(env)
    env.connect(state.gain)
    osc.start(time)
    lfo.start(time)
    osc.stop(time + dur + 0.05)
    lfo.stop(time + dur + 0.05)
  }

  private playPerc(
    state: MoodState,
    time: number,
    kind: 'kick' | 'hat' | 'snareBrush' | 'hand' | 'shaker',
    level: number,
  ): void {
    const ctx = this.ctx
    if (kind === 'kick') {
      const osc = ctx.createOscillator()
      osc.frequency.setValueAtTime(120, time)
      osc.frequency.exponentialRampToValueAtTime(45, time + 0.12)
      const env = ctx.createGain()
      env.gain.setValueAtTime(level, time)
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.18)
      osc.connect(env)
      env.connect(state.gain)
      osc.start(time)
      osc.stop(time + 0.2)
    } else {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const filter = ctx.createBiquadFilter()
      filter.type = kind === 'hat' || kind === 'shaker' ? 'highpass' : 'bandpass'
      filter.frequency.value =
        kind === 'hat' ? 7000 : kind === 'shaker' ? 4800 : kind === 'hand' ? 1150 : 2200
      const env = ctx.createGain()
      const dur = kind === 'hat' ? 0.05 : kind === 'shaker' ? 0.08 : kind === 'hand' ? 0.16 : 0.12
      env.gain.setValueAtTime(level * (kind === 'hat' || kind === 'shaker' ? 0.5 : 0.7), time)
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur)
      src.connect(filter)
      filter.connect(env)
      env.connect(state.gain)
      src.start(time)
      src.stop(time + dur + 0.02)
    }
  }

  // --- tape / vinyl texture ------------------------------------------------

  private startTapeTexture(): void {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3200
    filter.Q.value = 0.4
    const g = ctx.createGain()
    g.gain.value = 0.006
    // slow "wow and flutter" LFO on the noise gain for tape feel
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.5
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.003
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.out)
    src.start()
    lfo.start()
    // occasional vinyl crackle
    this.scheduleCrackle()
  }

  private crackleTimer: number | null = null
  private scheduleCrackle(): void {
    if (!this.started) return
    const state = this.moods.get(this.activeMood())!
    const amount = state.config.texture
    if (this.crackleRng() < amount) {
      const time = this.ctx.currentTime + 0.02
      const src = this.ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 4000
      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0.02 * amount, time)
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.03)
      src.connect(filter)
      filter.connect(env)
      env.connect(this.out)
      src.start(time)
      src.stop(time + 0.05)
    }
    this.crackleTimer = window.setTimeout(
      () => this.scheduleCrackle(),
      120 + this.crackleRng() * 400,
    )
  }

  private makeNoiseBuffer(): AudioBuffer {
    const len = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    const rng = mulberry32(this.seed ^ 0x9e37)
    for (let i = 0; i < len; i++) data[i] = rng() * 2 - 1
    return buffer
  }

  dispose(): void {
    this.stop()
    if (this.crackleTimer !== null) clearTimeout(this.crackleTimer)
    this.out.disconnect()
  }
}

function hashMood(mood: MusicMood): number {
  let h = 0
  for (let i = 0; i < mood.length; i++) h = (h * 31 + mood.charCodeAt(i)) | 0
  return h >>> 0
}
