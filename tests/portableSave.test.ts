import { describe, expect, it } from 'vitest'
import { createPortableSaveSnapshot } from '@/desktop/renderer/persistence'
import { EMPTY_MEDIA } from '@/game/data/media'
import { DEFAULT_SETTINGS } from '@/game/data/settings'
import { SAVE_SCHEMA_VERSION } from '@/game/save/schema'

describe('portable desktop save snapshots', () => {
  it('builds a validated, framework-neutral save envelope', () => {
    const save = createPortableSaveSnapshot({
      gameVersion: '1.0.0',
      savedAt: '2026-07-13T12:00:00.000Z',
      platform: 'darwin',
      player: { position: [4, 5, 6], yaw: 1.2, pitch: -0.2 },
      world: {
        seed: 123,
        travelDistance: 99,
        time: { cyclePosition: 0.75, auto: false, speed: 2 },
        weather: { mode: 'rain', rainIntensity: 0.5, rain: 0.4, wetness: 0.8 },
      },
      settings: structuredClone(DEFAULT_SETTINGS),
      media: structuredClone(EMPTY_MEDIA),
    })

    expect(save.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(save.desktop).toEqual({ sourcePlatform: 'darwin' })
    expect(save.progression).toEqual({ visitedDistrictIds: [], interactionFlags: {} })
    expect(save.player.position).toEqual([4, 5, 6])
  })

  it('rejects non-finite runtime state before IPC or disk writes', () => {
    expect(() =>
      createPortableSaveSnapshot({
        gameVersion: '1.0.0',
        savedAt: '2026-07-13T12:00:00.000Z',
        player: { position: [Number.NaN, 0, 0], yaw: 0, pitch: 0 },
        world: {
          seed: 1,
          travelDistance: 0,
          time: { cyclePosition: 0.5, auto: true, speed: 1 },
          weather: { mode: 'clear', rainIntensity: 0.5, rain: 0, wetness: 0 },
        },
        settings: structuredClone(DEFAULT_SETTINGS),
        media: structuredClone(EMPTY_MEDIA),
      }),
    ).toThrow()
  })
})
