import { describe, expect, it } from 'vitest'
import {
  INSTRUMENT_PALETTES,
  MOTIF_SEEDS,
  analyzeMusicPlanSoak,
  buildMusicalEventPlan,
  sectionAtBar,
  sectionsWithinMinutes,
  type MusicContext,
} from '@/game/audio/proceduralMusic/MusicalEventPlan'

describe('MusicalEventPlan', () => {
  it('is a deterministic pure two-hour plan', () => {
    expect(buildMusicalEventPlan(20260712)).toEqual(buildMusicalEventPlan(20260712))
    expect(buildMusicalEventPlan(20260712)).not.toEqual(buildMusicalEventPlan(20260713))
  })

  it('defines four palettes and sixteen original motif/progression seeds', () => {
    expect(INSTRUMENT_PALETTES).toHaveLength(4)
    expect(MOTIF_SEEDS).toHaveLength(16)
    expect(new Set(INSTRUMENT_PALETTES.flatMap((palette) => palette.instruments))).toEqual(
      new Set([
        'electric-piano',
        'felt-piano',
        'nylon-guitar',
        'soft-mallets',
        'air-flute',
        'bass',
        'brushed-kit',
        'hand-percussion',
        'tape-pad',
        'field-texture',
      ]),
    )
  })

  it('never repeats an identical arrangement inside thirty minutes', () => {
    const trace = sectionsWithinMinutes(buildMusicalEventPlan(444), 30)
    const signatures = trace.map((section) => section.arrangementSignature)
    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('delivers three-plus orchestrations and deliberate breathing space in ten minutes', () => {
    const trace = sectionsWithinMinutes(buildMusicalEventPlan(777), 10)
    expect(new Set(trace.map((section) => section.palette.id)).size).toBeGreaterThanOrEqual(3)
    expect(
      trace.some((section) => section.form === 'ambient-bridge' || section.form === 'outro-rest'),
    ).toBe(true)
  })

  it('never immediately repeats a lead timbre or form', () => {
    const trace = buildMusicalEventPlan(915).sections
    for (let index = 1; index < trace.length; index++) {
      expect(trace[index].lead, `lead at ${index}`).not.toBe(trace[index - 1].lead)
      expect(trace[index].form, `form at ${index}`).not.toBe(trace[index - 1].form)
    }
  })

  it('lets forest, village, edge, and turtle contexts change overlays without restarts', () => {
    const contexts: readonly MusicContext[] = [
      { mood: 'dawn', biome: 'forest', turtleEvent: false },
      { mood: 'day', biome: 'village', turtleEvent: false },
      { mood: 'rain', biome: 'edge', turtleEvent: false },
      { mood: 'night', biome: 'edge', turtleEvent: true },
    ]
    const plan = buildMusicalEventPlan(22, 20, (minute) => contexts[Math.min(3, Math.floor(minute / 4))])
    expect(new Set(plan.sections.map((section) => section.overlay))).toEqual(
      new Set(['forest-field', 'village-mallets', 'edge-air', 'turtle-resonance']),
    )
    expect(plan.sections.map((section) => section.index)).toEqual(
      plan.sections.map((_, index) => index),
    )
  })

  it('finds wrapped sections without scanning mutable runtime state', () => {
    const plan = buildMusicalEventPlan(80, 12)
    expect(sectionAtBar(plan, 0)).toBe(plan.sections[0])
    expect(sectionAtBar(plan, plan.totalBars)).toBe(plan.sections[0])
    const target = plan.sections[5]
    expect(sectionAtBar(plan, target.startBar + 1)).toBe(target)
  })

  it('passes a bounded two-hour scheduler soak with no failure silence', () => {
    const report = analyzeMusicPlanSoak(buildMusicalEventPlan(20260712, 120))
    expect(report.durationMinutes).toBe(120)
    expect(report.forms).toEqual([
      'a',
      'ambient-bridge',
      'b',
      'breakdown',
      'intro',
      'outro-rest',
      'reprise',
    ])
    expect(report.palettes).toHaveLength(4)
    expect(report.leads).toHaveLength(4)
    expect(report.breathingSpaces).toBeGreaterThan(20)
    expect(report.maxScheduledVoices).toBeLessThanOrEqual(18)
    expect(report.schedulerTimers).toBe(2)
    expect(report.silentFailureSections).toBe(0)
  })

  it('rejects invalid durations', () => {
    expect(() => buildMusicalEventPlan(1, 0)).toThrow(RangeError)
    expect(() => buildMusicalEventPlan(1, Number.NaN)).toThrow(RangeError)
  })
})
