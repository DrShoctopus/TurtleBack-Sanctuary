import { describe, expect, it } from 'vitest'
import { resolveStaticAssetUrl } from '@/game/assets/urls'

describe('resolveStaticAssetUrl', () => {
  it('preserves root, subpath, and Electron app bases', () => {
    expect(resolveStaticAssetUrl('https://host/', 'assets/models/tree.glb')).toBe(
      'https://host/assets/models/tree.glb',
    )
    expect(resolveStaticAssetUrl('https://host/game/', 'assets/models/tree.glb')).toBe(
      'https://host/game/assets/models/tree.glb',
    )
    expect(resolveStaticAssetUrl('app://turtleback/index.html', 'assets/models/tree.glb')).toBe(
      'app://turtleback/assets/models/tree.glb',
    )
    expect(resolveStaticAssetUrl('https://host/game/', 'assets/decoders/basis/')).toBe(
      'https://host/game/assets/decoders/basis/',
    )
  })

  it.each([
    '/assets/models/tree.glb',
    '//evil.example/tree.glb',
    'https://evil.example/tree.glb',
    'C:/assets/tree.glb',
    'assets\\models\\tree.glb',
    'assets/../secret.glb',
    'assets/./tree.glb',
    'assets//tree.glb',
    'assets/%2e%2e/secret.glb',
    'assets/%252e%252e/secret.glb',
    'assets/%2ftree.glb',
    'assets/%5ctree.glb',
    'assets%2Fmodels%2Ftree.glb',
    'assets%252Fmodels%252Ftree.glb',
    'assets%5Cmodels%5Ctree.glb',
    'assets%255Cmodels%255Ctree.glb',
    'assets/models/tree%41.glb',
    'assets/tree.glb?cache=off',
    'assets/tree.glb#fragment',
    'assets/\u0000tree.glb',
  ])('rejects a path outside the strict static boundary: %s', (path) => {
    expect(() => resolveStaticAssetUrl('https://host/game/', path)).toThrow(/static asset path/i)
  })
})
