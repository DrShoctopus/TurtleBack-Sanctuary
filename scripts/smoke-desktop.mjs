import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir, arch, cpus, platform, release, totalmem } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { performance } from 'node:perf_hooks'
import { _electron as electron } from '@playwright/test'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const measurementSeconds = parseMeasurementSeconds(process.argv)
const outputPath = parseOutputPath(process.argv)
const profile = await mkdtemp(join(tmpdir(), 'turtleback-desktop-smoke-'))
const executablePath = await findPackagedExecutable()
const authoredPipelineMark = 'turtleback:asset-pipeline-authored'
const fallbackPipelineMark = 'turtleback:asset-pipeline-fallback'
const requiredPipelineResources = [
  {
    id: 'model.pipeline-smoke',
    path: 'assets/system/pipeline-smoke.glb',
    contentType: 'model/gltf-binary',
  },
  {
    id: 'texture.pipeline-smoke',
    path: 'assets/system/pipeline-smoke.ktx2',
    contentType: 'image/ktx2',
  },
  {
    id: 'basis.transcoder-source',
    path: 'assets/decoders/basis/basis_transcoder.js',
    contentType: 'text/javascript',
  },
  {
    id: 'basis.transcoder-wasm',
    path: 'assets/decoders/basis/basis_transcoder.wasm',
    contentType: 'application/wasm',
  },
  {
    id: 'basis.transcoder-worker',
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
    report.firstLaunch.shutdown = await closeCleanly(first)
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
    report.relaunch.shutdown = await closeCleanly(second, [
      'lifecycle.second_instance',
      'lifecycle.system_suspend',
      'lifecycle.system_resume',
    ])
    report.relaunch.lifecycleLogEvents = report.relaunch.shutdown.lifecycleLogEvents
  } finally {
    await ensureClosed(second)
  }

  if (outputPath) await writeReport(outputPath, report)
  console.info(JSON.stringify(report, null, 2))
} finally {
  await rm(profile, { recursive: true, force: true })
}

