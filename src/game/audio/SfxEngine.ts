/** Synthesized footsteps, interaction sounds, and UI blips. All procedural. */
import { mulberry32 } from '../core/rng'
import { events } from '../core/events'
import type { GameEvents } from '../core/events'

export class SfxEngine {
  private ctx: AudioContext
  private out: GainNode
  private uiOut: GainNode
  private noise: AudioBuffer
  private unsub: Array<() => void> = []

  constructor(ctx: AudioContext, sfxBus: AudioNode, uiBus: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.connect(sfxBus)
    this.uiOut = ctx.createGain()
    this.uiOut.gain.value = 0.5
    this.uiOut.connect(uiBus)
    this.noise = this.makeNoise()
  }

  attach(): void {
    this.unsub.push(
      events.on('footstep', (p) => this.footstep(p)),
      events.on('interactSound', (p) => this.interact(p.kind)),
      events.on('uiSound', (p) => this.ui(p.kind)),
      events.on('respawnSplash', () => this.splash()),
    )
  }

  private now(offset = 0.02): number {
    return this.ctx.currentTime + offset
  }

  private footstep(p: GameEvents['footstep']): void {
    const t = this.now()
    const rng = mulberry32((Math.random() * 1e9) | 0)
    const surface = p.surface
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.8 + rng() * 0.4
    const filter = this.ctx.createBiquadFilter()
    const env = this.ctx.createGain()
    let dur = 0.09
    let level = 0.09
    switch (surface) {
      case 'wood':
        filter.type = 'bandpass'
        filter.frequency.value = 420
        filter.Q.value = 1.2
        level = 0.11
        break
      case 'stone':
        filter.type = 'bandpass'
        filter.frequency.value = 900
        filter.Q.value = 0.7
        dur = 0.07
        break
      case 'grass':
        filter.type = 'highpass'
        filter.frequency.value = 2600
        level = 0.06
        dur = 0.11
        break
      case 'shell':
        filter.type = 'bandpass'
        filter.frequency.value = 620
        filter.Q.value = 0.9
        break
      case 'interior':
        filter.type = 'bandpass'
        filter.frequency.value = 520
        filter.Q.value = 1
        level = 0.08
        break
    }
    if (p.jog) level *= 1.25
    env.gain.setValueAtTime(level, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.out)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  private interact(kind: GameEvents['interactSound']['kind']): void {
    const t = this.now()
    switch (kind) {
      case 'chime':
        this.bell(t, 1320, 0.9, 0.12)
        this.bell(t + 0.04, 1760, 1.1, 0.09)
        this.bell(t + 0.09, 2640, 1.3, 0.06)
        break
      case 'lamp':
        this.click(t, 0.08)
        break
      case 'door':
        this.softThud(t, 180)
        break
      case 'water':
        this.water(t)
        break
      case 'sit':
        this.softThud(t, 120)
        break
      case 'tea':
        this.water(t, 0.6)
        break
      case 'page':
        this.pageTurn(t)
        break
      default:
        this.click(t, 0.05)
    }
  }

  private ui(kind: GameEvents['uiSound']['kind']): void {
    const t = this.now()
    const freqs: Record<string, number> = {
      move: 520,
      confirm: 720,
      back: 380,
      open: 620,
      close: 440,
      soft: 560,
    }
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freqs[kind] ?? 520
    const env = this.ctx.createGain()
    const level = kind === 'move' || kind === 'soft' ? 0.04 : 0.08
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(level, t + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    osc.connect(env)
    env.connect(this.uiOut)
    osc.start(t)
    osc.stop(t + 0.14)
  }

  private bell(t: number, freq: number, dur: number, level: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const osc2 = this.ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 2.76 // inharmonic partial for a metallic ring
    const g2 = this.ctx.createGain()
    g2.gain.value = 0.3
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(level, t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(env)
    osc2.connect(g2)
    g2.connect(env)
    env.connect(this.out)
    osc.start(t)
    osc2.start(t)
    osc.stop(t + dur + 0.05)
    osc2.stop(t + dur + 0.05)
  }

  private click(t: number, level: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2400
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(level, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.out)
    src.start(t)
    src.stop(t + 0.05)
  }

  private softThud(t: number, freq: number): void {
    const osc = this.ctx.createOscillator()
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.1)
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.1, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    osc.connect(env)
    env.connect(this.out)
    osc.start(t)
    osc.stop(t + 0.16)
  }

  private water(t: number, level = 1): void {
    for (let i = 0; i < 4; i++) {
      const nt = t + i * 0.05 + Math.random() * 0.02
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      const f = 700 + Math.random() * 900
      osc.frequency.setValueAtTime(f, nt)
      osc.frequency.exponentialRampToValueAtTime(f * 1.8, nt + 0.04)
      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0.05 * level, nt)
      env.gain.exponentialRampToValueAtTime(0.0001, nt + 0.06)
      osc.connect(env)
      env.connect(this.out)
      osc.start(nt)
      osc.stop(nt + 0.08)
    }
  }

  private pageTurn(t: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 1.6
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 3200
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(0.05, t + 0.06)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.out)
    src.start(t)
    src.stop(t + 0.2)
  }

  private splash(): void {
    const t = this.now()
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1800, t)
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.4)
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.18, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.out)
    src.start(t)
    src.stop(t + 0.55)
  }

  private makeNoise(): AudioBuffer {
    const len = this.ctx.sampleRate * 0.5
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    const rng = mulberry32(4477)
    for (let i = 0; i < len; i++) data[i] = rng() * 2 - 1
    return buffer
  }

  dispose(): void {
    this.unsub.forEach((fn) => fn())
    this.unsub = []
    this.out.disconnect()
    this.uiOut.disconnect()
  }
}
