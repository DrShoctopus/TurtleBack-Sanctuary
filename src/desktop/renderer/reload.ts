/** Request a main-process reload when available so recovery is logged and crash-loop state resets. */
export function reloadApplication(): void {
  const bridge = window.desktopApp
  if (!bridge) {
    window.location.reload()
    return
  }
  void bridge.reloadApplication().catch(() => window.location.reload())
}
