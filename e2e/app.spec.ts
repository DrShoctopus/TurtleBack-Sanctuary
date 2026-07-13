import { test, expect, type Page } from '@playwright/test'

/** Wait for the title screen (scene booted). */
async function waitForTitle(page: Page) {
  await expect(page.getByRole('button', { name: /Enter Sanctuary/i })).toBeVisible({
    timeout: 30_000,
  })
}

async function enter(page: Page) {
  await page.getByRole('button', { name: /Enter Sanctuary/i }).click()
  // give the canvas a beat to take over
  await page.waitForTimeout(500)
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

test('loads and shows the start screen', async ({ page }) => {
  await page.goto('/')
  await waitForTitle(page)
  await expect(page.getByText(/Turtleback Sanctuary/i)).toBeVisible()
})

test('Enter Sanctuary starts the game and shows the HUD hint', async ({ page }) => {
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  // the reticle/hud layer exists once playing
  await expect(page.locator('.hud')).toBeVisible({ timeout: 10_000 })
})

test('Sanctuary menu opens and a time preset can be applied', async ({ page }) => {
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  await page.keyboard.press('KeyM')
  await expect(page.getByRole('dialog', { name: /Sanctuary/i })).toBeVisible()
  // apply the "Night" time preset
  await page.getByRole('button', { name: 'Night', exact: true }).click()
  const t = await page.evaluate(() => (window as any).__sanctuary?.settings.getState().time)
  expect(t.auto).toBe(false)
  expect(t.manual).toBeGreaterThan(0.9)
})

test('rain can be toggled from the Sanctuary menu', async ({ page }) => {
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  await page.keyboard.press('KeyM')
  await page.getByRole('radio', { name: /Gentle rain/i }).click()
  const mode = await page.evaluate(
    () => (window as any).__sanctuary?.settings.getState().weather.mode,
  )
  expect(mode).toBe('rain')
})

test('settings persist across reload', async ({ page }) => {
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  await page.evaluate(() =>
    (window as any).__sanctuary?.settings.getState().set('graphics', { fov: 85 }),
  )
  await page.waitForTimeout(200)
  await page.reload()
  await waitForTitle(page)
  const fov = await page.evaluate(
    () => (window as any).__sanctuary?.settings.getState().graphics.fov,
  )
  expect(fov).toBe(85)
})

test('keyboard menu navigation moves focus', async ({ page }) => {
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  await page.keyboard.press('Escape') // pause menu
  await expect(page.getByRole('dialog', { name: /Paused/i })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  const focused = await page.evaluate(() => document.activeElement?.textContent)
  expect(focused).toBeTruthy()
})

test('collision-backed bridge and stern stairs accept grounded movement', async ({ page }) => {
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  await page.waitForFunction(() => Boolean((window as any).__turtlebackDebug), null, {
    timeout: 10_000,
  })

  // Walk south from the crown of the garden pond bridge.
  await page.evaluate(() => (window as any).__sanctuary.teleport(-52, 13.9, 83, 0))
  await page.waitForTimeout(350)
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(6_000)
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  const bridge = await page.evaluate(() => ({
    z: (window as any).__sanctuary.runtime.player.pos.z,
    grounded: (window as any).__sanctuary.runtime.player.grounded,
  }))
  expect(bridge.z).toBeLessThan(82)
  expect(bridge.grounded).toBe(true)

  // Descend the steep engineered stern route onto its final landing.
  await page.evaluate(() => (window as any).__sanctuary.teleport(5.2, 14.95, 220, Math.PI))
  await page.waitForTimeout(350)
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(10_000)
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  const stern = await page.evaluate(() => ({
    z: (window as any).__sanctuary.runtime.player.pos.z,
    grounded: (window as any).__sanctuary.runtime.player.grounded,
  }))
  expect(stern.z).toBeGreaterThan(228)
  expect(stern.grounded).toBe(true)
})
