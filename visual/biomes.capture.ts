import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

interface BiomeDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => {
      fallbackAssetIds: readonly string[]
      sections: {
        world?: {
          biomeCount?: number
          biomeInstances?: number
          biomeLayers?: Readonly<Record<string, Readonly<Record<string, number>>>>
          biomeClusterFamilies?: Readonly<Record<string, readonly string[]>>
        }
      }
    }
  }
  __sanctuary?: {
    game: { getState: () => { sceneReady: boolean; phase: string } }
    settings: {
      getState: () => { set: (key: string, value: Record<string, unknown>) => void }
    }
    runtime: { quality: { level: string }; time: { t: number }; weather: { rain: number } }
  }
}

const EVIDENCE = resolve('docs/art-direction/runtime-evidence/slice-8a')

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () => {
      const app = window as BiomeDebugWindow
      return Boolean(app.__turtlebackDebug && app.__sanctuary?.game.getState().sceneReady)
    },
    null,
    { timeout: 30_000 },
  )
}

async function capture(
  page: Page,
  input: { view: string; quality: 'low' | 'high'; time: number; file: string },
): Promise<void> {
  const accepted = await page.evaluate(({ view, quality, time }) => {
    const app = window as BiomeDebugWindow
    const settings = app.__sanctuary?.settings.getState()
    if (!settings || !app.__turtlebackDebug) return false
    settings.set('graphics', { quality })
    settings.set('time', { auto: false, manual: time })
    settings.set('weather', { mode: 'clear', rainIntensity: 0 })
    return app.__turtlebackDebug.benchmark(view)
  }, input)
  expect(accepted).toBe(true)
  await page.waitForFunction(
    ({ quality, time }) => {
      const app = window as BiomeDebugWindow
      const world = app.__turtlebackDebug?.probe().sections.world
      const runtime = app.__sanctuary?.runtime
      return Boolean(
        world?.biomeCount === 5 &&
          world.biomeInstances! > 0 &&
          runtime?.quality.level === quality &&
          Math.abs(runtime.time.t - time) < 0.001 &&
          runtime.weather.rain < 0.03,
      )
    },
    input,
    { timeout: 30_000 },
  )
  await page.waitForTimeout(1_200)
  await page.screenshot({ path: resolve(EVIDENCE, input.file) })
}

test('capture remaining biome silhouette and color identities', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await boot(page)
  await capture(page, { view: 'blossomshade-grove', quality: 'high', time: 0.5, file: 'blossomshade-high.png' })
  await capture(page, { view: 'lumenfen-pools', quality: 'high', time: 0.5, file: 'lumenfen-high.png' })
  await capture(page, { view: 'fernfall-ravine', quality: 'high', time: 0.5, file: 'fernfall-high.png' })
  await capture(page, { view: 'galecrest-scrub', quality: 'high', time: 0.72, file: 'galecrest-high.png' })
  await capture(page, { view: 'hearth-commons', quality: 'high', time: 0.72, file: 'hearth-high.png' })
  await capture(page, { view: 'lumenfen-pools', quality: 'low', time: 0.5, file: 'lumenfen-low.png' })

  const probe = await page.evaluate(() => (window as BiomeDebugWindow).__turtlebackDebug?.probe())
  const world = probe?.sections.world
  expect(world?.biomeCount).toBe(5)
  for (const biome of ['blossomshade', 'lumenfen', 'fernfall', 'galecrest', 'hearth']) {
    expect(Object.keys(world?.biomeLayers?.[biome] ?? {})).toHaveLength(6)
    expect(world?.biomeClusterFamilies?.[biome]).toHaveLength(2)
  }
  expect(probe?.fallbackAssetIds).toEqual([])
  expect(errors).toEqual([])
})
