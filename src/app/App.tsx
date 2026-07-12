import { useMemo } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { hasWebGL2 } from './support'
import { GameCanvas } from '../game/GameCanvas'
import { UIRoot } from '../game/ui/UIRoot'

export function App() {
  const supported = useMemo(hasWebGL2, [])

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
      </div>
    </ErrorBoundary>
  )
}
