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
  await page.waitForFunction(
    () => Boolean((window as any).__scene && (window as any).__sanctuary),
    null,
    { timeout: 10_000 },
  )
  await page.evaluate(() =>
    (window as any).__sanctuary.settings.getState().set('graphics', { quality: 'medium' }),
  )
  await page.waitForFunction(
    () => (window as any).__sanctuary.runtime.quality.level === 'medium',
    null,
    { timeout: 10_000 },
  )

  const probe = () =>
    page.evaluate(() => {
      const result: Record<
        string,
        {
          time: number
          rain: number
          detail: number
          reflections: number
          vertices: number
          instances: number
        }
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
            detail: material.uniforms?.uDetail?.value ?? -1,
            reflections: material.uniforms?.uReflections?.value ?? -1,
            vertices: object.geometry?.getAttribute?.('position')?.count ?? 0,
            instances: object.count ?? 0,
          }
        }
      })
      const canvas = document.querySelector('canvas')
      return {
        materials: result,
        qualityLevel: (window as any).__sanctuary.runtime.quality.level as string,
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
      }
    })

  const before = await probe()
  await expect
    .poll(
      async () => {
        const current = await probe()
        return (
          current.materials.SkyDomeMaterial.time > before.materials.SkyDomeMaterial.time &&
          current.materials.CloudsMaterial.time > before.materials.CloudsMaterial.time &&
          current.materials.OceanMaterial.time > before.materials.OceanMaterial.time &&
          current.materials.RimMistMaterial.time > before.materials.RimMistMaterial.time
        )
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  const after = await probe()
  expect(after.materials.SkyDomeMaterial.time).toBeGreaterThan(
    before.materials.SkyDomeMaterial.time,
  )
  expect(after.materials.CloudsMaterial.time).toBeGreaterThan(before.materials.CloudsMaterial.time)
  expect(after.materials.OceanMaterial.time).toBeGreaterThan(before.materials.OceanMaterial.time)
  expect(after.materials.RimMistMaterial.time).toBeGreaterThan(
    before.materials.RimMistMaterial.time,
  )

  await page.evaluate(() =>
    (window as any).__sanctuary.settings.getState().set('weather', {
      mode: 'rain',
      rainIntensity: 1,
    }),
  )
  await expect
    .poll(async () => (await probe()).materials.RainMaterial.rain, { timeout: 15_000 })
    .toBeGreaterThan(0.01)
  const rainy = await probe()
  expect(rainy.materials.SkyDomeMaterial.rain).toBeGreaterThan(0.01)
  expect(rainy.materials.OceanMaterial.rain).toBeGreaterThan(0.01)
  expect(rainy.materials.RainMaterial.rain).toBeGreaterThan(0.01)
  expect(rainy.materials.RoofDripMaterial.rain).toBeGreaterThan(0.01)

  await page.evaluate(() =>
    (window as any).__sanctuary.settings.getState().set('graphics', { quality: 'low' }),
  )
  await expect
    .poll(
      async () => {
        const current = await probe()
        return (
          current.qualityLevel === 'low' &&
          current.materials.OceanMaterial.detail < rainy.materials.OceanMaterial.detail &&
          current.materials.RainMaterial.vertices < rainy.materials.RainMaterial.vertices &&
          current.materials.RimMistMaterial.instances < rainy.materials.RimMistMaterial.instances
        )
      },
      { timeout: 10_000 },
    )
    .toBe(true)
  const low = await probe()
  expect(low.qualityLevel).toBe('low')

  await page.evaluate(() =>
    (window as any).__sanctuary.settings.getState().set('graphics', { quality: 'ultra' }),
  )
  await expect
    .poll(
      async () => {
        const current = await probe()
        return (
          current.qualityLevel === 'ultra' &&
          current.materials.OceanMaterial.detail > low.materials.OceanMaterial.detail &&
          current.materials.RainMaterial.vertices > low.materials.RainMaterial.vertices &&
          current.materials.RimMistMaterial.instances > low.materials.RimMistMaterial.instances
        )
      },
      { timeout: 10_000 },
    )
    .toBe(true)
  const ultra = await probe()
  expect(ultra.qualityLevel).toBe('ultra')
  expect(ultra.canvasWidth).toBeGreaterThan(low.canvasWidth)
  expect(ultra.canvasHeight).toBeGreaterThan(low.canvasHeight)
  expect(ultra.materials.OceanMaterial.vertices).toBeGreaterThan(
    low.materials.OceanMaterial.vertices,
  )
  expect(ultra.materials.OceanMaterial.detail).toBeGreaterThan(low.materials.OceanMaterial.detail)
  expect(ultra.materials.OceanMaterial.reflections).toBeGreaterThan(
    low.materials.OceanMaterial.reflections,
  )
  expect(ultra.materials.RainMaterial.vertices).toBeGreaterThan(low.materials.RainMaterial.vertices)
  expect(ultra.materials.RimMistMaterial.instances).toBeGreaterThan(
    low.materials.RimMistMaterial.instances,
  )
  expect(ultra.materials.RoofDripMaterial.vertices).toBeGreaterThan(
    low.materials.RoofDripMaterial.vertices,
  )
  expect(ultra.materials.PuddleSheenMaterial.instances).toBeGreaterThan(
    low.materials.PuddleSheenMaterial.instances,
  )
  expect(ultra.materials.PuddleSheenMaterial.vertices).toBeGreaterThan(
    low.materials.PuddleSheenMaterial.vertices,
  )
  expect(ultra.materials.CloudsMaterial.detail).toBeGreaterThan(low.materials.CloudsMaterial.detail)
})

