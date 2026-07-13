import { z } from 'zod'
import type { QualityLevel } from '../core/quality'
import { assertStaticAssetPath } from './urls'

export type AssetKind =
  | 'model'
  | 'texture'
  | 'environment'
  | 'animation'
  | 'music-track'
  | 'ambience-bed'
  | 'ambient-detail'
  | 'wildlife-call'
  | 'turtle-sound'
export type AssetLicense = 'Original' | 'CC0-1.0' | 'CC-BY-4.0'
export type AssetId = string

export interface AssetVariant {
  id: AssetId
  path: string
  quality: readonly QualityLevel[]
  lod?: 0 | 1 | 2
  sha256: string
  encodedBytes: number
  decodedBytes: number
}

export type AssetFallback = { kind: 'asset'; id: AssetId } | { kind: 'procedural'; key: string }

export interface BaseAssetRecord {
  id: AssetId
  slice: 'rendering' | 'world' | 'audio'
  variants: readonly AssetVariant[]
  sourceUrl?: string
  generationRecord?: string
  author: string
  license: AssetLicense
  attribution: string
  preloadRegions: readonly string[]
  fallback: AssetFallback
  capabilities: {
    wetness?: boolean
    wind?: boolean
    animation?: boolean
    materialFamily?: string
  }
}

export type ModelAssetRecord = BaseAssetRecord & {
  kind: 'model'
  capabilities: BaseAssetRecord['capabilities'] & { animation: boolean }
}
export type TextureAssetRecord = BaseAssetRecord & {
  kind: 'texture'
  textureRole: 'color' | 'normal' | 'roughness' | 'ao' | 'emissive' | 'mask'
}
export type EnvironmentAssetRecord = BaseAssetRecord & { kind: 'environment' }
export type AnimationAssetRecord = BaseAssetRecord & { kind: 'animation' }
export type TimedAudioAssetRecord<K extends AssetKind> = BaseAssetRecord & {
  kind: K
  durationSec: number
}
export interface AssetByKind {
  model: ModelAssetRecord
  texture: TextureAssetRecord
  environment: EnvironmentAssetRecord
  animation: AnimationAssetRecord
  'music-track': TimedAudioAssetRecord<'music-track'>
  'ambience-bed': TimedAudioAssetRecord<'ambience-bed'>
  'ambient-detail': TimedAudioAssetRecord<'ambient-detail'>
  'wildlife-call': TimedAudioAssetRecord<'wildlife-call'>
  'turtle-sound': TimedAudioAssetRecord<'turtle-sound'>
}
export type AssetRecord = AssetByKind[keyof AssetByKind]

export interface AssetRegistry {
  get(id: AssetId): AssetRecord
  has(id: AssetId): boolean
  getByKind<K extends AssetKind>(kind: K): readonly AssetByKind[K][]
  values(): readonly AssetRecord[]
}

export interface AssetManifest {
  schemaVersion: 1
  assets: readonly AssetRecord[]
}

const QUALITY_LEVELS = ['low', 'medium', 'high', 'ultra'] as const
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

const assetIdSchema = z.string().regex(ID_PATTERN, 'must be a stable lowercase asset ID')
const nonblankSchema = z
  .string()
  .refine((value) => value.trim().length > 0 && value === value.trim(), {
    message: 'must be nonblank with no surrounding whitespace',
  })
const safeRelativePathSchema = z.string().superRefine((value, context) => {
  try {
    assertStaticAssetPath(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'must be a safe relative path' })
  }
})
function usesHttpProtocol(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
const sourceUrlSchema = z
  .string()
  .url()
  .refine(usesHttpProtocol, { message: 'must use http or https' })
const qualitySchema = z
  .array(z.enum(QUALITY_LEVELS))
  .min(1)
  .superRefine((levels, context) => {
    const seen = new Set<QualityLevel>()
    for (const [index, level] of levels.entries()) {
      if (seen.has(level)) {
        context.addIssue({ code: 'custom', path: [index], message: `duplicates quality ${level}` })
      }
      seen.add(level)
    }
  })

export const assetVariantSchema = z
  .object({
    id: assetIdSchema,
    path: safeRelativePathSchema,
    quality: qualitySchema,
    lod: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    sha256: z.string().regex(SHA256_PATTERN, 'must be a lowercase SHA-256 digest'),
    encodedBytes: z.number().int().positive(),
    decodedBytes: z.number().int().positive(),
  })
  .strict()

const fallbackSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('asset'), id: assetIdSchema }).strict(),
  z.object({ kind: z.literal('procedural'), key: assetIdSchema }).strict(),
])
const capabilitiesSchema = z
  .object({
    wetness: z.boolean().optional(),
    wind: z.boolean().optional(),
    animation: z.boolean().optional(),
    materialFamily: nonblankSchema.optional(),
  })
  .strict()
const modelCapabilitiesSchema = z
  .object({
    wetness: z.boolean().optional(),
    wind: z.boolean().optional(),
    animation: z.boolean(),
    materialFamily: nonblankSchema.optional(),
  })
  .strict()

const baseShape = {
  id: assetIdSchema,
  slice: z.enum(['rendering', 'world', 'audio']),
  variants: z.array(assetVariantSchema).min(1),
  sourceUrl: sourceUrlSchema.optional(),
  generationRecord: safeRelativePathSchema.optional(),
  author: nonblankSchema,
  license: z.enum(['Original', 'CC0-1.0', 'CC-BY-4.0']),
  attribution: nonblankSchema,
  preloadRegions: z.array(assetIdSchema).superRefine((regions, context) => {
    const seen = new Set<string>()
    for (const [index, region] of regions.entries()) {
      if (seen.has(region)) {
        context.addIssue({ code: 'custom', path: [index], message: `duplicates region ${region}` })
      }
      seen.add(region)
    }
  }),
  fallback: fallbackSchema,
} as const

const modelRecordSchema = z
  .object({ ...baseShape, kind: z.literal('model'), capabilities: modelCapabilitiesSchema })
  .strict()
const textureRecordSchema = z
  .object({
    ...baseShape,
    kind: z.literal('texture'),
    capabilities: capabilitiesSchema,
    textureRole: z.enum(['color', 'normal', 'roughness', 'ao', 'emissive', 'mask']),
  })
  .strict()
const environmentRecordSchema = z
  .object({ ...baseShape, kind: z.literal('environment'), capabilities: capabilitiesSchema })
  .strict()
const animationRecordSchema = z
  .object({ ...baseShape, kind: z.literal('animation'), capabilities: capabilitiesSchema })
  .strict()

function timedAudioRecordSchema<
  K extends Exclude<AssetKind, 'model' | 'texture' | 'environment' | 'animation'>,
>(kind: K) {
  return z
    .object({
      ...baseShape,
      kind: z.literal(kind),
      capabilities: capabilitiesSchema,
      durationSec: z.number().finite().positive(),
    })
    .strict()
}

export const assetRecordSchema = z.discriminatedUnion('kind', [
  modelRecordSchema,
  textureRecordSchema,
  environmentRecordSchema,
  animationRecordSchema,
  timedAudioRecordSchema('music-track'),
  timedAudioRecordSchema('ambience-bed'),
  timedAudioRecordSchema('ambient-detail'),
  timedAudioRecordSchema('wildlife-call'),
  timedAudioRecordSchema('turtle-sound'),
])

export const assetManifestSchema = z
  .object({ schemaVersion: z.literal(1), assets: z.array(assetRecordSchema) })
  .strict()

export function parseAssetManifest(value: unknown): AssetManifest {
  return assetManifestSchema.parse(value) as AssetManifest
}
