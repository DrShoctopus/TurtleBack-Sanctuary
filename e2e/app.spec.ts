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

test('live shaders advance and quality rebuilds geometry immediately', async ({ page }) => {
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  await page.waitForFunction(() => Boolean((window as any).__scene), null, { timeout: 10_000 })

  const probe = () =>
    page.evaluate(() => {
      const result: Record<
        string,
        { time: number; rain: number; vertices: number; instances: number }
      > = {}
      ;(window as any).__scene.traverse((object: any) => {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) {
          if (
            !material?.name ||
            ![
              'SkyDomeMaterial',
              'CloudsMaterial',
              'OceanMaterial',
              'RainMaterial',
              'RimMistMaterial',
              'RoofDripMaterial',
              'PuddleSheenMaterial',
            ].includes(material.name)
          )
            continue
          result[material.name] = {
            time: material.uniforms?.uTime?.value ?? -1,
            rain: material.uniforms?.uRain?.value ?? -1,
            vertices: object.geometry?.getAttribute?.('position')?.count ?? 0,
            instances: object.count ?? 0,
          }
        }
      })
      return result
    })

  const before = await probe()
  await expect
    .poll(
      async () => {
        const current = await probe()
        return (
          current.SkyDomeMaterial.time > before.SkyDomeMaterial.time &&
          current.CloudsMaterial.time > before.CloudsMaterial.time &&
          current.OceanMaterial.time > before.OceanMaterial.time &&
          current.RimMistMaterial.time > before.RimMistMaterial.time
        )
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  const after = await probe()
  expect(after.SkyDomeMaterial.time).toBeGreaterThan(before.SkyDomeMaterial.time)
  expect(after.CloudsMaterial.time).toBeGreaterThan(before.CloudsMaterial.time)
  expect(after.OceanMaterial.time).toBeGreaterThan(before.OceanMaterial.time)
  expect(after.RimMistMaterial.time).toBeGreaterThan(before.RimMistMaterial.time)

  await page.evaluate(() =>
    (window as any).__sanctuary.settings.getState().set('weather', {
      mode: 'rain',
      rainIntensity: 1,
    }),
  )
  await expect
    .poll(async () => (await probe()).RainMaterial.rain, { timeout: 15_000 })
    .toBeGreaterThan(0.01)
  const rainy = await probe()
  expect(rainy.SkyDomeMaterial.rain).toBeGreaterThan(0.01)
  expect(rainy.OceanMaterial.rain).toBeGreaterThan(0.01)
  expect(rainy.RainMaterial.rain).toBeGreaterThan(0.01)
  expect(rainy.RoofDripMaterial.rain).toBeGreaterThan(0.01)

  await page.evaluate(() =>
    (window as any).__sanctuary.settings.getState().set('graphics', { quality: 'low' }),
  )
  await expect
    .poll(async () => (await probe()).RainMaterial.vertices, { timeout: 10_000 })
    .toBe(1_600)
  const low = await probe()
  expect(low.OceanMaterial.vertices).toBe(9_409)
  expect(low.RainMaterial.vertices).toBe(1_600)
  expect(low.RoofDripMaterial.vertices).toBe(39)
  expect(low.PuddleSheenMaterial.instances).toBe(5)

  await page.evaluate(() =>
    (window as any).__sanctuary.settings.getState().set('graphics', { quality: 'high' }),
  )
  await expect
    .poll(async () => (await probe()).RainMaterial.vertices, { timeout: 10_000 })
    .toBe(6_000)
  const high = await probe()
  expect(high.OceanMaterial.vertices).toBe(50_625)
  expect(high.RainMaterial.vertices).toBe(6_000)
  expect(high.RoofDripMaterial.vertices).toBe(156)
  expect(high.PuddleSheenMaterial.instances).toBe(13)
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
  await page.evaluate(() => (window as any).__sanctuary.teleport(-52, 16, 83, 0))
  await page.waitForFunction(() => (window as any).__sanctuary.runtime.player.grounded, null, {
    timeout: 3_000,
  })
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForFunction(
    () => (window as any).__sanctuary.runtime.player.pos.z < 82,
    null,
    { timeout: 15_000 },
  )
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForFunction(() => (window as any).__sanctuary.runtime.player.grounded, null, {
    timeout: 3_000,
  })
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
  await page.waitForFunction(
    () => (window as any).__sanctuary.runtime.player.pos.z > 228,
    null,
    { timeout: 25_000 },
  )
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForFunction(() => (window as any).__sanctuary.runtime.player.grounded, null, {
    timeout: 2_000,
  })
  const stern = await page.evaluate(() => ({
    z: (window as any).__sanctuary.runtime.player.pos.z,
    grounded: (window as any).__sanctuary.runtime.player.grounded,
  }))
  expect(stern.z).toBeGreaterThan(228)
  expect(stern.grounded).toBe(true)
})
