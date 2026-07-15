import { expect, test, type Page } from '@playwright/test'

async function enterSanctuary(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /Enter Sanctuary/i }).click()
  await page.waitForFunction(
    () =>
      Boolean((window as any).__turtlebackDebug?.probe) &&
      (window as any).__sanctuary?.game.getState().sceneReady,
    null,
    { timeout: 15_000 },
  )
}

test('monumental turtle owns the live scene and respects every quality LOD cap', async ({ page }) => {
  await enterSanctuary(page)
  const accepted = await page.evaluate(() =>
    (window as any).__turtlebackDebug.benchmark('turtle-eye-encounter'),
  )
  expect(accepted).toBe(true)

  for (const [quality, lod] of [
    ['low', 2],
    ['medium', 1],
    ['high', 0],
    ['ultra', 0],
  ] as const) {
    await page.evaluate((level) => {
      ;(window as any).__sanctuary.settings.getState().set('graphics', { quality: level })
    }, quality)
    await expect
      .poll(
        () =>
          page.evaluate(() => ({
            quality: (window as any).__sanctuary.runtime.quality.level,
            turtle: (window as any).__turtlebackDebug.probe().sections.turtle,
          })),
        { timeout: 15_000 },
      )
      .toMatchObject({
        quality,
        turtle: { model: 'turtle.hero.monumental', fallback: false, lod },
      })
  }

  const nodes = await page.evaluate(() => {
    const scene = (window as any).__scene
    return ['Head', 'Jaw', 'Eye_R', 'Flipper_FL', 'Wake_FR'].map((name) => ({
      name,
      present: Boolean(scene.getObjectByName(name)),
    }))
  })
  expect(nodes).toEqual(nodes.map(({ name }) => ({ name, present: true })))
})
