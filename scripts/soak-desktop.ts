import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, release, tmpdir, totalmem } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { performance } from 'node:perf_hooks'
import { promisify } from 'node:util'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { analyzeMemoryPlateau, type MemoryPlateauSample } from '../src/game/debug/performanceMath'
import { GRAPHICS_PERFORMANCE_CONTRACT } from '../src/game/debug/performanceContract'
import type { SceneProbeSnapshot } from '../src/game/debug/probes'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const options = parseOptions(process.argv.slice(2))
const profile = await mkdtemp(join(tmpdir(), 'turtleback-desktop-soak-'))
const executablePath = await findPackagedExecutable(options.executable)
const route = [
  'arrival-bridge',
  'forest-interior',
  'lumenfen-pools',
  'hearth-commons',
  'garden-workyard',
  'galecrest-turtle-reveal',
  'plaza',
  'galecrest-scrub',
] as const

interface SoakSample extends MemoryPlateauSample {
  readonly capturedAt: string
  readonly privateBytes: number | null
  readonly jsHeapBytes: number | null
  readonly view: (typeof route)[number]
  readonly weather: 'clear' | 'rain'
  readonly time: number
  readonly centerCell: string | null
  readonly activeCells: number
  readonly retainedCells: number
  readonly rendererCalls: number
  readonly rendererTriangles: number
  readonly loadedAssets: number
  readonly fallbackAssets: readonly string[]
  readonly musicSchedulerTimers: number | null
  readonly musicScheduledEvents: number | null
  readonly biomeBedCount: number | null
}

interface ProcessMetric {
  readonly type: string
  readonly memory: {
    readonly workingSetSize: number
    readonly privateBytes?: number
  }
}

interface DiagnosticWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => SceneProbeSnapshot
  }
  __sanctuary?: {
    game: { getState: () => { sceneReady: boolean; phase: string } }
    settings: {
      getState: () => {
        set: (key: string, value: Record<string, unknown>) => void
        setDeep: (updater: (draft: any) => void) => void
      }
    }
  }
}

