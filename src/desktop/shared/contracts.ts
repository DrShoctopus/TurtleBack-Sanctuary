import { z } from 'zod'
import { gameSettingsSchema, type GameSettings } from '../../game/data/settings'
import { portableMediaSchema, type PortableMediaData } from '../../game/data/media'
import {
  portableSaveSchema,
  saveSlotSchema,
  type PortableSaveData,
  type SaveSlotInfo,
} from '../../game/save/schema'

export const IPC_CHANNELS = {
  saveGame: 'save:write',
  loadGame: 'save:load',
  listSaveSlots: 'save:list',
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  getMedia: 'media:get',
  setMedia: 'media:set',
  eraseAllData: 'data:erase-all',
  getDesktopPreferences: 'desktop-preferences:get',
  selectLocalAudioFolder: 'local-audio:select-folder',
  listLocalAudioFolders: 'local-audio:list-folders',
  authorizeRemoteMediaUrl: 'platform:authorize-media-url',
  getAppVersion: 'platform:get-version',
  getPlatformInfo: 'platform:get-info',
  windowCommand: 'window:command',
  openLogFolder: 'logging:open-folder',
  rendererError: 'logging:renderer-error',
  prepareShutdown: 'lifecycle:prepare-shutdown',
  shutdownReady: 'lifecycle:shutdown-ready',
  lifecycleEvent: 'lifecycle:event',
  reloadApplication: 'lifecycle:reload-application',
} as const

export interface DesktopPreferences {
  lastSaveSlot: string
  autoLoadLastSave: boolean
}

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  lastSaveSlot: 'autosave',
  autoLoadLastSave: true,
}

export const desktopPreferencesSchema: z.ZodType<DesktopPreferences> = z.object({
  lastSaveSlot: saveSlotSchema,
  autoLoadLastSave: z.boolean(),
})

export interface PlatformInfo {
  platform: 'win32' | 'darwin' | 'linux'
  arch: string
  release: string
  electronVersion: string
  chromiumVersion: string
  locale: string
}

export const platformInfoSchema: z.ZodType<PlatformInfo> = z.object({
  platform: z.enum(['win32', 'darwin', 'linux']),
  arch: z.string().min(1).max(40),
  release: z.string().min(1).max(120),
  electronVersion: z.string().min(1).max(40),
  chromiumVersion: z.string().min(1).max(40),
  locale: z.string().min(1).max(40),
})

export interface PortableAudioTrack {
  id: string
  displayName: string
  format: string
  playbackUrl: string
}

export interface LocalAudioFolder {
  folderId: string
  displayName: string
  tracks: PortableAudioTrack[]
}

export const folderIdSchema = z.string().uuid()
export const portableAudioTrackSchema: z.ZodType<PortableAudioTrack> = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(240),
  format: z.string().min(1).max(12),
  playbackUrl: z.string().startsWith('turtleback-media://track/'),
})
export const localAudioFolderSchema: z.ZodType<LocalAudioFolder> = z.object({
  folderId: folderIdSchema,
  displayName: z.string().min(1).max(240),
  tracks: z.array(portableAudioTrackSchema).max(5000),
})

export const saveWriteRequestSchema = z.object({ slot: saveSlotSchema, data: portableSaveSchema })
export const settingsWriteRequestSchema = gameSettingsSchema
export const mediaWriteRequestSchema = portableMediaSchema
export const windowCommandSchema = z.enum(['minimize', 'maximize', 'restore', 'close'])
export const rendererErrorSchema = z.object({
  message: z.string().min(1).max(4000),
  stack: z.string().max(16000).optional(),
  source: z.enum(['error', 'unhandledrejection', 'react-boundary']),
})
export const desktopLifecycleEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('suspend') }),
  z.object({ type: z.literal('resume') }),
])
export type DesktopLifecycleEvent = z.infer<typeof desktopLifecycleEventSchema>

export interface DesktopAppBridge {
  saveGame(slot: string, data: PortableSaveData): Promise<void>
  loadGame(slot: string): Promise<PortableSaveData | null>
  listSaveSlots(): Promise<SaveSlotInfo[]>
  getSettings(): Promise<GameSettings | null>
  setSettings(settings: GameSettings): Promise<GameSettings>
  getMedia(): Promise<PortableMediaData | null>
  setMedia(media: PortableMediaData): Promise<PortableMediaData>
  eraseAllData(): Promise<void>
  getDesktopPreferences(): Promise<DesktopPreferences>
  selectLocalAudioFolder(): Promise<LocalAudioFolder | null>
  listLocalAudioFolders(): Promise<LocalAudioFolder[]>
  authorizeRemoteMediaUrl(url: string): Promise<string | null>
  getAppVersion(): Promise<string>
  getPlatformInfo(): Promise<PlatformInfo>
  windowCommand(command: 'minimize' | 'maximize' | 'restore' | 'close'): Promise<void>
  openLogFolder(): Promise<void>
  logRendererError(error: z.infer<typeof rendererErrorSchema>): Promise<void>
  reloadApplication(): Promise<void>
  onPrepareShutdown(callback: () => void | Promise<void>): () => void
  onLifecycleEvent(callback: (event: DesktopLifecycleEvent) => void | Promise<void>): () => void
  signalShutdownReady(): void
}

declare global {
  interface Window {
    desktopApp?: DesktopAppBridge
  }
}
