import { describe, expect, it } from 'vitest'
import { canonicalAssetManifest } from '@/game/assets/registry'

const TURTLE_SOUND_IDS = [
  'turtle.sound.breath-deep',
  'turtle.sound.breath-loop',
  'turtle.sound.shell-resonance',
  'turtle.sound.stroke-front',
  'turtle.sound.stroke-rear',
] as const

describe('final authored asset inventory', () => {
  it('registers every shipped turtle delivery with provenance and bounded decode behavior', () => {
    const records = canonicalAssetManifest.assets
      .filter((record) => record.kind === 'turtle-sound')
      .sort((left, right) => left.id.localeCompare(right.id))

    expect(records.map((record) => record.id)).toEqual(TURTLE_SOUND_IDS)
    for (const record of records) {
      expect(record.generationRecord).toBe('art-source/turtle/audio/README.md')
      expect(record.license).toBe('Original')
      expect(record.preloadRegions).toEqual([])
      expect(record.fallback).toEqual({ kind: 'procedural', key: 'procedural.silence' })
      expect(record.variants).toHaveLength(1)
      expect(record.variants[0].path).toMatch(/^assets\/audio\/turtle\/[a-z-]+\.mp3$/)
      expect(record.variants[0].quality).toEqual(['low', 'medium', 'high', 'ultra'])
      expect(record.variants[0].decodedBytes).toBeLessThanOrEqual(2_304_000)
    }
  })
})
