import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir, arch, cpus, platform, release, totalmem } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { performance } from 'node:perf_hooks'
import { _electron as electron } from '@playwright/test'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const measurementSeconds = parseMeasurementSeconds(process.argv)
const profile = await mkdtemp(join(tmpdir(), 'turtleback-desktop-smoke-'))
const executablePath = await findPackagedExecutable()
const requiredPipelineResources = [
  { path: 'assets/system/pipeline-smoke.glb', contentType: 'model/gltf-binary' },
  { path: 'assets/system/pipeline-smoke.ktx2', contentType: 'image/ktx2' },
  { path: 'assets/decoders/basis/basis_transcoder.js', contentType: 'text/javascript' },
  { path: 'assets/decoders/basis/basis_transcoder.wasm', contentType: 'application/wasm' },
  {
    path: 'assets/decoders/basis/turtleback-basis-worker.js',
    contentType: 'text/javascript',
    isolatedWorkerPolicy: true,
  },
]
const report = {
  schemaVersion: 2,
  measuredAt: new Date().toISOString(),
  sourceCommit: await currentCommit(),
  artifact: artifactLabel(executablePath),
  offlineMode: 'Chromium host resolver maps all DNS names to NOTFOUND',
  host: {
    platform: platform(),
    architecture: arch(),
    release: release(),
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
  },
  firstLaunch: {},
  relaunch: {},
  frameSample: null,
  processMetrics: {},
}

try {
  const first = await launchPackagedApp('first-launch')
  try {
    report.firstLaunch = await verifyProductionWindow(first, true)
    report.processMetrics.title = await collectProcessMetrics(first.application)

    const controllableStarted = performance.now()
    await first.page.getByRole('button', { name: 'Enter Sanctuary' }).click()
    await first.page.locator('.hud').waitFor({ state: 'visible', timeout: 20_000 })
    report.firstLaunch.controllableFrameMs = round(performance.now() - first.startedAt)
    report.firstLaunch.enterTransitionMs = round(performance.now() - controllableStarted)

    await first.page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', key: 'm' }))
    })
    await first.page.getByRole('dialog', { name: 'Sanctuary' }).waitFor({ state: 'visible' })
    await first.page.getByRole('tab', { name: 'Graphics', exact: true }).click()
    await first.page.getByRole('slider', { name: 'Field of view' }).fill('83')
    await first.page.getByRole('radio', { name: 'High', exact: true }).click()
    assert(
      (await first.page.getByRole('slider', { name: 'Field of view' }).inputValue()) === '83',
      'FOV control did not accept the smoke value',
    )
    await first.page.waitForTimeout(400)
    assertNoRendererErrors(first)
    await closeCleanly(first)
    const diskSettings = JSON.parse(await readFile(join(profile, 'settings.json'), 'utf8'))
    assert(
      diskSettings.graphics.fov === 83,
      `clean shutdown wrote unexpected FOV ${String(diskSettings.graphics.fov)}`,
    )
  } finally {
    await ensureClosed(first)
  }

  const second = await launchPackagedApp('relaunch')
  try {
    report.relaunch = await verifyProductionWindow(second, false)
    const persisted = await second.page.evaluate(async () => ({
      settings: await window.desktopApp.getSettings(),
      media: await window.desktopApp.getMedia(),
      saves: await window.desktopApp.listSaveSlots(),
      platform: await window.desktopApp.getPlatformInfo(),
      appVersion: await window.desktopApp.getAppVersion(),
    }))
    assert(
      persisted.settings?.graphics.fov === 83,
      `FOV did not survive a full app relaunch (received ${String(persisted.settings?.graphics.fov)})`,
    )
    assert(persisted.settings?.graphics.quality === 'high', 'High quality did not survive relaunch')
    assert(persisted.media !== null, 'media repository was not seeded')
    assert(
      persisted.saves.some((entry) => entry.slot === 'autosave'),
      'coordinated shutdown did not create an autosave',
    )
    report.relaunch.platform = persisted.platform
    report.relaunch.appVersion = persisted.appVersion
    report.relaunch.persistedFov = persisted.settings.graphics.fov
    report.relaunch.mediaRepositoryAvailable = true
    report.relaunch.saveSlots = persisted.saves.map((entry) => entry.slot)

    await second.page.getByRole('button', { name: 'Enter Sanctuary' }).click()
    await second.page.locator('.hud').waitFor({ state: 'visible', timeout: 20_000 })
    report.relaunch.secondInstance = await verifySecondInstance(second)
    report.relaunch.powerCycle = await verifyPowerCycle(second)
    await second.page.waitForTimeout(measurementSeconds > 0 ? 5_000 : 750)
    report.processMetrics.gameplayStart = await collectProcessMetrics(second.application)
    if (measurementSeconds > 0) {
      report.frameSample = await sampleFrames(second.page, measurementSeconds)
      report.processMetrics.gameplayEnd = await collectProcessMetrics(second.application)
    }
    assertNoRendererErrors(second)
    await closeCleanly(second)
    report.relaunch.lifecycleLogEvents = await waitForLifecycleLogEvents([
      'lifecycle.second_instance',
      'lifecycle.system_suspend',
      'lifecycle.system_resume',
    ])
  } finally {
    await ensureClosed(second)
  }

  console.info(JSON.stringify(report, null, 2))
} finally {
  await rm(profile, { recursive: true, force: true })
}

