import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { input } from './game/input/InputManager'
import { installPointerLockWatcher } from './game/input/pointerLock'
import { useSettings } from './game/state/settingsStore'
import './styles/global.css'

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