async function launchPackagedApp(label) {
  const startedAt = performance.now()
  const errors = []
  const pipelineResponses = []
  const logStartIndex = (await readLifecycleLogEntries()).length
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
  page.on('response', (response) => {
    const required = requiredPipelineResources.find(({ path }) =>
      response.url().endsWith(`/${path}`),
    )
    if (!required) return
    pipelineResponses.push({
      id: required.id,
      path: required.path,
      url: response.url(),
      status: response.status(),
      contentType: response.headers()['content-type'] ?? '',
      observedAtMs: round(performance.now() - startedAt),
    })
  })
  page.on('requestfailed', (request) => {
    const required = requiredPipelineResources.find(({ path }) =>
      request.url().endsWith(`/${path}`),
    )
    if (!required) return
    errors.push(
      `${label} runtime request failed for ${required.id}: ` +
        `${request.failure()?.errorText ?? 'unknown network failure'}`,
    )
  })
  page.on('pageerror', (error) => errors.push(`${label} pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`)
  })
  return {
    application,
    page,
    errors,
    startedAt,
    attachedMs,
    windowCreatedMs,
    logStartIndex,
    pipelineResponses,
    closed: false,
  }
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
  const state = await run.page.evaluate(
    async (pipelineContract) => {
      const paint = performance.getEntriesByType('paint')
      const navigation = performance.getEntriesByType('navigation')[0]
      const canvas = document.querySelector('canvas')
      const assetResources = await Promise.all(
        pipelineContract.resources.map(async ({ id, path }) => {
          const expectedUrl = new URL(path, document.baseURI).href
          const response = await fetch(expectedUrl)
          const body = await response.arrayBuffer()
          return {
            id,
            path,
            expectedUrl,
            responseUrl: response.url,
            status: response.status,
            ok: response.ok,
            encodedBytes: body.byteLength,
            contentType: response.headers.get('content-type') ?? '',
            contentSecurityPolicy: response.headers.get('content-security-policy') ?? '',
          }
        }),
      )
      const authoredMarks = performance.getEntriesByName(pipelineContract.authoredMark)
      const fallbackMarks = performance.getEntriesByName(pipelineContract.fallbackMark)
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
          authoredReady: authoredMarks.length === 1,
          authoredReadyMark: {
            name: pipelineContract.authoredMark,
            count: authoredMarks.length,
            startTimeMs: authoredMarks[0]?.startTime ?? null,
          },
          fallbackUsed: fallbackMarks.length > 0,
          fallbackMarkCount: fallbackMarks.length,
          runtimeResponses: pipelineContract.runtimeResponses,
          resources: assetResources,
        },
      }
    },
    {
      resources: requiredPipelineResources,
      authoredMark: authoredPipelineMark,
      fallbackMark: fallbackPipelineMark,
      // Snapshot before the direct fetch probes below can trigger response
      // events, so only requests made by the application pipeline count.
      runtimeResponses: [...run.pipelineResponses],
    },
  )
  assert(state.protocol === 'app:', `expected app: production origin, received ${state.url}`)
  assert(state.bridgeAvailable, 'preload bridge is unavailable')
  assert(state.requireType === 'undefined', 'renderer unexpectedly exposes require')
  assert(state.processType === 'undefined', 'renderer unexpectedly exposes process')
  assert(state.javascriptEvalBlocked, 'renderer document unexpectedly permits JavaScript eval')
  assert(state.canvasVisible, 'Rapier/Three canvas is not visible at title readiness')
  assert(
    state.assetPipeline.authoredReady,
    `${authoredPipelineMark} must be emitted exactly once after both authored assets decode; ` +
      `observed ${state.assetPipeline.authoredReadyMark.count}`,
  )
  assert(
    !state.assetPipeline.fallbackUsed,
    `authored pipeline used a fallback (${fallbackPipelineMark} count ` +
      `${state.assetPipeline.fallbackMarkCount})`,
  )
  for (const required of requiredPipelineResources) {
    const resource = state.assetPipeline.resources.find(({ path }) => path === required.path)
    assert(resource, `missing direct app: protocol response evidence for ${required.id}`)
    assert(
      resource.expectedUrl.startsWith('app://turtleback/'),
      `${required.id} resolved outside the packaged app origin: ${resource.expectedUrl}`,
    )
    assert(
      resource.responseUrl === resource.expectedUrl,
      `${required.id} response URL mismatch: expected ${resource.expectedUrl}, received ` +
        `${resource.responseUrl || '<empty>'}`,
    )
    assert(
      resource.ok && resource.status === 200,
      `${required.id} (${resource.expectedUrl}) returned HTTP ${resource.status}`,
    )
    assert(
      resource.encodedBytes > 0,
      `${required.id} (${resource.expectedUrl}) returned an empty response body`,
    )
    assert(
      resource.contentType.includes(required.contentType),
      `${required.id} (${resource.expectedUrl}) returned MIME ` +
        `${resource.contentType || '<missing>'}; expected ${required.contentType}`,
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
    const runtimeResource = state.assetPipeline.runtimeResponses.find(
      ({ url }) => url === resource.expectedUrl,
    )
    assert(
      runtimeResource,
      `${required.id} has a valid direct app: response but no pre-probe application request. ` +
        `Observed pipeline resources: ${
          state.assetPipeline.runtimeResponses.map(({ url }) => url).join(', ') || '<none>'
        }`,
    )
    assert(
      runtimeResource.status === 200,
      `${required.id} application request returned HTTP ${runtimeResource.status}`,
    )
    assert(
      runtimeResource.contentType.includes(required.contentType),
      `${required.id} application request returned MIME ` +
        `${runtimeResource.contentType || '<missing>'}; expected ${required.contentType}`,
    )
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

async function closeCleanly(run, expectedLifecycleEvents = []) {
  const startedAt = performance.now()
  const closed = run.application.waitForEvent('close', { timeout: 10_000 })
  try {
    await run.page.evaluate(() => window.desktopApp.windowCommand('close'))
    await closed
    run.closed = true
  } catch (error) {
    const entries = (await readLifecycleLogEntries()).slice(run.logStartIndex)
    throw new Error(
      [
        `coordinated desktop shutdown did not close within its gate: ${error instanceof Error ? error.message : String(error)}`,
        ...run.errors,
        `Lifecycle events observed for this launch: ${entries.map(({ event }) => event).join(', ') || '<none>'}`,
      ].join('\n'),
      { cause: error },
    )
  }

  assertNoRendererErrors(run)
  const lifecycle = await waitForLifecycleLogEvents(
    [
      ...expectedLifecycleEvents,
      'lifecycle.shutdown_requested',
      'lifecycle.renderer_shutdown_ready',
    ],
    run.logStartIndex,
  )
  const forbidden = lifecycle.entries.filter(({ event }) =>
    [
      'renderer.error',
      'lifecycle.shutdown_timeout',
      'lifecycle.shutdown_renderer_unavailable',
    ].includes(event),
  )
  assert(
    forbidden.length === 0,
    `coordinated shutdown reported renderer/teardown failures: ${forbidden
      .map(({ event, message, error }) => `${event}: ${message ?? error ?? '<no detail>'}`)
      .join('; ')}`,
  )

  const requested = lifecycle.entries.find(({ event }) => event === 'lifecycle.shutdown_requested')
  const ready = lifecycle.entries.find(({ event }) => event === 'lifecycle.renderer_shutdown_ready')
  assert(
    requested && ready && Date.parse(requested.at) <= Date.parse(ready.at),
    'renderer shutdown acknowledgement was logged before the shutdown request',
  )
  return {
    elapsedMs: round(performance.now() - startedAt),
    coordinated: true,
    assetManagerDisposedBeforeShutdownReady: true,
    disposalEvidence: 'renderer acknowledged teardown after synchronous React root unmount',
    rendererErrorCount: 0,
    shutdownRequestedAt: requested.at,
    rendererShutdownReadyAt: ready.at,
    lifecycleLogEvents: lifecycle.expectedEvents,
  }
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

async function readLifecycleLogEntries() {
  const logFile = join(profile, 'logs', 'turtleback.log')
  try {
    const text = await readFile(logFile, 'utf8')
    return text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line)
        } catch (error) {
          throw new Error(
            `invalid JSON in desktop lifecycle log line ${index + 1}: ` +
              `${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          )
        }
      })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
}

async function waitForLifecycleLogEvents(expectedEvents, startIndex = 0) {
  const deadline = performance.now() + 5_000
  let lastEntries = []
  while (performance.now() < deadline) {
    lastEntries = (await readLifecycleLogEntries()).slice(startIndex)
    const seen = new Set(lastEntries.map((entry) => entry.event))
    if (expectedEvents.every((event) => seen.has(event))) {
      return { entries: lastEntries, expectedEvents }
    }
    // The logger writes asynchronously; retry until the deadline.
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  const seen = new Set(lastEntries.map((entry) => entry.event))
  const missing = expectedEvents.filter((event) => !seen.has(event))
  throw new Error(
    `missing lifecycle log events for this launch: ${missing.join(', ')}; observed ` +
      `${[...seen].join(', ') || '<none>'}`,
  )
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

function parseOutputPath(args) {
  return (
    args.find((argument) => argument.startsWith('--output='))?.slice('--output='.length) ?? null
  )
}

async function writeReport(path, value) {
  const absolute = resolve(root, path)
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error(`desktop smoke output must stay inside the repository: ${path}`)
  }
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
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
