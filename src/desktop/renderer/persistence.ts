import { portableMediaSchema, type PortableMediaData } from '../../game/data/media'
import { gameSettingsSchema, type GameSettings } from '../../game/data/settings'
import { events } from '../../game/core/events'
import { runtime } from '../../game/core/runtime'
import {
  SAVE_SCHEMA_VERSION,
  portableSaveSchema,
  type PortableSaveData,
} from '../../game/save/schema'
import { useGame } from '../../game/state/gameStore'
import { useMedia } from '../../game/state/mediaStore'
import { useSettings } from '../../game/state/settingsStore'
import type { DesktopAppBridge, DesktopPreferences, PlatformInfo } from '../shared/contracts'

const WRITE_DEBOUNCE_MS = 250
const AUTOSAVE_INTERVAL_MS = 60_000

let bridge: DesktopAppBridge | null = null
let preferences: DesktopPreferences | null = null
let appVersion = '1.0.0'
let platform: PlatformInfo['platform'] | undefined
let pendingRestore: PortableSaveData['player'] | null = null
let settingsTimer: ReturnType<typeof setTimeout> | null = null
let mediaTimer: ReturnType<typeof setTimeout> | null = null
let autosaveTimer: ReturnType<typeof setInterval> | null = null
let settingsQueue: Promise<void> = Promise.resolve()
let mediaQueue: Promise<void> = Promise.resolve()
let saveQueue: Promise<void> = Promise.resolve()
let unsubscribeSettings: (() => void) | null = null
let unsubscribeMedia: (() => void) | null = null
let unsubscribeGame: (() => void) | null = null
let started = false
let erasing = false

export interface PortableSaveSnapshotInput {
  gameVersion: string
  savedAt: string
  platform?: PlatformInfo['platform']
  player: PortableSaveData['player']
  world: PortableSaveData['world']
  settings: GameSettings
  media: PortableMediaData
  progression?: PortableSaveData['progression']
}

/** Build and validate the framework-neutral save envelope before crossing IPC. */
export function createPortableSaveSnapshot(input: PortableSaveSnapshotInput): PortableSaveData {
  return portableSaveSchema.parse({
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: input.gameVersion,
    savedAt: input.savedAt,
    player: input.player,
    world: input.world,
    settings: input.settings,
    media: input.media,
    progression: input.progression ?? { visitedDistrictIds: [], interactionFlags: {} },
    desktop: input.platform ? { sourcePlatform: input.platform } : undefined,
  })
}

/** Hydrate durable desktop state before React and the simulation mount. */
export async function initializeDesktopPersistence(): Promise<void> {
  bridge = window.desktopApp ?? null
  if (!bridge) return

  try {
    preferences = await bridge.getDesktopPreferences()
    const [storedSettings, storedMedia, version, platformInfo, save] = await Promise.all([
      bridge.getSettings(),
      bridge.getMedia(),
      bridge.getAppVersion(),
      bridge.getPlatformInfo(),
      preferences.autoLoadLastSave
        ? bridge.loadGame(preferences.lastSaveSlot)
        : Promise.resolve(null),
    ])
    appVersion = version
    platform = platformInfo.platform

    let settings = storedSettings ?? save?.settings
    if (settings && save) {
      settings = gameSettingsSchema.parse({
        ...settings,
        worldSeed: save.world.seed,
        time: {
          ...settings.time,
          auto: save.world.time.auto,
          speed: save.world.time.speed,
          manual: save.world.time.cyclePosition,
        },
        weather: {
          mode: save.world.weather.mode,
          rainIntensity: save.world.weather.rainIntensity,
        },
      })
    }
    if (settings) useSettings.setState(settings)

    const media = storedMedia ?? save?.media
    if (media) useMedia.getState().replaceAll(portableMediaSchema.parse(media))

    if (save) {
      runtime.time.t = save.world.time.cyclePosition
      runtime.travel.distance = save.world.travelDistance
      runtime.weather.rain = save.world.weather.rain
      runtime.weather.wetness = save.world.weather.wetness
      runtime.player.pos.set(...save.player.position)
      runtime.player.yaw = save.player.yaw
      runtime.player.pitch = save.player.pitch
      pendingRestore = save.player
    }
  } catch (error) {
    reportPersistenceError('desktop persistence hydration failed', error)
  }
}

