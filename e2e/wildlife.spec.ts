import { expect, test, type Page } from '@playwright/test'

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () =>
      Boolean((window as any).__turtlebackDebug?.probe) &&
      (window as any).__sanctuary?.game.getState().sceneReady,
    null,
    { timeout: 25_000 },
  )
}

test('both wildlife waves expose deterministic habitat coverage on High and Low', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await boot(page)

  expect(
    await page.evaluate(() => Boolean((window as any).__scene.getObjectByName('wildlife:director'))),
  ).toBe(true)

  for (const quality of ['high', 'low'] as const) {
    await page.evaluate((level) => {
      ;(window as any).__sanctuary.settings.getState().set('graphics', { quality: level })
      ;(window as any).__sanctuary.settings.getState().setDeep((settings: any) => {
        settings.quietMode = level === 'low'
      })
    }, quality)
    await page.waitForFunction(
      (level) => {
        const app = window as any
        const wildlife = app.__turtlebackDebug?.probe().sections.wildlife
        return app.__sanctuary.runtime.quality.level === level && wildlife?.activeAgents > 0
      },
      quality,
      { timeout: 20_000 },
    )
    const probe = await page.evaluate(() => (window as any).__turtlebackDebug.probe())
    expect(probe.sections.wildlife).toMatchObject({
      pooledAgents: 26,
      orphanCalls: 0,
      lowHabitatCoverage: true,
    })
    expect(probe.sections.wildlife.categories).toEqual([
      'canopy',
      'coast',
      'ground',
      'insects',
      'ocean',
      'wetland',
    ])
    expect(probe.sections.wildlife.habitats).toHaveLength(7)
    expect(probe.sections.audio.wildlifeOrphanCalls).toBe(0)
    expect(probe.fallbackAssetIds).toEqual([])
  }

  expect(errors).toEqual([])
})

test('weather, time, Quiet Mode, and review cameras remain live', async ({ page }) => {
  await boot(page)
  const accepted = await page.evaluate(() => {
    const app = window as any
    const settings = app.__sanctuary.settings.getState()
    settings.set('graphics', { quality: 'high' })
    settings.set('time', { auto: false, manual: 0.88 })
    settings.set('weather', { mode: 'rain', rainIntensity: 1 })
    settings.setDeep((draft: any) => {
      draft.quietMode = true
    })
    return ['crownwood-songbirds', 'shell-hare-meadow', 'galecrest-wildlife', 'ocean-wildlife'].every(
      (view) => app.__turtlebackDebug.benchmark(view),
    )
  })
  expect(accepted).toBe(true)
  await page.waitForFunction(
    () => {
      const app = window as any
      const wildlife = app.__turtlebackDebug?.probe().sections.wildlife
      return (
        app.__sanctuary.runtime.weather.rain > 0.65 &&
        wildlife?.quietMode === true &&
        wildlife?.rainResponse === 'sheltering' &&
        wildlife?.timeResponse === 'night'
      )
    },
    null,
    { timeout: 90_000 },
  )
  const wildlife = await page.evaluate(
    () => (window as any).__turtlebackDebug.probe().sections.wildlife,
  )
  expect(wildlife.behaviors).toEqual(expect.arrayContaining(['glow', 'perch', 'rest']))
  expect(wildlife.categories).toHaveLength(6)
})
