import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { input } from './game/input/InputManager'
import { installPointerLockWatcher } from './game/input/pointerLock'
import { useSettings } from './game/state/settingsStore'
import './styles/global.css'

installDesktopLifecycle()

// Deterministic world seed override for testing: ?seed=123
const params = new URLSearchParams(window.location.search)
const seedParam = params.get('seed')
if (seedParam && /^\d+$/.test(seedParam)) {
  useSettings.setState({ worldSeed: Number(seedParam) })
}

input.attach()
installPointerLockWatcher()

if (import.meta.env.DEV) {
  // Dev/QA handle: inspect stores and runtime from the console or e2e tests.
  void Promise.all([
    import('./game/core/runtime'),
    import('./game/state/gameStore'),
    import('./game/core/events'),
    import('./game/audio/AudioManager'),
  ]).then(([{ runtime }, { useGame }, { events }, { audio }]) => {
    ;(window as unknown as Record<string, unknown>).__sanctuary = {
      runtime,
      game: useGame,
      settings: useSettings,
      events,
      audio,
      input,
      teleport: (x: number, y: number, z: number, yaw: number) =>
        events.emit('teleport', { x, y, z, yaw, reason: 'debug' }),
    }
  })
}

// NOTE: StrictMode is intentionally omitted — its double-invoked effects fight
// with imperative singletons (physics world, AudioContext). See ARCHITECTURE.md.
createRoot(document.getElementById('root')!).render(<App />)

function installDesktopLifecycle(): void {
  const bridge = window.desktopApp
  if (!bridge) return

  window.addEventListener('error', (event) => {
    void bridge.logRendererError({
      message: event.message || String(event.error ?? 'Unknown renderer error'),
      stack: event.error instanceof Error ? event.error.stack : undefined,
      source: 'error',
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : null
    void bridge.logRendererError({
      message: error?.message ?? String(event.reason),
      stack: error?.stack,
      source: 'unhandledrejection',
    })
  })

  bridge.onPrepareShutdown(async () => {
    const [{ audio }, { mediaPlayer }, { disposeAllTextures }] = await Promise.all([
      import('./game/audio/AudioManager'),
      import('./game/media/MediaPlayer'),
      import('./game/world/textures'),
    ])
    mediaPlayer.dispose()
    audio.dispose()
    disposeAllTextures()
    bridge.signalShutdownReady()
  })
}