async function launchPackagedApp(label) {
  const startedAt = performance.now()
  const errors = []
  const application = await electron.launch({
    executablePath,
    args: [
      `--user-data-dir=${profile}`,
      '--host-resolver-rules=MAP * ~NOTFOUND',
      '--disable-background-networking',
    ],
    env: { ...process.env, NODE_ENV: 'production' },
  })
  const attachedMs = round(performance.now() - startedAt)
  const page = await application.firstWindow({ timeout: 20_000 })
  const windowCreatedMs = round(performance.now() - startedAt)
  page.on('pageerror', (error) => errors.push(`${label} pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`)
  })
  return { application, page, errors, startedAt, attachedMs, windowCreatedMs, closed: false }
}

async function verifyProductionWindow(run, cleanProfile) {
  try {
    await run.page.getByRole('button', { name: 'Enter Sanctuary' }).waitFor({
      state: 'visible',
      timeout: 20_000,
    })
  } catch (error) {
    const body = await run.page
      .locator('body')
      .innerText()
      .catch(() => '<body unavailable>')
    const details = [
      `Packaged title readiness timed out: ${error instanceof Error ? error.message : String(error)}`,
      ...run.errors,
      `Visible renderer text: ${body.slice(0, 2_000)}`,
    ]
    throw new Error(details.join('\n'), { cause: error })
  }
  const titleReadyMs = round(performance.now() - run.startedAt)
  const state = await run.page.evaluate(async (requiredResources) => {
    const paint = performance.getEntriesByType('paint')
    const navigation = performance.getEntriesByType('navigation')[0]
    const canvas = document.querySelector('canvas')
    const assetResources = await Promise.all(
      requiredResources.map(async ({ path }) => {
        const response = await fetch(new URL(path, document.baseURI))
        await response.arrayBuffer()
        return {
          path,
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
          contentSecurityPolicy: response.headers.get('content-security-policy') ?? '',
        }
      }),
    )
    return {
      url: window.location.href,
      protocol: window.location.protocol,
      bridgeAvailable: typeof window.desktopApp === 'object',
      requireType: typeof window.require,
      processType: typeof window.process,
      canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0),
      firstContentfulPaintMs:
        paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio },
      javascriptEvalBlocked: (() => {
        try {
          new Function('return 1')()
          return false
        } catch (error) {
          return error instanceof EvalError
        }
      })(),
      assetPipeline: {
        authoredReady:
          performance.getEntriesByName('turtleback:asset-pipeline-authored').length === 1,
        fallbackUsed: performance.getEntriesByName('turtleback:asset-pipeline-fallback').length > 0,
        resources: assetResources,
      },
    }
  }, requiredPipelineResources)
  assert(state.protocol === 'app:', `expected app: production origin, received ${state.url}`)
  assert(state.bridgeAvailable, 'preload bridge is unavailable')
  assert(state.requireType === 'undefined', 'renderer unexpectedly exposes require')
  assert(state.processType === 'undefined', 'renderer unexpectedly exposes process')
  assert(state.javascriptEvalBlocked, 'renderer document unexpectedly permits JavaScript eval')
  assert(state.canvasVisible, 'Rapier/Three canvas is not visible at title readiness')
  assert(state.assetPipeline.authoredReady, 'authored GLB/KTX2 pipeline did not decode')
  assert(!state.assetPipeline.fallbackUsed, 'pipeline smoke unexpectedly used a fallback')
  for (const required of requiredPipelineResources) {
    const resource = state.assetPipeline.resources.find(({ path }) => path === required.path)
    assert(resource, `missing pipeline resource response for ${required.path}`)
    assert(resource.status === 200, `${required.path} returned HTTP ${resource.status}`)
    assert(
      resource.contentType.includes(required.contentType),
      `${required.path} returned unexpected content type ${resource.contentType}`,
    )
    if (required.isolatedWorkerPolicy) {
      assert(
        resource.contentSecurityPolicy.includes("script-src blob: 'unsafe-eval'"),
        `${required.path} is missing its isolated generated-code policy`,
      )
    } else {
      assert(
        !resource.contentSecurityPolicy.includes("'unsafe-eval'"),
        `${required.path} unexpectedly received a JavaScript eval allowance`,
      )
    }
  }
  if (cleanProfile) assert(!state.url.includes('recovery='), 'clean launch entered recovery mode')
  assertNoRendererErrors(run)
  return {
    electronAttachedMs: run.attachedMs,
    windowCreatedMs: run.windowCreatedMs,
    titleAndRapierReadyMs: titleReadyMs,
    ...state,
  }
}

