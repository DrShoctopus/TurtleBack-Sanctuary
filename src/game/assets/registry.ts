import manifestJson from './manifest.json'
import type { QualityLevel } from '../core/quality'
import {
  assetRecordSchema,
  parseAssetManifest,
  type AssetByKind,
  type AssetId,
  type AssetKind,
  type AssetRecord,
  type AssetRegistry,
  type AssetVariant,
} from './schema'

const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high', 'ultra']
const ASSET_KINDS: readonly AssetKind[] = [
  'model',
  'texture',
  'environment',
  'animation',
  'music-track',
  'ambience-bed',
  'ambient-detail',
  'wildlife-call',
  'turtle-sound',
]
const EMPTY_PROCEDURAL_FALLBACK_KEYS: ReadonlySet<string> = new Set()

export const canonicalAssetManifest = parseAssetManifest(manifestJson)

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function candidateId(value: unknown, index: number): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string'
  ) {
    return value.id
  }
  return `record[${index}]`
}

function parseRecord(value: AssetRecord, index: number): AssetRecord {
  const result = assetRecordSchema.safeParse(value)
  if (result.success) return result.data as AssetRecord
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
    .join('; ')
  throw new Error(`Asset ${candidateId(value, index)} is invalid: ${details}`)
}

function extensionFor(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot < 0 ? '' : path.slice(dot).toLowerCase()
}

function allowedExtensions(kind: AssetKind): readonly string[] {
  switch (kind) {
    case 'model':
    case 'animation':
      return ['.glb']
    case 'texture':
      return ['.ktx2']
    case 'environment':
      return ['.ktx2', '.hdr', '.exr']
    case 'music-track':
    case 'ambience-bed':
    case 'ambient-detail':
    case 'wildlife-call':
    case 'turtle-sound':
      return ['.mp3']
  }
}

function resourceFamily(
  kind: AssetKind,
): 'model' | 'texture' | 'streaming-audio' | 'buffered-audio' {
  switch (kind) {
    case 'model':
    case 'animation':
      return 'model'
    case 'texture':
    case 'environment':
      return 'texture'
    case 'music-track':
    case 'ambience-bed':
      return 'streaming-audio'
    case 'ambient-detail':
    case 'wildlife-call':
    case 'turtle-sound':
      return 'buffered-audio'
  }
}

function validateVariants(record: AssetRecord): void {
  const qualities = new Set(record.variants.flatMap((variant) => variant.quality))
  const missing = QUALITY_LEVELS.filter((quality) => !qualities.has(quality))
  if (missing.length > 0) {
    throw new Error(`Asset ${record.id} is missing quality coverage: ${missing.join(', ')}`)
  }

  const hasLod = record.variants.map((variant) => variant.lod !== undefined)
  if (hasLod.some(Boolean) && !hasLod.every(Boolean)) {
    throw new Error(`Asset ${record.id} cannot mix LOD and non-LOD variants`)
  }

  if (hasLod.every(Boolean)) {
    let previous = -1
    const levels: number[] = []
    const mappings = new Set<string>()
    for (const variant of record.variants) {
      const lod = variant.lod as 0 | 1 | 2
      if (lod < previous) throw new Error(`Asset ${record.id} has invalid LOD order`)
      previous = lod
      if (!levels.includes(lod)) levels.push(lod)
      for (const quality of variant.quality) {
        const mapping = `${quality}:${lod}`
        if (mappings.has(mapping)) {
          throw new Error(`Asset ${record.id} has ambiguous ${quality} mapping for LOD ${lod}`)
        }
        mappings.add(mapping)
      }
    }
    for (let index = 1; index < levels.length; index++) {
      if (levels[index] !== levels[index - 1] + 1) {
        throw new Error(
          `Asset ${record.id} has an LOD gap between ${levels[index - 1]} and ${levels[index]}`,
        )
      }
    }
    if (levels[0] !== 0) throw new Error(`Asset ${record.id} has an LOD gap before ${levels[0]}`)
  } else {
    const mappings = new Set<QualityLevel>()
    for (const variant of record.variants) {
      for (const quality of variant.quality) {
        if (mappings.has(quality)) {
          throw new Error(`Asset ${record.id} has ambiguous ${quality} non-LOD variants`)
        }
        mappings.add(quality)
      }
    }
  }

  const allowed = allowedExtensions(record.kind)
  for (const variant of record.variants) {
    if (!allowed.includes(extensionFor(variant.path))) {
      throw new Error(
        `Asset ${record.id} variant ${variant.id} has incompatible extension for ${record.kind}`,
      )
    }
  }
}

