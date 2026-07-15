import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

interface VillageDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => {
      fallbackAssetIds: readonly string[]
      sections: {
        world?: {
          villageAnchors?: number
          villageStoryClusters?: number
          villageDistricts?: number
          villagePropFamilies?: number
        }
      }
    }
  }
  __sanctuary?: {
    game: { getState: () => { sceneReady: boolean; phase: string } }
    settings: {
      getState: () => { set: (key: string, value: Record<string, unknown>) => void }
    }
    runtime: {
      quality: { level: string }
      time: { t: number }
      weather: { rain: number; wetness: number }
    }
  }
}

const EVIDENCE = resolve('docs/art-direction/runtime-evidence/slice-5')

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () => {
      const app = window as VillageDebugWindow
      const game = app.__sanctuary?.game.getState()
      return Boolean(app.__turtlebackDebug && game?.sceneReady && game.phase === 'playing')
    },
    null,
    { timeout: 30_000 },
  )
}

async function capture(
  page: Page,
  input: {
    view: 'village-threshold' | 'market-lane' | 'garden-workyard'
    quality: 'low' | 'high'
    time: number
    weather: 'clear' | 'rain'
    file: string
  },
): Promise<void> {
  const accepted = await page.evaluate(({ view, quality, time, weather }) => {
    const app = window as VillageDebugWindow
    const settings = app.__sanctuary?.settings.getState()
    if (!settings || !app.__turtlebackDebug) return false
    settings.set('graphics', { quality })
    settings.set('time', { auto: false, manual: time })
    settings.set('weather', { mode: weather, rainIntensity: 1 })
    return app.__turtlebackDebug.benchmark(view)
  }, input)
  expect(accepted).toBe(true)
  await page.waitForFunction(
    ({ quality, time }) => {
      const app = window as VillageDebugWindow
      const runtime = app.__sanctuary?.runtime
      const village = app.__turtlebackDebug?.probe().sections.world
      if (!runtime || !village) return false
      return (
        runtime.quality.level === quality &&
        Math.abs(runtime.time.t - time) < 0.001 &&
        village.villageStoryClusters === 28 &&
        village.villageAnchors === 21
      )
    },
    input,
    { timeout: 30_000 },
  )
  await page.waitForFunction(
    (weather) => {
      const runtime = (window as VillageDebugWindow).__sanctuary?.runtime
      if (!runtime) return false
      return weather === 'rain'
        ? runtime.weather.rain >= 0.85 && runtime.weather.wetness >= 0.55
        : runtime.weather.rain <= 0.03 && runtime.weather.wetness <= 0.03
    },
    input.weather,
    { timeout: 90_000 },
  )
  await page.waitForTimeout(input.weather === 'rain' ? 1_600 : 1_000)
  await page.screenshot({ path: resolve(EVIDENCE, input.file) })
}

test('capture village story density across key conditions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await boot(page)
  const selectedFiles = new Set(
    (process.env.VILLAGE_CAPTURE_ONLY ?? '')
      .split(',')
      .map((file) => file.trim())
      .filter(Boolean),
  )
  const captureSelected = async (input: Parameters<typeof capture>[1]) => {
    if (selectedFiles.size === 0 || selectedFiles.has(input.file)) await capture(page, input)
  }
  await captureSelected({
    view: 'village-threshold',
    quality: 'high',
    time: 0.5,
    weather: 'clear',
    file: 'village-threshold-high.png',
  })
  await captureSelected({
    view: 'market-lane',
    quality: 'high',
    time: 0.5,
    weather: 'clear',
    file: 'market-lane-high.png',
  })
  await captureSelected({
    view: 'garden-workyard',
    quality: 'high',
    time: 0.5,
    weather: 'clear',
    file: 'garden-workyard-high.png',
  })
  await captureSelected({
    view: 'market-lane',
    quality: 'low',
    time: 0.5,
    weather: 'clear',
    file: 'market-lane-low.png',
  })
  await captureSelected({
    view: 'market-lane',
    quality: 'high',
    time: 0.88,
    weather: 'clear',
    file: 'market-lane-night.png',
  })
  // Rain stays last because wetness intentionally dries much more slowly than
  // it accumulates; later clear captures must never inherit the rain state.
  await captureSelected({
    view: 'village-threshold',
    quality: 'high',
    time: 0.72,
    weather: 'rain',
    file: 'village-threshold-sunset-rain.png',
  })

  const probe = await page.evaluate(() => (window as VillageDebugWindow).__turtlebackDebug?.probe())
  expect(probe?.sections.world).toMatchObject({
    villageAnchors: 21,
    villageStoryClusters: 28,
    villageDistricts: 7,
    villagePropFamilies: 21,
  })
  expect(probe?.fallbackAssetIds).toEqual([])
  expect(errors).toEqual([])
})
