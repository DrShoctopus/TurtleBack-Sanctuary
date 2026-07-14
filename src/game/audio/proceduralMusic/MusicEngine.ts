/**
 * Original generative lo-fi engine (Web Audio). Four moods (dawn/day/rain/night)
 * each get a seeded chord progression; a lookahead scheduler renders soft
 * electric-piano chords, a sparse melody, gentle bass, brushed percussion, and
 * procedural vinyl/tape texture. Everything is synthesized — no samples.
 */
import { mulberry32, type Rng } from '../../core/rng'
import { midiToFreq, chordFromDegree, quantizeToScale } from './theory'
import { MOODS, buildProgression, scaleIntervals, type MusicMood, type MoodConfig } from './moods'
import { bindMusicPlayer, bindMusicPreview } from './engineHandle'

interface MoodState {
  mood: MusicMood
  config: MoodConfig
  progression: number[]
  rng: Rng
  melodyRng: Rng
  gain: GainNode
  lastMelodyMidi: number
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

  constructor(ctx: AudioContext, destination: AudioNode, seed: number) {
    this.ctx = ctx
    this.seed = seed
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
        progression: buildProgression(config, seed ^ hashMood(mood), 8),
        rng: mulberry32(seed ^ (hashMood(mood) + 13)),
        melodyRng: mulberry32(seed ^ (hashMood(mood) + 91)),
        gain,
        lastMelodyMidi: config.rootMidi + 12,
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
    const secPer16th = () => 60 / this.moods.get(active)!.config.bpm / 4
    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(active, this.step, this.nextNoteTime)
      this.nextNoteTime += secPer16th()
      this.step = (this.step + 1) % (16 * 8) // 8 bars of sixteenths
    }
    this.timer = window.setTimeout(this.tick, LOOKAHEAD * 1000)
  }

  private scheduleStep(mood: MusicMood, step: number, time: number): void {
    const state = this.moods.get(mood)!
    const cfg = state.config
    const bar = Math.floor(step / 16)
    const sixteenth = step % 16
    const scale = scaleIntervals(cfg)
    const chordBarsIdx = Math.floor(bar / cfg.chordBars) % state.progression.length
    const degree = state.progression[chordBarsIdx]

    // --- chord (electric piano) on beat 1 and sometimes beat 3 ---
    if (sixteenth === 0 || (sixteenth === 8 && state.rng() < 0.5)) {
      const chord = chordFromDegree(cfg.rootMidi, scale, degree, {
        seventh: true,
        add9: state.rng() < 0.4,
      })
      chord.forEach((midi, i) => {
        this.playEPiano(
          state,
          midiToFreq(midi - 12 + (i > 2 ? 12 : 0)),
          time + i * 0.012,
          1.9,
          cfg.padLevel * 0.4,
        )
      })
    }

    // --- pad (sustained sine stack) refreshed each chord change ---
    if (sixteenth === 0 && bar % cfg.chordBars === 0) {
      const chord = chordFromDegree(cfg.rootMidi, scale, degree, { seventh: true })
      const dur = (60 / cfg.bpm) * 4 * cfg.chordBars
      chord.forEach((midi) => this.playPad(state, midiToFreq(midi), time, dur, cfg.padLevel * 0.16))
    }

    // --- bass on beats ---
    if (sixteenth === 0 || sixteenth === 10) {
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

    // --- brushed percussion ---
    if (cfg.percLevel > 0) {
      if (sixteenth % 8 === 4) this.playPerc(state, time, 'snareBrush', cfg.percLevel * 0.5)
      if (sixteenth % 4 === 2 && state.rng() < 0.6)
        this.playPerc(state, time, 'hat', cfg.percLevel * 0.3)
      if (sixteenth === 0) this.playPerc(state, time, 'kick', cfg.percLevel * 0.6)
    }

    // --- sparse melody ---
    if (state.melodyRng() < cfg.melodyDensity && sixteenth % 2 === 0) {
      const step7 = Math.floor((state.melodyRng() - 0.5) * 6)
      let midi = quantizeToScale(state.lastMelodyMidi + step7, cfg.rootMidi, scale)
      const hi = cfg.rootMidi + 20
      const lo = cfg.rootMidi + 4
      if (midi > hi) midi -= 12
      if (midi < lo) midi += 12
      state.lastMelodyMidi = midi
      this.playMelody(state, midiToFreq(midi), time, 0.5 + state.melodyRng() * 0.6, 0.16)
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

  private playEPiano(
    state: MoodState,
    freq: number,
    time: number,
    dur: number,
    level: number,
  ): void {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 2.002 // subtle beating shimmer
    const g = ctx.createGain()
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    const filter = this.lowpass(state.config.cutoff)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.exponentialRampToValueAtTime(level, time + 0.012)
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
    freq: number,
    time: number,
    dur: number,
    level: number,
  ): void {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const filter = this.lowpass(state.config.cutoff * 1.3)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, time)
    env.gain.exponentialRampToValueAtTime(level, time + 0.03)
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    // slight vibrato
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = freq * 0.006
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
    kind: 'kick' | 'hat' | 'snareBrush',
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
      filter.type = kind === 'hat' ? 'highpass' : 'bandpass'
      filter.frequency.value = kind === 'hat' ? 7000 : 2200
      const env = ctx.createGain()
      const dur = kind === 'hat' ? 0.05 : 0.12
      env.gain.setValueAtTime(level * (kind === 'hat' ? 0.5 : 0.7), time)
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
    if (Math.random() < amount) {
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
    this.crackleTimer = window.setTimeout(() => this.scheduleCrackle(), 120 + Math.random() * 400)
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
