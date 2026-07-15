import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config. Boots the Vite dev server and drives the app in Chromium.
 * WebGL-heavy 3D assertions are avoided; these cover UI/logic flows that are
 * unreliable to unit-test but stable at the DOM level.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Six scene-heavy specs can otherwise start five SwiftShader worlds at
  // once, starving unrelated title/media tests during initial compilation.
  workers: 3,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'off',
    // WebGL needs a GPU-ish context; these flags make headless Chromium cooperate
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
