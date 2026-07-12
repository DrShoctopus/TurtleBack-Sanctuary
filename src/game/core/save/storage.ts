/** localStorage wrapper that never throws (private mode, disabled storage, quota). */

let memoryFallback: Map<string, string> | null = null

function backing(): Storage | Map<string, string> {
  if (memoryFallback) return memoryFallback
  try {
    const probe = '__turtleback_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    memoryFallback = new Map()
    return memoryFallback
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      const b = backing()
      return b instanceof Map ? (b.get(key) ?? null) : b.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      const b = backing()
      if (b instanceof Map) b.set(key, value)
      else b.setItem(key, value)
    } catch {
      /* quota or privacy error — settings simply won't persist */
    }
  },
  removeItem(key: string): void {
    try {
      const b = backing()
      if (b instanceof Map) b.delete(key)
      else b.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  get persistent(): boolean {
    return memoryFallback === null
  },
}
