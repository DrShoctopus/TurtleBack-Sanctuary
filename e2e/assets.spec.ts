import { expect, test, type Page } from '@playwright/test'

async function enterSanctuary(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Enter Sanctuary/i })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /Enter Sanctuary/i }).click()
  await page.waitForFunction(
    () =>
      Boolean((window as any).__turtlebackDebug?.probe) &&
      (window as any).__sanctuary?.game.getState().sceneReady,
    null,
    { timeout: 15_000 },
  )
}

test('authored assets decode and an injected reload uses the registered fallback', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await enterSanctuary(page)

  const authored = await page.evaluate(() => (window as any).__turtlebackDebug.probe())
  expect(authored.loadedAssetIds).toEqual(
    expect.arrayContaining(['model.pipeline-smoke', 'texture.pipeline-smoke']),
  )
  expect(authored.decodedAssetBytesById['model.pipeline-smoke']).toBeGreaterThan(0)
  expect(authored.decodedAssetBytesById['texture.pipeline-smoke']).toBeGreaterThan(0)
  expect(authored.fallbackAssetIds).not.toContain('procedural.debug-box')

  const armed = await page.evaluate(() =>
    (window as any).__turtlebackDebug.failAsset('model.pipeline-smoke'),
  )
  expect(armed).toBe(true)
  await page.evaluate(() =>
    (window as any).__sanctuary.settings.getState().set('graphics', { quality: 'low' }),
  )

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const probe = (window as any).__turtlebackDebug.probe()
          return {
            quality: (window as any).__sanctuary.runtime.quality.level,
            fallbacks: probe.fallbackAssetIds,
          }
        }),
      { timeout: 20_000 },
    )
    .toMatchObject({ quality: 'low', fallbacks: expect.arrayContaining(['procedural.debug-box']) })

  const fallback = await page.evaluate(() => (window as any).__turtlebackDebug.probe())
  expect(fallback.loadedAssetIds).toContain('texture.pipeline-smoke')
  expect(fallback.decodedAssetBytesById['texture.pipeline-smoke']).toBeGreaterThan(0)
  expect(pageErrors).toEqual([])
})
