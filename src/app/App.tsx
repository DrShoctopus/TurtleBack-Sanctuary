import { useMemo, useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { hasWebGL2 } from './support'
import { GameCanvas } from '../game/GameCanvas'
import { UIRoot } from '../game/ui/UIRoot'
import { reloadApplication } from '../desktop/renderer/reload'

export function App() {
  const recovery = useMemo(() => new URLSearchParams(window.location.search).get('recovery'), [])
  const safeMode = useMemo(
    () => new URLSearchParams(window.location.search).get('safe') === '1',
    [],
  )
  const supported = useMemo(() => safeMode || hasWebGL2(), [safeMode])

  if (safeMode) return <RecoveryScreen />

  if (!supported) {
    return (
      <div className="unsupported">
        <div className="card">
          <h2>This browser can't reach the sanctuary</h2>
          <p>
            Turtleback Sanctuary needs WebGL&nbsp;2, which this browser or device doesn't provide.
            Current versions of Chrome, Edge, Firefox and Safari on a desktop or laptop all work.
          </p>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '0.9em' }}>
            If you're already using one of those, hardware acceleration may be disabled in the
            browser's settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="app-root">
        <GameCanvas />
        <UIRoot />
        {recovery && <RecoveryNotice />}
      </div>
    </ErrorBoundary>
  )
}

function RecoveryNotice() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <div className="recovery-notice" role="status">
      <span>The sanctuary recovered after a graphics interruption. Durable data was kept.</span>
      <button className="btn small" onClick={() => setVisible(false)}>
        Dismiss
      </button>
    </div>
  )
}

function RecoveryScreen() {
  return (
    <div className="unsupported">
      <div className="card">
        <h2>The sanctuary paused safely</h2>
        <p>
          The graphics process stopped repeatedly, so automatic restarts were paused. Your saved
          settings, journal, and last autosave remain on this device.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={reloadApplication}>
            Restart sanctuary
          </button>
          <button className="btn" onClick={() => void window.desktopApp?.openLogFolder()}>
            Open diagnostic logs
          </button>
        </div>
      </div>
    </div>
  )
}
