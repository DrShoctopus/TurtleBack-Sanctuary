import { describe, it, expect } from 'vitest'
import { QualityGovernor, QUALITY_PROFILES, resolveQuality } from '@/game/core/quality'

describe('resolveQuality', () => {
  it('returns the explicit level when not auto', () => {
    expect(resolveQuality('low', 'high').level).toBe('low')
    expect(resolveQuality('high', 'low').level).toBe('high')
  })
  it('uses the auto level when auto', () => {
    expect(resolveQuality('auto', 'medium').level).toBe('medium')
  })
})

describe('QUALITY_PROFILES', () => {
  it('scales cost monotonically low → high', () => {
    const l = QUALITY_PROFILES.low
    const m = QUALITY_PROFILES.medium
    const h = QUALITY_PROFILES.high
    expect(l.shadowMapSize).toBeLessThan(m.shadowMapSize)
    expect(m.shadowMapSize).toBeLessThanOrEqual(h.shadowMapSize)
    expect(l.rainMax).toBeLessThan(h.rainMax)
    expect(l.dprMax).toBeLessThanOrEqual(h.dprMax)
    expect(l.drawDistance).toBeLessThan(h.drawDistance)
  })
  it('disables bloom on low', () => {
    expect(QUALITY_PROFILES.low.bloomAllowed).toBe(false)
    expect(QUALITY_PROFILES.high.bloomAllowed).toBe(true)
  })
  it('turns off shadow rendering on low', () => {
    expect(QUALITY_PROFILES.low.shadowsEnabled).toBe(false)
    expect(QUALITY_PROFILES.medium.shadowsEnabled).toBe(true)
  })
})

describe('QualityGovernor', () => {
  it('steps down when framerate is poor', () => {
    const g = new QualityGovernor('high')
    // feed 200 frames of ~15fps (dt ~0.066)
    for (let i = 0; i < 200; i++) g.update(0.066)
    expect(g.current).not.toBe('high')
  })
  it('steps up when framerate is strong', () => {
    const g = new QualityGovernor('low')
    for (let i = 0; i < 400; i++) g.update(1 / 60)
    expect(g.current).not.toBe('low')
  })
  it('does not thrash within one sample window', () => {
    const g = new QualityGovernor('medium')
    const results: (string | null)[] = []
    for (let i = 0; i < 100; i++) results.push(g.update(1 / 60))
    // fewer than 180 samples → no decision yet
    expect(results.every((r) => r === null)).toBe(true)
  })
  it('ignores non-positive dt', () => {
    const g = new QualityGovernor('medium')
    expect(g.update(0)).toBeNull()
    expect(g.update(-1)).toBeNull()
  })
})
