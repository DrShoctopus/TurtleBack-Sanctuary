import { describe, expect, it } from 'vitest'
import { assetFailureInjectionEnabled } from '@/game/assets/AssetFailureRouter'

describe('asset diagnostics build flags', () => {
  it.each([
    { dev: true, flag: undefined, expected: true },
    { dev: true, flag: '0', expected: true },
    { dev: false, flag: '1', expected: true },
    { dev: false, flag: undefined, expected: false },
    { dev: false, flag: '0', expected: false },
    { dev: false, flag: 'true', expected: false },
  ])('resolves dev=$dev flag=$flag to $expected', ({ dev, flag, expected }) => {
    expect(assetFailureInjectionEnabled({ dev, diagnosticsFlag: flag })).toBe(expected)
  })
})
