import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  assetManifestSchema,
  type AssetManifest,
  type ModelAssetRecord,
  type TextureAssetRecord,
} from '../../src/game/assets/schema'

export interface MeasuredSmokeFiles {
  model: { sha256: string; encodedBytes: number }
  texture: { sha256: string; encodedBytes: number }
}

const QUALITY_LEVELS = ['low', 'medium', 'high', 'ultra'] as const
const GENERATION_RECORD = 'docs/assets/generation/pipeline-smoke.md'
const AUTHOR = 'Turtleback Sanctuary contributors'

export function buildPipelineSmokeRecords(
  input: MeasuredSmokeFiles,
): readonly [ModelAssetRecord, TextureAssetRecord] {
  return [
    {
      id: 'model.pipeline-smoke',
      kind: 'model',
      slice: 'rendering',
      variants: [
        {
          id: 'model.pipeline-smoke.lod0',
          path: 'assets/system/pipeline-smoke.glb',
          quality: QUALITY_LEVELS,
          lod: 0,
          sha256: input.model.sha256,
          encodedBytes: input.model.encodedBytes,
          decodedBytes: 42,
        },
      ],
      generationRecord: GENERATION_RECORD,
      author: AUTHOR,
      license: 'Original',
      attribution: AUTHOR,
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
          quality: QUALITY_LEVELS,
          sha256: input.texture.sha256,
          encodedBytes: input.texture.encodedBytes,
          decodedBytes: 84,
        },
      ],
      generationRecord: GENERATION_RECORD,
      author: AUTHOR,
      license: 'Original',
      attribution: AUTHOR,
      preloadRegions: ['system'],
      fallback: { kind: 'procedural', key: 'procedural.debug-checker' },
      capabilities: {},
      textureRole: 'color',
    },
  ]
}

async function measureFile(path: string): Promise<{ sha256: string; encodedBytes: number }> {
  const fileStats = await stat(path)
  if (!fileStats.isFile()) throw new Error(`Smoke asset is not a regular file: ${path}`)
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(path)) digest.update(chunk)
  return { sha256: digest.digest('hex'), encodedBytes: fileStats.size }
}

function compareCodePoints(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

async function writeManifestAtomically(path: string, manifest: AssetManifest): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

export async function registerPipelineSmoke(rootDirectory = process.cwd()): Promise<void> {
  const manifestPath = resolve(rootDirectory, 'src/game/assets/manifest.json')
  const [manifestContents, model, texture] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    measureFile(resolve(rootDirectory, 'public/assets/system/pipeline-smoke.glb')),
    measureFile(resolve(rootDirectory, 'public/assets/system/pipeline-smoke.ktx2')),
  ])
  const current = assetManifestSchema.parse(JSON.parse(manifestContents)) as AssetManifest
  const smokeRecords = buildPipelineSmokeRecords({ model, texture })
  const smokeIds = new Set(smokeRecords.map(({ id }) => id))
  const next = assetManifestSchema.parse({
    schemaVersion: 1,
    assets: [...current.assets.filter(({ id }) => !smokeIds.has(id)), ...smokeRecords].sort(
      compareCodePoints,
    ),
  }) as AssetManifest
  await writeManifestAtomically(manifestPath, next)
}

function isMainModule(): boolean {
  return (
    process.argv[1] !== undefined &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  )
}

if (isMainModule()) {
  try {
    await registerPipelineSmoke()
    process.stdout.write('Registered pipeline-smoke model and texture assets.\n')
  } catch (error) {
    process.stderr.write(
      `Pipeline-smoke registration failed: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  }
}
