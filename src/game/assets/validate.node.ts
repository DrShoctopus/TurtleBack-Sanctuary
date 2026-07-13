import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, open, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { ZodError } from 'zod'
import {
  ASSET_LICENSES_BEGIN_MARKER,
  ASSET_LICENSES_END_MARKER,
  renderAssetLicenseLedger,
} from './licenseLedger'
import { PROCEDURAL_FALLBACK_KEYS } from './proceduralFallbacks'
import { createAssetRegistry } from './registry'
import { assetManifestSchema, type AssetRecord, type AssetVariant } from './schema'

export interface AssetValidationOptions {
  slice?: 'rendering' | 'world' | 'audio'
  final: boolean
  writeLicenses: boolean
}

export interface AssetValidationReport {
  assetCount: number
  variantCount: number
  verifiedBytes: number
  generatedLedger: string
}

const KTX2_MAGIC = Buffer.from([
  0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
])

interface LedgerSpan {
  start: number
  end: number
  generatedBlock: string
}

class AssetFileValidationError extends Error {}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isStrictlyWithin(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target)
  return (
    pathFromRoot !== '' &&
    pathFromRoot !== '..' &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  )
}

function normalizedLedgerBlock(value: string): string {
  return value.replaceAll('\r\n', '\n')
}

function lineEndingFor(contents: string): '\n' | '\r\n' {
  const firstNewline = contents.indexOf('\n')
  return firstNewline > 0 && contents[firstNewline - 1] === '\r' ? '\r\n' : '\n'
}

function renderWithLineEnding(value: string, lineEnding: '\n' | '\r\n'): string {
  return lineEnding === '\n' ? value : value.replaceAll('\n', '\r\n')
}

function countOccurrences(contents: string, marker: string): number {
  let count = 0
  let cursor = 0
  while (true) {
    const next = contents.indexOf(marker, cursor)
    if (next < 0) return count
    count += 1
    cursor = next + marker.length
  }
}

function findLedgerSpan(contents: string): LedgerSpan {
  const beginCount = countOccurrences(contents, ASSET_LICENSES_BEGIN_MARKER)
  const endCount = countOccurrences(contents, ASSET_LICENSES_END_MARKER)
  if (beginCount !== 1 || endCount !== 1) {
    throw new Error(
      `Asset license ledger must contain exactly one generated marker pair; found ${beginCount} begin and ${endCount} end markers`,
    )
  }

  const start = contents.indexOf(ASSET_LICENSES_BEGIN_MARKER)
  const endMarkerStart = contents.indexOf(ASSET_LICENSES_END_MARKER)
  if (endMarkerStart < start) {
    throw new Error('Asset license ledger generated markers are out of order')
  }
  const end = endMarkerStart + ASSET_LICENSES_END_MARKER.length
  return { start, end, generatedBlock: contents.slice(start, end) }
}

function formatManifestError(error: ZodError, input: unknown): Error {
  const assets =
    typeof input === 'object' && input !== null && 'assets' in input && Array.isArray(input.assets)
      ? input.assets
      : []
  const details = error.issues.map((issue) => {
    const index =
      issue.path[0] === 'assets' && typeof issue.path[1] === 'number' ? issue.path[1] : -1
    const candidate = index >= 0 ? assets[index] : undefined
    const id =
      typeof candidate === 'object' &&
      candidate !== null &&
      'id' in candidate &&
      typeof candidate.id === 'string'
        ? candidate.id
        : index >= 0
          ? `record[${index}]`
          : 'manifest'
    return `Asset ${id} ${issue.path.join('.') || 'root'}: ${issue.message}`
  })
  return new Error(`Invalid asset manifest: ${details.join('; ')}`)
}

