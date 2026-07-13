import { describe, expect, it } from 'vitest'
import {
  subscribeToDevicePixelRatio,
  type DevicePixelRatioSource,
} from '@/game/core/devicePixelRatio'

describe('subscribeToDevicePixelRatio', () => {
  it('tracks resize and re-arms the resolution media query after each DPR change', () => {
    let dpr = 1
    let resizeListener: () => void = () => undefined
    let resizeRemoved = false
    const queries: Array<{
      query: string
      listener: (() => void) | null
      removed: boolean
    }> = []
    const source = {
      get devicePixelRatio() {
        return dpr
      },
      addEventListener(type: string, listener: () => void) {
        if (type === 'resize') resizeListener = listener
      },
      removeEventListener(type: string, listener: () => void) {
        if (type === 'resize' && resizeListener === listener) resizeRemoved = true
      },
      matchMedia(query: string) {
        const entry = { query, listener: null as (() => void) | null, removed: false }
        queries.push(entry)
        return {
          addEventListener(type: string, listener: () => void) {
            if (type === 'change') entry.listener = listener
          },
          removeEventListener(type: string, listener: () => void) {
            if (type === 'change' && entry.listener === listener) {
              entry.listener = null
              entry.removed = true
            }
          },
        }
      },
    } as unknown as DevicePixelRatioSource
    const observed: number[] = []

    const unsubscribe = subscribeToDevicePixelRatio(source, (value) => observed.push(value))
    expect(observed).toEqual([1])
    expect(queries.map((entry) => entry.query)).toEqual(['(resolution: 1dppx)'])

    dpr = 1.5
    queries[0].listener?.()
    expect(observed).toEqual([1, 1.5])
    expect(queries[0].removed).toBe(true)
    expect(queries[1].query).toBe('(resolution: 1.5dppx)')

    dpr = 2
    resizeListener()
    expect(observed).toEqual([1, 1.5, 2])
    expect(queries[1].removed).toBe(true)
    expect(queries[2].query).toBe('(resolution: 2dppx)')

    unsubscribe()
    expect(resizeRemoved).toBe(true)
    expect(queries[2].removed).toBe(true)
  })

  it('normalizes an invalid browser DPR to one', () => {
    const listeners = new Set<() => void>()
    const source = {
      devicePixelRatio: Number.NaN,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      matchMedia: () => ({
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }),
    } as unknown as DevicePixelRatioSource
    const observed: number[] = []

    const unsubscribe = subscribeToDevicePixelRatio(source, (value) => observed.push(value))
    expect(observed).toEqual([1])
    unsubscribe()
  })
})
