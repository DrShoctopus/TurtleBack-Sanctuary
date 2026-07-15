import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

interface WildlifeDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => {
      fallbackAssetIds: readonly string[]
      sections: {
        wildlife?: {
          activeAgents?: number
          categories?: readonly string[]
          habitats?: readonly string[]
          quietMode?: boolean
          rainResponse?: string
          timeResponse?: string
          orphanCalls?: number
        }
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

const EVIDENCE = resolve('docs/art-direction/runtime-evidence/slice-6')

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () => {
      const app = window as WildlifeDebugWindow
      return Boolean(app.__turtlebackDebug && app.__sanctuary?.game.getState().sceneReady)
    },
    null,
    { timeout: 30_000 },
  )
}

async function capture(
  page: Page,
  input: {
    view: string
    quality: 'low' | 'high'
    time: number
    weather: 'clear' | 'rain'
    quiet: boolean
    file: string
  },
): Promise<void> {
  const accepted = await page.evaluate(({ view, quality, time, weather, quiet }) => {
    const app = window as WildlifeDebugWindow
    const settings = app.__sanctuary?.settings.getState()
    if (!settings || !app.__turtlebackDebug) return false
    settings.set('graphics', { quality })
    settings.set('time', { auto: false, manual: time })
    settings.set('weather', { mode: weather, rainIntensity: 1 })
    settings.setDeep((draft) => {
      draft.quietMode = quiet
    })
    return app.__turtlebackDebug.benchmark(view)
  }, input)
  expect(accepted).toBe(true)
  await page.waitForFunction(
    ({ quality, time, weather, quiet }) => {
      const app = window as WildlifeDebugWindow
      const runtime = app.__sanctuary?.runtime
      const wildlife = app.__turtlebackDebug?.probe().sections.wildlife
      if (!runtime || !wildlife) return false
      const weatherReady = weather === 'rain' ? runtime.weather.rain > 0.68 : runtime.weather.rain < 0.03
      return (
        runtime.quality.level === quality &&
        Math.abs(runtime.time.t - time) < 0.001 &&
        weatherReady &&
        wildlife.activeAgents! > 0 &&
        wildlife.categories?.length === 6 &&
        wildlife.habitats?.length === 7 &&
        wildlife.quietMode === quiet
      )
    },
    input,
    { timeout: 90_000 },
  )
  await page.waitForTimeout(1_200)
  await page.screenshot({ path: resolve(EVIDENCE, input.file) })
}

test('capture first-wave wildlife habitat evidence', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await boot(page)
  const selectedFiles = new Set(
    (process.env.WILDLIFE_CAPTURE_ONLY ?? '').split(',').map((file) => file.trim()).filter(Boolean),
  )
  const captureSelected = async (input: Parameters<typeof capture>[1]) => {
    if (selectedFiles.size === 0 || selectedFiles.has(input.file)) await capture(page, input)
  }
  await captureSelected({ view: 'crownwood-songbirds', quality: 'high', time: 0.5, weather: 'clear', quiet: false, file: 'crownwood-songbirds-high.png' })
  await captureSelected({ view: 'shell-hare-meadow', quality: 'high', time: 0.5, weather: 'clear', quiet: false, file: 'shell-hare-and-insects-high.png' })
  await captureSelected({ view: 'galecrest-wildlife', quality: 'high', time: 0.5, weather: 'clear', quiet: false, file: 'galecrest-seabirds-high.png' })
  await captureSelected({ view: 'ocean-wildlife', quality: 'high', time: 0.5, weather: 'clear', quiet: false, file: 'ocean-rays-high.png' })
  await captureSelected({ view: 'wildlife-grouping', quality: 'low', time: 0.5, weather: 'clear', quiet: false, file: 'garden-habitat-low.png' })
  await captureSelected({ view: 'wildlife-grouping', quality: 'high', time: 0.88, weather: 'clear', quiet: true, file: 'garden-fireflies-quiet-night.png' })
  await captureSelected({ view: 'crownwood-songbirds', quality: 'high', time: 0.72, weather: 'rain', quiet: false, file: 'crownwood-rain-shelter-high.png' })

  const probe = await page.evaluate(() => (window as WildlifeDebugWindow).__turtlebackDebug?.probe())
  expect(probe?.sections.wildlife).toMatchObject({ orphanCalls: 0 })
  expect(probe?.fallbackAssetIds).toEqual([])
  expect(errors).toEqual([])
})
