import { expect, test } from '@playwright/test'

const VIEWS = [
  'arrival-bridge',
  'home-porch',
  'home-interior',
  'plaza',
  'cafe-interior',
  'store-interior',
  'bookshop-interior',
  'records-interior',
  'garden-pond',
  'greenhouse-exterior',
  'greenhouse-interior',
  'landmarks',
  'gallery-interior',
  'bathhouse-exterior',
  'bathhouse-interior',
  'pavilion-interior',
  'cottage-interior',
  'observatory-approach',
  'observatory-interior',
  'east-edge',
  'stern-edge',
  'west-edge',
  'cottages',
  'turtle-portrait',
] as const

test('capture named high-quality benchmark views', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Enter Sanctuary/i })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /Enter Sanctuary/i }).click()
  await page.waitForFunction(
    () =>
      Boolean((window as any).__turtlebackDebug) &&
      (window as any).__sanctuary?.game.getState().sceneReady &&
      (window as any).__sanctuary?.game.getState().phase === 'playing',
    null,
    { timeout: 10_000 },
  )
  await page.evaluate(() => {
    const settings = (window as any).__sanctuary.settings.getState()
    settings.set('graphics', { quality: 'high' })
    settings.set('time', { auto: false, manual: 0.5 })
    settings.set('weather', { mode: 'clear' })
  })
  await page.waitForFunction(
    () =>
      (window as any).__sanctuary.runtime.time.t > 0.49 &&
      (window as any).__sanctuary.runtime.time.t < 0.51,
  )

  for (const id of VIEWS) {
    const accepted = await page.evaluate((view) => (window as any).__turtlebackDebug.benchmark(view), id)
    expect(accepted).toBe(true)
    await page.waitForTimeout(500)
    await page.screenshot({ path: testInfo.outputPath(`${id}.png`) })
  }
})
