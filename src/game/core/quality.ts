import type { QualityChoice } from '../data/settings'
import { FrameTimeWindow, percentile } from './frameTimeStats'

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra'
export type AutoQualityLevel = Exclude<QualityLevel, 'ultra'>
export type TextureTier = '512' | '1k' | '2k' | '4k'

export interface QualityProfile {
  level: QualityLevel
  dprMax: number
  internalResolutionScale: number
  shadowMapSize: number
  shadowDistance: number
  shadowsEnabled: boolean
  textureTier: TextureTier
  lodBias: number
  cellLoadRadius: number
  cellRetainRadius: number
  vegetationDensity: number
  wildlifeDensity: number
  atmosphereDetail: 0 | 1 | 2 | 3
  ssaoAllowed: boolean
  iblResolution: 0 | 64 | 128 | 256
  oceanDetail: 0 | 1 | 2 | 3
  oceanSegments: number
  rainMax: number
  drawDistance: number
  reflections: 0 | 1 | 2 | 3
  bloomAllowed: boolean
  cloudDetail: 0 | 1 | 2 | 3
  landmarkDetail: 0 | 1 | 2 | 3
  maxDynamicLights: number
  updateHz: number
}

export interface QualityDecision {
  previous: AutoQualityLevel
  next: AutoQualityLevel
  p95FrameMs: number
  reason: 'over-budget' | 'sustained-headroom'
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    level: 'low',
    dprMax: 1,
    internalResolutionScale: 0.75,
    shadowMapSize: 1024,
    shadowDistance: 55,
    shadowsEnabled: false,
    textureTier: '512',
    lodBias: 1.5,
    cellLoadRadius: 1,
    cellRetainRadius: 2,
    vegetationDensity: 0.45,
    wildlifeDensity: 0.35,
    atmosphereDetail: 0,
    ssaoAllowed: false,
    iblResolution: 0,
    oceanDetail: 0,
    oceanSegments: 96,
    rainMax: 1600,
    drawDistance: 900,
    reflections: 0,
    bloomAllowed: false,
    cloudDetail: 0,
    landmarkDetail: 0,
    maxDynamicLights: 2,
    updateHz: 15,
  },
  medium: {
    level: 'medium',
    dprMax: 1.5,
    internalResolutionScale: 0.85,
    shadowMapSize: 2048,
    shadowDistance: 80,
    shadowsEnabled: true,
    textureTier: '1k',
    lodBias: 1,
    cellLoadRadius: 2,
    cellRetainRadius: 3,
    vegetationDensity: 0.75,
    wildlifeDensity: 0.65,
    atmosphereDetail: 1,
    ssaoAllowed: false,
    iblResolution: 64,
    oceanDetail: 1,
    oceanSegments: 160,
    rainMax: 3500,
    drawDistance: 1200,
    reflections: 1,
    bloomAllowed: true,
    cloudDetail: 1,
    landmarkDetail: 1,
    maxDynamicLights: 4,
    updateHz: 30,
  },
  high: {
    level: 'high',
    dprMax: 2,
    internalResolutionScale: 1,
    shadowMapSize: 4096,
    shadowDistance: 110,
    shadowsEnabled: true,
    textureTier: '2k',
    lodBias: 0.5,
    cellLoadRadius: 3,
    cellRetainRadius: 4,
    vegetationDensity: 1,
    wildlifeDensity: 1,
    atmosphereDetail: 2,
    ssaoAllowed: true,
    iblResolution: 128,
    oceanDetail: 2,
    oceanSegments: 224,
    rainMax: 6000,
    drawDistance: 1600,
    reflections: 2,
    bloomAllowed: true,
    cloudDetail: 2,
    landmarkDetail: 2,
    maxDynamicLights: 6,
    updateHz: 45,
  },
  ultra: {
    level: 'ultra',
    dprMax: 2.5,
    internalResolutionScale: 1.25,
    shadowMapSize: 8192,
    shadowDistance: 145,
    shadowsEnabled: true,
    textureTier: '4k',
    lodBias: 0,
    cellLoadRadius: 4,
    cellRetainRadius: 5,
    vegetationDensity: 1.3,
    wildlifeDensity: 1.35,
    atmosphereDetail: 3,
    ssaoAllowed: true,
    iblResolution: 256,
    oceanDetail: 3,
    oceanSegments: 320,
    rainMax: 9000,
    drawDistance: 2200,
    reflections: 3,
    bloomAllowed: true,
    cloudDetail: 3,
    landmarkDetail: 3,
    maxDynamicLights: 8,
    updateHz: 60,
  },
}

