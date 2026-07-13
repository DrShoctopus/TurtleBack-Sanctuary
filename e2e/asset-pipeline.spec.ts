import { expect, test, type Page, type Response } from '@playwright/test'

interface AssetDiagnosticsSnapshot {
  loadedIds: readonly string[]
  pendingIds: readonly string[]
  fallbackIds: readonly string[]
  decodedBytesById: Readonly<Record<string, number>>
  estimatedDecodedBytes: number
}

const REQUIRED_RESPONSES = {
  'pipeline-smoke.glb': 'model/gltf-binary',
  'pipeline-smoke.ktx2': 'image/ktx2',
  'basis_transcoder.js': 'text/javascript',
  'basis_transcoder.wasm': 'application/wasm',
  'turtleback-basis-worker.js': 'text/javascript',
} as const

function responseName(response: Response): keyof typeof REQUIRED_RESPONSES | null {
  const pathname = new URL(response.url()).pathname
  for (const name of Object.keys(REQUIRED_RESPONSES) as (keyof typeof REQUIRED_RESPONSES)[]) {
    if (pathname.endsWith(`/${name}`)) return name
  }
  return null
}

async function readDiagnostics(page: Page): Promise<AssetDiagnosticsSnapshot | null> {
  return page.evaluate(async (moduleUrl) => {
    const diagnosticsModule = (await import(/* @vite-ignore */ moduleUrl)) as {
      readActiveAssetDiagnostics(): AssetDiagnosticsSnapshot | null
    }
    return diagnosticsModule.readActiveAssetDiagnostics()
  }, '/src/game/assets/diagnostics.ts')
}

test('decodes the authored Meshopt/KTX2 pipeline before scene readiness', async ({ page }) => {
  let releaseBlockedModel!: () => void
  const blockedModel = new Promise<void>((resolve) => {
    releaseBlockedModel = resolve
  })
  const responses = new Map<string, { status: number; contentType: string }>()
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  await page.route('**/assets/system/pipeline-smoke.glb', async (route) => {
    await blockedModel
    await route.continue()
  })
  page.on('response', (response) => {
    const name = responseName(response)
    if (!name) return
    responses.set(name, {
      status: response.status(),
      contentType: response.headers()['content-type'] ?? '',
    })
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?seed=271828')
  try {
    await expect(page.getByRole('status', { name: 'Loading' })).toBeVisible()
    await page.waitForTimeout(750)
    await expect(page.getByRole('button', { name: /Enter Sanctuary/i })).toBeHidden()
  } finally {
    releaseBlockedModel()
  }
  await expect(page.getByRole('button', { name: /Enter Sanctuary/i })).toBeVisible({
    timeout: 30_000,
  })

  const diagnostics = await readDiagnostics(page)
  expect(diagnostics).toEqual({
    loadedIds: ['model.pipeline-smoke', 'texture.pipeline-smoke'],
    pendingIds: [],
    fallbackIds: [],
    decodedBytesById: {
      'model.pipeline-smoke': 42,
      'texture.pipeline-smoke': 84,
    },
    estimatedDecodedBytes: 126,
  })
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])

  for (const [name, expectedContentType] of Object.entries(REQUIRED_RESPONSES)) {
    const response = responses.get(name)
    expect(response, `${name} response`).toBeDefined()
    expect(response?.status, `${name} status`).toBe(200)
    expect(response?.contentType, `${name} content type`).toContain(expectedContentType)
  }
})
