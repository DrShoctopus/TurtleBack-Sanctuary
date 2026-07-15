import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

interface HeroDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => {
      sections: { turtle?: { model?: string; fallback?: boolean; lod?: number } }
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
      reducedMotion: boolean
    }
  }
}

const EVIDENCE = resolve('docs/art-direction/runtime-evidence/slice-3')

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () => {
      const app = window as HeroDebugWindow
      const game = app.__sanctuary?.game.getState()
      return Boolean(app.__turtlebackDebug && game?.sceneReady && game.phase === 'playing')
    },
    null,
    { timeout: 20_000 },
  )
}

async function capture(
  page: Page,
  view: string,
  quality: 'low' | 'high' | 'ultra',
  file: string,
  reducedMotion = false,
): Promise<void> {
  const result = await page.evaluate(
    ({ selectedView, selectedQuality, reduced }) => {
      const app = window as HeroDebugWindow
      const settings = app.__sanctuary?.settings.getState()
      if (!settings || !app.__turtlebackDebug) return false
      settings.set('graphics', { quality: selectedQuality })
      settings.set('time', { auto: false, manual: 0.5 })
      settings.set('weather', { mode: 'clear', rainIntensity: 1 })
      settings.set('comfort', { reducedMotion: reduced })
      return app.__turtlebackDebug.benchmark(selectedView)
    },
    { selectedView: view, selectedQuality: quality, reduced: reducedMotion },
  )
  expect(result).toBe(true)
  await page.waitForFunction(
    ({ selectedQuality, reduced }) => {
      const runtime = (window as HeroDebugWindow).__sanctuary?.runtime
      return Boolean(
        runtime &&
          runtime.quality.level === selectedQuality &&
          Math.abs(runtime.time.t - 0.5) < 0.001 &&
          runtime.weather.rain < 0.03 &&
          runtime.reducedMotion === reduced,
      )
    },
    { selectedQuality: quality, reduced: reducedMotion },
    { timeout: 30_000 },
  )
  await page.waitForTimeout(1_000)
  await page.screenshot({ path: resolve(EVIDENCE, file) })
}

test('capture monumental turtle scale compositions', async ({ page }) => {
  await boot(page)
  await capture(page, 'turtle-distant-silhouette', 'high', 'distant-silhouette-high.png')
  await capture(page, 'galecrest-turtle-reveal', 'high', 'galecrest-reveal-high.png')
  await capture(page, 'turtle-eye-encounter', 'ultra', 'eye-encounter-ultra.png')
  await capture(page, 'turtle-material-close', 'ultra', 'material-close-ultra.png')
  await capture(page, 'galecrest-turtle-reveal', 'low', 'galecrest-reveal-low.png')
  await capture(page, 'turtle-eye-encounter', 'high', 'eye-encounter-reduced-motion.png', true)

  const turtle = await page.evaluate(
    () => (window as HeroDebugWindow).__turtlebackDebug?.probe().sections.turtle,
  )
  expect(turtle).toMatchObject({ model: 'turtle.hero.monumental', fallback: false })
})
