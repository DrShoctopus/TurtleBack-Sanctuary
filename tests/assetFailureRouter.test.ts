import { describe, expect, it } from 'vitest'
import {
  AssetFailureRouter,
  InjectedAssetFailure,
  type AssetFailureChannel,
} from '@/game/assets/AssetFailureRouter'
import type { AssetKind } from '@/game/assets/schema'

const kinds = new Map<string, AssetKind>([
  ['model.known', 'model'],
  ['animation.known', 'animation'],
  ['texture.known', 'texture'],
  ['environment.known', 'environment'],
  ['music.known', 'music-track'],
  ['ambience.known', 'ambience-bed'],
  ['detail.known', 'ambient-detail'],
  ['wildlife.known', 'wildlife-call'],
  ['turtle.known', 'turtle-sound'],
])

function makeRouter(enabled = true): AssetFailureRouter {
  return new AssetFailureRouter({ enabled, kindFor: (id) => kinds.get(id) ?? null })
}

describe('AssetFailureRouter', () => {
  it('is immutable while disabled', () => {
    const router = makeRouter(false)
    const before = router.snapshot()

    expect(router.failNext('model.known')).toBe(false)
    expect(router.consume('model.known', 'model')).toBe(false)
    expect(router.snapshot()).toEqual(before)
    expect(router.snapshot()).toEqual({ enabled: false, pendingIds: [], consumed: [] })
  })

  it('rejects unknown IDs and stores only one pending failure per known ID', () => {
    const router = makeRouter()

    expect(router.failNext('model.missing')).toBe(false)
    expect(router.failNext('model.known')).toBe(true)
    expect(router.failNext('model.known')).toBe(false)
    expect(router.snapshot().pendingIds).toEqual(['model.known'])
  })

  it.each<{
    id: string
    matching: AssetFailureChannel
    wrong: AssetFailureChannel
  }>([
    { id: 'model.known', matching: 'model', wrong: 'texture' },
    { id: 'animation.known', matching: 'model', wrong: 'audio-buffer' },
    { id: 'texture.known', matching: 'texture', wrong: 'model' },
    { id: 'environment.known', matching: 'texture', wrong: 'streaming-media' },
    { id: 'music.known', matching: 'streaming-media', wrong: 'audio-buffer' },
    { id: 'ambience.known', matching: 'streaming-media', wrong: 'texture' },
    { id: 'detail.known', matching: 'audio-buffer', wrong: 'streaming-media' },
    { id: 'wildlife.known', matching: 'audio-buffer', wrong: 'model' },
    { id: 'turtle.known', matching: 'audio-buffer', wrong: 'texture' },
  ])('consumes $id exactly once through $matching', ({ id, matching, wrong }) => {
    const router = makeRouter()
    expect(router.failNext(id)).toBe(true)

    expect(router.consume(id, wrong)).toBe(false)
    expect(router.snapshot().pendingIds).toEqual([id])
    expect(router.consume(id, matching)).toBe(true)
    expect(router.consume(id, matching)).toBe(false)
    expect(router.snapshot()).toEqual({
      enabled: true,
      pendingIds: [],
      consumed: [{ id, channel: matching, sequence: 1 }],
    })
  })

  it('keeps a deterministic bounded history of the latest 32 consumptions', () => {
    const router = new AssetFailureRouter({
      enabled: true,
      kindFor: (id) => (id.startsWith('model.history-') ? 'model' : null),
    })

    for (let index = 0; index < 40; index++) {
      const id = `model.history-${String(index).padStart(2, '0')}`
      expect(router.failNext(id)).toBe(true)
      expect(router.consume(id, 'model')).toBe(true)
    }

    const snapshot = router.snapshot()
    expect(snapshot.consumed).toHaveLength(32)
    expect(snapshot.consumed[0]).toEqual({
      id: 'model.history-08',
      channel: 'model',
      sequence: 9,
    })
    expect(snapshot.consumed.at(-1)).toEqual({
      id: 'model.history-39',
      channel: 'model',
      sequence: 40,
    })
  })

  it('resets pending failures, history, and the sequence', () => {
    const router = makeRouter()
    router.failNext('texture.known')
    router.consume('texture.known', 'texture')
    router.failNext('model.known')

    router.reset()
    expect(router.snapshot()).toEqual({ enabled: true, pendingIds: [], consumed: [] })

    router.failNext('model.known')
    router.consume('model.known', 'model')
    expect(router.snapshot().consumed[0].sequence).toBe(1)
  })

  it('uses one common injected-failure payload', () => {
    const error = new InjectedAssetFailure('model.known', 'model')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('InjectedAssetFailure')
    expect(error.assetId).toBe('model.known')
    expect(error.channel).toBe('model')
    expect(error.message).toContain('model.known')
    expect(error.message).toContain('model')
  })
})
