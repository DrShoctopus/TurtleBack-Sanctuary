/** Tiny typed event bus for one-shot cross-system signals (kept out of React state). */

export type GameEvents = {
  footstep: { surface: 'grass' | 'stone' | 'wood' | 'shell' | 'interior'; jog: boolean }
  teleport: { x: number; y: number; z: number; yaw?: number; reason: 'home' | 'respawn' | 'debug' }
  notify: { text: string; long?: boolean }
  uiSound: { kind: 'move' | 'confirm' | 'back' | 'open' | 'close' | 'soft' }
  interactSound: { kind: 'generic' | 'lamp' | 'door' | 'chime' | 'water' | 'sit' | 'tea' | 'page' }
  worldEffect: { kind: 'water' | 'chime'; source: string }
  respawnSplash: undefined
  padRumble: { strength: number; ms: number }
}

type Handler<T> = (payload: T) => void

class EventBus {
  private map = new Map<string, Set<Handler<unknown>>>()

  on<K extends keyof GameEvents>(key: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.map.get(key)
    if (!set) {
      set = new Set()
      this.map.set(key, set)
    }
    set.add(fn as Handler<unknown>)
    return () => set.delete(fn as Handler<unknown>)
  }

  emit<K extends keyof GameEvents>(key: K, payload: GameEvents[K]): void {
    const set = this.map.get(key)
    if (!set) return
    for (const fn of set) {
      try {
        fn(payload)
      } catch (err) {
        if (import.meta.env?.DEV) console.error(`[events] handler for "${key}" failed`, err)
      }
    }
  }
}

export const events = new EventBus()
