import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from '../core/save/storage'
import { SAVE_KEYS } from '../config/constants'

export type QualityChoice = 'auto' | 'low' | 'medium' | 'high'
export type WeatherMode = 'auto' | 'clear' | 'rain'
export type DecorTheme = 'driftwood' | 'tidepool' | 'dune'
export type SpeakerMode = 'room' | 'personal'

export interface SettingsState {
  graphics: {
    quality: QualityChoice
    fov: number
    uiScale: number
    bloom: boolean
    /** 0..1 multiplier on weather/ambient particle counts. */
    particleDensity: number
  }
  comfort: {
    /** null → follow the OS `prefers-reduced-motion` media query. */
    reducedMotion: boolean | null
    headBob: boolean
    turtleBob: boolean
    cameraSway: boolean
    highContrastPrompts: boolean
    centerDot: boolean
    holdToInteract: boolean
    showClock: boolean
    subtitles: boolean
  }
  input: {
    mouseSens: number
    padSens: number
    invertY: boolean
    deadzone: number
    vibration: boolean
  }
  audio: {
    master: number
    music: number
    ambient: number
    sfx: number
    tv: number
    media: number
    muteAll: boolean
  }
  time: {
    auto: boolean
    speed: number
    manual: number
  }
  weather: {
    mode: WeatherMode
    rainIntensity: number
  }
  home: {
    warmth: number
    blinds: number
    artwork: number
    theme: DecorTheme
    speakerMode: SpeakerMode
  }
  quietMode: boolean
  /** the generative soundtrack on/off (media player is independent) */
  originalMusic: boolean
  worldSeed: number
}

export const DEFAULT_SETTINGS: SettingsState = {
  graphics: { quality: 'auto', fov: 72, uiScale: 1, bloom: true, particleDensity: 1 },
  comfort: {
    reducedMotion: null,
    headBob: true,
    turtleBob: true,
    cameraSway: true,
    highContrastPrompts: false,
    centerDot: true,
    holdToInteract: false,
    showClock: true,
    subtitles: true,
  },
  input: { mouseSens: 1, padSens: 1, invertY: false, deadzone: 0.15, vibration: false },
  audio: { master: 0.8, music: 0.65, ambient: 0.8, sfx: 0.8, tv: 0.85, media: 0.85, muteAll: false },
  time: { auto: true, speed: 1, manual: 0.35 },
  weather: { mode: 'auto', rainIntensity: 0.7 },
  home: { warmth: 0.55, blinds: 0.1, artwork: 0, theme: 'driftwood', speakerMode: 'room' },
  quietMode: false,
  originalMusic: true,
  worldSeed: 20260712,
}

export const SETTINGS_VERSION = 1

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Deep-merge persisted values over defaults, dropping unknown keys and wrong types. */
export function mergeWithDefaults<T>(defaults: T, incoming: unknown): T {
  if (!isObject(defaults as unknown as object) || !isObject(incoming)) {
    if (incoming !== undefined && typeof incoming === typeof defaults && incoming !== null) {
      return incoming as T
    }
    return defaults
  }
  const out: Record<string, unknown> = {}
  const d = defaults as unknown as Record<string, unknown>
  for (const key of Object.keys(d)) {
    const dv = d[key]
    const iv = (incoming as Record<string, unknown>)[key]
    if (iv === undefined) out[key] = dv
    else if (isObject(dv)) out[key] = mergeWithDefaults(dv, iv)
    else if (dv === null || typeof iv === typeof dv || (key === 'reducedMotion' && iv === null))
      out[key] = iv
    else out[key] = dv
  }
  return out as T
}

/**
 * Versioned migration. Version 0 was the pre-release flat shape
 * ({ volumeMusic, volumeAmbient, quality }) — folded into the nested schema.
 */
export function migrateSettings(persisted: unknown, fromVersion: number): SettingsState {
  let candidate: unknown = persisted
  if (fromVersion === 0 && isObject(persisted)) {
    const p = persisted
    candidate = {
      graphics: { quality: p.quality },
      audio: {
        music: typeof p.volumeMusic === 'number' ? p.volumeMusic : undefined,
        ambient: typeof p.volumeAmbient === 'number' ? p.volumeAmbient : undefined,
      },
    }
  }
  return mergeWithDefaults(DEFAULT_SETTINGS, candidate)
}

type SettingsActions = {
  set: <K extends keyof SettingsState>(key: K, value: Partial<SettingsState[K]>) => void
  setDeep: (updater: (s: SettingsState) => void) => void
  resetAll: () => void
}

export type SettingsStore = SettingsState & SettingsActions

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...structuredClone(DEFAULT_SETTINGS),
      set: (key, value) =>
        set((s) => {
          const cur = s[key]
          if (typeof cur === 'object' && cur !== null) {
            return { [key]: { ...(cur as object), ...(value as object) } } as Partial<SettingsStore>
          }
          return { [key]: value } as Partial<SettingsStore>
        }),
      setDeep: (updater) =>
        set((s) => {
          const draft = structuredClone({
            graphics: s.graphics,
            comfort: s.comfort,
            input: s.input,
            audio: s.audio,
            time: s.time,
            weather: s.weather,
            home: s.home,
            quietMode: s.quietMode,
            originalMusic: s.originalMusic,
            worldSeed: s.worldSeed,
          }) as SettingsState
          updater(draft)
          return draft as Partial<SettingsStore>
        }),
      resetAll: () => set(() => structuredClone(DEFAULT_SETTINGS) as Partial<SettingsStore>),
    }),
    {
      name: SAVE_KEYS.settings,
      version: SETTINGS_VERSION,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persisted, version) => migrateSettings(persisted, version) as SettingsStore,
      partialize: (s) => ({
        graphics: s.graphics,
        comfort: s.comfort,
        input: s.input,
        audio: s.audio,
        time: s.time,
        weather: s.weather,
        home: s.home,
        quietMode: s.quietMode,
        originalMusic: s.originalMusic,
        worldSeed: s.worldSeed,
      }),
    },
  ),
)

let osReducedMotion = false
if (typeof window !== 'undefined' && 'matchMedia' in window) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  osReducedMotion = mq.matches
  mq.addEventListener?.('change', (e) => {
    osReducedMotion = e.matches
  })
}

/** Effective reduced-motion flag (explicit setting wins, else OS preference). */
export function reducedMotionEnabled(s: Pick<SettingsState, 'comfort'>): boolean {
  return s.comfort.reducedMotion ?? osReducedMotion
}
