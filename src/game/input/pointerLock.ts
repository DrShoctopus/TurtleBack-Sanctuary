import { useGame } from '../state/gameStore'

let lastExitAt = 0
let suppressPauseUntil = 0
let lastRequestAt = -Infinity
let lastLockAt = -Infinity
let installed = false

export function installPointerLockWatcher(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement !== null
    const now = performance.now()
    if (locked) lastLockAt = now
    if (!locked) lastExitAt = performance.now()
    useGame.getState().setPointerLocked(locked)
    // Browser-initiated unlock (Esc) while playing with no overlay → open pause
    const g = useGame.getState()
    if (
      !locked &&
      now > suppressPauseUntil &&
      !(now - lastRequestAt < 800 && now - lastLockAt < 200) &&
      g.phase === 'playing' &&
      g.overlay === null &&
      !document.hidden
    ) {
      g.setOverlay('pause')
    }
  })
  document.addEventListener('pointerlockerror', () => {
    useGame.getState().setPointerLocked(false)
  })
}

/**
 * Request pointer lock on the game canvas. Chrome enforces a ~1.3s cooldown after
 * an Esc-exit; failures are swallowed and the HUD keeps its "click to look" hint.
 */
export function requestPointerLock(): void {
  const canvas = document.querySelector('canvas')
  if (!canvas) return
  const sinceExit = performance.now() - lastExitAt
  const delay = sinceExit < 1400 ? 1400 - sinceExit : 0
  window.setTimeout(() => {
    const g = useGame.getState()
    if (g.phase !== 'playing' || g.overlay !== null) return
    try {
      lastRequestAt = performance.now()
      const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined
      p?.catch?.(() => {
        /* cooldown or platform refusal — user can click to retry */
      })
    } catch {
      /* older browsers throw synchronously */
    }
  }, delay)
}

export function exitPointerLock(): void {
  if (document.pointerLockElement) {
    // pointerlockchange can fire synchronously in some engines. Mark this exit
    // as intentional before requesting it so menu opens cannot race into Pause.
    suppressPauseUntil = performance.now() + 1000
    document.exitPointerLock()
  }
}
