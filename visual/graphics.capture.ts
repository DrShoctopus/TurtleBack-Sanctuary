import { expect, test } from '@playwright/test'

const VIEWS = [
  'arrival-bridge',
  'home-interior',
  'plaza',
  'cafe-interior',
  'bookshop-interior',
  'garden-pond',
  'landmarks',
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
  await page.waitForFunction(() => Boolean((window as any).__turtlebackDebug), null, { timeout: 10_000 })
  await page.evaluate(() => {
    const settings = (window as any).__sanctuary.settings.getState()
    settings.set('graphics', { quality: 'high' })
    settings.set('time', { auto: false, manual: 0.5 })
    settings.set('weather', { mode: 'clear' })
  })

  for (const id of VIEWS) {
    const accepted = await page.evaluate((view) => (window as any).__turtlebackDebug.benchmark(view), id)
    expect(accepted).toBe(true)
    await page.waitForTimeout(500)
    await page.screenshot({ path: testInfo.outputPath(`${id}.png`) })
  }
})
