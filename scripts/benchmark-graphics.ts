import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'
import { BENCHMARK_SCENARIOS, type BenchmarkScenario } from '../src/game/config/benchmarkScenarios'
import { frameTimePercentiles } from '../src/game/debug/performanceMath'
import type { SceneProbeSnapshot } from '../src/game/debug/probes'
import { scenarioCondition } from '../visual/graphics.matrix'
import { parseGraphicsArgs } from './lib/graphicsCli'

const MEASUREMENT_MS = 60_000
const PROBE_INTERVAL_MS = 1_000
const OUTPUT_DIRECTORY = 'test-results/graphics-benchmarks'

interface BenchmarkDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => SceneProbeSnapshot
  }
  __sanctuary?: {
    game: { getState: () => { sceneReady: boolean; phase: string } }
    settings: {
      getState: () => {
        weather: { mode: string }
        set: (key: string, value: Record<string, unknown>) => void
      }
    }
    runtime: {
      quality: { level: string }
      time: { t: number }
      weather: { rain: number; wetness: number }
    }
  }
}

interface BrowserMeasurement {
  readonly frameDeltasMs: readonly number[]
  readonly probes: readonly SceneProbeSnapshot[]
}

interface GraphicsBenchmarkResult {
  readonly schemaVersion: 1
  readonly capturedAt: string
  readonly scenarioId: string
  readonly variant: 'default'
  readonly view: BenchmarkScenario['view']
  readonly quality: BenchmarkScenario['quality']
  readonly condition: string
  readonly time: number
  readonly weather: BenchmarkScenario['weather']
  readonly warmupMs: number
  readonly measurementMs: number
  readonly frameSampleCount: number
  readonly p50FrameMs: number
  readonly p95FrameMs: number
  readonly p99FrameMs: number
  readonly frameDeltasMs: readonly number[]
  readonly probes: readonly SceneProbeSnapshot[]
  readonly browserVersion: string
  readonly consoleErrors: readonly string[]
}

function selectedScenarios(id: string | null): readonly BenchmarkScenario[] {
  if (!id) return BENCHMARK_SCENARIOS
  const selected = BENCHMARK_SCENARIOS.find((scenario) => scenario.id === id)
  if (!selected) throw new Error(`Graphics scenario disappeared after CLI validation: ${id}`)
  return [selected]
}

async function startServer(): Promise<{ server: ViteDevServer; url: string }> {
  const server = await createServer({
    root: process.cwd(),
    logLevel: 'warn',
    server: { host: '127.0.0.1', port: 4175, strictPort: false },
  })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') {
    await server.close()
    throw new Error('Vite benchmark server did not expose a TCP address')
  }
  return { server, url: `http://127.0.0.1:${address.port}` }
}

async function bootSanctuary(page: Page, url: string): Promise<void> {
  await page.goto(url)
  const enter = page.getByRole('button', { name: /Enter Sanctuary/i })
  await enter.waitFor({ state: 'visible', timeout: 30_000 })
  await enter.click()
  await page.waitForFunction(
    () => {
      const app = window as BenchmarkDebugWindow
      const game = app.__sanctuary?.game.getState()
      return Boolean(app.__turtlebackDebug && game?.sceneReady && game.phase === 'playing')
    },
    null,
    { timeout: 15_000 },
  )
}

async function applyScenario(page: Page, scenario: BenchmarkScenario): Promise<void> {
  const accepted = await page.evaluate((selected) => {
    const app = window as BenchmarkDebugWindow
    const debug = app.__turtlebackDebug
    const settings = app.__sanctuary?.settings.getState()
    if (!debug || !settings) return false
    settings.set('graphics', { quality: selected.quality })
    settings.set('time', { auto: false, manual: selected.time })
    settings.set('weather', { mode: selected.weather, rainIntensity: 1 })
    return debug.benchmark(selected.view)
  }, scenario)
  if (!accepted) throw new Error(`Debug seam rejected benchmark scenario ${scenario.id}`)

  await page.waitForFunction(
    (selected) => {
      const app = window as BenchmarkDebugWindow
      const sanctuary = app.__sanctuary
      if (!sanctuary) return false
      const runtime = sanctuary.runtime
      const settings = sanctuary.settings.getState()
      const weatherSettled =
        selected.weather === 'rain'
          ? runtime.weather.rain >= 0.99 && runtime.weather.wetness >= 0.99
          : runtime.weather.rain <= 0.03 && runtime.weather.wetness <= 0.03
      return (
        runtime.quality.level === selected.quality &&
        Math.abs(runtime.time.t - selected.time) < 0.001 &&
        settings.weather.mode === selected.weather &&
        weatherSettled
      )
    },
    scenario,
    { timeout: 90_000 },
  )
  await page.waitForTimeout(scenario.warmupMs)
}