async function readManifest(rootDirectory: string): Promise<readonly AssetRecord[]> {
  const manifestPath = join(rootDirectory, 'src/game/assets/manifest.json')
  let contents: string
  try {
    contents = await readFile(manifestPath, 'utf8')
  } catch (error) {
    throw new Error(`Unable to read asset manifest at ${manifestPath}`, { cause: error })
  }

  let input: unknown
  try {
    input = JSON.parse(contents)
  } catch (error) {
    throw new Error(`Asset manifest at ${manifestPath} is not valid JSON`, { cause: error })
  }

  const result = assetManifestSchema.safeParse(input)
  if (!result.success) throw formatManifestError(result.error, input)
  return result.data.assets as readonly AssetRecord[]
}

function assetError(record: AssetRecord, variant: AssetVariant, message: string): Error {
  return new AssetFileValidationError(`Asset ${record.id} variant ${variant.id}: ${message}`)
}

async function readHeader(
  path: string,
  byteLength: number,
  record: AssetRecord,
  variant: AssetVariant,
): Promise<Buffer> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(byteLength)
    const { bytesRead } = await handle.read(buffer, 0, byteLength, 0)
    if (bytesRead !== byteLength) {
      throw assetError(record, variant, `file is too short for its ${byteLength}-byte header`)
    }
    return buffer
  } finally {
    await handle.close()
  }
}

async function validateContainer(
  path: string,
  fileSize: number,
  record: AssetRecord,
  variant: AssetVariant,
): Promise<void> {
  const extension = variant.path.slice(variant.path.lastIndexOf('.')).toLowerCase()
  if (extension === '.glb') {
    const header = await readHeader(path, 12, record, variant)
    if (header.toString('ascii', 0, 4) !== 'glTF') {
      throw assetError(record, variant, 'invalid GLB magic bytes')
    }
    const version = header.readUInt32LE(4)
    if (version !== 2)
      throw assetError(record, variant, `unsupported GLB version ${version}; expected 2`)
    const declaredLength = header.readUInt32LE(8)
    if (declaredLength !== fileSize) {
      throw assetError(
        record,
        variant,
        `GLB declared length ${declaredLength} does not match encoded size ${fileSize}`,
      )
    }
  } else if (extension === '.ktx2') {
    const header = await readHeader(path, KTX2_MAGIC.byteLength, record, variant)
    if (!header.equals(KTX2_MAGIC)) throw assetError(record, variant, 'invalid KTX2 magic bytes')
  }
}

async function streamSha256(path: string): Promise<string> {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(path)) digest.update(chunk)
  return digest.digest('hex')
}

async function validateVariant(
  rootDirectory: string,
  record: AssetRecord,
  variant: AssetVariant,
): Promise<number> {
  const path = join(rootDirectory, 'public', variant.path)
  let fileStats
  try {
    fileStats = await lstat(path)
  } catch (error) {
    throw assetError(record, variant, `missing file ${variant.path}: ${String(error)}`)
  }
  if (fileStats.isSymbolicLink()) {
    throw assetError(record, variant, `${variant.path} must not be a symbolic link`)
  }
  if (!fileStats.isFile())
    throw assetError(record, variant, `${variant.path} is not a regular file`)

  try {
    const [projectRoot, publicRoot, filePath] = await Promise.all([
      realpath(rootDirectory),
      realpath(join(rootDirectory, 'public')),
      realpath(path),
    ])
    if (!isStrictlyWithin(projectRoot, publicRoot)) {
      throw assetError(record, variant, 'the public asset root escapes the project root')
    }
    if (!isStrictlyWithin(publicRoot, filePath)) {
      throw assetError(record, variant, `${variant.path} escapes the public asset root`)
    }
  } catch (error) {
    if (error instanceof AssetFileValidationError) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw assetError(record, variant, `unable to resolve ${variant.path}: ${message}`)
  }
  if (fileStats.size !== variant.encodedBytes) {
    throw assetError(
      record,
      variant,
      `encoded size ${fileStats.size} does not match manifest size ${variant.encodedBytes}`,
    )
  }

  try {
    await validateContainer(path, fileStats.size, record, variant)
    const digest = await streamSha256(path)
    if (digest !== variant.sha256) {
      throw assetError(
        record,
        variant,
        `SHA-256 ${digest} does not match manifest ${variant.sha256}`,
      )
    }
  } catch (error) {
    if (error instanceof AssetFileValidationError) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw assetError(record, variant, `unable to inspect ${variant.path}: ${message}`)
  }
  return fileStats.size
}

