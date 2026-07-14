import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { renderAssetLicenseLedger } from '@/game/assets/licenseLedger'
import type { AssetRecord, ModelAssetRecord, TextureAssetRecord } from '@/game/assets/schema'
import { validateAssetRegistry } from '@/game/assets/validate.node'

const roots: string[] = []
const ALL_QUALITY = ['low', 'medium', 'high', 'ultra'] as const

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function validGlb(declaredLength = 12): Uint8Array {
  const bytes = new Uint8Array(12)
  bytes.set([0x67, 0x6c, 0x54, 0x46])
  new DataView(bytes.buffer).setUint32(4, 2, true)
  new DataView(bytes.buffer).setUint32(8, declaredLength, true)
  return bytes
}

const KTX2_MAGIC = new Uint8Array([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
])

function modelRecord(
  id: string,
  bytes: Uint8Array,
  overrides: Partial<ModelAssetRecord> = {},
): ModelAssetRecord {
  return {
    id,
    kind: 'model',
    slice: 'rendering',
    variants: [
      {
        id: `${id}.lod0`,
        path: `assets/models/${id}.glb`,
        quality: ALL_QUALITY,
        lod: 0,
        sha256: sha256(bytes),
        encodedBytes: bytes.byteLength,
        decodedBytes: 24,
      },
    ],
    generationRecord: `docs/assets/generation/${id}.md`,
    author: 'Turtleback Sanctuary contributors',
    license: 'Original',
    attribution: 'Turtleback Sanctuary contributors',
    preloadRegions: [],
    fallback: { kind: 'procedural', key: 'procedural.debug-box' },
    capabilities: { animation: false },
    ...overrides,
  }
}

function textureRecord(id: string, bytes: Uint8Array): TextureAssetRecord {
  return {
    id,
    kind: 'texture',
    slice: 'rendering',
    variants: [
      {
        id: `${id}.color`,
        path: `assets/textures/${id}.ktx2`,
        quality: ALL_QUALITY,
        sha256: sha256(bytes),
        encodedBytes: bytes.byteLength,
        decodedBytes: 84,
      },
    ],
    generationRecord: `docs/assets/generation/${id}.md`,
    author: 'Turtleback Sanctuary contributors',
    license: 'Original',
    attribution: 'Turtleback Sanctuary contributors',
    preloadRegions: [],
    fallback: { kind: 'procedural', key: 'procedural.debug-checker' },
    capabilities: {},
    textureRole: 'color',
  }
}

async function fixture(input: {
  records: readonly AssetRecord[]
  files?: Readonly<Record<string, Uint8Array>>
  ledger?: string
}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'turtleback-assets-'))
  roots.push(root)
  await mkdir(join(root, 'src/game/assets'), { recursive: true })
  await writeFile(
    join(root, 'src/game/assets/manifest.json'),
    `${JSON.stringify({ schemaVersion: 1, assets: input.records }, null, 2)}\n`,
  )
  const generated = renderAssetLicenseLedger(input.records)
  await writeFile(
    join(root, 'ASSET_LICENSES.md'),
    input.ledger ?? `# Asset Licenses\n\n${generated}\n\n## Third-party software\n\nKeep me.\n`,
  )
  for (const record of input.records) {
    if (!record.generationRecord) continue
    const target = join(root, record.generationRecord)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, `# ${record.id}\n`)
  }
  for (const [path, bytes] of Object.entries(input.files ?? {})) {
    const target = join(root, 'public', path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
  }
  return root
}

const OPTIONS = { final: false, writeLicenses: false } as const

