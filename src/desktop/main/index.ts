import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { app, BrowserWindow, Menu, powerMonitor, protocol, session, type Session } from 'electron'
import { IPC_CHANNELS, type DesktopLifecycleEvent } from '../shared/contracts'
import { registerIpcHandlers } from './ipc/registerIpc'
import { RendererRecoveryPolicy, rendererRecoveryUrl } from './lifecycle/recoveryPolicy'
import { AppLogger } from './logging/logger'
import { rendererCacheControl } from './security/rendererCacheControl'
import { contentSecurityPolicyForResponse } from './security/contentSecurityPolicy'
import { RemoteRequestPolicy } from './security/urlPolicy'
import { resolveRendererFile } from './security/rendererProtocol'
import { rendererContentType } from './security/rendererContentType'
import { LocalAudioLibrary } from './storage/localAudioLibrary'
import { DesktopRepositories } from './storage/repositories'
import { WindowStateManager } from './window/windowState'

const APP_ORIGIN = 'app://turtleback'
const APP_ENTRY = `${APP_ORIGIN}/index.html`
const SHUTDOWN_TIMEOUT_MS = 3_000
const UNRESPONSIVE_RECOVERY_MS = 12_000

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'turtleback-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  void startApplication()
}

async function startApplication(): Promise<void> {
  await app.whenReady()

  const userDataDirectory = app.getPath('userData')
  const logDirectory = join(userDataDirectory, 'logs')
  const logger = new AppLogger(join(logDirectory, 'turtleback.log'))
  const repositories = new DesktopRepositories(userDataDirectory, logger)
  const localAudio = new LocalAudioLibrary(join(userDataDirectory, 'local-audio.json'), logger)
  const windowState = new WindowStateManager(userDataDirectory, logger)
  const requestPolicy = new RemoteRequestPolicy()
  const developmentUrl = developmentRendererUrl()
  const rendererBaseUrl = developmentUrl ?? APP_ENTRY
  const rendererDirectory = resolve(__dirname, '..', '..', 'dist')
  const recoveryPolicy = new RendererRecoveryPolicy()

  await installProtocols(rendererDirectory, localAudio, logger)
  installSessionSecurity(session.defaultSession, requestPolicy, logger, developmentUrl)

  let mainWindow: BrowserWindow | null = null
  let removeIpcHandlers: (() => void) | null = null
  let quitStarted = false
  let quitAllowed = false
  let shutdownTimer: ReturnType<typeof setTimeout> | null = null
  let unresponsiveTimer: ReturnType<typeof setTimeout> | null = null
  let recoveryInFlight = false

  const clearUnresponsiveTimer = () => {
    if (unresponsiveTimer) clearTimeout(unresponsiveTimer)
    unresponsiveTimer = null
  }

  const finishQuit = () => {
    if (quitAllowed) return
    quitAllowed = true
    if (shutdownTimer) clearTimeout(shutdownTimer)
    clearUnresponsiveTimer()
    shutdownTimer = null
    removeIpcHandlers?.()
    removeIpcHandlers = null
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
    mainWindow = null
    app.quit()
  }

  const beginQuit = () => {
    if (quitStarted) return
    quitStarted = true
    logger.info('lifecycle.shutdown_requested')
    if (!mainWindow || mainWindow.isDestroyed()) {
      finishQuit()
      return
    }
    try {
      mainWindow.webContents.send(IPC_CHANNELS.prepareShutdown)
    } catch (error) {
      logger.warn('lifecycle.shutdown_renderer_unavailable', { error: String(error) })
      finishQuit()
      return
    }
    shutdownTimer = setTimeout(() => {
      logger.warn('lifecycle.shutdown_timeout', { timeoutMs: SHUTDOWN_TIMEOUT_MS })
      finishQuit()
    }, SHUTDOWN_TIMEOUT_MS)
  }

  const loadRenderer = async (window: BrowserWindow, url = rendererBaseUrl): Promise<void> => {
    await window.loadURL(url)
    logger.info('renderer.load_complete', {
      origin: developmentUrl ? new URL(developmentUrl).origin : APP_ORIGIN,
      recovery: new URL(url).searchParams.get('recovery') ?? undefined,
    })
  }

  const recoverRenderer = async (window: BrowserWindow, reason: string): Promise<void> => {
    if (
      quitStarted ||
      recoveryInFlight ||
      window.isDestroyed() ||
      window.webContents.isDestroyed()
    ) {
      return
    }
    recoveryInFlight = true
    clearUnresponsiveTimer()
    const decision = recoveryPolicy.next()
    logger.warn('lifecycle.renderer_recovery_started', {
      reason,
      mode: decision.mode,
      attempt: decision.attempt,
    })
    try {
      await loadRenderer(
        window,
        rendererRecoveryUrl(rendererBaseUrl, reason, decision.mode === 'safe-mode'),
      )
      logger.info('lifecycle.renderer_recovery_complete', {
        reason,
        mode: decision.mode,
        attempt: decision.attempt,
      })
    } catch (error) {
      logger.error('lifecycle.renderer_recovery_failed', { reason, error: String(error) })
    } finally {
      recoveryInFlight = false
    }
  }

  const createMainWindow = async (): Promise<BrowserWindow> => {
    const restored = await windowState.restore()
    const window = new BrowserWindow({
      title: 'Turtleback Sanctuary',
      x: restored.x,
      y: restored.y,
      width: restored.width,
      height: restored.height,
      minWidth: 960,
      minHeight: 540,
      show: false,
      backgroundColor: '#07171b',
      autoHideMenuBar: process.platform !== 'darwin',
      webPreferences: {
        preload: resolve(__dirname, '..', 'preload', 'index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        spellcheck: false,
        backgroundThrottling: false,
      },
    })

    hardenWindow(window, developmentUrl, logger)
    installWindowDiagnostics(window, logger, {
      isQuitting: () => quitStarted,
      onRecoveryRequested: (reason) => void recoverRenderer(window, reason),
      onUnresponsive: () => {
        clearUnresponsiveTimer()
        unresponsiveTimer = setTimeout(() => {
          logger.warn('process.renderer_unresponsive_timeout', {
            timeoutMs: UNRESPONSIVE_RECOVERY_MS,
          })
          void recoverRenderer(window, 'renderer-unresponsive')
        }, UNRESPONSIVE_RECOVERY_MS)
      },
      onResponsive: clearUnresponsiveTimer,
    })
    windowState.attach(window)
    if (restored.maximized) window.maximize()

    removeIpcHandlers = registerIpcHandlers({
      window,
      repositories,
      localAudio,
      requestPolicy,
      logger,
      loggerDirectory: logDirectory,
      appVersion: app.getVersion(),
      onShutdownReady: () => {
        logger.info('lifecycle.renderer_shutdown_ready')
        finishQuit()
      },
      onReloadRequested: () => {
        recoveryPolicy.reset()
        logger.info('lifecycle.renderer_reload_requested')
        setTimeout(() => void loadRenderer(window), 0)
      },
    })

    window.once('ready-to-show', () => window.show())
    window.on('close', (event) => {
      if (quitAllowed) return
      event.preventDefault()
      app.quit()
    })
    window.on('closed', () => {
      if (mainWindow === window) mainWindow = null
    })

    try {
      await loadRenderer(window)
    } catch (error) {
      logger.error('renderer.load_failed', { error: String(error) })
      throw error
    }
    return window
  }

  const sendLifecycleEvent = (event: DesktopLifecycleEvent) => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return
    try {
      mainWindow.webContents.send(IPC_CHANNELS.lifecycleEvent, event)
    } catch (error) {
      logger.warn('lifecycle.renderer_event_unavailable', {
        type: event.type,
        error: String(error),
      })
    }
  }

  app.on('before-quit', (event) => {
    if (quitAllowed) return
    event.preventDefault()
    beginQuit()
  })

  app.on('second-instance', () => {
    logger.info('lifecycle.second_instance')
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.on('activate', () => {
    logger.info('lifecycle.activate')
    if (mainWindow || quitStarted) return
    void createMainWindow()
      .then((window) => {
        mainWindow = window
      })
      .catch((error) => {
        logger.error('window.create_failed', { error: String(error) })
        app.quit()
      })
  })

  app.on('child-process-gone', (_event, details) => {
    logger.error('process.child_gone', {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode,
      serviceName: details.serviceName,
    })
    if (details.type.toLowerCase() === 'gpu' && mainWindow && !mainWindow.isDestroyed()) {
      const window = mainWindow
      setTimeout(() => void recoverRenderer(window, `gpu-${details.reason}`), 250)
    }
  })

  powerMonitor.on('suspend', () => {
    logger.info('lifecycle.system_suspend')
    sendLifecycleEvent({ type: 'suspend' })
  })
  powerMonitor.on('resume', () => {
    logger.info('lifecycle.system_resume')
    sendLifecycleEvent({ type: 'resume' })
  })

  process.on('uncaughtException', (error) => {
    logger.error('process.uncaught_exception', { message: error.message, stack: error.stack })
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', { reason: String(reason) })
  })

  if (process.platform === 'win32') app.setAppUserModelId('com.turtleback.sanctuary')
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)

  try {
    mainWindow = await createMainWindow()
    logger.info('application.ready', {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      packaged: app.isPackaged,
    })
  } catch (error) {
    logger.error('application.start_failed', { error: String(error) })
    app.quit()
  }
}

async function installProtocols(
  rendererDirectory: string,
  localAudio: LocalAudioLibrary,
  logger: AppLogger,
): Promise<void> {
  await protocol.handle('app', async (request) => {
    const file = resolveRendererFile(request.url, rendererDirectory)
    if (!file) {
      logger.warn('protocol.app_rejected', { url: request.url })
      return new Response('Not found', { status: 404 })
    }
    try {
      const body = new Uint8Array(await readFile(file))
      return new Response(body, {
        headers: {
          'Content-Type': rendererContentType(file),
          'Cache-Control': rendererCacheControl(file, app.isPackaged),
        },
      })
    } catch (error) {
      logger.warn('protocol.app_read_failed', { file, error: String(error) })
      return new Response('Not found', { status: 404 })
    }
  })
  await protocol.handle('turtleback-media', (request) => localAudio.handleProtocol(request))
}

function installSessionSecurity(
  targetSession: Session,
  requestPolicy: RemoteRequestPolicy,
  logger: AppLogger,
  developmentUrl: string | null,
): void {
  const developmentOrigin = developmentUrl ? new URL(developmentUrl).origin : undefined

  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  )
  targetSession.setPermissionCheckHandler(() => false)

  targetSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = requestPolicy.isAllowed(details.url, developmentOrigin)
    if (!allowed) {
      logger.warn('network.request_blocked', {
        resourceType: details.resourceType,
        url: redactUrl(details.url),
      })
    }
    callback({ cancel: !allowed })
  })

  targetSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = contentSecurityPolicyForResponse({
      url: details.url,
      resourceType: details.resourceType,
      appOrigin: APP_ORIGIN,
      ...(developmentOrigin ? { developmentOrigin } : {}),
    })
    if (!csp) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })
}

