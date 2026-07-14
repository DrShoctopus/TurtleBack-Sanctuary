import { test, expect, type Page } from '@playwright/test'

async function enter(page: Page) {
  await expect(page.getByRole('button', { name: /Enter Sanctuary/i })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /Enter Sanctuary/i }).click()
  await page.waitForTimeout(400)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('turtleback:e2e-initialized')) {
        localStorage.clear()
        sessionStorage.setItem('turtleback:e2e-initialized', '1')
      }
    } catch {
      /* ignore */
    }
  })
})

test('TV accepts a valid YouTube URL and shows the embed', async ({ page }) => {
  await page.goto('/')
  await enter(page)
  await page.evaluate(() => (window as any).__sanctuary?.game.getState().setOverlay('tv'))
  const dialog = page.getByRole('dialog', { name: /Television/i })
  await expect(dialog).toBeVisible()
  await page
    .getByLabel(/YouTube URL or video ID/i)
    .fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('iframe.tv-iframe')).toHaveAttribute(
    'src',
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
  )
})

test('TV rejects invalid input with an error', async ({ page }) => {
  await page.goto('/')
  await enter(page)
  await page.evaluate(() => (window as any).__sanctuary?.game.getState().setOverlay('tv'))
  await page.getByLabel(/YouTube URL or video ID/i).fill('https://example.com/not-a-video')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.tv-error')).toBeVisible()
  await expect(page.locator('iframe.tv-iframe')).toHaveCount(0)
})

test('radio form rejects an insecure (http) URL', async ({ page }) => {
  await page.goto('/')
  await enter(page)
  await page.evaluate(() => (window as any).__sanctuary?.game.getState().setOverlay('music'))
  await page.getByRole('tab', { name: /Radio/i }).click()
  await page.getByLabel(/Stream URL/i).fill('http://insecure.example.com/stream.mp3')
  await page.getByRole('button', { name: /Save station/i }).click()
  await expect(page.locator('.tv-error')).toContainText(/https/i)
})

test('music player lists the four built-in generative tracks', async ({ page }) => {
  await page.goto('/')
  await enter(page)
  await page.evaluate(() => (window as any).__sanctuary?.game.getState().setOverlay('music'))
  await expect(page.getByRole('button', { name: 'Play Sanctuary — Dawn' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play Sanctuary — Night' })).toBeVisible()
})
