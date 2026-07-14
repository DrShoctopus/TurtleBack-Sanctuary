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
  deleteSave: 'save:delete',
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  getMedia: 'media:get',
  setMedia: 'media:set',
  eraseAllData: 'data:erase-all',
  getDesktopPreferences: 'desktop-preferences:get',
  setDesktopPreferences: 'desktop-preferences:set',
  selectLocalAudioFolder: 'local-audio:select-folder',
  listLocalAudioFolders: 'local-audio:list-folders',
  listLocalAudioFiles: 'local-audio:list-files',
  openExternalLink: 'platform:open-external',
  authorizeRemoteMediaUrl: 'platform:authorize-media-url',
  getAppVersion: 'platform:get-version',
  getPlatformInfo: 'platform:get-info',
  setDisplayMode: 'window:set-display-mode',
  toggleFullscreen: 'window:toggle-fullscreen',
  setWindowSize: 'window:set-size',
  windowCommand: 'window:command',
  openLogFolder: 'logging:open-folder',
  rendererError: 'logging:renderer-error',
  prepareShutdown: 'lifecycle:prepare-shutdown',
  shutdownReady: 'lifecycle:shutdown-ready',
  lifecycleEvent: 'lifecycle:event',
  reloadApplication: 'lifecycle:reload-application',
} as const

export type DisplayMode = 'windowed' | 'fullscreen' | 'borderless'
export type WindowSizeId = '1280x720' | '1600x900' | '1920x1080'
export const windowSizeIdSchema = z.enum(['1280x720', '1600x900', '1920x1080'])

export interface DesktopPreferences {
  displayMode: DisplayMode
  windowSize: WindowSizeId
  lastSaveSlot: string
  autoLoadLastSave: boolean
}

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  displayMode: 'windowed',
  windowSize: '1280x720',
  lastSaveSlot: 'autosave',
  autoLoadLastSave: true,
}

export const desktopPreferencesSchema: z.ZodType<DesktopPreferences> = z.object({
  displayMode: z.enum(['windowed', 'fullscreen', 'borderless']),
  windowSize: windowSizeIdSchema,
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
export const windowSizeSchema = z.object({
  width: z.number().int().min(960).max(7680),
  height: z.number().int().min(540).max(4320),
})
export const displayModeSchema = z.enum(['windowed', 'fullscreen', 'borderless'])
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
  deleteSave(slot: string): Promise<void>
  getSettings(): Promise<GameSettings | null>
  setSettings(settings: GameSettings): Promise<GameSettings>
  getMedia(): Promise<PortableMediaData | null>
  setMedia(media: PortableMediaData): Promise<PortableMediaData>
  eraseAllData(): Promise<void>
  getDesktopPreferences(): Promise<DesktopPreferences>
  setDesktopPreferences(patch: Partial<DesktopPreferences>): Promise<DesktopPreferences>
  selectLocalAudioFolder(): Promise<LocalAudioFolder | null>
  listLocalAudioFolders(): Promise<LocalAudioFolder[]>
  listLocalAudioFiles(folderId: string): Promise<PortableAudioTrack[]>
  openExternalLink(url: string): Promise<boolean>
  authorizeRemoteMediaUrl(url: string): Promise<boolean>
  getAppVersion(): Promise<string>
  getPlatformInfo(): Promise<PlatformInfo>
  setDisplayMode(mode: DisplayMode): Promise<DisplayMode>
  toggleFullscreen(): Promise<boolean>
  setWindowSize(width: number, height: number): Promise<void>
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