async function validateGenerationRecord(rootDirectory: string, record: AssetRecord): Promise<void> {
  if (!record.generationRecord) return
  const path = join(rootDirectory, record.generationRecord)
  let fileStats
  try {
    fileStats = await lstat(path)
  } catch (error) {
    throw new Error(
      `Asset ${record.id} generation record is missing at ${record.generationRecord}: ${String(error)}`,
    )
  }
  if (fileStats.isSymbolicLink()) {
    throw new Error(
      `Asset ${record.id} generation record must not be a symbolic link: ${record.generationRecord}`,
    )
  }
  if (!fileStats.isFile()) {
    throw new Error(
      `Asset ${record.id} generation record is not a regular file: ${record.generationRecord}`,
    )
  }
  try {
    const [projectRoot, filePath] = await Promise.all([realpath(rootDirectory), realpath(path)])
    if (!isStrictlyWithin(projectRoot, filePath)) {
      throw new Error(
        `Asset ${record.id} generation record escapes the project root: ${record.generationRecord}`,
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`Asset ${record.id} `)) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Asset ${record.id} generation record could not be resolved at ${record.generationRecord}: ${message}`,
    )
  }
}

async function replaceLedgerAtomically(path: string, contents: string): Promise<void> {
  const directory = dirname(path)
  const temporaryPath = join(
    directory,
    `.ASSET_LICENSES.md.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  )
  try {
    const currentStats = await stat(path)
    await writeFile(temporaryPath, contents, { encoding: 'utf8', mode: currentStats.mode })
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

export async function validateAssetRegistry(
  rootDirectory: string,
  options: AssetValidationOptions,
): Promise<AssetValidationReport> {
  const records = await readManifest(rootDirectory)
  const registry = createAssetRegistry(records, {
    proceduralFallbackKeys: PROCEDURAL_FALLBACK_KEYS,
  })
  const allRecords = registry.values()

  for (const record of allRecords) await validateGenerationRecord(rootDirectory, record)

  if (options.final) {
    for (const record of allRecords) {
      if (!record.sourceUrl && !record.generationRecord) {
        throw new Error(
          `Asset ${record.id} is missing final provenance; add a source URL or generation record`,
        )
      }
    }
  }

  const generatedLedger = renderAssetLicenseLedger(allRecords)
  const ledgerPath = join(rootDirectory, 'ASSET_LICENSES.md')
  let ledgerContents: string
  try {
    ledgerContents = await readFile(ledgerPath, 'utf8')
  } catch (error) {
    throw new Error(`Unable to read asset license ledger at ${ledgerPath}`, { cause: error })
  }
  const ledgerSpan = findLedgerSpan(ledgerContents)

  const selectedRecords = options.slice
    ? allRecords.filter((record) => record.slice === options.slice)
    : allRecords
  let verifiedBytes = 0
  let variantCount = 0
  for (const record of selectedRecords) {
    for (const variant of [...record.variants].sort((left, right) =>
      compareCodePoints(left.id, right.id),
    )) {
      verifiedBytes += await validateVariant(rootDirectory, record, variant)
      variantCount += 1
    }
  }

  if (options.writeLicenses) {
    const generatedForDocument = renderWithLineEnding(
      generatedLedger,
      lineEndingFor(ledgerContents),
    )
    const nextContents =
      ledgerContents.slice(0, ledgerSpan.start) +
      generatedForDocument +
      ledgerContents.slice(ledgerSpan.end)
    if (nextContents !== ledgerContents) await replaceLedgerAtomically(ledgerPath, nextContents)
  } else if (normalizedLedgerBlock(ledgerSpan.generatedBlock) !== generatedLedger) {
    throw new Error(
      'Asset license ledger drift: run pnpm write:asset-licenses and review the generated rows',
    )
  }

  return {
    assetCount: selectedRecords.length,
    variantCount,
    verifiedBytes,
    generatedLedger,
  }
}
