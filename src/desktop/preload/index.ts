import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  desktopPreferencesSchema,
  displayModeSchema,
  localAudioFolderSchema,
  platformInfoSchema,
  portableAudioTrackSchema,
  rendererErrorSchema,
  windowCommandSchema,
  windowSizeIdSchema,
  windowSizeSchema,
  type DesktopAppBridge,
  type DesktopPreferences,
} from '../shared/contracts'
import { gameSettingsSchema } from '../../game/data/settings'
import { portableMediaSchema } from '../../game/data/media'
import { portableSaveSchema, saveSlotSchema, type SaveSlotInfo } from '../../game/save/schema'

const bridge: DesktopAppBridge = {
  async saveGame(slot, data) {
    await ipcRenderer.invoke(IPC_CHANNELS.saveGame, {
      slot: saveSlotSchema.parse(slot),
      data: portableSaveSchema.parse(data),
    })
  },
  async loadGame(slot) {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.loadGame, saveSlotSchema.parse(slot))
    return value === null ? null : portableSaveSchema.parse(value)
  },
  async listSaveSlots() {
    return (await ipcRenderer.invoke(IPC_CHANNELS.listSaveSlots)) as SaveSlotInfo[]
  },
  async deleteSave(slot) {
    await ipcRenderer.invoke(IPC_CHANNELS.deleteSave, saveSlotSchema.parse(slot))
  },
  async getSettings() {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.getSettings)
    return value === null ? null : gameSettingsSchema.parse(value)
  },
  async setSettings(settings) {
    const value = await ipcRenderer.invoke(
      IPC_CHANNELS.setSettings,
      gameSettingsSchema.parse(settings),
    )
    return gameSettingsSchema.parse(value)
  },
  async getMedia() {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.getMedia)
    return value === null ? null : portableMediaSchema.parse(value)
  },
  async setMedia(media) {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.setMedia, portableMediaSchema.parse(media))
    return portableMediaSchema.parse(value)
  },
  async eraseAllData() {
    await ipcRenderer.invoke(IPC_CHANNELS.eraseAllData)
  },
  async getDesktopPreferences() {
    return desktopPreferencesSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.getDesktopPreferences),
    )
  },
  async setDesktopPreferences(patch) {
    const safePatch: Partial<DesktopPreferences> = {}
    if (patch.displayMode !== undefined)
      safePatch.displayMode = displayModeSchema.parse(patch.displayMode)
    if (patch.windowSize !== undefined)
      safePatch.windowSize = windowSizeIdSchema.parse(patch.windowSize)
    if (patch.lastSaveSlot !== undefined)
      safePatch.lastSaveSlot = saveSlotSchema.parse(patch.lastSaveSlot)
    if (patch.autoLoadLastSave !== undefined)
      safePatch.autoLoadLastSave = Boolean(patch.autoLoadLastSave)
    return desktopPreferencesSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.setDesktopPreferences, safePatch),
    )
  },
  async selectLocalAudioFolder() {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.selectLocalAudioFolder)
    return value === null ? null : localAudioFolderSchema.parse(value)
  },
  async listLocalAudioFolders() {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.listLocalAudioFolders)
    return localAudioFolderSchema.array().parse(value)
  },
  async listLocalAudioFiles(folderId) {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.listLocalAudioFiles, folderId)
    return portableAudioTrackSchema.array().parse(value)
  },
  async openExternalLink(url) {
    return Boolean(await ipcRenderer.invoke(IPC_CHANNELS.openExternalLink, String(url)))
  },
  async authorizeRemoteMediaUrl(url) {
    return Boolean(await ipcRenderer.invoke(IPC_CHANNELS.authorizeRemoteMediaUrl, String(url)))
  },
  async getAppVersion() {
    return String(await ipcRenderer.invoke(IPC_CHANNELS.getAppVersion))
  },
  async getPlatformInfo() {
    return platformInfoSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.getPlatformInfo))
  },
  async setDisplayMode(mode) {
    return displayModeSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.setDisplayMode, displayModeSchema.parse(mode)),
    )
  },
  async toggleFullscreen() {
    return Boolean(await ipcRenderer.invoke(IPC_CHANNELS.toggleFullscreen))
  },
  async setWindowSize(width, height) {
    await ipcRenderer.invoke(IPC_CHANNELS.setWindowSize, windowSizeSchema.parse({ width, height }))
  },
  async windowCommand(command) {
    await ipcRenderer.invoke(IPC_CHANNELS.windowCommand, windowCommandSchema.parse(command))
  },
  async openLogFolder() {
    await ipcRenderer.invoke(IPC_CHANNELS.openLogFolder)
  },
  async logRendererError(error) {
    await ipcRenderer.invoke(IPC_CHANNELS.rendererError, rendererErrorSchema.parse(error))
  },
  onPrepareShutdown(callback) {
    const listener = () => {
      void Promise.resolve(callback()).catch(() => undefined)
    }
    ipcRenderer.on(IPC_CHANNELS.prepareShutdown, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.prepareShutdown, listener)
  },
  signalShutdownReady() {
    ipcRenderer.send(IPC_CHANNELS.shutdownReady)
  },
}

contextBridge.exposeInMainWorld('desktopApp', Object.freeze(bridge))
