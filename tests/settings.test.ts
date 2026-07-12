import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  mergeWithDefaults,
  migrateSettings,
  SETTINGS_VERSION,
} from '@/game/state/settingsStore'

describe('mergeWithDefaults', () => {
  it('fills missing keys from defaults', () => {
    const merged = mergeWithDefaults(DEFAULT_SETTINGS, { graphics: { fov: 80 } })
    expect(merged.graphics.fov).toBe(80)
    expect(merged.graphics.quality).toBe(DEFAULT_SETTINGS.graphics.quality)
    expect(merged.audio.master).toBe(DEFAULT_SETTINGS.audio.master)
  })
  it('ignores unknown keys', () => {
    const merged = mergeWithDefaults(DEFAULT_SETTINGS, {
      graphics: { fov: 80, bogus: 999 },
      alsoBogus: true,
    } as unknown)
    expect((merged.graphics as Record<string, unknown>).bogus).toBeUndefined()
    expect((merged as unknown as Record<string, unknown>).alsoBogus).toBeUndefined()
  })
  it('drops values of the wrong type', () => {
    const merged = mergeWithDefaults(DEFAULT_SETTINGS, { graphics: { fov: 'huge' } } as unknown)
    expect(merged.graphics.fov).toBe(DEFAULT_SETTINGS.graphics.fov)
  })
  it('preserves the reducedMotion null tri-state', () => {
    const merged = mergeWithDefaults(DEFAULT_SETTINGS, { comfort: { reducedMotion: null } })
    expect(merged.comfort.reducedMotion).toBeNull()
    const on = mergeWithDefaults(DEFAULT_SETTINGS, { comfort: { reducedMotion: true } })
    expect(on.comfort.reducedMotion).toBe(true)
  })
  it('returns defaults for non-object input', () => {
    expect(mergeWithDefaults(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS)
    expect(mergeWithDefaults(DEFAULT_SETTINGS, 'nonsense')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('migrateSettings', () => {
  it('migrates the v0 flat shape into the nested schema', () => {
    const v0 = { quality: 'high', volumeMusic: 0.3, volumeAmbient: 0.9 }
    const migrated = migrateSettings(v0, 0)
    expect(migrated.graphics.quality).toBe('high')
    expect(migrated.audio.music).toBe(0.3)
    expect(migrated.audio.ambient).toBe(0.9)
    // untouched keys keep defaults
    expect(migrated.time.speed).toBe(DEFAULT_SETTINGS.time.speed)
  })
  it('passes through current-version data unchanged in shape', () => {
    const current = { ...DEFAULT_SETTINGS, quietMode: true }
    const migrated = migrateSettings(current, SETTINGS_VERSION)
    expect(migrated.quietMode).toBe(true)
    expect(migrated.graphics).toEqual(DEFAULT_SETTINGS.graphics)
  })
  it('never throws on garbage', () => {
    expect(() => migrateSettings(undefined, 0)).not.toThrow()
    expect(() => migrateSettings(42, 1)).not.toThrow()
    expect(migrateSettings(undefined, 0)).toEqual(DEFAULT_SETTINGS)
  })
})
