import { describe, expect, it } from 'vitest'
import {
  assetManifestSchema,
  type AssetRecord,
  type AssetVariant,
  type ModelAssetRecord,
  type TextureAssetRecord,
} from '@/game/assets/schema'
import { createAssetRegistry, resolveAssetVariant } from '@/game/assets/registry'

const ALL_QUALITY = ['low', 'medium', 'high', 'ultra'] as const
const SHA256 = '0'.repeat(64)
const PROCEDURAL_KEYS = new Set(['procedural.debug-box', 'procedural.debug-checker'])

function variant(overrides: Partial<AssetVariant> = {}): AssetVariant {
  return {
    id: 'model.tree.lod0',
    path: 'assets/models/tree.glb',
    quality: ALL_QUALITY,
    lod: 0,
    sha256: SHA256,
    encodedBytes: 12,
    decodedBytes: 24,
    ...overrides,
  }
}

function modelRecord(overrides: Partial<ModelAssetRecord> = {}): ModelAssetRecord {
  return {
    id: 'model.tree',
    kind: 'model',
    slice: 'rendering',
    variants: [variant()],
    generationRecord: 'docs/assets/generation/tree.md',
    author: 'Turtleback Sanctuary contributors',
    license: 'Original',
    attribution: 'Turtleback Sanctuary contributors',
    preloadRegions: ['system'],
    fallback: { kind: 'procedural', key: 'procedural.debug-box' },
    capabilities: { animation: false },
    ...overrides,
  }
}

function textureRecord(overrides: Partial<TextureAssetRecord> = {}): TextureAssetRecord {
  return {
    id: 'texture.tree',
    kind: 'texture',
    slice: 'rendering',
    variants: [
      variant({
        id: 'texture.tree.color',
        path: 'assets/textures/tree.ktx2',
        lod: undefined,
      }),
    ],
    generationRecord: 'docs/assets/generation/tree-texture.md',
    author: 'Turtleback Sanctuary contributors',
    license: 'Original',
    attribution: 'Turtleback Sanctuary contributors',
    preloadRegions: ['system'],
    fallback: { kind: 'procedural', key: 'procedural.debug-checker' },
    capabilities: {},
    textureRole: 'color',
    ...overrides,
  }
}

function registry(records: readonly AssetRecord[]) {
  return createAssetRegistry(records, { proceduralFallbackKeys: PROCEDURAL_KEYS })
}

describe('authored asset schema', () => {
  it('keeps a strict root and one strict discriminant for every supported kind', () => {
    const base = modelRecord()
    const records: AssetRecord[] = [
      base,
      textureRecord(),
      {
        ...base,
        id: 'environment.sky',
        kind: 'environment',
        variants: [
          variant({
            id: 'environment.sky.hdr',
            path: 'assets/environments/sky.hdr',
            lod: undefined,
          }),
        ],
      },
      {
        ...base,
        id: 'animation.bird',
        kind: 'animation',
        variants: [
          variant({
            id: 'animation.bird.clip',
            path: 'assets/animations/bird.glb',
            lod: undefined,
          }),
        ],
        capabilities: {},
      },
      ...(
        ['music-track', 'ambience-bed', 'ambient-detail', 'wildlife-call', 'turtle-sound'] as const
      ).map((kind, index) => ({
        ...base,
        id: `${kind}.sample`,
        kind,
        variants: [
          variant({
            id: `${kind}.sample.file`,
            path: `audio/sample-${index}.mp3`,
            lod: undefined,
          }),
        ],
        capabilities: {},
        durationSec: 3,
      })),
    ]

    expect(assetManifestSchema.parse({ schemaVersion: 1, assets: records }).assets).toHaveLength(9)
    expect(() => assetManifestSchema.parse({ schemaVersion: 1, assets: [], extra: true })).toThrow()
    expect(() =>
      assetManifestSchema.parse({
        schemaVersion: 1,
        assets: [{ ...modelRecord(), unexpected: true }],
      }),
    ).toThrow()
  })

  it('rejects malformed hashes, sizes, attribution, and licenses', () => {
    expect(() => registry([modelRecord({ variants: [variant({ sha256: 'ABC' })] })])).toThrow(
      /model\.tree.*sha-?256/i,
    )
    expect(() => registry([modelRecord({ variants: [variant({ encodedBytes: 0 })] })])).toThrow(
      /model\.tree.*encoded/i,
    )
    expect(() => registry([modelRecord({ attribution: ' ' })])).toThrow(/model\.tree.*attribution/i)
    expect(() =>
      registry([{ ...modelRecord(), license: 'MIT' } as unknown as AssetRecord]),
    ).toThrow(/model\.tree.*license/i)
  })

  it('reports a malformed source URL without throwing from schema refinement', () => {
    const malformed = {
      ...modelRecord(),
      sourceUrl: 'not a valid URL',
    } as unknown as AssetRecord

    expect(() =>
      assetManifestSchema.safeParse({ schemaVersion: 1, assets: [malformed] }),
    ).not.toThrow()
    expect(assetManifestSchema.safeParse({ schemaVersion: 1, assets: [malformed] }).success).toBe(
      false,
    )
    expect(() => registry([malformed])).toThrow(/asset model\.tree.*sourceUrl/i)
  })
})

