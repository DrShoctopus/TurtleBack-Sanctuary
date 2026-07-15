import { mulberry32 } from '../../core/rng'
import type { TurtleScaleEvent, TurtleScaleEventKind } from './types'

export interface TurtleEventInput {
  elapsedTime: number
  playerInVista: boolean
  rain: number
  reducedMotion: boolean
}

const MIN_GAP_SECONDS = 72
const GAP_VARIATION_SECONDS = 54
const SAME_KIND_COOLDOWN_SECONDS = 12 * 60

/** Deterministic director for rare, calm, non-cutscene scale acknowledgements. */
export class TurtleEventDirector {
  private random = mulberry32(1)
  private nextAt = 18
  private nextId = 1
  private active: TurtleScaleEvent | null = null
  private lastByKind = new Map<TurtleScaleEventKind, number>()

  constructor(seed: number) {
    this.reset(seed)
  }

  reset(seed: number): void {
    this.random = mulberry32(Number.isFinite(seed) ? seed | 0 : 1)
    this.nextAt = 14 + this.random() * 12
    this.nextId = 1
    this.active = null
    this.lastByKind.clear()
  }

  update(_dt: number, input: TurtleEventInput): TurtleScaleEvent | null {
    const now = Number.isFinite(input.elapsedTime) ? Math.max(0, input.elapsedTime) : 0
    if (this.active && now < this.active.startedAt + this.active.duration) return this.active
    this.active = null
    if (now < this.nextAt) return null

    const candidates: TurtleScaleEventKind[] = ['deep-breath', 'head-turn']
    if (input.rain < 0.38) candidates.push('front-stroke')
    if (input.playerInVista) candidates.push('eye-contact')
    const eligible = candidates.filter(
      (kind) => now - (this.lastByKind.get(kind) ?? Number.NEGATIVE_INFINITY) >= SAME_KIND_COOLDOWN_SECONDS,
    )

    if (eligible.length === 0) {
      this.nextAt = now + MIN_GAP_SECONDS
      return null
    }

    const kind = eligible[Math.floor(this.random() * eligible.length)]
    const duration = kind === 'deep-breath' ? 8.5 : kind === 'front-stroke' ? 6.8 : 5.2
    const baseIntensity = 0.68 + this.random() * 0.24
    const reducedScale = input.reducedMotion ? (kind === 'deep-breath' ? 0.72 : 0.2) : 1
    this.active = Object.freeze({
      id: this.nextId++,
      kind,
      startedAt: now,
      duration,
      intensity: baseIntensity * reducedScale,
    })
    this.lastByKind.set(kind, now)
    this.nextAt = now + duration + MIN_GAP_SECONDS + this.random() * GAP_VARIATION_SECONDS
    return this.active
  }
}
