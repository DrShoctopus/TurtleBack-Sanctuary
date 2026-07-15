import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  desktopPreferencesSchema,
  desktopLifecycleEventSchema,
  localAudioFolderSchema,
  platformInfoSchema,
  rendererErrorSchema,
  windowCommandSchema,
  type DesktopAppBridge,
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
  async selectLocalAudioFolder() {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.selectLocalAudioFolder)
    return value === null ? null : localAudioFolderSchema.parse(value)
  },
  async listLocalAudioFolders() {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.listLocalAudioFolders)
    return localAudioFolderSchema.array().parse(value)
  },
  async authorizeRemoteMediaUrl(url) {
    const value = await ipcRenderer.invoke(IPC_CHANNELS.authorizeRemoteMediaUrl, String(url))
    return typeof value === 'string' ? value : null
  },
  async getAppVersion() {
    return String(await ipcRenderer.invoke(IPC_CHANNELS.getAppVersion))
  },
  async getPlatformInfo() {
    return platformInfoSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.getPlatformInfo))
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
  async reloadApplication() {
    await ipcRenderer.invoke(IPC_CHANNELS.reloadApplication)
  },
  onPrepareShutdown(callback) {
    const listener = () => {
      void Promise.resolve(callback()).catch(() => undefined)
    }
    ipcRenderer.on(IPC_CHANNELS.prepareShutdown, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.prepareShutdown, listener)
  },
  onLifecycleEvent(callback) {
    const listener = (_event: Electron.IpcRendererEvent, rawEvent: unknown) => {
      const event = desktopLifecycleEventSchema.safeParse(rawEvent)
      if (event.success) void Promise.resolve(callback(event.data)).catch(() => undefined)
    }
    ipcRenderer.on(IPC_CHANNELS.lifecycleEvent, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.lifecycleEvent, listener)
  },
  signalShutdownReady() {
    ipcRenderer.send(IPC_CHANNELS.shutdownReady)
  },
}

contextBridge.exposeInMainWorld('desktopApp', Object.freeze(bridge))
