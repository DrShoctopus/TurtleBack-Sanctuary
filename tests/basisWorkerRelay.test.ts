import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { BASIS_TRANSCODER_BOOTSTRAP_MESSAGE } from '@/shared/basisTranscoder'

type WorkerEvent = {
  data?: unknown
  error?: unknown
  message?: string
  reason?: unknown
  preventDefault(): void
  stopImmediatePropagation(): void
}
type WorkerListener = (event: WorkerEvent) => void

function relayHarness(importScripts: (url: string) => void) {
  const listeners = new Map<string, Set<WorkerListener>>()
  const posted: unknown[] = []
  const self = {
    addEventListener(type: string, listener: WorkerListener) {
      const registered = listeners.get(type) ?? new Set<WorkerListener>()
      registered.add(listener)
      listeners.set(type, registered)
    },
    removeEventListener(type: string, listener: WorkerListener) {
      listeners.get(type)?.delete(listener)
    },
    postMessage(message: unknown) {
      posted.push(message)
    },
  }
  const dispatch = (type: string, init: Partial<WorkerEvent>) => {
    let stopped = false
    const event: WorkerEvent = {
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(() => {
        stopped = true
      }),
      ...init,
    }
    for (const listener of [...(listeners.get(type) ?? [])]) {
      listener(event)
      if (stopped) break
    }
    return event
  }
  return { self, posted, dispatch, importScripts }
}

describe('Basis worker security relay', () => {
  async function install(harness: ReturnType<typeof relayHarness>) {
    const source = await readFile('public/assets/decoders/basis/turtleback-basis-worker.js', 'utf8')
    runInNewContext(source, harness)
  }

  it('imports only the locally assembled blob after the canonical bootstrap', async () => {
    const importScripts = vi.fn()
    const harness = relayHarness(importScripts)
    await install(harness)

    harness.dispatch('message', {
      data: {
        type: BASIS_TRANSCODER_BOOTSTRAP_MESSAGE,
        sourceUrl: 'blob:app://turtleback/source',
      },
    })

    expect(importScripts).toHaveBeenCalledOnce()
    expect(importScripts).toHaveBeenCalledWith('blob:app://turtleback/source')
    expect(harness.posted).toEqual([])
  })

  it('turns bootstrap failures into a transcode rejection instead of a hung request', async () => {
    const harness = relayHarness(() => {
      throw new Error('CSP rejected source')
    })
    await install(harness)

    harness.dispatch('message', {
      data: {
        type: BASIS_TRANSCODER_BOOTSTRAP_MESSAGE,
        sourceUrl: 'blob:app://turtleback/source',
      },
    })
    expect(harness.posted).toEqual([])
    harness.dispatch('message', { data: { type: 'init' } })
    expect(harness.posted).toEqual([])
    harness.dispatch('message', { data: { type: 'transcode' } })

    expect(harness.posted).toEqual([
      {
        type: 'error',
        error: 'Basis worker initialization failed: Error: CSP rejected source',
        data: { faces: [], width: 0, height: 0, format: 0, type: 0, dfdFlags: 0 },
      },
    ])
  })

  it('rejects an in-flight transcode when decoder initialization rejects', async () => {
    const harness = relayHarness(vi.fn())
    await install(harness)
    harness.dispatch('message', {
      data: {
        type: BASIS_TRANSCODER_BOOTSTRAP_MESSAGE,
        sourceUrl: 'blob:app://turtleback/source',
      },
    })
    harness.dispatch('message', { data: { type: 'init' } })
    harness.dispatch('message', { data: { type: 'transcode' } })
    expect(harness.posted).toEqual([])

    const rejection = harness.dispatch('unhandledrejection', {
      reason: new Error('WASM initialization rejected'),
    })

    expect(rejection.preventDefault).toHaveBeenCalledOnce()
    expect(harness.posted).toEqual([
      {
        type: 'error',
        error: 'Basis worker initialization failed: Error: WASM initialization rejected',
        data: { faces: [], width: 0, height: 0, format: 0, type: 0, dfdFlags: 0 },
      },
    ])
  })
})
