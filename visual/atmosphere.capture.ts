import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

interface AtmosphereDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => {
      fallbackAssetIds: readonly string[]
      sections: {
        atmosphere?: {
          condition?: string
          lightRayCount?: number
          turtleRouteScaleCues?: number
          puddleOpacity?: number
        }
      }
    }
  }
  __sanctuary?: {
    game: { getState: () => { sceneReady: boolean; phase: string } }
    settings: { getState: () => { set: (key: string, value: Record<string, unknown>) => void } }
    runtime: {
      quality: { level: string }
      time: { t: number }
      weather: { rain: number; wetness: number }
    }
  }
}

const EVIDENCE = resolve('docs/art-direction/runtime-evidence/slice-9')

const CAPTURES = [
  { view: 'arrival-bridge', time: 0.5, weather: 'clear', file: 'arrival-noon-high.png' },
  { view: 'forest-interior', time: 0.5, weather: 'clear', file: 'forest-noon-high.png' },
  { view: 'village-threshold', time: 0.77, weather: 'clear', file: 'village-sunset-high.png' },
  { view: 'galecrest-turtle-reveal', time: 0.77, weather: 'clear', file: 'turtle-sunset-high.png' },
  { view: 'arrival-bridge', time: 0.83, weather: 'clear', file: 'arrival-blue-hour-high.png' },
  { view: 'turtle-eye-encounter', time: 0.94, weather: 'clear', file: 'turtle-night-high.png' },
  { view: 'forest-interior', time: 0.5, weather: 'rain', file: 'forest-rain-high.png' },
  { view: 'market-lane', time: 0.5, weather: 'rain', file: 'village-rain-high.png' },
] as const

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () => {
      const app = window as AtmosphereDebugWindow
      const game = app.__sanctuary?.game.getState()
      return Boolean(app.__turtlebackDebug && game?.sceneReady && game.phase === 'playing')
    },
    null,
    { timeout: 30_000 },
  )
}

async function capture(page: Page, input: (typeof CAPTURES)[number]): Promise<void> {
  const accepted = await page.evaluate(({ view, time, weather }) => {
    const app = window as AtmosphereDebugWindow
    const settings = app.__sanctuary?.settings.getState()
    if (!settings || !app.__turtlebackDebug) return false
    settings.set('graphics', { quality: 'high', bloom: true })
    settings.set('time', { auto: false, manual: time })
    settings.set('weather', { mode: weather, rainIntensity: 1 })
    return app.__turtlebackDebug.benchmark(view)
  }, input)
  expect(accepted).toBe(true)

  await page.waitForFunction(
    ({ time, weather }) => {
      const app = window as AtmosphereDebugWindow
      const runtime = app.__sanctuary?.runtime
      const atmosphere = app.__turtlebackDebug?.probe().sections.atmosphere
      if (!runtime || !atmosphere) return false
      const weatherReady =
        weather === 'rain'
          ? runtime.weather.rain >= 0.98 && runtime.weather.wetness >= 0.98
          : runtime.weather.rain <= 0.03 && runtime.weather.wetness <= 0.03
      return (
        runtime.quality.level === 'high' &&
        Math.abs(runtime.time.t - time) < 0.001 &&
        weatherReady &&
        atmosphere.lightRayCount === 8 &&
        atmosphere.turtleRouteScaleCues === 6
      )
    },
    input,
    { timeout: 90_000 },
  )
  await page.waitForTimeout(1_500)
  await page.screenshot({ path: resolve(EVIDENCE, input.file) })
}

test('capture authored time, weather, and turtle-route compositions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await boot(page)
  for (const input of CAPTURES) await capture(page, input)

  const probe = await page.evaluate(() =>
    (window as AtmosphereDebugWindow).__turtlebackDebug?.probe(),
  )
  expect(probe?.sections.atmosphere).toMatchObject({
    condition: 'rain',
    lightRayCount: 8,
    turtleRouteScaleCues: 6,
  })
  expect(probe?.sections.atmosphere?.puddleOpacity).toBeLessThanOrEqual(0.2)
  expect(probe?.fallbackAssetIds).toEqual([])
  expect(errors).toEqual([])
})
