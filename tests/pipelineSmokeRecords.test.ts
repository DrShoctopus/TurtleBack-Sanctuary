import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { describe, expect, it } from 'vitest'
import { buildPipelineSmokeRecords } from '../scripts/authoring/register-pipeline-smoke'

const ALL_QUALITY = ['low', 'medium', 'high', 'ultra']
const execFileAsync = promisify(execFile)
const KTX2_IDENTIFIER = Buffer.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
])
const KHR_DF_MODEL_UASTC = 166
const KHR_DF_PRIMARIES_BT709 = 1
const KHR_DF_TRANSFER_SRGB = 2

interface GlbContents {
  json: Record<string, any>
  binary: Uint8Array
}

function readGlbContents(bytes: Buffer): GlbContents {
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF')
  expect(bytes.readUInt32LE(4)).toBe(2)
  expect(bytes.readUInt32LE(8)).toBe(bytes.byteLength)

  const jsonLength = bytes.readUInt32LE(12)
  expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a)
  const jsonStart = 20
  const jsonEnd = jsonStart + jsonLength
  const json = JSON.parse(bytes.toString('utf8', jsonStart, jsonEnd).trimEnd()) as Record<
    string,
    any
  >
  expect(bytes.readUInt32LE(jsonEnd + 4)).toBe(0x004e4942)
  const binaryLength = bytes.readUInt32LE(jsonEnd)
  const binaryStart = jsonEnd + 8
  return {
    json,
    binary: new Uint8Array(bytes.buffer, bytes.byteOffset + binaryStart, binaryLength),
  }
}

