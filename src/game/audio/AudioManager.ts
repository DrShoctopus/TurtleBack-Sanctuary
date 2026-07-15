import { volumeToGain } from '../core/mathUtils'
import { useSettings } from '../state/settingsStore'
import { runtime } from '../core/runtime'
import { MusicEngine } from './proceduralMusic/MusicEngine'
import type { MusicMood } from './proceduralMusic/moods'
import type { MusicBiome } from './proceduralMusic/MusicalEventPlan'
import { AmbienceEngine } from './ambience/AmbienceEngine'
import { SfxEngine } from './SfxEngine'
import { crownwoodInfluence } from '../village/forest/layout'
import { shellRadius } from '../world/shell/shellShape'

export type BusName = 'master' | 'music' | 'ambient' | 'sfx' | 'media'

/**
 * Web Audio mixer. Created lazily on the first user gesture ("Enter Sanctuary")
 * to respect autoplay policies. The TV bus is virtual — YouTube iframe volume
 * is driven separately via postMessage; `tvVolume()` exposes the target level.
 */
class AudioManager {
  ctx: AudioContext | null = null
  private buses = new Map<BusName, GainNode>()
  private unsubscribe: (() => void) | null = null
  started = false

  music: MusicEngine | null = null
  private ambience: AmbienceEngine | null = null
  private sfx: SfxEngine | null = null
  private musicEnabled = true
  private analyser: AnalyserNode | null = null
  private analyserData: Uint8Array<ArrayBuffer> | null = null

  start(): void {
    if (this.started) {
      void this.ctx?.resume().catch(() => {})
      return
    }
    try {
      const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
    } catch {
      return
    }
    const ctx = this.ctx!
    const master = ctx.createGain()
    master.connect(ctx.destination)
    // parallel analyser tap for level metering / visualizers
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyserData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
    master.connect(this.analyser)
    this.buses.set('master', master)
    for (const name of ['music', 'ambient', 'sfx', 'media'] as const) {
      const g = ctx.createGain()
      g.connect(master)
      this.buses.set(name, g)
    }
    // a UI sub-bus rides the sfx bus so interface blips share its slider
    const uiBus = ctx.createGain()
    uiBus.connect(this.buses.get('sfx')!)

    const seed = useSettings.getState().worldSeed
    this.music = new MusicEngine(ctx, this.buses.get('music')!, seed)
    this.ambience = new AmbienceEngine(ctx, this.buses.get('ambient')!, seed)
    this.sfx = new SfxEngine(ctx, this.buses.get('sfx')!, uiBus)
    this.sfx.attach()
    this.music.start()
    this.ambience.start()

    this.started = true
    this.musicEnabled = useSettings.getState().originalMusic
    this.applyVolumes()
    this.unsubscribe = useSettings.subscribe((s) => {
      this.applyVolumes()
      this.musicEnabled = s.originalMusic
    })
    document.addEventListener('visibilitychange', this.onVisibility)
    void ctx.resume().catch(() => {})
  }

  /** Choose the music mood from time-of-day + weather. */
  private moodFromWorld(): MusicMood {
    if (runtime.weather.rain > 0.35) return 'rain'
    const t = runtime.time.t
    const night = runtime.time.celest.nightFactor
    if (night > 0.55) return 'night'
    if (t > 0.2 && t < 0.32) return 'dawn'
    if (t > 0.72 && t < 0.86) return 'dawn' // golden hour shares the dawn palette
    return 'day'
  }

  private musicBiomeFromWorld(): MusicBiome {
    const { x, z } = runtime.player.pos
    if (crownwoodInfluence(x, z) > 0.55) return 'forest'
    if (shellRadius(x, z) > 0.78) return 'edge'
    return 'village'
  }