let application: ElectronApplication | null = null
try {
  const errors: string[] = []
  application = await electron.launch({
    executablePath,
    args: [
      `--user-data-dir=${profile}`,
      '--host-resolver-rules=MAP * ~NOTFOUND',
      '--disable-background-networking',
    ],
    env: { ...process.env, NODE_ENV: 'production' },
  })
  const page = await application.firstWindow({ timeout: 30_000 })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.getByRole('button', { name: /Enter Sanctuary/i }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /Enter Sanctuary/i }).click()
  await page.waitForFunction(
    () => {
      const app = window as DiagnosticWindow
      const game = app.__sanctuary?.game.getState()
      return Boolean(app.__turtlebackDebug && game?.sceneReady && game.phase === 'playing')
    },
    null,
    { timeout: 30_000 },
  )

  for (const view of route) {
    await applyTraversalState(page, view, 'clear', 0.5)
    await page.waitForTimeout(options.warmupSeconds * 1_000)
  }

  await applyTraversalState(page, route[0], 'clear', 0.5)
  await page.waitForTimeout(options.warmupSeconds * 1_000)

  const startedAt = performance.now()
  const samples: SoakSample[] = []
  samples.push(await collectSample(application, page, startedAt, route[0], 'clear', 0.5))
  let index = 1
  const durationMs = options.durationMinutes * 60_000
  while (performance.now() - startedAt < durationMs) {
    const view = route[index % route.length]
    const weather: 'clear' | 'rain' = Math.floor(index / route.length) % 2 === 0 ? 'clear' : 'rain'
    const time = index % 3 === 0 ? 0.5 : index % 3 === 1 ? 0.72 : 0.88
    await applyTraversalState(page, view, weather, time)
    const remainingMs = durationMs - (performance.now() - startedAt)
    await page.waitForTimeout(Math.max(0, Math.min(options.intervalSeconds * 1_000, remainingMs)))
    samples.push(await collectSample(application, page, startedAt, view, weather, time))
    index += 1
  }

  const finalWindowMs = options.finalWindowMinutes * 60_000
  const memoryPlateau = analyzeMemoryPlateau(samples, {
    finalWindowMs,
    maxGrowthPercent: GRAPHICS_PERFORMANCE_CONTRACT.soak.maxMemoryGrowthPercent,
  })
  const centerCells = samples.map((sample) => sample.centerCell).filter(Boolean)
  const cellTransitions = centerCells
    .slice(1)
    .filter((cell, sampleIndex) => cell !== centerCells[sampleIndex]).length
  const cellTransitionsPerMinute = cellTransitions / options.durationMinutes
  const workingTree = await gitWorkingTree()
  const contractDurationMet =
    options.durationMinutes * 60_000 >= GRAPHICS_PERFORMANCE_CONTRACT.soak.durationMs &&
    finalWindowMs >= GRAPHICS_PERFORMANCE_CONTRACT.soak.finalWindowMs
  const localGatePassed =
    memoryPlateau.passed &&
    cellTransitionsPerMinute <= GRAPHICS_PERFORMANCE_CONTRACT.soak.maxCellTransitionsPerMinute &&
    errors.length === 0 &&
    samples.every((sample) => sample.fallbackAssets.length === 0)
  const report = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    sourceCommit: await currentCommit(),
    workingTreeClean: workingTree.length === 0,
    artifact: artifactLabel(executablePath),
    diagnosticArtifact: true,
    offlineMode: 'Chromium host resolver maps all DNS names to NOTFOUND',
    host: {
      platform: platform(),
      architecture: arch(),
      release: release(),
      cpu: cpus()[0]?.model ?? 'unknown',
      logicalCpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
    },
    traversal: {
      route,
      durationMinutes: options.durationMinutes,
      finalWindowMinutes: options.finalWindowMinutes,
      sampleIntervalSeconds: options.intervalSeconds,
      warmupSecondsPerView: options.warmupSeconds,
      sampleCount: samples.length,
      cellTransitions,
      cellTransitionsPerMinute,
    },
    memoryPlateau,
    rendererPlateau: {
      maxGeometries: memoryPlateau.maxRendererGeometries,
      finalGeometries: memoryPlateau.finalRendererGeometries,
      maxTextures: memoryPlateau.maxRendererTextures,
      finalTextures: memoryPlateau.finalRendererTextures,
    },
    audioDecodeStrategy: {
      producedScore: 'procedural Web Audio; no produced-track decode cache',
      turtleDeliveries: 'registered mono MP3, no preload regions, procedural silence fallback',
      schedulerTimers: [...new Set(samples.map((sample) => sample.musicSchedulerTimers))],
      maxScheduledEvents: Math.max(...samples.map((sample) => sample.musicScheduledEvents ?? 0)),
      maxBiomeBeds: Math.max(...samples.map((sample) => sample.biomeBedCount ?? 0)),
    },
    errors,
    acceptance: {
      contractDurationMet,
      localGatePassed,
      passed: contractDurationMet && localGatePassed,
      referenceHardwareEvidence: false,
      reason:
        'This local development host proves packaged traversal stability only; named high-dedicated and low-integrated frame-time slots remain external hardware gates.',
    },
    samples,
  }

  await writeReport(options.output, report)
  console.info(JSON.stringify(report, null, 2))
  if (!localGatePassed) throw new Error('Packaged traversal soak failed its local stability gate')
} finally {
  await application?.close().catch(() => undefined)
  await rm(profile, { recursive: true, force: true })
}

async function applyTraversalState(
  page: Page,
  view: (typeof route)[number],
  weather: 'clear' | 'rain',
  time: number,
): Promise<void> {
  const accepted = await page.evaluate(
    ({ selectedView, selectedWeather, selectedTime }) => {
      const app = window as DiagnosticWindow
      const settings = app.__sanctuary?.settings.getState()
      if (!settings || !app.__turtlebackDebug) return false
      settings.set('graphics', { quality: 'high' })
      settings.set('time', { auto: false, manual: selectedTime })
      settings.set('weather', { mode: selectedWeather, rainIntensity: 1 })
      settings.setDeep((draft) => {
        draft.quietMode = false
        draft.comfort.reducedMotion = false
      })
      return app.__turtlebackDebug.benchmark(selectedView)
    },
    { selectedView: view, selectedWeather: weather, selectedTime: time },
  )
  if (!accepted) throw new Error(`Diagnostic artifact rejected traversal view ${view}`)
}

