import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('[boundary]', error, info.componentStack)
    void window.desktopApp?.logRendererError({
      message: error.message,
      stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`.slice(0, 16000),
      source: 'react-boundary',
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="unsupported">
          <div className="card">
            <h2>Something drifted off course</h2>
            <p>
              The sanctuary hit an unexpected snag. Your settings are safe — reloading usually
              brings everything back.
            </p>
            {import.meta.env.DEV && (
              <pre style={{ textAlign: 'left', fontSize: 11, overflow: 'auto', maxHeight: 160 }}>
                {String(this.state.error.stack ?? this.state.error.message)}
              </pre>
            )}
            <button className="btn primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
