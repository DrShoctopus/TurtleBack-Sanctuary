import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from '../core/save/storage'
import { SAVE_KEYS } from '../config/constants'
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  migrateSettings,
  type GameSettings,
} from '../data/settings'

export {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  mergeWithDefaults,
  migrateSettings,
  type DecorTheme,
  type QualityChoice,
  type SpeakerMode,
  type WeatherMode,
} from '../data/settings'

export type SettingsState = GameSettings

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
