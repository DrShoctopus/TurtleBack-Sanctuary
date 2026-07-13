import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { app, BrowserWindow, Menu, protocol, session, type Session } from 'electron'
import { IPC_CHANNELS } from '../shared/contracts'
import { registerIpcHandlers } from './ipc/registerIpc'
import { AppLogger } from './logging/logger'
import { RemoteRequestPolicy } from './security/urlPolicy'
import { resolveRendererFile } from './security/rendererProtocol'
import { LocalAudioLibrary } from './storage/localAudioLibrary'
import { DesktopRepositories } from './storage/repositories'
import { WindowStateManager } from './window/windowState'

const APP_ORIGIN = 'app://turtleback'
const APP_ENTRY = `${APP_ORIGIN}/index.html`
const SHUTDOWN_TIMEOUT_MS = 1_500

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
  const rendererDirectory = resolve(__dirname, '..', '..', 'dist')

  await installProtocols(rendererDirectory, localAudio, logger)
  installSessionSecurity(session.defaultSession, requestPolicy, logger, developmentUrl)

  let mainWindow: BrowserWindow | null = null
  let removeIpcHandlers: (() => void) | null = null
  let quitStarted = false
  let quitAllowed = false
  let shutdownTimer: ReturnType<typeof setTimeout> | null = null

  const finishQuit = () => {
    if (quitAllowed) return
    quitAllowed = true
    if (shutdownTimer) clearTimeout(shutdownTimer)
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
    mainWindow.webContents.send(IPC_CHANNELS.prepareShutdown)
    shutdownTimer = setTimeout(() => {
      logger.warn('lifecycle.shutdown_timeout', { timeoutMs: SHUTDOWN_TIMEOUT_MS })
      finishQuit()
    }, SHUTDOWN_TIMEOUT_MS)
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
      await window.loadURL(developmentUrl ?? APP_ENTRY)
      logger.info('renderer.load_complete', {
        origin: developmentUrl ? new URL(developmentUrl).origin : APP_ORIGIN,
      })
    } catch (error) {
      logger.error('renderer.load_failed', { error: String(error) })
      throw error
    }
    return window
  }

  app.on('before-quit', (event) => {
    if (quitAllowed) return
    event.preventDefault()
    beginQuit()
  })

  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.on('activate', () => {
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
          'Cache-Control': rendererCacheControl(file),
        },
      })
    } catch (error) {
      logger.warn('protocol.app_read_failed', { file, error: String(error) })
      return new Response('Not found', { status: 404 })
    }
  })
  await protocol.handle('turtleback-media', (request) => localAudio.handleProtocol(request))
}

function rendererCacheControl(file: string): string {
  if (!app.isPackaged) return 'no-store'
  return extname(file).toLowerCase() === '.html'
    ? 'no-cache'
    : 'public, max-age=31536000, immutable'
}

function rendererContentType(file: string): string {
  switch (extname(file).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.wasm':
      return 'application/wasm'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

function installSessionSecurity(
  targetSession: Session,
  requestPolicy: RemoteRequestPolicy,
  logger: AppLogger,
  developmentUrl: string | null,
): void {
  const developmentOrigin = developmentUrl ? new URL(developmentUrl).origin : undefined
  const scriptPolicy = developmentUrl
    ? "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'wasm-unsafe-eval'"
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    scriptPolicy,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: turtleback-media: https:",
    "connect-src 'self' https: wss: ws:",
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
    "worker-src 'self' blob:",
  ].join('; ')

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
    const isRendererDocument =
      details.resourceType === 'mainFrame' &&
      (details.url.startsWith(`${APP_ORIGIN}/`) ||
        (developmentOrigin !== undefined && details.url.startsWith(`${developmentOrigin}/`)))
    if (!isRendererDocument) {
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
  window.webContents.on('render-process-gone', (_event, details) => {
    logger.error('process.renderer_gone', {
      reason: details.reason,
      exitCode: details.exitCode,
    })
  })
  window.webContents.on('unresponsive', () => logger.warn('process.renderer_unresponsive'))
  window.webContents.on('responsive', () => logger.info('process.renderer_responsive'))
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
