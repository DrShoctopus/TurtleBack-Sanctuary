import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

interface ReleaseCaptureWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => {
      fallbackAssetIds: readonly string[]
      sections: {
        atmosphere?: { condition?: string }
        wildlife?: { quietMode?: boolean }
      }
    }
  }
  __sanctuary?: {
    game: { getState: () => { sceneReady: boolean; phase: string } }
    settings: {
      getState: () => {
        set: (key: string, value: Record<string, unknown>) => void
        setDeep: (updater: (draft: any) => void) => void
      }
    }
    runtime: {
      quality: { level: string }
      time: { t: number }
      weather: { rain: number; wetness: number }
    }
  }
}

interface CaptureInput {
  readonly file: string
  readonly view: string
  readonly quality: 'low' | 'medium' | 'high'
  readonly time: number
  readonly weather: 'clear' | 'rain'
  readonly reducedMotion: boolean
  readonly quietMode: boolean
}

const EVIDENCE = resolve('docs/art-direction/runtime-evidence/slice-10')

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /Enter Sanctuary/i }).click()
  await page.waitForFunction(
    () => {
      const app = window as ReleaseCaptureWindow
      const game = app.__sanctuary?.game.getState()
      return Boolean(app.__turtlebackDebug && game?.sceneReady && game.phase === 'playing')
    },
    null,
    { timeout: 30_000 },
  )
}

async function capture(page: Page, input: CaptureInput): Promise<void> {
  const accepted = await page.evaluate((selected) => {
    const app = window as ReleaseCaptureWindow
    const settings = app.__sanctuary?.settings.getState()
    if (!settings || !app.__turtlebackDebug) return false
    settings.set('graphics', { quality: selected.quality })
    settings.set('time', { auto: false, manual: selected.time })
    settings.set('weather', { mode: selected.weather, rainIntensity: 1 })
    settings.setDeep((draft) => {
      draft.comfort.reducedMotion = selected.reducedMotion
      draft.quietMode = selected.quietMode
    })
    return app.__turtlebackDebug.benchmark(selected.view)
  }, input)
  expect(accepted).toBe(true)
  await page.waitForFunction(
    (selected) => {
      const app = window as ReleaseCaptureWindow
      const runtime = app.__sanctuary?.runtime
      const probe = app.__turtlebackDebug?.probe()
      if (!runtime || !probe) return false
      const weatherReady =
        selected.weather === 'rain'
          ? runtime.weather.rain >= 0.99 && runtime.weather.wetness >= 0.99
          : runtime.weather.rain <= 0.03 && runtime.weather.wetness <= 0.03
      return (
        runtime.quality.level === selected.quality &&
        Math.abs(runtime.time.t - selected.time) < 0.001 &&
        weatherReady &&
        probe.sections.wildlife?.quietMode === selected.quietMode &&
        probe.fallbackAssetIds.length === 0
      )
    },
    input,
    { timeout: 90_000 },
  )
  await page.waitForTimeout(input.weather === 'rain' ? 1_500 : 900)
  await page.screenshot({ path: resolve(EVIDENCE, input.file) })
}

test('capture final release-condition proof', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await boot(page)
  const captures: readonly CaptureInput[] = [
    {
      file: 'high-day-clear-arrival.png',
      view: 'arrival-bridge',
      quality: 'high',
      time: 0.5,
      weather: 'clear',
      reducedMotion: false,
      quietMode: false,
    },
    {
      file: 'medium-night-clear-village.png',
      view: 'village-threshold',
      quality: 'medium',
      time: 0.88,
      weather: 'clear',
      reducedMotion: false,
      quietMode: false,
    },
    {
      file: 'high-reduced-sunset-forest.png',
      view: 'forest-interior',
      quality: 'high',
      time: 0.72,
      weather: 'clear',
      reducedMotion: true,
      quietMode: false,
    },
    {
      file: 'high-reduced-night-turtle.png',
      view: 'galecrest-turtle-reveal',
      quality: 'high',
      time: 0.88,
      weather: 'clear',
      reducedMotion: true,
      quietMode: false,
    },
    {
      file: 'low-day-rain-forest.png',
      view: 'forest-interior',
      quality: 'low',
      time: 0.5,
      weather: 'rain',
      reducedMotion: false,
      quietMode: false,
    },
    {
      file: 'high-quiet-rain-wildlife.png',
      view: 'wildlife-grouping',
      quality: 'high',
      time: 0.72,
      weather: 'rain',
      reducedMotion: false,
      quietMode: true,
    },
  ]
  for (const input of captures) await capture(page, input)
  expect(errors).toEqual([])
})
