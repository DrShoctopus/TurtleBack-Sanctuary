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

test('village districts expose authored anchors and story clusters on every graphics tier', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await boot(page)

  expect(
    await page.evaluate(() =>
      Boolean((window as any).__scene.getObjectByName('village:outdoor-props')),
    ),
  ).toBe(true)

  for (const view of ['village-threshold', 'market-lane', 'garden-workyard']) {
    expect(
      await page.evaluate(
        (selectedView) => (window as any).__turtlebackDebug.benchmark(selectedView),
        view,
      ),
      view,
    ).toBe(true)
  }

  for (const quality of ['low', 'high'] as const) {
    await page.evaluate((level) => {
      ;(window as any).__sanctuary.settings.getState().set('graphics', { quality: level })
    }, quality)
    await page.waitForFunction(
      (level) => (window as any).__sanctuary.runtime.quality.level === level,
      quality,
      { timeout: 20_000 },
    )
    const world = await page.evaluate(
      () => (window as any).__turtlebackDebug.probe().sections.world,
    )
    expect(world).toMatchObject({
      villageAnchors: 21,
      villageStoryClusters: 28,
      villageDistricts: 7,
      villagePropFamilies: 21,
    })
  }

  expect(errors).toEqual([])
})
