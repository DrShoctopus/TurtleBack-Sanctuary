import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audio } from '@/game/audio/AudioManager'
import { BUILTIN_ITEMS, MediaPlayer, type PlaylistItem } from '@/game/media/MediaPlayer'
import type { LocalTrack } from '@/game/media/localFiles'

class FakeAudioElement {
  crossOrigin = ''
  preload = ''
  src = ''
  currentTime = 0
  duration = 0

  addEventListener(): void {}
  pause(): void {}
  load(): void {}
  removeAttribute(name: string): void {
    if (name === 'src') this.src = ''
  }
  play(): Promise<void> {
    return Promise.resolve()
  }
}

function connectable() {
  return { connect: vi.fn(), disconnect: vi.fn() }
}

function localItem(track: LocalTrack): PlaylistItem {
  return { id: track.id, kind: 'local', title: track.name, track }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

let originalAudioConstructor: typeof Audio | undefined
let originalContext: AudioContext | null

beforeEach(() => {
  originalAudioConstructor = globalThis.Audio
  originalContext = audio.ctx
  globalThis.Audio = FakeAudioElement as unknown as typeof Audio
  const panner = {
    ...connectable(),
    panningModel: 'equalpower',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: 10_000,
    rolloffFactor: 1,
    positionX: { value: 0 },
    positionY: { value: 0 },
    positionZ: { value: 0 },
  }
  audio.ctx = {
    createMediaElementSource: () => connectable(),
    createPanner: () => panner,
    createGain: () => connectable(),
  } as unknown as AudioContext
  vi.spyOn(audio, 'bus').mockReturnValue(connectable() as unknown as GainNode)
})

afterEach(() => {
  vi.restoreAllMocks()
  audio.ctx = originalContext
  if (originalAudioConstructor) globalThis.Audio = originalAudioConstructor
  else Reflect.deleteProperty(globalThis, 'Audio')
})

describe('MediaPlayer', () => {
  it('ignores an older asynchronous selection after a newer track resolves', async () => {
    const firstUrl = deferred<string>()
    const secondUrl = deferred<string>()
    const first: LocalTrack = {
      id: 'local-first',
      name: 'First',
      getUrl: () => firstUrl.promise,
      revoke: vi.fn(),
    }
    const second: LocalTrack = {
      id: 'local-second',
      name: 'Second',
      getUrl: () => secondUrl.promise,
      revoke: vi.fn(),
    }
    const player = new MediaPlayer()
    player.playlist = [localItem(first), localItem(second)]

    const earlier = player.playIndex(0)
    const later = player.playIndex(1)
    secondUrl.resolve('blob:second')
    await later
    firstUrl.resolve('blob:first')
    await earlier

    expect(player.index).toBe(1)
    expect((player as unknown as { el: FakeAudioElement }).el.src).toBe('blob:second')
    player.dispose()
  })

  it('preserves the active item by ID and stops when that item is removed', () => {
    const revoke = vi.fn()
    const track: LocalTrack = {
      id: 'local-track',
      name: 'Track',
      getUrl: async () => 'blob:track',
      revoke,
    }
    const player = new MediaPlayer()
    player.playlist = [BUILTIN_ITEMS[0], localItem(track), BUILTIN_ITEMS[1]]
    player.index = 1
    player.status = 'playing'

    player.setPlaylist([BUILTIN_ITEMS[1], localItem(track), BUILTIN_ITEMS[0]])
    expect(player.index).toBe(1)
    expect(player.status).toBe('playing')
    expect(revoke).not.toHaveBeenCalled()

    player.setPlaylist([...BUILTIN_ITEMS])
    expect(player.index).toBe(0)
    expect(player.status).toBe('idle')
    expect(revoke).toHaveBeenCalledOnce()
    player.dispose()
  })

  it('revokes every retained local URL during disposal', () => {
    const revoke = vi.fn()
    const track: LocalTrack = {
      id: 'local-track',
      name: 'Track',
      getUrl: async () => 'blob:track',
      revoke,
    }
    const player = new MediaPlayer()
    player.playlist = [localItem(track), localItem(track)]

    player.dispose()

    expect(revoke).toHaveBeenCalledOnce()
  })
})
