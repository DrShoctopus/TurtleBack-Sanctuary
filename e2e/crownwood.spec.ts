import { expect, test, type Page } from '@playwright/test'

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enter Sanctuary' }).click()
  await page.waitForFunction(
    () =>
      Boolean((window as any).__turtlebackDebug?.probe) &&
      (window as any).__sanctuary?.game.getState().sceneReady,
    null,
    { timeout: 20_000 },
  )
}

test('Crownwood keeps seven-layer identity while quality changes its LOD and density', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await boot(page)
  expect(
    await page.evaluate(() => Boolean((window as any).__scene.getObjectByName('crownwood:streamed-forest'))),
  ).toBe(true)
  expect(await page.evaluate(() => (window as any).__turtlebackDebug.benchmark('forest-interior')))
    .toBe(true)

  const selectQuality = async (quality: 'low' | 'high', lod: 0 | 2) => {
    await page.evaluate((level) => {
      ;(window as any).__sanctuary.settings.getState().set('graphics', { quality: level })
    }, quality)
    await page.waitForFunction(
      ({ level, expectedLod }) => {
        const world = (window as any).__turtlebackDebug.probe().sections.world
        return (
          (window as any).__sanctuary.runtime.quality.level === level &&
          world.forestLod === expectedLod &&
          world.forestInstances > 0
        )
      },
      { level: quality, expectedLod: lod },
      { timeout: 20_000 },
    )
    return page.evaluate(() => (window as any).__turtlebackDebug.probe())
  }

  const low = await selectQuality('low', 2)
  const high = await selectQuality('high', 0)
  const requiredLayers = [
    'trees',
    'midstory',
    'understory',
    'groundCover',
    'deadfall',
    'boulders',
    'mist',
  ]
  for (const layer of requiredLayers) {
    expect(low.sections.world.forestLayers[layer], `Low ${layer}`).toBeGreaterThan(0)
    expect(high.sections.world.forestLayers[layer], `High ${layer}`).toBeGreaterThan(
      low.sections.world.forestLayers[layer],
    )
  }
  expect(high.instancesByFamily.forest).toBeGreaterThan(low.instancesByFamily.forest)
  expect(high.sections.world.forestDiscoveries).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
