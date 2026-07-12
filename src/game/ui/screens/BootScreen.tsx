export function BootScreen() {
  return (
    <div className="boot-screen" role="status" aria-label="Loading">
      <div className="spinner" />
      <div className="boot-title">Preparing the sanctuary…</div>
    </div>
  )
}
