import { z } from 'zod'
import {
  cloneDefaultKeyboardBindings,
  DEFAULT_GAMEPAD_BINDINGS,
  type GamepadBindings,
  type KeyboardBindings,
} from '../input/actions'

export type QualityChoice = 'auto' | 'low' | 'medium' | 'high'
export type WeatherMode = 'auto' | 'clear' | 'rain'
export type DecorTheme = 'driftwood' | 'tidepool' | 'dune'
export type SpeakerMode = 'room' | 'personal'
export type TimeSpeed = 0.5 | 1 | 2 | 5

export interface GameSettings {
  graphics: {
    quality: QualityChoice
    fov: number
    uiScale: number
    bloom: boolean
    /** 0..1 multiplier on weather/ambient particle counts. */
    particleDensity: number
  }
  comfort: {
    /** null -> follow the OS prefers-reduced-motion media query. */
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
    keyboardBindings: KeyboardBindings
    gamepadBindings: GamepadBindings
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
    speed: TimeSpeed
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
  originalMusic: boolean
  worldSeed: number
}

export const DEFAULT_SETTINGS: GameSettings = {
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
  input: {
    mouseSens: 1,
    padSens: 1,
    invertY: false,
    deadzone: 0.15,
    vibration: false,
    keyboardBindings: cloneDefaultKeyboardBindings(),
    gamepadBindings: { ...DEFAULT_GAMEPAD_BINDINGS },
  },
  audio: { master: 0.8, music: 0.65, ambient: 0.8, sfx: 0.8, tv: 0.85, media: 0.85, muteAll: false },
  time: { auto: true, speed: 1, manual: 0.35 },
  weather: { mode: 'auto', rainIntensity: 0.7 },
  home: { warmth: 0.55, blinds: 0.1, artwork: 0, theme: 'driftwood', speakerMode: 'room' },
  quietMode: false,
  originalMusic: true,
  worldSeed: 20260712,
}

const finiteRange = (min: number, max: number) => z.number().finite().min(min).max(max)
const keyCodes = z.array(z.string().min(1).max(48)).min(1).max(3)
const padButton = z.number().int().min(0).max(31)

const keyboardBindingsSchema = z.object({
  move_forward: keyCodes,
  move_backward: keyCodes,
  move_left: keyCodes,
  move_right: keyCodes,
  jog: keyCodes,
  jump: keyCodes,
  interact: keyCodes,
  pause: keyCodes,
  open_sanctuary: keyCodes,
  open_map: keyCodes,
  return_home: keyCodes,
  performance_overlay: keyCodes,
})

const gamepadBindingsSchema = z.object({
  interact: padButton,
  back: padButton,
  secondary: padButton,
  menu: padButton,
  tabL: padButton,
  tabR: padButton,
  interactAlt: padButton,
  map: padButton,
  pause: padButton,
  jog: padButton,
  jump: padButton,
  navUp: padButton,
  navDown: padButton,
  navLeft: padButton,
  navRight: padButton,
})

export const gameSettingsSchema: z.ZodType<GameSettings> = z.object({
  graphics: z.object({
    quality: z.enum(['auto', 'low', 'medium', 'high']),
    fov: finiteRange(60, 95),
    uiScale: finiteRange(0.8, 1.4),
    bloom: z.boolean(),
    particleDensity: finiteRange(0.2, 1),
  }),
  comfort: z.object({
    reducedMotion: z.boolean().nullable(),
    headBob: z.boolean(),
    turtleBob: z.boolean(),
    cameraSway: z.boolean(),
    highContrastPrompts: z.boolean(),
    centerDot: z.boolean(),
    holdToInteract: z.boolean(),
    showClock: z.boolean(),
    subtitles: z.boolean(),
  }),
  input: z.object({
    mouseSens: finiteRange(0.2, 2.5),
    padSens: finiteRange(0.2, 2.5),
    invertY: z.boolean(),
    deadzone: finiteRange(0.05, 0.4),
    vibration: z.boolean(),
    keyboardBindings: keyboardBindingsSchema,
    gamepadBindings: gamepadBindingsSchema,
  }),
  audio: z.object({
    master: finiteRange(0, 1),
    music: finiteRange(0, 1),
    ambient: finiteRange(0, 1),
    sfx: finiteRange(0, 1),
    tv: finiteRange(0, 1),
    media: finiteRange(0, 1),
    muteAll: z.boolean(),
  }),
  time: z.object({
    auto: z.boolean(),
    speed: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(5)]),
    manual: finiteRange(0, 1),
  }),
  weather: z.object({
    mode: z.enum(['auto', 'clear', 'rain']),
    rainIntensity: finiteRange(0, 1),
  }),
  home: z.object({
    warmth: finiteRange(0, 1),
    blinds: finiteRange(0, 1),
    artwork: z.number().int().min(0).max(3),
    theme: z.enum(['driftwood', 'tidepool', 'dune']),
    speakerMode: z.enum(['room', 'personal']),
  }),
  quietMode: z.boolean(),
  originalMusic: z.boolean(),
  worldSeed: z.number().int().min(0).max(0x7fffffff),
})

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Deep-merge persisted values over defaults, dropping unknown keys and wrong primitive types. */
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
    const defaultValue = d[key]
    const incomingValue = incoming[key]
    if (incomingValue === undefined) out[key] = defaultValue
    else if (isObject(defaultValue)) out[key] = mergeWithDefaults(defaultValue, incomingValue)
    else if (
      defaultValue === null ||
      typeof incomingValue === typeof defaultValue ||
      (key === 'reducedMotion' && incomingValue === null)
    )
      out[key] = incomingValue
    else out[key] = defaultValue
  }
  return out as T
}

export const SETTINGS_VERSION = 2

/** Version 0 was flat; version 1 predates configurable input bindings. */
export function migrateSettings(persisted: unknown, fromVersion: number): GameSettings {
  let candidate: unknown = persisted
  if (fromVersion === 0 && isObject(persisted)) {
    candidate = {
      graphics: { quality: persisted.quality },
      audio: {
        music: typeof persisted.volumeMusic === 'number' ? persisted.volumeMusic : undefined,
        ambient: typeof persisted.volumeAmbient === 'number' ? persisted.volumeAmbient : undefined,
      },
    }
  }
  const merged = mergeWithDefaults(DEFAULT_SETTINGS, candidate)
  const parsed = gameSettingsSchema.safeParse(merged)
  return parsed.success ? parsed.data : structuredClone(DEFAULT_SETTINGS)
}