describe('validateAssetRegistry', () => {
  it('reports deterministic selected counts and verified bytes', async () => {
    const bytes = validGlb()
    const record = modelRecord('model.valid', bytes)
    const root = await fixture({ records: [record], files: { [record.variants[0].path]: bytes } })

    await expect(validateAssetRegistry(root, OPTIONS)).resolves.toMatchObject({
      assetCount: 1,
      variantCount: 1,
      verifiedBytes: 12,
      generatedLedger: renderAssetLicenseLedger([record]),
    })
  })

  it('rejects missing files, encoded-size drift, and checksum drift', async () => {
    const bytes = validGlb()
    const missing = modelRecord('model.missing', bytes)
    const missingRoot = await fixture({ records: [missing] })
    await expect(validateAssetRegistry(missingRoot, OPTIONS)).rejects.toThrow(
      /model\.missing.*missing file/i,
    )

    const validSize = modelRecord('model.size', bytes)
    const wrongSize = modelRecord('model.size', bytes, {
      variants: [{ ...validSize.variants[0], encodedBytes: 13 }],
    })
    const sizeRoot = await fixture({
      records: [wrongSize],
      files: { [wrongSize.variants[0].path]: bytes },
    })
    await expect(validateAssetRegistry(sizeRoot, OPTIONS)).rejects.toThrow(/model\.size.*size/i)

    const validHash = modelRecord('model.hash', bytes)
    const wrongHash = modelRecord('model.hash', bytes, {
      variants: [{ ...validHash.variants[0], sha256: '0'.repeat(64) }],
    })
    const hashRoot = await fixture({
      records: [wrongHash],
      files: { [wrongHash.variants[0].path]: bytes },
    })
    await expect(validateAssetRegistry(hashRoot, OPTIONS)).rejects.toThrow(/model\.hash.*sha-?256/i)
  })

  it('checks GLB version and declared length plus the complete KTX2 magic', async () => {
    const badMagic = validGlb()
    badMagic[0] = 0
    const magicRecord = modelRecord('model.bad-magic', badMagic)
    const magicRoot = await fixture({
      records: [magicRecord],
      files: { [magicRecord.variants[0].path]: badMagic },
    })
    await expect(validateAssetRegistry(magicRoot, OPTIONS)).rejects.toThrow(
      /model\.bad-magic.*invalid GLB magic/i,
    )

    const badVersion = validGlb()
    new DataView(badVersion.buffer).setUint32(4, 1, true)
    const versionRecord = modelRecord('model.bad-version', badVersion)
    const versionRoot = await fixture({
      records: [versionRecord],
      files: { [versionRecord.variants[0].path]: badVersion },
    })
    await expect(validateAssetRegistry(versionRoot, OPTIONS)).rejects.toThrow(
      /model\.bad-version.*GLB version 1.*expected 2/i,
    )

    const badLength = validGlb(16)
    const glb = modelRecord('model.bad-length', badLength)
    const glbRoot = await fixture({ records: [glb], files: { [glb.variants[0].path]: badLength } })
    await expect(validateAssetRegistry(glbRoot, OPTIONS)).rejects.toThrow(
      /model\.bad-length.*declared length/i,
    )

    const badKtx = new Uint8Array(KTX2_MAGIC)
    badKtx[11] = 0
    const texture = textureRecord('texture.bad-magic', badKtx)
    const ktxRoot = await fixture({
      records: [texture],
      files: { [texture.variants[0].path]: badKtx },
    })
    await expect(validateAssetRegistry(ktxRoot, OPTIONS)).rejects.toThrow(
      /texture\.bad-magic.*ktx2 magic/i,
    )
  })

  it('detects ledger drift and rewrites only the generated block after other checks pass', async () => {
    const bytes = validGlb()
    const record = modelRecord('model.ledger', bytes)
    const stale =
      '# Asset Licenses\n\n<!-- BEGIN GENERATED ASSET LICENSES -->\nstale\n<!-- END GENERATED ASSET LICENSES -->\n\n## Third-party software\n\nKeep me.\n'
    const root = await fixture({
      records: [record],
      files: { [record.variants[0].path]: bytes },
      ledger: stale,
    })
    await expect(validateAssetRegistry(root, OPTIONS)).rejects.toThrow(/license ledger drift/i)
    await validateAssetRegistry(root, { final: false, writeLicenses: true })
    const written = await readFile(join(root, 'ASSET_LICENSES.md'), 'utf8')
    expect(written).toContain(renderAssetLicenseLedger([record]))
    expect(written).toContain('## Third-party software\n\nKeep me.')

    const missing = modelRecord('model.transaction', bytes)
    const failedRoot = await fixture({ records: [missing], ledger: stale })
    await expect(
      validateAssetRegistry(failedRoot, { final: false, writeLicenses: true }),
    ).rejects.toThrow(/missing file/i)
    expect(await readFile(join(failedRoot, 'ASSET_LICENSES.md'), 'utf8')).toBe(stale)
  })

  it('accepts CRLF ledger output and preserves CRLF when rewriting its generated block', async () => {
    const bytes = validGlb()
    const record = modelRecord('model.crlf-ledger', bytes)
    const generatedCrlf = renderAssetLicenseLedger([record]).replaceAll('\n', '\r\n')
    const root = await fixture({
      records: [record],
      files: { [record.variants[0].path]: bytes },
      ledger: `# Asset Licenses\r\n\r\n${generatedCrlf}\r\n\r\n## Third-party software\r\n\r\nKeep me.\r\n`,
    })

    await expect(validateAssetRegistry(root, OPTIONS)).resolves.toMatchObject({ assetCount: 1 })

    const staleCrlf =
      '# Asset Licenses\r\n\r\n<!-- BEGIN GENERATED ASSET LICENSES -->\r\nstale\r\n<!-- END GENERATED ASSET LICENSES -->\r\n\r\n## Third-party software\r\n\r\nKeep me.\r\n'
    await writeFile(join(root, 'ASSET_LICENSES.md'), staleCrlf)
    await validateAssetRegistry(root, { final: false, writeLicenses: true })
    const written = await readFile(join(root, 'ASSET_LICENSES.md'), 'utf8')
    expect(written).toContain(generatedCrlf)
    expect(written).toContain('## Third-party software\r\n\r\nKeep me.\r\n')
    expect(written.replaceAll('\r\n', '')).not.toContain('\n')
  })

  it('keeps graph and ledger global while filtering file checks and report counts by slice', async () => {
    const bytes = validGlb()
    const rendering = modelRecord('model.rendering', bytes)
    const world = modelRecord('model.world', bytes, { slice: 'world' })
    const root = await fixture({
      records: [rendering, world],
      files: { [rendering.variants[0].path]: bytes },
    })

    await expect(
      validateAssetRegistry(root, { slice: 'rendering', final: false, writeLicenses: false }),
    ).resolves.toMatchObject({ assetCount: 1, variantCount: 1, verifiedBytes: 12 })
    await expect(validateAssetRegistry(root, OPTIONS)).rejects.toThrow(
      /model\.world.*missing file/i,
    )
  })

  it('requires provenance only in final mode without imposing future inventory counts', async () => {
    const bytes = validGlb()
    const record = modelRecord('model.no-provenance', bytes, { generationRecord: undefined })
    const root = await fixture({ records: [record], files: { [record.variants[0].path]: bytes } })
    await expect(validateAssetRegistry(root, OPTIONS)).resolves.toMatchObject({ assetCount: 1 })
    await expect(
      validateAssetRegistry(root, { final: true, writeLicenses: false }),
    ).rejects.toThrow(/model\.no-provenance.*provenance/i)
  })

  it('rejects a declared generation record that is missing or not a regular file', async () => {
    const bytes = validGlb()
    const missing = modelRecord('model.dangling-provenance', bytes)
    const missingRoot = await fixture({
      records: [missing],
      files: { [missing.variants[0].path]: bytes },
    })
    await rm(join(missingRoot, missing.generationRecord!), { force: true })
    await expect(validateAssetRegistry(missingRoot, OPTIONS)).rejects.toThrow(
      /model\.dangling-provenance.*generation record.*missing/i,
    )

    const directory = modelRecord('model.directory-provenance', bytes)
    const directoryRoot = await fixture({
      records: [directory],
      files: { [directory.variants[0].path]: bytes },
    })
    await rm(join(directoryRoot, directory.generationRecord!), { force: true })
    await mkdir(join(directoryRoot, directory.generationRecord!), { recursive: true })
    await expect(validateAssetRegistry(directoryRoot, OPTIONS)).rejects.toThrow(
      /model\.directory-provenance.*generation record.*regular file/i,
    )
  })

  it.skipIf(process.platform === 'win32')(
    'rejects asset and generation-record symlinks that escape their allowed roots',
    async () => {
      const bytes = validGlb()
      const asset = modelRecord('model.asset-parent-link', bytes)
      const assetRoot = await fixture({ records: [asset] })
      const externalAssets = await mkdtemp(join(tmpdir(), 'turtleback-external-assets-'))
      roots.push(externalAssets)
      await writeFile(join(externalAssets, 'model.asset-parent-link.glb'), bytes)
      const modelsDirectory = join(assetRoot, 'public/assets/models')
      await rm(modelsDirectory, { recursive: true, force: true })
      await mkdir(dirname(modelsDirectory), { recursive: true })
      await symlink(externalAssets, modelsDirectory, 'dir')
      await expect(validateAssetRegistry(assetRoot, OPTIONS)).rejects.toThrow(
        /model\.asset-parent-link.*escapes the public asset root/i,
      )

      const provenance = modelRecord('model.provenance-parent-link', bytes)
      const provenanceRoot = await fixture({
        records: [provenance],
        files: { [provenance.variants[0].path]: bytes },
      })
      const externalRecords = await mkdtemp(join(tmpdir(), 'turtleback-external-records-'))
      roots.push(externalRecords)
      await writeFile(join(externalRecords, 'model.provenance-parent-link.md'), '# outside\n')
      const generationDirectory = join(provenanceRoot, 'docs/assets/generation')
      await rm(generationDirectory, { recursive: true, force: true })
      await symlink(externalRecords, generationDirectory, 'dir')
      await expect(validateAssetRegistry(provenanceRoot, OPTIONS)).rejects.toThrow(
        /model\.provenance-parent-link.*generation record escapes the project root/i,
      )
    },
  )
})