async function measure(page: Page): Promise<BrowserMeasurement> {
  // Keep the measured callback as browser-native source. The benchmark runs
  // through `tsx`, whose keep-names transform can otherwise inject its private
  // `__name` helper into a serialized Playwright callback without injecting the
  // helper itself into the page realm.
  const expression = `(() => {
    const debug = window.__turtlebackDebug;
    if (!debug) throw new Error('Graphics benchmark diagnostics are unavailable');
    const durationMs = ${MEASUREMENT_MS};
    const probeIntervalMs = ${PROBE_INTERVAL_MS};
    return new Promise((resolve) => {
      const frameDeltasMs = [];
      const probes = [debug.probe()];
      const startedAt = performance.now();
      let previousFrame = startedAt;
      let nextProbe = startedAt + probeIntervalMs;
      const sample = (now) => {
        frameDeltasMs.push(now - previousFrame);
        previousFrame = now;
        if (now >= nextProbe) {
          probes.push(debug.probe());
          do nextProbe += probeIntervalMs; while (now >= nextProbe);
        }
        if (now - startedAt >= durationMs) {
          probes.push(debug.probe());
          resolve({ frameDeltasMs, probes });
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  })()`
  return page.evaluate<BrowserMeasurement>(expression)
}

async function writeResult(result: GraphicsBenchmarkResult): Promise<void> {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true })
  const filename = `${result.scenarioId}--${result.variant}.json`
  await writeFile(join(OUTPUT_DIRECTORY, filename), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
}

async function main(): Promise<void> {
  const cli = parseGraphicsArgs(process.argv.slice(2))
  const scenarios = selectedScenarios(cli.scenario)
  let server: ViteDevServer | null = null
  let browser: Browser | null = null

  try {
    const started = await startServer()
    server = started.server
    browser = await chromium.launch({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    })
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message))
    await bootSanctuary(page, started.url)
    if (pageErrors.length > 0) {
      throw new Error(`Page error during benchmark boot: ${pageErrors.join('\n')}`)
    }

    for (const scenario of scenarios) {
      const errorCountBefore = pageErrors.length
      const consoleErrorCountBefore = consoleErrors.length
      await applyScenario(page, scenario)
      const measurement = await measure(page)
      if (pageErrors.length > errorCountBefore) {
        throw new Error(
          `Page error during ${scenario.id}: ${pageErrors.slice(errorCountBefore).join('\n')}`,
        )
      }
      const percentiles = frameTimePercentiles(measurement.frameDeltasMs)
      await writeResult({
        schemaVersion: 1,
        capturedAt: new Date().toISOString(),
        scenarioId: scenario.id,
        variant: 'default',
        view: scenario.view,
        quality: scenario.quality,
        condition: scenarioCondition(scenario),
        time: scenario.time,
        weather: scenario.weather,
        warmupMs: scenario.warmupMs,
        measurementMs: MEASUREMENT_MS,
        frameSampleCount: measurement.frameDeltasMs.length,
        ...percentiles,
        frameDeltasMs: measurement.frameDeltasMs,
        probes: measurement.probes,
        browserVersion: browser.version(),
        consoleErrors: consoleErrors.slice(consoleErrorCountBefore),
      })
    }
  } finally {
    await browser?.close()
    await server?.close()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
  process.exitCode = 1
})
