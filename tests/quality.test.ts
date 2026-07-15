import { describe, it, expect } from 'vitest'
import {
  QualityGovernor,
  QUALITY_PROFILES,
  resolveCanvasDpr,
  resolveQuality,
  resolveShadowMapSize,
  type QualityDecision,
} from '@/game/core/quality'

describe('resolveQuality', () => {
  it('returns the explicit level when not auto', () => {
    expect(resolveQuality('low', 'high').level).toBe('low')
    expect(resolveQuality('high', 'low').level).toBe('high')
    expect(resolveQuality('ultra', 'medium').level).toBe('ultra')
  })
  it('uses the auto level when auto', () => {
    expect(resolveQuality('auto', 'medium').level).toBe('medium')
  })
})

describe('QUALITY_PROFILES', () => {
  const levels = ['low', 'medium', 'high', 'ultra'] as const
  const profiles = levels.map((level) => QUALITY_PROFILES[level])

  it('preserves the live Low, Medium, and High geometry budgets', () => {
    expect(
      profiles.slice(0, 3).map((profile) => ({
        dprMax: profile.dprMax,
        shadowMapSize: profile.shadowMapSize,
        shadowDistance: profile.shadowDistance,
        shadowsEnabled: profile.shadowsEnabled,
        oceanDetail: profile.oceanDetail,
        oceanSegments: profile.oceanSegments,
        rainMax: profile.rainMax,
        vegetationDensity: profile.vegetationDensity,
        drawDistance: profile.drawDistance,
        reflections: profile.reflections,
        bloomAllowed: profile.bloomAllowed,
        cloudDetail: profile.cloudDetail,
        landmarkDetail: profile.landmarkDetail,
        maxDynamicLights: profile.maxDynamicLights,
      })),
    ).toEqual([
      {
        dprMax: 1,
        shadowMapSize: 1024,
        shadowDistance: 55,
        shadowsEnabled: false,
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
      {
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
      {
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
    ])
  })

  it('scales every authored-content budget Low to Ultra', () => {
    expect(profiles.map((profile) => profile.textureTier)).toEqual(['512', '1k', '2k', '4k'])
    expect(profiles.map((profile) => profile.internalResolutionScale)).toEqual([
      0.75, 0.85, 1, 1.25,
    ])
    expect(profiles.map((profile) => profile.atmosphereDetail)).toEqual([0, 1, 2, 3])
    expect(profiles.map((profile) => profile.lodBias)).toEqual([1.5, 1, 0.5, 0])
    expect(profiles.map((profile) => profile.cellLoadRadius)).toEqual([1, 2, 3, 4])
    expect(profiles.map((profile) => profile.cellRetainRadius)).toEqual([2, 3, 4, 5])
    expect(profiles.map((profile) => profile.wildlifeDensity)).toEqual([0.35, 0.65, 1, 1.35])
    expect(profiles.map((profile) => profile.wildlife)).toEqual([
      { maxNearAgents: 10, maxDistantGroups: 8, updateHz: 8, animationLodBias: 2, shadowRadius: 0, maxAudioVoices: 4 },
      { maxNearAgents: 18, maxDistantGroups: 12, updateHz: 12, animationLodBias: 1, shadowRadius: 12, maxAudioVoices: 6 },
      { maxNearAgents: 32, maxDistantGroups: 20, updateHz: 20, animationLodBias: 0, shadowRadius: 28, maxAudioVoices: 10 },
      { maxNearAgents: 48, maxDistantGroups: 28, updateHz: 30, animationLodBias: 0, shadowRadius: 42, maxAudioVoices: 12 },
    ])
    expect(profiles.map((profile) => profile.iblResolution)).toEqual([0, 64, 128, 256])
    expect(profiles.map((profile) => profile.updateHz)).toEqual([15, 30, 45, 60])
    expect(profiles.map((profile) => profile.ssaoAllowed)).toEqual([false, false, true, true])
    expect(profiles.map((profile) => profile.vegetationDensity)).toEqual(
      [...profiles.map((profile) => profile.vegetationDensity)].sort((a, b) => a - b),
    )
    expect(profiles.every((profile) => profile.wildlifeDensity > 0)).toBe(true)
  })

  it('defines the complete Ultra live budget', () => {
    expect(QUALITY_PROFILES.ultra).toMatchObject({
      dprMax: 2.5,
      shadowMapSize: 8192,
      shadowDistance: 145,
      shadowsEnabled: true,
      oceanDetail: 3,
      oceanSegments: 320,
      rainMax: 9000,
      vegetationDensity: 1.3,
      drawDistance: 2200,
      reflections: 3,
      bloomAllowed: true,
      cloudDetail: 3,
      landmarkDetail: 3,
      maxDynamicLights: 8,
    })
  })
  it('disables bloom on low', () => {
    expect(QUALITY_PROFILES.low.bloomAllowed).toBe(false)
    expect(QUALITY_PROFILES.high.bloomAllowed).toBe(true)
  })
  it('turns off shadow rendering on low', () => {
    expect(QUALITY_PROFILES.low.shadowsEnabled).toBe(false)
    expect(QUALITY_PROFILES.medium.shadowsEnabled).toBe(true)
  })

  it('resolves internal DPR without changing the current DPR2 tier results', () => {
    expect(profiles.map((profile) => resolveCanvasDpr(2, profile))).toEqual([1, 1.5, 2, 2.5])
    expect(resolveCanvasDpr(1, QUALITY_PROFILES.low)).toBe(0.8)
  })
})

describe('resolveShadowMapSize', () => {
  it('clamps an authored shadow budget to the GPU texture limit', () => {
    expect(resolveShadowMapSize(8192, 4096)).toBe(4096)
    expect(resolveShadowMapSize(2048, 4096)).toBe(2048)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid requested size (%s)',
    (requested) => {
      expect(() => resolveShadowMapSize(requested, 4096)).toThrow(RangeError)
    },
  )

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid GPU limit (%s)',
    (limit) => {
      expect(() => resolveShadowMapSize(4096, limit)).toThrow(RangeError)
    },
  )
})

describe('QualityGovernor', () => {
  const feedWindow = (governor: QualityGovernor, dt: number) => {
    let decision = null
    for (let i = 0; i < 180; i++) decision = governor.update(dt) ?? decision
    return decision
  }

  it('demotes after one over-budget p95 window', () => {
    const governor = new QualityGovernor('high')
    expect(feedWindow(governor, 1 / 30)).toEqual({
      previous: 'high',
      next: 'medium',
      p95FrameMs: 1000 / 30,
      reason: 'over-budget',
    })
    expect(governor.current).toBe('medium')
  })

  it('does not demote High at an ordinary 60 FPS', () => {
    const governor = new QualityGovernor('high')
    expect(feedWindow(governor, 1 / 60)).toBeNull()
    expect(governor.current).toBe('high')
  })

  it('requires three consecutive headroom windows to promote', () => {
    const governor = new QualityGovernor('low')
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toEqual({
      previous: 'low',
      next: 'medium',
      p95FrameMs: 1000 / 120,
      reason: 'sustained-headroom',
    })
  })

  it('resets promotion evidence when a window lacks headroom', () => {
    const governor = new QualityGovernor('medium')
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 60)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)?.next).toBe('high')
  })

  it('does not promote Auto to Ultra', () => {
    const governor = new QualityGovernor('high')
    for (let i = 0; i < 3_600; i++) governor.update(1 / 120)
    expect(governor.current).toBe('high')
  })

  it('holds a demoted tier until a fresh post-cooldown window is complete', () => {
    const governor = new QualityGovernor('high')
    expect(feedWindow(governor, 1 / 30)?.next).toBe('medium')
    expect(feedWindow(governor, 1 / 30)).toBeNull()
    expect(governor.current).toBe('medium')
    expect(feedWindow(governor, 1 / 30)).toBeNull()
    for (let i = 0; i < 119; i++) expect(governor.update(1 / 30)).toBeNull()
    expect(governor.update(1 / 30)?.next).toBe('low')
  })

  it('ignores the cooldown-crossing frame at a non-window-divisible boundary', () => {
    const governor = new QualityGovernor('high')
    expect(feedWindow(governor, 1 / 30)?.next).toBe('medium')

    // 143 * 70 ms crosses the 10 s boundary. That crossing frame is still
    // cooldown time and must not become the first sample of a mixed window.
    for (let i = 0; i < 143; i++) expect(governor.update(0.07)).toBeNull()
    for (let i = 0; i < 179; i++) expect(governor.update(1 / 30)).toBeNull()
    expect(governor.update(1 / 30)?.next).toBe('low')
  })

  it('requires a fresh three-window proof after the 30-second promotion cooldown', () => {
    const governor = new QualityGovernor('low')
    feedWindow(governor, 1 / 120)
    feedWindow(governor, 1 / 120)
    expect(feedWindow(governor, 1 / 120)?.next).toBe('medium')

    for (let i = 0; i < 20; i++) expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)?.next).toBe('high')
  })

  it('resetEvaluation discards an incomplete window without changing tier', () => {
    const governor = new QualityGovernor('high')
    for (let i = 0; i < 179; i++) expect(governor.update(1 / 30)).toBeNull()

    governor.resetEvaluation()
    expect(governor.current).toBe('high')
    for (let i = 0; i < 179; i++) expect(governor.update(1 / 30)).toBeNull()
    expect(governor.update(1 / 30)?.next).toBe('medium')
  })

  it('resetEvaluation discards accumulated promotion evidence', () => {
    const governor = new QualityGovernor('low')
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toBeNull()

    governor.resetEvaluation()
    expect(governor.current).toBe('low')
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)).toBeNull()
    expect(feedWindow(governor, 1 / 120)?.next).toBe('medium')
  })

  it('resetEvaluation preserves the active cooldown and requires a fresh window afterward', () => {
    const governor = new QualityGovernor('high')
    expect(feedWindow(governor, 1 / 30)?.next).toBe('medium')

    // Spend part of the cooldown, then simulate a menu/manual-quality
    // eligibility transition. Resetting evaluation must neither cancel nor
    // restart the remaining anti-thrash hold.
    for (let i = 0; i < 40; i++) expect(governor.update(0.07)).toBeNull()
    governor.resetEvaluation()
    expect(governor.current).toBe('medium')
    for (let i = 40; i < 143; i++) expect(governor.update(0.07)).toBeNull()

    // The cooldown-crossing frame was ignored, so only a wholly fresh
    // 180-frame evidence window may demote again.
    for (let i = 0; i < 179; i++) expect(governor.update(1 / 30)).toBeNull()
    expect(governor.update(1 / 30)?.next).toBe('low')
  })

  it('does not thrash within one sample window', () => {
    const g = new QualityGovernor('medium')
    const results: (QualityDecision | null)[] = []
    for (let i = 0; i < 100; i++) results.push(g.update(1 / 60))
    // fewer than 180 samples → no decision yet
    expect(results.every((r) => r === null)).toBe(true)
  })
  it('ignores non-positive dt', () => {
    const g = new QualityGovernor('medium')
    expect(g.update(0)).toBeNull()
    expect(g.update(-1)).toBeNull()
    expect(g.update(Number.NaN)).toBeNull()
    expect(g.update(Number.POSITIVE_INFINITY)).toBeNull()
  })
})