describe('createAssetRegistry', () => {
  it('rejects duplicate record, variant, and cross-namespace IDs', () => {
    expect(() => registry([modelRecord(), modelRecord()])).toThrow(/model\.tree.*duplicate/i)
    expect(() =>
      registry([
        modelRecord(),
        modelRecord({
          id: 'model.rock',
          variants: [variant({ id: 'model.tree.lod0', path: 'assets/models/rock.glb' })],
        }),
      ]),
    ).toThrow(/model\.tree\.lod0.*duplicate/i)
    expect(() => registry([modelRecord({ id: 'model.tree.lod0' })])).toThrow(
      /model\.tree\.lod0.*namespace/i,
    )
  })

  it('requires collective four-tier coverage and unambiguous LOD mappings', () => {
    expect(() =>
      registry([modelRecord({ variants: [variant({ quality: ['low', 'medium', 'high'] })] })]),
    ).toThrow(/model\.tree.*ultra/i)
    expect(() =>
      registry([
        modelRecord({
          variants: [
            variant({ id: 'model.tree.a', quality: ALL_QUALITY }),
            variant({ id: 'model.tree.b', quality: ['high'], lod: 0 }),
          ],
        }),
      ]),
    ).toThrow(/model\.tree.*ambiguous.*high.*lod 0/i)
  })

  it('rejects reversed, gapped, and mixed LOD chains', () => {
    expect(() =>
      registry([
        modelRecord({
          variants: [variant({ id: 'model.tree.lod1', lod: 1 }), variant({ lod: 0 })],
        }),
      ]),
    ).toThrow(/model\.tree.*lod order/i)
    expect(() =>
      registry([
        modelRecord({
          variants: [variant({ lod: 0 }), variant({ id: 'model.tree.lod2', lod: 2 })],
        }),
      ]),
    ).toThrow(/model\.tree.*lod gap/i)
    expect(() =>
      registry([modelRecord({ variants: [variant({ id: 'model.tree.lod1', lod: 1 })] })]),
    ).toThrow(/model\.tree.*lod gap.*1/i)
    expect(() =>
      registry([
        modelRecord({
          variants: [variant(), variant({ id: 'model.tree.no-lod', lod: undefined })],
        }),
      ]),
    ).toThrow(/model\.tree.*mix.*lod/i)
  })

  it('rejects unsafe paths and kind-extension mismatches', () => {
    expect(() => registry([modelRecord({ variants: [variant({ path: '../tree.glb' })] })])).toThrow(
      /model\.tree.*path/i,
    )
    expect(() =>
      registry([modelRecord({ variants: [variant({ path: 'assets/models/tree.mp3' })] })]),
    ).toThrow(/model\.tree.*extension/i)
  })

  it('rejects unknown, missing, self, incompatible, and cyclic fallbacks', () => {
    expect(() => createAssetRegistry([modelRecord()])).toThrow(
      /model\.tree.*procedural\.debug-box/i,
    )
    expect(() =>
      registry([modelRecord({ fallback: { kind: 'asset', id: 'model.missing' } })]),
    ).toThrow(/model\.tree.*model\.missing/i)
    expect(() =>
      registry([modelRecord({ fallback: { kind: 'asset', id: 'model.tree' } })]),
    ).toThrow(/model\.tree.*itself/i)
    expect(() =>
      registry([modelRecord({ fallback: { kind: 'asset', id: 'texture.tree' } }), textureRecord()]),
    ).toThrow(/model\.tree.*incompatible.*texture\.tree/i)
    expect(() =>
      registry([
        modelRecord({ id: 'model.a', fallback: { kind: 'asset', id: 'model.b' } }),
        modelRecord({
          id: 'model.b',
          variants: [variant({ id: 'model.b.lod0', path: 'assets/models/b.glb' })],
          fallback: { kind: 'asset', id: 'model.a' },
        }),
      ]),
    ).toThrow(/fallback cycle.*model\.a.*model\.b/i)
  })

  it('returns stable readonly views and resolves exact then cheaper LODs deterministically', () => {
    const model = modelRecord({
      variants: [
        variant({ id: 'model.tree.lod0', quality: ['high', 'ultra'], lod: 0 }),
        variant({ id: 'model.tree.lod1', quality: ['medium', 'high', 'ultra'], lod: 1 }),
        variant({ id: 'model.tree.lod2', quality: ALL_QUALITY, lod: 2 }),
      ],
    })
    const result = registry([
      modelRecord({
        id: 'model.zed',
        variants: [variant({ id: 'model.zed.lod0', path: 'assets/models/zed.glb' })],
      }),
      model,
    ])

    expect(result.values().map(({ id }) => id)).toEqual(['model.tree', 'model.zed'])
    expect(Object.isFrozen(result.values())).toBe(true)
    expect(Object.isFrozen(result.getByKind('model'))).toBe(true)
    expect(resolveAssetVariant(model, 'high', 0).id).toBe('model.tree.lod0')
    expect(resolveAssetVariant(model, 'medium', 0).id).toBe('model.tree.lod1')
    expect(resolveAssetVariant(model, 'low', 0).id).toBe('model.tree.lod2')
    expect(resolveAssetVariant(model, 'ultra').id).toBe('model.tree.lod0')
  })
})
