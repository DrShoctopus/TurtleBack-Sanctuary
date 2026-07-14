import { describe, expect, it } from 'vitest'
import {
  ASSET_LICENSES_BEGIN_MARKER,
  ASSET_LICENSES_END_MARKER,
  renderAssetLicenseLedger,
} from '@/game/assets/licenseLedger'
import type { ModelAssetRecord } from '@/game/assets/schema'

const ALL_QUALITY = ['low', 'medium', 'high', 'ultra'] as const

function record(id: string, overrides: Partial<ModelAssetRecord> = {}): ModelAssetRecord {
  return {
    id,
    kind: 'model',
    slice: 'world',
    variants: [
      {
        id: `${id}.lod0`,
        path: `assets/models/${id}.glb`,
        quality: ALL_QUALITY,
        lod: 0,
        sha256: '0'.repeat(64),
        encodedBytes: 12,
        decodedBytes: 24,
      },
    ],
    generationRecord: `docs/assets/generation/${id}.md`,
    author: 'Turtleback contributors',
    license: 'Original',
    attribution: 'Turtleback contributors',
    preloadRegions: [],
    fallback: { kind: 'procedural', key: 'procedural.debug-box' },
    capabilities: { animation: false },
    ...overrides,
  }
}

describe('renderAssetLicenseLedger', () => {
  it('renders stable Original, CC0, and attribution-required rows by asset ID', () => {
    const ledger = renderAssetLicenseLedger([
      record('model.zed', {
        sourceUrl: 'https://example.com/zed',
        generationRecord: undefined,
        author: 'Zed Author',
        license: 'CC-BY-4.0',
        attribution: 'Zed by Zed Author',
      }),
      record('model.alpha'),
      record('model.middle', {
        sourceUrl: 'https://example.com/middle',
        generationRecord: undefined,
        author: 'Middle Author',
        license: 'CC0-1.0',
        attribution: 'Middle Author',
      }),
    ])

    expect(ledger.startsWith(ASSET_LICENSES_BEGIN_MARKER)).toBe(true)
    expect(ledger.endsWith(ASSET_LICENSES_END_MARKER)).toBe(true)
    expect(ledger.indexOf('`model.alpha`')).toBeLessThan(ledger.indexOf('`model.middle`'))
    expect(ledger.indexOf('`model.middle`')).toBeLessThan(ledger.indexOf('`model.zed`'))
    expect(ledger).toContain('CC0-1.0')
    expect(ledger).toContain('CC-BY-4.0')
    expect(ledger).toContain('Zed by Zed Author')
    expect(ledger).toContain('[Generation record](docs/assets/generation/model.alpha.md)')
  })

  it('keeps an empty ledger deterministic and marker-delimited', () => {
    const first = renderAssetLicenseLedger([])
    expect(renderAssetLicenseLedger([])).toBe(first)
    expect(first).toContain('| Asset ID | Kind | Author | License | Provenance | Attribution |')
    expect(first.split(ASSET_LICENSES_BEGIN_MARKER)).toHaveLength(2)
    expect(first.split(ASSET_LICENSES_END_MARKER)).toHaveLength(2)
  })

  it('neutralizes marker and table injection in text and link targets', () => {
    const ledger = renderAssetLicenseLedger([
      record('model.safe', {
        generationRecord: 'docs/assets/generation/a|b (draft).md',
        author: '<!-- BEGIN GENERATED ASSET LICENSES -->',
        attribution: 'Author | collaborator',
      }),
    ])

    expect(ledger.split(ASSET_LICENSES_BEGIN_MARKER)).toHaveLength(2)
    expect(ledger).toContain('&lt;!-- BEGIN GENERATED ASSET LICENSES --&gt;')
    expect(ledger).toContain('Author \\| collaborator')
    expect(ledger).toContain('a%7Cb%20%28draft%29.md')
  })
})
