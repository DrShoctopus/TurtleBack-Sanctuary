import { useEffect } from 'react'
import { useGame } from '../state/gameStore'
import { useSettings } from '../state/settingsStore'
import { events } from '../core/events'
import { HOME_SPAWN } from '../config/constants'
import { exitPointerLock, requestPointerLock } from '../input/pointerLock'
import { BootScreen } from './screens/BootScreen'
import { TitleScreen } from './screens/TitleScreen'
import { Hud } from './hud/Hud'
import { MenuOverlay } from './menus/MenuOverlay'
import { BreathingOverlay } from './hud/BreathingOverlay'
import { TvOverlay } from './media/TvOverlay'
import { MusicOverlay } from './media/MusicOverlay'
import { JournalOverlay } from './media/JournalOverlay'
import { ReadingOverlay } from './media/ReadingOverlay'
import { PerfOverlay } from './hud/PerfOverlay'
import { keyboardActionForCode } from '../input/actions'
import { reloadApplication } from '../../desktop/renderer/reload'

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

export function UIRoot() {
  const phase = useGame((s) => s.phase)
  const overlay = useGame((s) => s.overlay)
  const sceneReady = useGame((s) => s.sceneReady)
  const fade = useGame((s) => s.fade)
  const webglLost = useGame((s) => s.webglLost)
  const uiScale = useSettings((s) => s.graphics.uiScale)
  const setPhase = useGame((s) => s.setPhase)

  // boot → title once the scene resolves
  useEffect(() => {
    if (phase === 'boot' && sceneReady) setPhase('title')
  }, [phase, sceneReady, setPhase])

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(uiScale))
  }, [uiScale])

  // click anywhere while playing → re-acquire pointer lock
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const g = useGame.getState()
      const target = event.target as Element | null
      if (target?.closest('button, input, textarea, select, [role="dialog"]')) return
      if (g.phase === 'playing' && g.overlay === null && !g.pointerLocked) {
        requestPointerLock()
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [])

  // global hotkeys that belong to the UI layer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) {
        if (e.code === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      const g = useGame.getState()
      if (g.phase !== 'playing') return
      const action = keyboardActionForCode(e.code, useSettings.getState().input.keyboardBindings)
      switch (action) {
        case 'pause': {
          if (g.overlay !== null) {
            closeOverlay()
          } else {
            g.setOverlay('pause')
            exitPointerLock()
          }
          break
        }
        case 'open_sanctuary': {
          if (g.overlay === 'sanctuary') closeOverlay()
          else if (g.overlay === null) {
            g.setOverlay('sanctuary', 'time')
            exitPointerLock()
          }
          break
        }
        case 'open_map': {
          e.preventDefault()
          if (g.overlay === 'sanctuary') closeOverlay()
          else if (g.overlay === null) {
            g.setOverlay('sanctuary', 'map')
            exitPointerLock()
          }
          break
        }
        case 'return_home': {
          if (g.overlay === null && !g.sitting) {
            g.setFade(true)
            window.setTimeout(() => {
              events.emit('teleport', { ...HOME_SPAWN, reason: 'home' })
              g.notify('Back home')
              window.setTimeout(() => g.setFade(false), 450)
            }, 550)
          }
          break
        }
        case 'performance_overlay': {
          if (import.meta.env.DEV) {
            e.preventDefault()
            g.togglePerfOverlay()
          }
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {phase === 'boot' && <BootScreen />}
      {phase === 'title' && <TitleScreen />}
      {phase === 'playing' && <Hud />}
      {phase === 'playing' && <BreathingOverlay />}
      {overlay === 'pause' && <MenuOverlay mode="pause" />}
      {overlay === 'sanctuary' && <MenuOverlay mode="sanctuary" />}
      {overlay === 'tv' && <TvOverlay />}
      {overlay === 'music' && <MusicOverlay />}
      {overlay === 'journal' && <JournalOverlay />}
      {overlay === 'reading' && <ReadingOverlay />}
      <PerfOverlay />
      <div className={`screen-fade${fade ? ' on' : ''}`} />
      {webglLost && (
        <div className="unsupported">
          <div className="card">
            <h2>Graphics paused</h2>
            <p>
              The browser released the graphics context. It usually recovers on its own — if not,
              reload the page.
            </p>
            <button className="btn primary" onClick={reloadApplication}>
              Reload
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** Close any overlay and return to play (restoring pointer lock). */
export function closeOverlay(): void {
  const g = useGame.getState()
  g.setOverlay(null)
  if (g.phase === 'playing') requestPointerLock()
}