const AUTO_LEVELS: readonly AutoQualityLevel[] = ['low', 'medium', 'high']
const AUTO_FRAME_WINDOW = 180
const DEMOTION_COOLDOWN_SECONDS = 10
const PROMOTION_COOLDOWN_SECONDS = 30
const PROMOTION_WINDOWS_REQUIRED = 3
const COOLDOWN_EPSILON_SECONDS = 1e-9

/** Maximum p95 at which an Auto tier is allowed to remain active. */
export const AUTO_QUALITY_TARGET_FRAME_MS: Readonly<Record<AutoQualityLevel, number>> = {
  low: 34,
  medium: 23,
  high: 17.5,
}

/** p95 needed for the current tier to prove it has room for the next tier. */
export const AUTO_QUALITY_HEADROOM_FRAME_MS: Readonly<
  Record<Exclude<AutoQualityLevel, 'high'>, number>
> = {
  low: 18,
  medium: 14,
}

/**
 * P95-based Auto governor. One bad window demotes; three consecutive windows
 * with real headroom promote. Explicit Ultra is deliberately outside this state.
 */
export class QualityGovernor {
  current: AutoQualityLevel
  private readonly frameTimes = new FrameTimeWindow(AUTO_FRAME_WINDOW)
  private cooldownSeconds = 0
  private headroomWindows = 0

  constructor(initial: AutoQualityLevel = 'medium') {
    this.current = initial
  }

  /**
   * Start a new evidence period without changing the resolved Auto tier or its
   * anti-thrash cooldown. Call when evaluation eligibility changes.
   */
  resetEvaluation(): void {
    this.frameTimes.clear()
    this.headroomWindows = 0
  }

  /** Feed one frame's delta in seconds. */
  update(dt: number): QualityDecision | null {
    if (!Number.isFinite(dt) || dt <= 0) return null

    // A frame that begins in cooldown is not evidence, even if its delta
    // crosses the boundary. This guarantees the next evaluation is composed
    // entirely of post-cooldown samples.
    if (this.cooldownSeconds > 0) {
      const remaining = this.cooldownSeconds - dt
      this.cooldownSeconds = remaining > COOLDOWN_EPSILON_SECONDS ? remaining : 0
      this.frameTimes.clear()
      return null
    }

    this.frameTimes.add(dt * 1000)
    if (!this.frameTimes.isFull) return null

    const p95FrameMs = percentile(this.frameTimes.snapshot(), 0.95)
    this.frameTimes.clear()

    if (p95FrameMs > AUTO_QUALITY_TARGET_FRAME_MS[this.current]) {
      this.headroomWindows = 0
      const currentIndex = AUTO_LEVELS.indexOf(this.current)
      if (currentIndex === 0) return null
      const previous = this.current
      const next = AUTO_LEVELS[currentIndex - 1]
      this.current = next
      this.cooldownSeconds = DEMOTION_COOLDOWN_SECONDS
      return { previous, next, p95FrameMs, reason: 'over-budget' }
    }

    if (this.current === 'high') {
      this.headroomWindows = 0
      return null
    }

    if (p95FrameMs <= AUTO_QUALITY_HEADROOM_FRAME_MS[this.current]) {
      this.headroomWindows++
      if (this.headroomWindows < PROMOTION_WINDOWS_REQUIRED) return null

      const previous = this.current
      const next = AUTO_LEVELS[AUTO_LEVELS.indexOf(previous) + 1]
      this.current = next
      this.headroomWindows = 0
      this.cooldownSeconds = PROMOTION_COOLDOWN_SECONDS
      return { previous, next, p95FrameMs, reason: 'sustained-headroom' }
    }

    this.headroomWindows = 0
    return null
  }
}

export function resolveQuality(choice: QualityChoice, autoLevel: AutoQualityLevel): QualityProfile {
  const level = choice === 'auto' ? autoLevel : choice
  return QUALITY_PROFILES[level]
}

/** Resolve the live R3F pixel ratio from the device ratio and tier scale. */
export function resolveCanvasDpr(devicePixelRatio: number, profile: QualityProfile): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    throw new RangeError('device pixel ratio must be positive and finite')
  }
  return Math.min(profile.dprMax, Math.max(0.8, devicePixelRatio * profile.internalResolutionScale))
}

/** Clamp an authored shadow-map budget to the renderer's hardware limit. */
export function resolveShadowMapSize(requested: number, maxTextureSize: number): number {
  if (!Number.isSafeInteger(requested) || requested <= 0) {
    throw new RangeError('requested shadow-map size must be a positive integer')
  }
  if (!Number.isSafeInteger(maxTextureSize) || maxTextureSize <= 0) {
    throw new RangeError('maximum texture size must be a positive integer')
  }
  return Math.min(requested, maxTextureSize)
}