  /** Called from the world loop each frame (throttled internally). */
  private ambienceAcc = 0
  update(dt: number): void {
    if (!this.started) return
    this.ambienceAcc += dt
    if (this.ambienceAcc >= 0.1) {
      this.ambienceAcc = 0
      this.ambience?.update()
      if (this.music) {
        const bus = this.buses.get('music')!
        const enabled = this.musicEnabled && !useSettings.getState().audio.muteAll
        bus.gain.setTargetAtTime(enabled ? volumeToGain(useSettings.getState().audio.music) : 0, this.now, 0.3)
        this.music.setMood(this.moodFromWorld())
        this.music.setWorldContext({
          biome: this.musicBiomeFromWorld(),
          turtleEvent: runtime.turtle.activeEvent !== null,
        })
      }
    }
  }

  setMusicEnabled(v: boolean): void {
    this.musicEnabled = v
  }

  /** Update the spatial-audio listener from the camera each frame. */
  updateListener(px: number, py: number, pz: number, yaw: number, pitch: number): void {
    const ctx = this.ctx
    if (!ctx) return
    const l = ctx.listener
    const fx = -Math.sin(yaw) * Math.cos(pitch)
    const fy = Math.sin(pitch)
    const fz = -Math.cos(yaw) * Math.cos(pitch)
    if (l.positionX) {
      const t = ctx.currentTime
      l.positionX.setTargetAtTime(px, t, 0.02)
      l.positionY.setTargetAtTime(py, t, 0.02)
      l.positionZ.setTargetAtTime(pz, t, 0.02)
      l.forwardX.setTargetAtTime(fx, t, 0.02)
      l.forwardY.setTargetAtTime(fy, t, 0.02)
      l.forwardZ.setTargetAtTime(fz, t, 0.02)
      l.upX.value = 0
      l.upY.value = 1
      l.upZ.value = 0
    } else {
      // Safari legacy API
      const legacy = l as unknown as {
        setPosition?: (x: number, y: number, z: number) => void
        setOrientation?: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void
      }
      legacy.setPosition?.(px, py, pz)
      legacy.setOrientation?.(fx, fy, fz, 0, 1, 0)
    }
  }

  /** RMS of the current master output, 0..1. Drives visualizers / QA checks. */
  masterLevel(): number {
    if (!this.analyser || !this.analyserData) return 0
    this.analyser.getByteTimeDomainData(this.analyserData)
    let sum = 0
    for (let i = 0; i < this.analyserData.length; i++) {
      const v = (this.analyserData[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / this.analyserData.length)
  }

  private onVisibility = () => {
    if (!this.ctx) return
    // reduce activity when hidden: suspend the whole context
    if (document.hidden) void this.ctx.suspend().catch(() => {})
    else void this.ctx.resume().catch(() => {})
  }

  async suspend(): Promise<void> {
    await this.ctx?.suspend().catch(() => undefined)
  }

  async resume(): Promise<void> {
    await this.ctx?.resume().catch(() => undefined)
  }

  bus(name: BusName): GainNode | null {
    return this.buses.get(name) ?? null
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0
  }

  applyVolumes(): void {
    if (!this.ctx) return
    const a = useSettings.getState().audio
    const t = this.ctx.currentTime
    const setGain = (name: BusName, v: number) => {
      const g = this.buses.get(name)
      if (!g) return
      g.gain.setTargetAtTime(a.muteAll ? 0 : volumeToGain(v), t, 0.05)
    }
    setGain('master', a.master)
    setGain('music', a.music)
    setGain('ambient', a.ambient)
    setGain('sfx', a.sfx)
    setGain('media', a.media)
  }

  /** Target YouTube player volume 0..100 (master × tv, perceptual). */
  tvVolume(): number {
    const a = useSettings.getState().audio
    if (a.muteAll) return 0
    return Math.round(volumeToGain(a.tv) * volumeToGain(a.master) * 100)
  }

  dispose(): void {
    this.unsubscribe?.()
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.music?.dispose()
    this.ambience?.dispose()
    this.sfx?.dispose()
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.buses.clear()
    this.started = false
  }
}

export const audio = new AudioManager()

export function startAudio(): void {
  audio.start()
}
