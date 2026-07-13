import { describe, expect, it } from 'vitest'
import {
  RendererRecoveryPolicy,
  rendererRecoveryUrl,
} from '@/desktop/main/lifecycle/recoveryPolicy'
import { intersectsVisibleDisplay } from '@/desktop/main/window/windowPlacement'

describe('desktop renderer recovery policy', () => {
  it('bounds automatic reloads and ages attempts out after a stable window', () => {
    const policy = new RendererRecoveryPolicy(1_000, 2)

    expect(policy.next(0)).toEqual({ mode: 'reload', attempt: 1 })
    expect(policy.next(100)).toEqual({ mode: 'reload', attempt: 2 })
    expect(policy.next(200)).toEqual({ mode: 'safe-mode', attempt: 3 })
    expect(policy.next(1_500)).toEqual({ mode: 'reload', attempt: 1 })
  })

  it('resets crash-loop state for an explicit user restart', () => {
    const policy = new RendererRecoveryPolicy(1_000, 1)
    policy.next(0)
    expect(policy.next(1).mode).toBe('safe-mode')
    policy.reset()
    expect(policy.next(2).mode).toBe('reload')
  })

  it('adds a bounded recovery reason without losing the renderer base URL', () => {
    const url = new URL(rendererRecoveryUrl('app://turtleback/index.html', 'gpu-crashed', true))
    expect(url.protocol).toBe('app:')
    expect(url.hostname).toBe('turtleback')
    expect(url.pathname).toBe('/index.html')
    expect(url.searchParams.get('recovery')).toBe('gpu-crashed')
    expect(url.searchParams.get('safe')).toBe('1')
  })
})

describe('desktop window recovery', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 }

  it('keeps reachable restored windows and rejects windows stranded off-screen', () => {
    expect(intersectsVisibleDisplay({ x: 1600, y: 800, width: 1280, height: 720 }, [display])).toBe(
      true,
    )
    expect(intersectsVisibleDisplay({ x: 2100, y: 100, width: 1280, height: 720 }, [display])).toBe(
      false,
    )
    expect(
      intersectsVisibleDisplay({ x: -1200, y: 100, width: 1280, height: 720 }, [display]),
    ).toBe(false)
  })
})