function hardenWindow(
  window: BrowserWindow,
  developmentUrl: string | null,
  logger: AppLogger,
): void {
  const allowedDocumentOrigin = developmentUrl ? new URL(developmentUrl).origin : APP_ORIGIN
  window.webContents.setWindowOpenHandler(({ url }) => {
    logger.warn('navigation.popup_blocked', { url: redactUrl(url) })
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${allowedDocumentOrigin}/`)) return
    event.preventDefault()
    logger.warn('navigation.blocked', { url: redactUrl(url) })
  })
  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
    logger.warn('navigation.webview_blocked')
  })
}

interface WindowDiagnosticsOptions {
  isQuitting: () => boolean
  onRecoveryRequested: (reason: string) => void
  onUnresponsive: () => void
  onResponsive: () => void
}

function installWindowDiagnostics(
  window: BrowserWindow,
  logger: AppLogger,
  options: WindowDiagnosticsOptions,
): void {
  window.webContents.on('render-process-gone', (_event, details) => {
    logger.error('process.renderer_gone', {
      reason: details.reason,
      exitCode: details.exitCode,
    })
    if (options.isQuitting() || details.reason === 'clean-exit') return
    setTimeout(() => options.onRecoveryRequested(`renderer-${details.reason}`), 250)
  })
  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      logger.error('renderer.load_failed', {
        errorCode,
        errorDescription,
        url: redactUrl(validatedURL),
        isMainFrame,
      })
      if (!isMainFrame || errorCode === -3 || options.isQuitting()) return
      setTimeout(() => options.onRecoveryRequested(`load-failed-${errorCode}`), 250)
    },
  )
  window.webContents.on('unresponsive', () => {
    logger.warn('process.renderer_unresponsive')
    options.onUnresponsive()
  })
  window.webContents.on('responsive', () => {
    logger.info('process.renderer_responsive')
    options.onResponsive()
  })
}

function developmentRendererUrl(): string | null {
  if (app.isPackaged) return null
  const raw = process.argv
    .find((arg) => arg.startsWith('--dev-server-url='))
    ?.slice('--dev-server-url='.length)
  if (!raw) return null
  try {
    const url = new URL(raw)
    const localHost = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
    if (url.protocol !== 'http:' || !localHost || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function redactUrl(input: string): string {
  try {
    const url = new URL(input)
    return `${url.protocol}//${url.host}${url.pathname}`.slice(0, 500)
  } catch {
    return input.slice(0, 500)
  }
}