async function closeCleanly(run) {
  const closed = run.application.waitForEvent('close', { timeout: 10_000 })
  await run.page.evaluate(() => window.desktopApp.windowCommand('close'))
  await closed
  run.closed = true
}

async function ensureClosed(run) {
  if (run.closed) return
  await run.application.close().catch(() => undefined)
  run.closed = true
}

async function collectProcessMetrics(application) {
  return application.evaluate(({ app }) =>
    app.getAppMetrics().map((metric) => ({
      type: metric.type,
      cpuPercent: metric.cpu.percentCPUUsage,
      workingSetKb: metric.memory.workingSetSize,
      peakWorkingSetKb: metric.memory.peakWorkingSetSize,
      privateBytesKb: metric.memory.privateBytes,
    })),
  )
}

async function verifySecondInstance(run) {
  const startedAt = performance.now()
  await execFileAsync(
    executablePath,
    [
      `--user-data-dir=${profile}`,
      '--host-resolver-rules=MAP * ~NOTFOUND',
      '--disable-background-networking',
    ],
    { env: { ...process.env, NODE_ENV: 'production' }, timeout: 10_000 },
  )
  await run.page.locator('.hud').waitFor({ state: 'visible' })
  return {
    duplicateExitedMs: round(performance.now() - startedAt),
    primaryRemainedResponsive: true,
  }
}

