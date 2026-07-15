import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

interface CrownwoodDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => {
      fallbackAssetIds: readonly string[]
      sections: {
        world?: {
          forestInstances?: number
          forestLod?: number
          forestDiscoveries?: number
          forestLayers?: Record<string, number>
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
      reducedMotion: boolean
    }
  }
}

const EVIDENCE = resolve('docs/art-direction/runtime-evidence/slice-4')

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () => {
      const app = window as CrownwoodDebugWindow
      const game = app.__sanctuary?.game.getState()
      return Boolean(app.__turtlebackDebug && game?.sceneReady && game.phase === 'playing')
    },
    null,
    { timeout: 25_000 },
  )
}

async function capture(
  page: Page,
  view: 'arrival-bridge' | 'forest-interior',
  quality: 'low' | 'high',
  file: string,
  reducedMotion = false,
): Promise<void> {
  const accepted = await page.evaluate(
    ({ selectedView, selectedQuality, reduced }) => {
      const app = window as CrownwoodDebugWindow
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
  expect(accepted).toBe(true)
  await page.waitForFunction(
    ({ selectedQuality, reduced }) => {
      const runtime = (window as CrownwoodDebugWindow).__sanctuary?.runtime
      const forest = (window as CrownwoodDebugWindow).__turtlebackDebug?.probe().sections.world
      return Boolean(
        runtime &&
          forest &&
          runtime.quality.level === selectedQuality &&
          Math.abs(runtime.time.t - 0.5) < 0.001 &&
          runtime.weather.rain < 0.03 &&
          runtime.reducedMotion === reduced &&
          forest.forestInstances &&
          forest.forestInstances > 0,
      )
    },
    { selectedQuality: quality, reduced: reducedMotion },
    { timeout: 30_000 },
  )
  await page.waitForTimeout(1_200)
  await page.screenshot({ path: resolve(EVIDENCE, file) })
}

test('capture Crownwood and Arrival identity across graphics tiers', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await boot(page)
  await capture(page, 'arrival-bridge', 'high', 'arrival-high.png')
  await capture(page, 'forest-interior', 'high', 'forest-interior-high.png')
  await capture(page, 'arrival-bridge', 'low', 'arrival-low.png')
  await capture(page, 'forest-interior', 'low', 'forest-interior-low.png')
  await capture(
    page,
    'forest-interior',
    'high',
    'forest-interior-reduced-motion.png',
    true,
  )

  const probe = await page.evaluate(
    () => (window as CrownwoodDebugWindow).__turtlebackDebug?.probe(),
  )
  expect(probe?.sections.world).toMatchObject({ forestLod: 0 })
  expect(probe?.sections.world?.forestDiscoveries).toBeGreaterThan(0)
  expect(probe?.fallbackAssetIds).toEqual([])
  expect(errors).toEqual([])
})
