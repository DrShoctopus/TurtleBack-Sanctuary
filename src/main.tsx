import { createRoot, type Root } from 'react-dom/client'
import { App } from './app/App'
import { input } from './game/input/InputManager'
import {
  exitPointerLock,
  installPointerLockWatcher,
  uninstallPointerLockWatcher,
} from './game/input/pointerLock'
import { useGame } from './game/state/gameStore'
import { useSettings } from './game/state/settingsStore'
import {
  flushDesktopPersistence,
  initializeDesktopPersistence,
  startDesktopPersistence,
  stopDesktopPersistence,
} from './desktop/renderer/persistence'
import './styles/global.css'

let appRoot: Root | null = null

installDesktopLifecycle()
await initializeDesktopPersistence()

// Deterministic world seed override for testing: ?seed=123
const params = new URLSearchParams(window.location.search)
const seedParam = params.get('seed')
if (seedParam && /^\d+$/.test(seedParam)) {
  useSettings.setState({ worldSeed: Number(seedParam) })
}

if (params.get('safe') !== '1') {
  input.attach()
  installPointerLockWatcher()
}

if (import.meta.env.DEV || import.meta.env.VITE_TURTLEBACK_DIAGNOSTICS === '1') {
  // Dev/QA handle: inspect stores and runtime from the console or e2e tests.
  void Promise.all([
    import('./game/core/runtime'),
    import('./game/core/events'),
    import('./game/audio/AudioManager'),
  ]).then(([{ runtime }, { events }, { audio }]) => {
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
appRoot = createRoot(document.getElementById('root')!)
appRoot.render(<App />)
startDesktopPersistence()

function installDesktopLifecycle(): void {
  const bridge = window.desktopApp
  if (!bridge) return

  let shutdownStarted = false
  let lifecycleQueue = Promise.resolve()

  const report = (
    message: string,
    stack: string | undefined,
    source: 'error' | 'unhandledrejection',
  ) => {
    void bridge.logRendererError({ message, stack, source }).catch(() => undefined)
  }
  const onError = (event: ErrorEvent) => {
    report(
      event.message || String(event.error ?? 'Unknown renderer error'),
      event.error instanceof Error ? event.error.stack : undefined,
      'error',
    )
  }
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : null
    report(error?.message ?? String(event.reason), error?.stack, 'unhandledrejection')
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)

  const removeLifecycleListener = bridge.onLifecycleEvent((event) => {
    lifecycleQueue = lifecycleQueue
      .then(async () => {
        if (event.type === 'suspend') {
          input.suspend()
          exitPointerLock()
          await flushDesktopPersistence(true)
          const [{ audio }, { mediaPlayer }] = await Promise.all([
            import('./game/audio/AudioManager'),
            import('./game/media/MediaPlayer'),
          ])
          mediaPlayer.pause()
          await audio.suspend()
          return
        }
        const { audio } = await import('./game/audio/AudioManager')
        await audio.resume()
        if (useGame.getState().phase === 'playing') useGame.getState().notify('Welcome back')
      })
      .catch((error) => {
        const parsed = error instanceof Error ? error : new Error(String(error))
        report(
          `desktop lifecycle event failed: ${parsed.message}`,
          parsed.stack,
          'unhandledrejection',
        )
      })
    return lifecycleQueue
  })

  const removeShutdownListener = bridge.onPrepareShutdown(async () => {
    if (shutdownStarted) return
    shutdownStarted = true
    try {
      await lifecycleQueue
      await flushDesktopPersistence(true)
      stopDesktopPersistence()
      input.detach()
      exitPointerLock()
      uninstallPointerLockWatcher()
      appRoot?.unmount()
      appRoot = null
      const [{ audio }, { mediaPlayer }, { disposeAllTextures }] = await Promise.all([
        import('./game/audio/AudioManager'),
        import('./game/media/MediaPlayer'),
        import('./game/world/textures'),
      ])
      mediaPlayer.dispose()
      audio.dispose()
      disposeAllTextures()
    } catch (error) {
      const parsed = error instanceof Error ? error : new Error(String(error))
      report(`renderer teardown failed: ${parsed.message}`, parsed.stack, 'unhandledrejection')
    } finally {
      removeLifecycleListener()
      removeShutdownListener()
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      bridge.signalShutdownReady()
    }
  })
}
