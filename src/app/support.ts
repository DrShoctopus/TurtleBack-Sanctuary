/** Feature detection for the graceful unsupported-browser screen. */
export function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    return gl !== null
  } catch {
    return false
  }
}