/** Start subscriptions only after hydration so defaults never overwrite disk state. */
export function startDesktopPersistence(): void {
  if (!bridge || started) return
  started = true

  unsubscribeSettings = useSettings.subscribe(scheduleSettingsWrite)
  unsubscribeMedia = useMedia.subscribe(scheduleMediaWrite)
  unsubscribeGame = useGame.subscribe((state) => {
    if (state.sceneReady) applyPendingRestore()
  })
  autosaveTimer = setInterval(() => void queueAutosave(), AUTOSAVE_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
  applyPendingRestore()

  // Seed missing repositories after a first launch or recovery from a save.
  scheduleSettingsWrite()
  scheduleMediaWrite()
}

export async function flushDesktopPersistence(includeAutosave = true): Promise<void> {
  if (!bridge || erasing) return
  if (settingsTimer) {
    clearTimeout(settingsTimer)
    settingsTimer = null
  }
  if (mediaTimer) {
    clearTimeout(mediaTimer)
    mediaTimer = null
  }
  queueSettingsWrite()
  queueMediaWrite()
  if (includeAutosave) queueAutosave()
  await Promise.all([settingsQueue, mediaQueue, saveQueue])
}

export async function eraseAllDesktopData(): Promise<boolean> {
  if (!bridge) return false
  erasing = true
  stopDesktopPersistence()
  try {
    await bridge.eraseAllData()
    await bridge.reloadApplication()
    return true
  } catch (error) {
    erasing = false
    reportPersistenceError('desktop data erase failed', error)
    startDesktopPersistence()
    return false
  }
}

export function stopDesktopPersistence(): void {
  unsubscribeSettings?.()
  unsubscribeMedia?.()
  unsubscribeGame?.()
  unsubscribeSettings = null
  unsubscribeMedia = null
  unsubscribeGame = null
  if (settingsTimer) clearTimeout(settingsTimer)
  if (mediaTimer) clearTimeout(mediaTimer)
  if (autosaveTimer) clearInterval(autosaveTimer)
  settingsTimer = null
  mediaTimer = null
  autosaveTimer = null
  document.removeEventListener('visibilitychange', onVisibilityChange)
  started = false
}

function scheduleSettingsWrite(): void {
  if (!bridge || erasing) return
  if (settingsTimer) clearTimeout(settingsTimer)
  settingsTimer = setTimeout(() => {
    settingsTimer = null
    queueSettingsWrite()
  }, WRITE_DEBOUNCE_MS)
}

function scheduleMediaWrite(): void {
  if (!bridge || erasing) return
  if (mediaTimer) clearTimeout(mediaTimer)
  mediaTimer = setTimeout(() => {
    mediaTimer = null
    queueMediaWrite()
  }, WRITE_DEBOUNCE_MS)
}

function queueSettingsWrite(): void {
  if (!bridge || erasing) return
  const snapshot = gameSettingsSchema.parse(useSettings.getState())
  settingsQueue = settingsQueue
    .then(async () => {
      await bridge!.setSettings(snapshot)
    })
    .catch((error) => reportPersistenceError('desktop settings write failed', error))
}

function queueMediaWrite(): void {
  if (!bridge || erasing) return
  const snapshot = portableMediaSchema.parse(useMedia.getState())
  mediaQueue = mediaQueue
    .then(async () => {
      await bridge!.setMedia(snapshot)
    })
    .catch((error) => reportPersistenceError('desktop media write failed', error))
}

function queueAutosave(): void {
  if (!bridge || !preferences || erasing) return
  const game = useGame.getState()
  if (game.phase !== 'playing' || !game.sceneReady) return

  const settings = gameSettingsSchema.parse(useSettings.getState())
  const media = portableMediaSchema.parse(useMedia.getState())
  const snapshot = createPortableSaveSnapshot({
    gameVersion: appVersion,
    savedAt: new Date().toISOString(),
    platform,
    player: {
      position: [runtime.player.pos.x, runtime.player.pos.y, runtime.player.pos.z],
      yaw: runtime.player.yaw,
      pitch: runtime.player.pitch,
    },
    world: {
      seed: settings.worldSeed,
      travelDistance: runtime.travel.distance,
      time: {
        cyclePosition: runtime.time.t,
        auto: settings.time.auto,
        speed: settings.time.speed,
      },
      weather: {
        mode: settings.weather.mode,
        rainIntensity: settings.weather.rainIntensity,
        rain: runtime.weather.rain,
        wetness: runtime.weather.wetness,
      },
    },
    settings,
    media,
  })

  const slot = preferences.lastSaveSlot
  saveQueue = saveQueue
    .then(async () => {
      await bridge!.saveGame(slot, snapshot)
    })
    .catch((error) => reportPersistenceError('desktop autosave failed', error))
}

function applyPendingRestore(): void {
  if (!pendingRestore || !useGame.getState().sceneReady) return
  const player = pendingRestore
  pendingRestore = null
  events.emit('teleport', {
    x: player.position[0],
    y: player.position[1],
    z: player.position[2],
    yaw: player.yaw,
    pitch: player.pitch,
    reason: 'load',
  })
}

function onVisibilityChange(): void {
  if (document.hidden) void flushDesktopPersistence(true)
}

function reportPersistenceError(message: string, error: unknown): void {
  const parsed = error instanceof Error ? error : new Error(String(error))
  void bridge?.logRendererError({
    message: `${message}: ${parsed.message}`,
    stack: parsed.stack,
    source: 'unhandledrejection',
  })
}
