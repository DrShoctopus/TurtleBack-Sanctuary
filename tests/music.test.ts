import { describe, it, expect } from 'vitest'
import { midiToFreq, chordFromDegree, quantizeToScale, SCALES } from '@/game/audio/proceduralMusic/theory'
import { MOODS, buildProgression } from '@/game/audio/proceduralMusic/moods'

describe('midiToFreq', () => {
  it('maps A4 (69) to 440Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5)
  })
  it('an octave up doubles frequency', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 5)
  })
})

describe('chordFromDegree', () => {
  it('builds a triad from scale degrees', () => {
    const chord = chordFromDegree(60, SCALES.major, 0)
    expect(chord).toEqual([60, 64, 67]) // C major triad
  })
  it('adds a seventh when requested', () => {
    const chord = chordFromDegree(60, SCALES.major, 0, { seventh: true })
    expect(chord).toHaveLength(4)
    expect(chord[3]).toBe(71) // major 7th
  })
  it('wraps octaves for high degrees', () => {
    const chord = chordFromDegree(60, SCALES.major, 7)
    expect(chord[0]).toBe(72) // one octave up
  })
})

describe('quantizeToScale', () => {
  it('snaps to the nearest scale tone', () => {
    // C# (61) is not in C major; nearest is C(60) or D(62)
    const q = quantizeToScale(61, 60, SCALES.major)
    expect([60, 62]).toContain(q)
  })
  it('leaves scale tones unchanged', () => {
    expect(quantizeToScale(64, 60, SCALES.major)).toBe(64)
  })
})

describe('buildProgression', () => {
  it('is deterministic per mood + seed', () => {
    const a = buildProgression(MOODS.day, 100, 8)
    const b = buildProgression(MOODS.day, 100, 8)
    expect(a).toEqual(b)
  })
  it('resolves to the tonic at the end for a settled loop', () => {
    const prog = buildProgression(MOODS.night, 5, 8)
    expect(prog[prog.length - 1]).toBe(0)
  })
  it('has the requested length', () => {
    expect(buildProgression(MOODS.rain, 1, 12)).toHaveLength(12)
  })
  it('draws only from the mood degrees', () => {
    const prog = buildProgression(MOODS.dawn, 3, 16)
    for (const d of prog) expect([...MOODS.dawn.degrees, 0]).toContain(d)
  })
})

describe('MOODS', () => {
  it('every mood has a calm tempo (60–78 BPM)', () => {
    for (const key of Object.keys(MOODS) as (keyof typeof MOODS)[]) {
      expect(MOODS[key].bpm).toBeGreaterThanOrEqual(60)
      expect(MOODS[key].bpm).toBeLessThanOrEqual(78)
    }
  })
  it('defines all four required states', () => {
    expect(Object.keys(MOODS).sort()).toEqual(['dawn', 'day', 'night', 'rain'])
  })
})