function validateFallbackCycles(
  records: readonly AssetRecord[],
  byId: ReadonlyMap<string, AssetRecord>,
): void {
  const complete = new Set<string>()
  const visiting: string[] = []
  const visit = (id: string): void => {
    if (complete.has(id)) return
    const cycleIndex = visiting.indexOf(id)
    if (cycleIndex >= 0) {
      const cycle = [...visiting.slice(cycleIndex), id]
      throw new Error(`Asset fallback cycle: ${cycle.join(' -> ')}`)
    }
    visiting.push(id)
    const record = byId.get(id)
    if (record?.fallback.kind === 'asset') visit(record.fallback.id)
    visiting.pop()
    complete.add(id)
  }
  for (const record of records) visit(record.id)
}

export function createAssetRegistry(
  records: readonly AssetRecord[],
  options: { proceduralFallbackKeys: ReadonlySet<string> } = {
    proceduralFallbackKeys: EMPTY_PROCEDURAL_FALLBACK_KEYS,
  },
): AssetRegistry {
  const parsed = records.map(parseRecord)
  const sorted = [...parsed].sort((left, right) => compareCodePoints(left.id, right.id))
  const byId = new Map<string, AssetRecord>()
  for (const record of sorted) {
    if (byId.has(record.id)) throw new Error(`Asset ${record.id} has a duplicate record ID`)
    byId.set(record.id, record)
  }

  const variantIds = new Set<string>()
  for (const record of sorted) {
    validateVariants(record)
    for (const variant of record.variants) {
      if (byId.has(variant.id)) {
        throw new Error(`Asset ${variant.id} collides across the record/variant namespace`)
      }
      if (variantIds.has(variant.id))
        throw new Error(`Asset variant ${variant.id} has a duplicate ID`)
      variantIds.add(variant.id)
    }
  }

  const proceduralKeys = options.proceduralFallbackKeys
  for (const record of sorted) {
    if (record.fallback.kind === 'procedural') {
      if (!proceduralKeys.has(record.fallback.key)) {
        throw new Error(`Asset ${record.id} uses unregistered fallback ${record.fallback.key}`)
      }
      continue
    }
    const fallback = byId.get(record.fallback.id)
    if (!fallback) {
      throw new Error(`Asset ${record.id} references missing fallback ${record.fallback.id}`)
    }
    if (fallback.id === record.id) throw new Error(`Asset ${record.id} cannot fall back to itself`)
    if (resourceFamily(record.kind) !== resourceFamily(fallback.kind)) {
      throw new Error(`Asset ${record.id} has incompatible fallback ${fallback.id}`)
    }
  }
  validateFallbackCycles(sorted, byId)

  const values = Object.freeze([...sorted])
  const byKind = new Map<AssetKind, readonly AssetRecord[]>()
  for (const kind of ASSET_KINDS) {
    byKind.set(kind, Object.freeze(values.filter((record) => record.kind === kind)))
  }

  return Object.freeze({
    get(id: AssetId): AssetRecord {
      const record = byId.get(id)
      if (!record) throw new Error(`Unknown asset ID: ${id}`)
      return record
    },
    has(id: AssetId): boolean {
      return byId.has(id)
    },
    getByKind<K extends AssetKind>(kind: K): readonly AssetByKind[K][] {
      return byKind.get(kind) as readonly AssetByKind[K][]
    },
    values(): readonly AssetRecord[] {
      return values
    },
  })
}

export function resolveAssetVariant(
  record: AssetRecord,
  quality: QualityLevel,
  requestedLod?: 0 | 1 | 2,
): AssetVariant {
  const candidates = record.variants.filter((variant) => variant.quality.includes(quality))
  if (candidates.length === 0) throw new Error(`Asset ${record.id} has no ${quality} variant`)
  const usesLod = candidates[0].lod !== undefined
  if (!usesLod) {
    if (requestedLod !== undefined) throw new Error(`Asset ${record.id} does not use LOD variants`)
    return [...candidates].sort((left, right) => compareCodePoints(left.id, right.id))[0]
  }

  const ordered = [...candidates].sort(
    (left, right) =>
      (left.lod as number) - (right.lod as number) || compareCodePoints(left.id, right.id),
  )
  if (requestedLod === undefined) return ordered[0]
  return (
    ordered.find((variant) => variant.lod === requestedLod) ??
    ordered.find((variant) => (variant.lod as number) > requestedLod) ??
    [...ordered].reverse().find((variant) => (variant.lod as number) < requestedLod)!
  )
}
