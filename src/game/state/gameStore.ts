import { create } from 'zustand'
import type { QualityLevel } from '../core/quality'

export type AppPhase = 'boot' | 'title' | 'playing'
export type Overlay = null | 'pause' | 'sanctuary' | 'tv' | 'music' | 'journal' | 'reading'
export type InputDevice = 'kb' | 'pad'

export interface PromptInfo {
  label: string
  /** action name used to pick the key/button glyph */
  action: 'interact' | 'stand' | 'exit'
}

export interface Toast {
  id: number
  text: string
  until: number
}

interface GameState {
  phase: AppPhase
  overlay: Overlay
  menuTab: string
  pointerLocked: boolean
  device: InputDevice
  padConnected: boolean
  prompt: PromptInfo | null
  sitting: boolean
  breathing: boolean
  telescope: boolean
  toasts: Toast[]
  locationName: string
  webglLost: boolean
  sceneReady: boolean
  /** dev-only perf overlay */
  perfOverlay: boolean
  /** resolved level while graphics.quality === 'auto' */
  autoQuality: QualityLevel
  /** full-screen fade (respawns, return home) */
  fade: boolean
  /** tea/coffee activity state */
  teaPhase: 'idle' | 'brewing' | 'ready' | 'holding'

  setPhase: (p: AppPhase) => void
  setOverlay: (o: Overlay, tab?: string) => void
  setMenuTab: (t: string) => void
  setPointerLocked: (v: boolean) => void
  setDevice: (d: InputDevice) => void
  setPadConnected: (v: boolean) => void
  setPrompt: (p: PromptInfo | null) => void
  setSitting: (v: boolean) => void
  setBreathing: (v: boolean) => void
  setTelescope: (v: boolean) => void
  notify: (text: string, long?: boolean) => void
  expireToasts: () => void
  setLocation: (name: string) => void
  setWebglLost: (v: boolean) => void
  setSceneReady: (v: boolean) => void
  togglePerfOverlay: () => void
  setAutoQuality: (q: QualityLevel) => void
  setFade: (v: boolean) => void
  setTeaPhase: (p: 'idle' | 'brewing' | 'ready' | 'holding') => void
}

let toastId = 1

export const useGame = create<GameState>()((set, get) => ({
  phase: 'boot',
  overlay: null,
  menuTab: 'time',
  pointerLocked: false,
  device: 'kb',
  padConnected: false,
  prompt: null,
  sitting: false,
  breathing: false,
  telescope: false,
  toasts: [],
  locationName: '',
  webglLost: false,
  sceneReady: false,
  perfOverlay: false,
  autoQuality: 'medium',
  fade: false,
  teaPhase: 'idle',

  setPhase: (p) => set({ phase: p }),
  setOverlay: (o, tab) => set({ overlay: o, ...(tab ? { menuTab: tab } : {}) }),
  setMenuTab: (t) => set({ menuTab: t }),
  setPointerLocked: (v) => set({ pointerLocked: v }),
  setDevice: (d) => {
    if (get().device !== d) set({ device: d })
  },
  setPadConnected: (v) => set({ padConnected: v }),
  setPrompt: (p) => {
    const cur = get().prompt
    if (cur === p) return
    if (cur && p && cur.label === p.label && cur.action === p.action) return
    set({ prompt: p })
  },
  setSitting: (v) => set({ sitting: v }),
  setBreathing: (v) => set({ breathing: v }),
  setTelescope: (v) => set({ telescope: v }),
  notify: (text, long) =>
    set((s) => ({
      toasts: [
        ...s.toasts.filter((t) => t.until > performance.now()),
        { id: toastId++, text, until: performance.now() + (long ? 6500 : 3500) },
      ].slice(-3),
    })),
  expireToasts: () =>
    set((s) => {
      const now = performance.now()
      if (s.toasts.every((t) => t.until > now)) return s
      return { ...s, toasts: s.toasts.filter((t) => t.until > now) }
    }),
  setLocation: (name) => {
    if (get().locationName !== name) set({ locationName: name })
  },
  setWebglLost: (v) => set({ webglLost: v }),
  setSceneReady: (v) => set({ sceneReady: v }),
  togglePerfOverlay: () => set((s) => ({ perfOverlay: !s.perfOverlay })),
  setAutoQuality: (q) => set({ autoQuality: q }),
  setFade: (v) => set({ fade: v }),
  setTeaPhase: (p) => set({ teaPhase: p }),
}))