describe('pipeline-smoke authored records', () => {
  it('builds the exact model and texture records from measured file facts', () => {
    const records = buildPipelineSmokeRecords({
      model: { sha256: 'a'.repeat(64), encodedBytes: 321 },
      texture: { sha256: 'b'.repeat(64), encodedBytes: 654 },
    })

    expect(records).toEqual([
      {
        id: 'model.pipeline-smoke',
        kind: 'model',
        slice: 'rendering',
        variants: [
          {
            id: 'model.pipeline-smoke.lod0',
            path: 'assets/system/pipeline-smoke.glb',
            quality: ALL_QUALITY,
            lod: 0,
            sha256: 'a'.repeat(64),
            encodedBytes: 321,
            decodedBytes: 42,
          },
        ],
        generationRecord: 'docs/assets/generation/pipeline-smoke.md',
        author: 'Turtleback Sanctuary contributors',
        license: 'Original',
        attribution: 'Turtleback Sanctuary contributors',
        preloadRegions: ['system'],
        fallback: { kind: 'procedural', key: 'procedural.debug-box' },
        capabilities: { animation: false },
      },
      {
        id: 'texture.pipeline-smoke',
        kind: 'texture',
        slice: 'rendering',
        variants: [
          {
            id: 'texture.pipeline-smoke.color',
            path: 'assets/system/pipeline-smoke.ktx2',
            quality: ALL_QUALITY,
            sha256: 'b'.repeat(64),
            encodedBytes: 654,
            decodedBytes: 84,
          },
        ],
        generationRecord: 'docs/assets/generation/pipeline-smoke.md',
        author: 'Turtleback Sanctuary contributors',
        license: 'Original',
        attribution: 'Turtleback Sanctuary contributors',
        preloadRegions: ['system'],
        fallback: { kind: 'procedural', key: 'procedural.debug-checker' },
        capabilities: {},
        textureRole: 'color',
      },
    ])
  })

  it('contains genuine required Meshopt streams and an external required KTX2 texture', async () => {
    const bytes = await readFile(join(process.cwd(), 'public/assets/system/pipeline-smoke.glb'))
    const { json, binary } = readGlbContents(bytes)

    expect(json.extensionsUsed).toEqual(['EXT_meshopt_compression', 'KHR_texture_basisu'])
    expect(json.extensionsRequired).toEqual(['EXT_meshopt_compression', 'KHR_texture_basisu'])
    expect(json.nodes).toHaveLength(1)
    expect(json.meshes).toHaveLength(1)
    expect(json.meshes[0].primitives).toHaveLength(1)
    expect(json.buffers).toEqual([{ byteLength: binary.byteLength }, { byteLength: 42 }])
    expect(json.images).toEqual([{ uri: 'pipeline-smoke.ktx2', mimeType: 'image/ktx2' }])
    expect(json.textures[0]).not.toHaveProperty('source')
    expect(json.textures[0].extensions.KHR_texture_basisu).toEqual({ source: 0 })
    expect(json.materials[0].pbrMetallicRoughness.baseColorTexture).toEqual({ index: 0 })

    const [positionView, indexView] = json.bufferViews
    expect(positionView).toMatchObject({ buffer: 1, byteOffset: 0, byteLength: 36, byteStride: 12 })
    expect(indexView).toMatchObject({ buffer: 1, byteOffset: 36, byteLength: 6 })
    const positionCompression = positionView.extensions.EXT_meshopt_compression
    const indexCompression = indexView.extensions.EXT_meshopt_compression
    expect(positionCompression).toMatchObject({
      buffer: 0,
      byteStride: 12,
      count: 3,
      mode: 'ATTRIBUTES',
      filter: 'NONE',
    })
    expect(indexCompression).toMatchObject({
      buffer: 0,
      byteStride: 2,
      count: 3,
      mode: 'TRIANGLES',
      filter: 'NONE',
    })
    expect(positionCompression.byteOffset % 4).toBe(0)
    expect(indexCompression.byteOffset % 4).toBe(0)

    await MeshoptDecoder.ready
    const decode = (extension: Record<string, any>): Uint8Array => {
      const source = binary.subarray(
        extension.byteOffset,
        extension.byteOffset + extension.byteLength,
      )
      const output = new Uint8Array(extension.count * extension.byteStride)
      MeshoptDecoder.decodeGltfBuffer(
        output,
        extension.count,
        extension.byteStride,
        source,
        extension.mode,
        extension.filter,
      )
      return output
    }

    const positions = decode(positionCompression)
    const positionViewData = new DataView(
      positions.buffer,
      positions.byteOffset,
      positions.byteLength,
    )
    expect(
      Array.from({ length: 9 }, (_, index) => positionViewData.getFloat32(index * 4, true)),
    ).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])

    const indices = decode(indexCompression)
    const indexViewData = new DataView(indices.buffer, indices.byteOffset, indices.byteLength)
    expect(
      Array.from({ length: 3 }, (_, index) => indexViewData.getUint16(index * 2, true)),
    ).toEqual([0, 1, 2])
  })

  it('pins the exact 4x4, three-level UASTC sRGB/BT.709 KTX2 container contract', async () => {
    const bytes = await readFile(join(process.cwd(), 'public/assets/system/pipeline-smoke.ktx2'))
    expect(bytes.subarray(0, 12)).toEqual(KTX2_IDENTIFIER)
    expect(bytes.readUInt32LE(12)).toBe(0)
    expect(bytes.readUInt32LE(16)).toBe(1)
    expect(bytes.readUInt32LE(20)).toBe(4)
    expect(bytes.readUInt32LE(24)).toBe(4)
    expect(bytes.readUInt32LE(28)).toBe(0)
    expect(bytes.readUInt32LE(32)).toBe(0)
    expect(bytes.readUInt32LE(36)).toBe(1)
    expect(bytes.readUInt32LE(40)).toBe(3)
    expect(bytes.readUInt32LE(44)).toBe(0)

    const dfdOffset = bytes.readUInt32LE(48)
    const dfdLength = bytes.readUInt32LE(52)
    expect(dfdLength).toBe(44)
    expect(bytes.readUInt32LE(dfdOffset)).toBe(dfdLength)
    expect(bytes.readUInt16LE(dfdOffset + 4)).toBe(0)
    expect(bytes.readUInt16LE(dfdOffset + 6)).toBe(0)
    expect(bytes.readUInt16LE(dfdOffset + 8)).toBe(2)
    expect(bytes.readUInt16LE(dfdOffset + 10)).toBe(40)
    expect(bytes[dfdOffset + 12]).toBe(KHR_DF_MODEL_UASTC)
    expect(bytes[dfdOffset + 13]).toBe(KHR_DF_PRIMARIES_BT709)
    expect(bytes[dfdOffset + 14]).toBe(KHR_DF_TRANSFER_SRGB)

    const levelByteLengths = Array.from({ length: 3 }, (_, index) =>
      Number(bytes.readBigUInt64LE(80 + index * 24 + 8)),
    )
    expect(levelByteLengths).toEqual([16, 16, 16])
  })

  it('ships the official Basis Universal Apache-2.0 license and notice with ledger attribution', async () => {
    const licensePath = join(process.cwd(), 'public/assets/decoders/basis/LICENSE.txt')
    const noticePath = join(process.cwd(), 'public/assets/decoders/basis/NOTICE.txt')
    const [license, notice, ledger] = await Promise.all([
      readFile(licensePath),
      readFile(noticePath, 'utf8'),
      readFile(join(process.cwd(), 'ASSET_LICENSES.md'), 'utf8'),
    ])
    expect(createHash('sha256').update(license).digest('hex')).toBe(
      '065fcf48d6af21c0b75e23be5ed5753aee75c892e1c2cf178fa6736305614a5c',
    )
    expect(license.toString('utf8')).toContain('Copyright 2019-2026 Binomial LLC')
    expect(notice).toContain('Basis Universal™ Supercompressed GPU Texture Compression Library')
    expect(notice).toContain('Copyright © 2016–2026 Binomial LLC.')
    expect(notice).toContain('"Basis Universal" is a trademark of Binomial LLC.')
    expect(ledger).toContain('Basis Universal transcoder (bundled JS/WASM), Binomial LLC')
    expect(ledger).toContain('public/assets/decoders/basis/LICENSE.txt')
    expect(ledger).toContain('public/assets/decoders/basis/NOTICE.txt')
  })

  it('does not clobber the golden KTX2 when strict validation fails', async ({ skip }) => {
    if (process.platform === 'win32') skip()

    const root = await mkdtemp(join(tmpdir(), 'turtleback-ktx-transaction-'))
    const sourceDirectory = join(root, 'assets-src/system')
    const publicDirectory = join(root, 'public/assets/system')
    const binDirectory = join(root, 'bin')
    const goldenPath = join(publicDirectory, 'pipeline-smoke.ktx2')
    const golden = Buffer.from('known-good-golden')
    try {
      await Promise.all([
        mkdir(sourceDirectory, { recursive: true }),
        mkdir(publicDirectory, { recursive: true }),
        mkdir(binDirectory, { recursive: true }),
      ])
      await Promise.all([
        writeFile(join(sourceDirectory, 'pipeline-smoke.png'), Buffer.from('source')),
        writeFile(goldenPath, golden),
        writeFile(
          join(binDirectory, 'toktx'),
          `#!/bin/sh
if [ "$1" = "--version" ]; then echo "toktx v4.4.2"; exit 0; fi
output=''
previous=''
for argument in "$@"; do previous=$output; output=$argument; done
printf 'invalid replacement' > "$previous"
`,
        ),
        writeFile(
          join(binDirectory, 'ktx'),
          `#!/bin/sh
if [ "$1" = "--version" ]; then echo "ktx version: v4.4.2"; exit 0; fi
exit 9
`,
        ),
      ])
      await Promise.all([
        chmod(join(binDirectory, 'toktx'), 0o755),
        chmod(join(binDirectory, 'ktx'), 0o755),
      ])

      await expect(
        execFileAsync(
          '/bin/sh',
          [join(process.cwd(), 'scripts/authoring/generate-pipeline-smoke-ktx2.sh')],
          {
            cwd: root,
            env: { ...process.env, PATH: `${binDirectory}:/usr/bin:/bin` },
          },
        ),
      ).rejects.toThrow()
      expect(await readFile(goldenPath)).toEqual(golden)
      expect(await readdir(publicDirectory)).toEqual(['pipeline-smoke.ktx2'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