test('scene probes report live quality residency, resources, and vegetation LODs', async ({
  page,
}) => {
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  await page.waitForFunction(
    () =>
      Boolean((window as any).__turtlebackDebug?.probe) &&
      (window as any).__sanctuary?.game.getState().sceneReady,
    null,
    { timeout: 15_000 },
  )

  const selectQuality = async (quality: 'low' | 'high', active: number, retained: number) => {
    await page.evaluate((level) => {
      ;(window as any).__sanctuary.settings.getState().set('graphics', { quality: level })
    }, quality)
    await page.waitForFunction(
      ({ level, activeCount, retainedCount }) => {
        const probe = (window as any).__turtlebackDebug.probe()
        return (
          (window as any).__sanctuary.runtime.quality.level === level &&
          probe.activeCells.length === activeCount &&
          probe.retainedCells.length === retainedCount
        )
      },
      { level: quality, activeCount: active, retainedCount: retained },
      { timeout: 15_000 },
    )
    return page.evaluate(() => (window as any).__turtlebackDebug.probe())
  }

  const low = await selectQuality('low', 9, 25)
  const high = await selectQuality('high', 49, 81)

  expect(low.loadedAssetIds).toEqual(
    expect.arrayContaining(['model.pipeline-smoke', 'texture.pipeline-smoke']),
  )
  expect(low.decodedAssetBytesById['model.pipeline-smoke']).toBeGreaterThan(0)
  expect(low.renderer.calls).toBeGreaterThan(0)
  expect(low.lodsByFamily.vegetation.near).toBeGreaterThan(0)
  expect(high.activeCells).toHaveLength(49)
  expect(high.retainedCells).toHaveLength(81)
  expect(high.instancesByFamily.vegetation).toBeGreaterThan(low.instancesByFamily.vegetation)
  expect(high.lodsByFamily.vegetation.near).toBeGreaterThan(low.lodsByFamily.vegetation.near)
  expect(high.renderer.calls).toBeGreaterThan(low.renderer.calls)
  expect(high.renderer.triangles).toBeGreaterThan(low.renderer.triangles)
  expect(high.sections.world).toMatchObject({
    activeCellCount: 49,
    retainedCellCount: 81,
  })
})

test('spatial residency crosses two centred cell boundaries without page errors', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await waitForTitle(page)
  await enter(page)
  await page.waitForFunction(() => Boolean((window as any).__turtlebackDebug?.probe), null, {
    timeout: 15_000,
  })

  const teleportAndAwaitCell = async (x: number, expected: string) => {
    await page.evaluate((targetX) => (window as any).__turtlebackDebug.teleport(targetX, 0), x)
    await page.waitForFunction(
      (cell) => (window as any).__turtlebackDebug.probe().sections.world?.centerCell === cell,
      expected,
      { timeout: 20_000 },
    )
    // The runtime snapshot publishes before every streamed React consumer has
    // committed. Let the dense forest/biome cells settle before crossing again.
    await page.waitForTimeout(750)
  }

  await teleportAndAwaitCell(0, '0:0')
  // Use ordinary open-ground samples comfortably beyond the six-metre
  // hysteresis band. One-metre-over-boundary samples can be corrected back by
  // the character controller when denser authored scenery occupies the rim.
  await teleportAndAwaitCell(40, '1:0')
  await teleportAndAwaitCell(110, '2:0')
  expect(pageErrors).toEqual([])
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
  await page.waitForFunction(() => (window as any).__sanctuary.runtime.player.pos.z < 80, null, {
    timeout: 15_000,
  })
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForFunction(() => (window as any).__sanctuary.runtime.player.grounded, null, {
    timeout: 3_000,
  })
  const bridge = await page.evaluate(() => ({
    z: (window as any).__sanctuary.runtime.player.pos.z,
    grounded: (window as any).__sanctuary.runtime.player.grounded,
  }))
  expect(bridge.z).toBeLessThan(80)
  expect(bridge.grounded).toBe(true)

  // Descend the steep engineered stern route onto its final landing.
  await page.evaluate(() => (window as any).__sanctuary.teleport(5.2, 14.95, 220, Math.PI))
  await page.waitForTimeout(350)
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForFunction(() => (window as any).__sanctuary.runtime.player.pos.z > 228, null, {
    timeout: 25_000,
  })
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
