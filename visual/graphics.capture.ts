import { expect, test, type Page, type TestInfo } from '@playwright/test'
import type {
  BenchmarkScenario,
  GraphicsBenchmarkVariant,
} from '../src/game/config/benchmarkScenarios'
import { graphicsCapturePartition, type GraphicsCapturePartition } from './graphics.matrix'

interface GraphicsDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    setBenchmarkVariant: (variant: GraphicsBenchmarkVariant) => boolean
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

async function bootSanctuary(page: Page): Promise<void> {
  await page.goto('/')
  const enter = page.getByRole('button', { name: /Enter Sanctuary/i })
  await expect(enter).toBeVisible({ timeout: 30_000 })
  await enter.click()
  await page.waitForFunction(
    () => {
      const app = window as GraphicsDebugWindow
      const game = app.__sanctuary?.game.getState()
      return Boolean(app.__turtlebackDebug && game?.sceneReady && game.phase === 'playing')
    },
    null,
    { timeout: 15_000 },
  )
}

async function applyScenario(
  page: Page,
  scenario: BenchmarkScenario,
  variant: GraphicsBenchmarkVariant,
): Promise<void> {
  const accepted = await page.evaluate(
    ({ selected, selectedVariant }) => {
      const app = window as GraphicsDebugWindow
      const debug = app.__turtlebackDebug
      const settings = app.__sanctuary?.settings.getState()
      if (!debug || !settings) return { benchmark: false, variant: false }

      const variantAccepted = debug.setBenchmarkVariant(selectedVariant)
      settings.set('graphics', { quality: selected.quality })
      settings.set('time', { auto: false, manual: selected.time })
      settings.set('weather', { mode: selected.weather, rainIntensity: 1 })
      return {
        benchmark: debug.benchmark(selected.view),
        variant: variantAccepted,
      }
    },
    { selected: scenario, selectedVariant: variant },
  )
  expect(accepted).toEqual({ benchmark: true, variant: true })

  await page.waitForFunction(
    (selected) => {
      const app = window as GraphicsDebugWindow
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

async function captureMatrix(page: Page, testInfo: TestInfo): Promise<void> {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message))
  await bootSanctuary(page)
  if (pageErrors.length > 0) throw new Error(`Page error during capture boot: ${pageErrors[0]}`)
  const requestedPartition = process.env.TURTLEBACK_GRAPHICS_PART ?? 'all'
  const validPartitions: readonly GraphicsCapturePartition[] = [
    'all',
    'clear-primary',
    'clear-secondary',
    'rain',
  ]
  if (!validPartitions.includes(requestedPartition as GraphicsCapturePartition)) {
    throw new Error(`Unknown graphics capture partition: ${requestedPartition}`)
  }
  const entries = graphicsCapturePartition(requestedPartition as GraphicsCapturePartition)
  for (const entry of entries) {
    const errorCountBefore = pageErrors.length
    await applyScenario(page, entry.scenario, 'default')
    await page.screenshot({ path: testInfo.outputPath(entry.outputPath) })
    if (pageErrors.length > errorCountBefore) {
      throw new Error(`Page error during ${entry.scenario.id}: ${pageErrors[errorCountBefore]}`)
    }
  }
}

test('capture the deterministic graphics scenario matrix', async ({ page }, testInfo) => {
  await captureMatrix(page, testInfo)
})
