import type { QualityChoice } from '../state/settingsStore'

export type QualityLevel = 'low' | 'medium' | 'high'

export interface QualityProfile {
  level: QualityLevel
  dprMax: number
  shadowMapSize: number
  shadowDistance: number
  shadowsEnabled: boolean
  /** 0 cheap, 1 standard, 2 rich */
  oceanDetail: 0 | 1 | 2
  oceanSegments: number
  rainMax: number
  vegetationDensity: number
  drawDistance: number
  reflections: 0 | 1 | 2
  bloomAllowed: boolean
  cloudDetail: 0 | 1 | 2
  landmarkDetail: 0 | 1 | 2
  maxDynamicLights: number
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    level: 'low',
    dprMax: 1,
    shadowMapSize: 1024,
    shadowDistance: 55,
    shadowsEnabled: true,
    oceanDetail: 0,
    oceanSegments: 96,
    rainMax: 1600,
    vegetationDensity: 0.45,
    drawDistance: 900,
    reflections: 0,
    bloomAllowed: false,
    cloudDetail: 0,
    landmarkDetail: 0,
    maxDynamicLights: 2,
  },
  medium: {
    level: 'medium',
    dprMax: 1.5,
    shadowMapSize: 2048,
    shadowDistance: 80,
    shadowsEnabled: true,
    oceanDetail: 1,
    oceanSegments: 160,
    rainMax: 3500,
    vegetationDensity: 0.75,
    drawDistance: 1200,
    reflections: 1,
    bloomAllowed: true,
    cloudDetail: 1,
    landmarkDetail: 1,
    maxDynamicLights: 4,
  },
  high: {
    level: 'high',
    dprMax: 2,
    shadowMapSize: 4096,
    shadowDistance: 110,
    shadowsEnabled: true,
    oceanDetail: 2,
    oceanSegments: 224,
    rainMax: 6000,
    vegetationDensity: 1,
    drawDistance: 1600,
    reflections: 2,
    bloomAllowed: true,
    cloudDetail: 2,
    landmarkDetail: 2,
    maxDynamicLights: 6,
  },
}

/**
 * Auto-quality governor: starts at medium, samples smoothed FPS while playing and
 * steps down/up with hysteresis. Pure state machine — rendering applies the result.
 */
export class QualityGovernor {
  current: QualityLevel = 'medium'
  private samples: number[] = []
  private cooldown = 0

  constructor(initial: QualityLevel = 'medium') {
    this.current = initial
  }

  /** Feed one frame's dt (seconds). Returns a new level when a switch happens. */
  update(dt: number): QualityLevel | null {
    if (dt <= 0) return null
    this.cooldown -= dt
    this.samples.push(dt)
    if (this.samples.length < 180) return null
    const total = this.samples.reduce((a, b) => a + b, 0)
    const fps = this.samples.length / total
    this.samples.length = 0
    if (this.cooldown > 0) return null
    if (fps < 26 && this.current !== 'low') {
      this.current = this.current === 'high' ? 'medium' : 'low'
      this.cooldown = 10
      return this.current
    }
    if (fps > 57 && this.current === 'low') {
      this.current = 'medium'
      this.cooldown = 20
      return this.current
    }
    if (fps > 58 && this.current === 'medium') {
      this.current = 'high'
      this.cooldown = 30
      return this.current
    }
    return null
  }
}

export function resolveQuality(choice: QualityChoice, autoLevel: QualityLevel): QualityProfile {
  const level = choice === 'auto' ? autoLevel : choice
  return QUALITY_PROFILES[level]
}