async function collectSample(
  app: ElectronApplication,
  page: Page,
  startedAt: number,
  view: (typeof route)[number],
  weather: 'clear' | 'rain',
  time: number,
): Promise<SoakSample> {
  const metrics = (await app.evaluate(({ app: electronApp }) =>
    electronApp.getAppMetrics(),
  )) as ProcessMetric[]
  const rendererState = await page.evaluate(() => {
    const debug = (window as DiagnosticWindow).__turtlebackDebug
    if (!debug) throw new Error('Diagnostic probe disappeared during soak')
    const probe = debug.probe()
    const memory = (
      window.performance as unknown as {
        memory?: { readonly usedJSHeapSize?: number }
      }
    ).memory
    return { probe, jsHeapBytes: memory?.usedJSHeapSize ?? null }
  })
  const probe = rendererState.probe
  return {
    elapsedMs: performance.now() - startedAt,
    capturedAt: new Date().toISOString(),
    workingSetBytes: metrics.reduce((sum, metric) => sum + metric.memory.workingSetSize * 1024, 0),
    privateBytes: sumOptionalMetric(metrics, (metric) => metric.memory.privateBytes),
    jsHeapBytes: rendererState.jsHeapBytes,
    view,
    weather,
    time,
    centerCell: probe.sections.world?.centerCell ?? null,
    activeCells: probe.activeCells.length,
    retainedCells: probe.retainedCells.length,
    rendererCalls: probe.renderer.calls,
    rendererTriangles: probe.renderer.triangles,
    rendererGeometries: probe.renderer.geometries,
    rendererTextures: probe.renderer.textures,
    loadedAssets: probe.loadedAssetIds.length,
    fallbackAssets: probe.fallbackAssetIds,
    musicSchedulerTimers: probe.sections.audio?.musicSchedulerTimers ?? null,
    musicScheduledEvents: probe.sections.audio?.musicScheduledEvents ?? null,
    biomeBedCount: probe.sections.audio?.biomeBedCount ?? null,
  }
}

function sumOptionalMetric(
  metrics: readonly ProcessMetric[],
  select: (metric: ProcessMetric) => number | undefined,
): number | null {
  const values = metrics.map(select).filter((value): value is number => Number.isFinite(value))
  return values.length > 0 ? values.reduce((sum, value) => sum + value * 1024, 0) : null
}

function parseOptions(args: readonly string[]) {
  const value = (name: string): string | undefined =>
    args.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3)
  const number = (name: string, fallback: number, min: number, max: number): number => {
    const raw = value(name)
    const parsed = raw === undefined ? fallback : Number(raw)
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new Error(`--${name} must be between ${min} and ${max}`)
    }
    return parsed
  }
  const durationMinutes = number('duration-minutes', 30, 1, 120)
  const finalWindowMinutes = number(
    'final-window-minutes',
    Math.min(20, durationMinutes * (2 / 3)),
    0.5,
    durationMinutes,
  )
  return {
    durationMinutes,
    finalWindowMinutes,
    intervalSeconds: number('interval-seconds', 30, 5, 300),
    warmupSeconds: number('warmup-seconds', 2, 0.25, 15),
    executable: value('executable'),
    output: value('output') ?? 'test-results/desktop-soak.json',
  }
}

async function findPackagedExecutable(explicit: string | undefined): Promise<string> {
  const candidates = explicit
    ? [resolve(root, explicit)]
    : platform() === 'darwin'
      ? [
          resolve(
            root,
            'release-diagnostics/mac-arm64/Turtleback Sanctuary.app/Contents/MacOS/Turtleback Sanctuary',
          ),
          resolve(
            root,
            'release-diagnostics/mac/Turtleback Sanctuary.app/Contents/MacOS/Turtleback Sanctuary',
          ),
        ]
      : platform() === 'win32'
        ? [resolve(root, 'release-diagnostics/win-unpacked/Turtleback Sanctuary.exe')]
        : [resolve(root, 'release-diagnostics/linux-unpacked/turtleback-sanctuary')]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next platform output convention.
    }
  }
  throw new Error('No diagnostic desktop artifact found. Run the diagnostic package command first.')
}

async function writeReport(path: string, report: unknown): Promise<void> {
  const absolute = resolve(root, path)
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error(`Soak output must stay inside the repository: ${path}`)
  }
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

async function currentCommit(): Promise<string> {
  try {
    return (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim()
  } catch {
    return 'unknown'
  }
}

async function gitWorkingTree(): Promise<string> {
  try {
    return (await execFileAsync('git', ['status', '--porcelain'], { cwd: root })).stdout.trim()
  } catch {
    return 'unknown'
  }
}

function artifactLabel(path: string): string {
  return path.startsWith(`${root}${sep}`) ? path.slice(root.length + 1) : path
}
