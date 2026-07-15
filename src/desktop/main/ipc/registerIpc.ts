import { release } from 'node:os'
import { BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import {
  IPC_CHANNELS,
  mediaWriteRequestSchema,
  rendererErrorSchema,
  saveWriteRequestSchema,
  settingsWriteRequestSchema,
  windowCommandSchema,
} from '../../shared/contracts'
import { saveSlotSchema } from '../../../game/save/schema'
import type { AppLogger } from '../logging/logger'
import type { LocalAudioLibrary } from '../storage/localAudioLibrary'
import type { DesktopRepositories } from '../storage/repositories'
import type { RemoteMediaLibrary } from '../security/remoteMedia'

interface RegisterIpcOptions {
  window: BrowserWindow
  repositories: DesktopRepositories
  localAudio: LocalAudioLibrary
  remoteMedia: RemoteMediaLibrary
  logger: AppLogger
  loggerDirectory: string
  appVersion: string
  onShutdownReady: () => void
  onReloadRequested: () => void
}

function assertTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow): void {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
    throw new Error('IPC request rejected: untrusted sender')
  }
  const url = event.senderFrame.url
  if (
    !url.startsWith('app://turtleback/') &&
    !/^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(url)
  ) {
    throw new Error('IPC request rejected: invalid renderer origin')
  }
}

function handle(
  channel: string,
  window: BrowserWindow,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>,
): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedSender(event, window)
    return handler(event, ...args)
  })
}

export function registerIpcHandlers(options: RegisterIpcOptions): () => void {
  const { window, repositories, localAudio, remoteMedia, logger } = options

  handle(IPC_CHANNELS.saveGame, window, async (_event, request) => {
    const parsed = saveWriteRequestSchema.parse(request)
    await repositories.writeSave(parsed.slot, parsed.data)
  })
  handle(IPC_CHANNELS.loadGame, window, (_event, slot) =>
    repositories.loadSave(saveSlotSchema.parse(slot)),
  )
  handle(IPC_CHANNELS.listSaveSlots, window, () => repositories.listSaves())
  handle(IPC_CHANNELS.getSettings, window, () => repositories.getSettings())
  handle(IPC_CHANNELS.setSettings, window, (_event, settings) =>
    repositories.setSettings(settingsWriteRequestSchema.parse(settings)),
  )
  handle(IPC_CHANNELS.getMedia, window, () => repositories.getMedia())
  handle(IPC_CHANNELS.setMedia, window, (_event, media) =>
    repositories.setMedia(mediaWriteRequestSchema.parse(media)),
  )
  handle(IPC_CHANNELS.eraseAllData, window, async () => {
    await Promise.all([repositories.eraseAll(), localAudio.eraseAll()])
  })
  handle(IPC_CHANNELS.getDesktopPreferences, window, () => repositories.getPreferences())
  handle(IPC_CHANNELS.selectLocalAudioFolder, window, () => localAudio.selectFolder(window))
  handle(IPC_CHANNELS.listLocalAudioFolders, window, () => localAudio.listFolders())
  handle(IPC_CHANNELS.authorizeRemoteMediaUrl, window, async (_event, input) => {
    const playbackUrl = await remoteMedia.authorize(String(input))
    if (!playbackUrl) {
      logger.warn('remote_media.authorization_rejected')
      return null
    }
    logger.info('remote_media.authorization_granted')
    return playbackUrl
  })
  handle(IPC_CHANNELS.getAppVersion, window, () => options.appVersion)
  handle(IPC_CHANNELS.getPlatformInfo, window, () => ({
    platform: process.platform as 'win32' | 'darwin' | 'linux',
    arch: process.arch,
    release: release(),
    electronVersion: process.versions.electron,
    chromiumVersion: process.versions.chrome,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
  }))
  handle(IPC_CHANNELS.windowCommand, window, (_event, rawCommand) => {
    const command = windowCommandSchema.parse(rawCommand)
    if (command === 'minimize') window.minimize()
    else if (command === 'maximize') window.maximize()
    else if (command === 'restore') window.restore()
    else window.close()
  })
  handle(IPC_CHANNELS.openLogFolder, window, async () => {
    await shell.openPath(options.loggerDirectory)
  })
  handle(IPC_CHANNELS.rendererError, window, (_event, rawError) => {
    const error = rendererErrorSchema.parse(rawError)
    logger.error('renderer.error', error)
  })
  handle(IPC_CHANNELS.reloadApplication, window, () => options.onReloadRequested())

  const shutdownListener = (event: Electron.IpcMainEvent) => {
    if (event.sender === window.webContents) options.onShutdownReady()
  }
  ipcMain.on(IPC_CHANNELS.shutdownReady, shutdownListener)

  return () => {
    for (const channel of Object.values(IPC_CHANNELS)) ipcMain.removeHandler(channel)
    ipcMain.removeListener(IPC_CHANNELS.shutdownReady, shutdownListener)
  }
}