async function verifyPowerCycle(run) {
  const startedAt = performance.now()
  await run.application.evaluate(({ powerMonitor }) => powerMonitor.emit('suspend'))
  await run.page.waitForTimeout(250)
  await run.application.evaluate(({ powerMonitor }) => powerMonitor.emit('resume'))
  await run.page.waitForTimeout(250)
  await run.page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', key: 'm' }))
  })
  await run.page.getByRole('dialog', { name: 'Sanctuary' }).waitFor({ state: 'visible' })
  await run.page.getByRole('button', { name: 'Close menu' }).click()
  await run.page.locator('.hud').waitFor({ state: 'visible' })
  return { elapsedMs: round(performance.now() - startedAt), rendererRemainedResponsive: true }
}

async function waitForLifecycleLogEvents(expectedEvents) {
  const logFile = join(profile, 'logs', 'turtleback.log')
  const deadline = performance.now() + 5_000
  while (performance.now() < deadline) {
    try {
      const entries = (await readFile(logFile, 'utf8'))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
      const seen = new Set(entries.map((entry) => entry.event))
      if (expectedEvents.every((event) => seen.has(event))) return expectedEvents
    } catch {
      // The logger writes asynchronously; retry until the deadline.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  throw new Error(`missing lifecycle log events: ${expectedEvents.join(', ')}`)
}

async function sampleFrames(page, seconds) {
  return page.evaluate(
    (durationMs) =>
      new Promise((resolveSample) => {
        const deltas = []
        const startedAt = performance.now()
        let previous = startedAt
        const tick = (now) => {
          if (now !== previous) deltas.push(now - previous)
          previous = now
          if (now - startedAt < durationMs) {
            requestAnimationFrame(tick)
            return
          }
          const sorted = [...deltas].sort((a, b) => a - b)
          const percentile = (p) =>
            sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
          const elapsedMs = now - startedAt
          resolveSample({
            durationMs,
            elapsedMs,
            frameCount: deltas.length,
            averageFps: (deltas.length * 1000) / elapsedMs,
            medianFrameMs: percentile(0.5),
            p95FrameMs: percentile(0.95),
            p99FrameMs: percentile(0.99),
            maxFrameMs: sorted.at(-1),
            framesOver25Ms: deltas.filter((delta) => delta > 25).length,
            framesOver50Ms: deltas.filter((delta) => delta > 50).length,
          })
        }
        requestAnimationFrame(tick)
      }),
    seconds * 1_000,
  )
}

function assertNoRendererErrors(run) {
  assert(run.errors.length === 0, run.errors.join('\n'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function round(value) {
  return Math.round(value * 10) / 10
}

function parseMeasurementSeconds(args) {
  const raw = args.find((arg) => arg.startsWith('--measure-seconds='))?.split('=')[1]
  if (raw === undefined) return 0
  const seconds = Number(raw)
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 600) {
    throw new Error('--measure-seconds must be between 1 and 600')
  }
  return seconds
}

async function findPackagedExecutable() {
  const explicit = process.argv
    .find((argument) => argument.startsWith('--executable='))
    ?.slice('--executable='.length)
  if (explicit) {
    const absolute = resolve(root, explicit)
    await access(absolute)
    return absolute
  }
  const candidates =
    platform() === 'darwin'
      ? [
          'release/mac-arm64/Turtleback Sanctuary.app/Contents/MacOS/Turtleback Sanctuary',
          'release/mac/Turtleback Sanctuary.app/Contents/MacOS/Turtleback Sanctuary',
        ]
      : platform() === 'win32'
        ? ['release/win-unpacked/Turtleback Sanctuary.exe']
        : ['release/linux-unpacked/turtleback-sanctuary']
  for (const candidate of candidates) {
    const absolute = resolve(root, candidate)
    try {
      await access(absolute)
      return absolute
    } catch {
      // Try the next Electron Builder platform/architecture directory.
    }
  }
  throw new Error('No unpacked desktop artifact found. Run pnpm desktop:package first.')
}

async function currentCommit() {
  try {
    return (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim()
  } catch {
    return 'unknown'
  }
}

function artifactLabel(file) {
  return file.startsWith(`${root}${sep}`) ? file.slice(root.length + 1) : file
}
