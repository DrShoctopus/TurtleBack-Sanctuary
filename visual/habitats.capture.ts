import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

interface HabitatDebugWindow extends Window {
  __turtlebackDebug?: {
    benchmark: (id: string) => boolean
    probe: () => {
      fallbackAssetIds: readonly string[]
      sections: {
        world?: {
          habitatSignatureClusters?: number
          habitatSignatureFeatures?: number
          habitatClusterFamilies?: Readonly<Record<string, readonly string[]>>
        }
        wildlife?: { species?: readonly string[]; habitats?: readonly string[]; orphanCalls?: number }
        audio?: { biomeBedCount?: number; activeBiomeBeds?: readonly string[] }
      }
    }
  }
  __sanctuary?: {
    game: { getState: () => { sceneReady: boolean } }
    settings: { getState: () => { set: (key: string, value: Record<string, unknown>) => void } }
    runtime: { quality: { level: string }; time: { t: number }; weather: { rain: number } }
  }
}

const EVIDENCE = resolve('docs/art-direction/runtime-evidence/slice-8b')

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () => {
      const app = window as HabitatDebugWindow
      return Boolean(app.__turtlebackDebug && app.__sanctuary?.game.getState().sceneReady)
    },
    null,
    { timeout: 30_000 },
  )
}

async function capture(
  page: Page,
  input: { view: string; time: number; file: string },
): Promise<void> {
  const accepted = await page.evaluate(({ view, time }) => {
    const app = window as HabitatDebugWindow
    const settings = app.__sanctuary?.settings.getState()
    if (!settings || !app.__turtlebackDebug) return false
    settings.set('graphics', { quality: 'high' })
    settings.set('time', { auto: false, manual: time })
    settings.set('weather', { mode: 'clear', rainIntensity: 0 })
    return app.__turtlebackDebug.benchmark(view)
  }, input)
  expect(accepted).toBe(true)
  await page.waitForFunction(
    (time) => {
      const app = window as HabitatDebugWindow
      const probe = app.__turtlebackDebug?.probe()
      const runtime = app.__sanctuary?.runtime
      return Boolean(
        probe?.sections.world?.habitatSignatureClusters === 10 &&
          probe.sections.world.habitatSignatureFeatures! > 100 &&
          probe.sections.wildlife?.species?.includes('blossom-grazer') &&
          probe.sections.wildlife.species.includes('lumenfen-heron') &&
          probe.sections.audio?.biomeBedCount === 6 &&
          runtime?.quality.level === 'high' &&
          Math.abs(runtime.time.t - time) < 0.001 &&
          runtime.weather.rain < 0.03,
      )
    },
    input.time,
    { timeout: 30_000 },
  )
  await page.waitForTimeout(1_400)
  await page.screenshot({ path: resolve(EVIDENCE, input.file) })
}

test('capture signature habitat details and second-wave wildlife', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await boot(page)
  await capture(page, { view: 'blossom-grazer-close', time: 0.5, file: 'blossomshade-grazer-high.png' })
  await capture(page, { view: 'lumenfen-heron-close', time: 0.5, file: 'lumenfen-heron-high.png' })
  await capture(page, { view: 'lumenfen-pools', time: 0.88, file: 'lumenfen-lights-night.png' })
  await capture(page, { view: 'fernfall-details', time: 0.5, file: 'fernfall-roots-high.png' })
  await capture(page, { view: 'galecrest-details', time: 0.72, file: 'galecrest-saltstone-high.png' })
  await capture(page, { view: 'hearth-details', time: 0.72, file: 'hearth-lanterns-high.png' })

  const probe = await page.evaluate(() => (window as HabitatDebugWindow).__turtlebackDebug?.probe())
  expect(probe?.sections.wildlife?.habitats).toHaveLength(7)
  expect(probe?.sections.wildlife?.orphanCalls).toBe(0)
  expect(probe?.fallbackAssetIds).toEqual([])
  expect(errors).toEqual([])
})
