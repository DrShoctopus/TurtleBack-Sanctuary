import type { QualityLevel } from '../core/quality'
import { percentile } from '../core/frameTimeStats'
import { resolveAssetVariant } from '../assets/registry'
import type { AssetRecord } from '../assets/schema'
import type { SceneProbeSnapshot } from './probes'

export interface FrameTimePercentiles {
  readonly p50FrameMs: number
  readonly p95FrameMs: number
  readonly p99FrameMs: number
}

export interface RendererInfoLike {
  readonly render: {
    readonly calls: number
    readonly triangles: number
    readonly points: number
  }
  readonly memory: {
    readonly geometries: number
    readonly textures: number
  }
}

export type RendererCounters = SceneProbeSnapshot['renderer']

export interface RendererMemoryEstimate {
  readonly renderer: RendererCounters
  readonly estimatedTextureBytes: number
}

export interface MemoryPlateauSample {
  readonly elapsedMs: number
  readonly workingSetBytes: number
  readonly rendererGeometries: number
  readonly rendererTextures: number
}

export interface MemoryPlateauReport {
  readonly sampleCount: number
  readonly finalWindowSampleCount: number
  readonly finalWindowMs: number
  readonly startWorkingSetBytes: number
  readonly endWorkingSetBytes: number
  readonly growthPercent: number
  readonly maxGrowthPercent: number
  readonly maxRendererGeometries: number
  readonly finalRendererGeometries: number
  readonly maxRendererTextures: number
  readonly finalRendererTextures: number
  readonly passed: boolean
}

export function frameTimePercentiles(samples: readonly number[]): FrameTimePercentiles {
  return {
    p50FrameMs: percentile(samples, 0.5),
    p95FrameMs: percentile(samples, 0.95),
    p99FrameMs: percentile(samples, 0.99),
  }
}

export function rendererCounters(info: RendererInfoLike): RendererCounters {
  return {
    calls: info.render.calls,
    triangles: info.render.triangles,
    points: info.render.points,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
  }
}

export function estimateTextureBytes(
  records: readonly AssetRecord[],
  loadedAssetIds: readonly string[],
  quality: QualityLevel,
): number {
  const loaded = new Set(loadedAssetIds)
  const counted = new Set<string>()
  let total = 0

  for (const record of records) {
    if (
      counted.has(record.id) ||
      !loaded.has(record.id) ||
      (record.kind !== 'texture' && record.kind !== 'environment')
    ) {
      continue
    }
    counted.add(record.id)
    total += resolveAssetVariant(record, quality).decodedBytes
  }

  return total
}

export function estimateRendererMemory(
  info: RendererInfoLike,
  records: readonly AssetRecord[],
  loadedAssetIds: readonly string[],
  quality: QualityLevel,
): RendererMemoryEstimate {
  return {
    renderer: rendererCounters(info),
    estimatedTextureBytes: estimateTextureBytes(records, loadedAssetIds, quality),
  }
}

function assertFiniteNonnegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and >= 0`)
}

function median(values: readonly number[]): number {
  return percentile(values, 0.5)
}

export function analyzeMemoryPlateau(
  samples: readonly MemoryPlateauSample[],
  options: { readonly finalWindowMs: number; readonly maxGrowthPercent: number },
): MemoryPlateauReport {
  if (samples.length < 2) throw new RangeError('memory plateau requires at least two samples')
  if (!Number.isFinite(options.finalWindowMs) || options.finalWindowMs <= 0) {
    throw new RangeError('finalWindowMs must be finite and > 0')
  }
  assertFiniteNonnegative('maxGrowthPercent', options.maxGrowthPercent)

  let previousElapsed = -1
  for (const sample of samples) {
    assertFiniteNonnegative('elapsedMs', sample.elapsedMs)
    if (sample.elapsedMs <= previousElapsed) {
      throw new RangeError('memory plateau samples must have strictly increasing elapsedMs')
    }
    previousElapsed = sample.elapsedMs
    if (!Number.isFinite(sample.workingSetBytes) || sample.workingSetBytes <= 0) {
      throw new RangeError('workingSetBytes must be finite and > 0')
    }
    assertFiniteNonnegative('rendererGeometries', sample.rendererGeometries)
    assertFiniteNonnegative('rendererTextures', sample.rendererTextures)
  }

  const endElapsed = samples.at(-1)!.elapsedMs
  if (endElapsed < options.finalWindowMs) {
    throw new RangeError('memory plateau samples do not cover the requested final window')
  }
  const windowStart = endElapsed - options.finalWindowMs
  const finalWindow = samples.filter((sample) => sample.elapsedMs >= windowStart)
  if (finalWindow.length < 2) {
    throw new RangeError('memory plateau final window requires at least two samples')
  }

  const bucketMs = Math.min(5 * 60_000, options.finalWindowMs / 4)
  const startBucket = finalWindow.filter((sample) => sample.elapsedMs <= windowStart + bucketMs)
  const endBucket = finalWindow.filter((sample) => sample.elapsedMs >= endElapsed - bucketMs)
  if (startBucket.length === 0 || endBucket.length === 0) {
    throw new RangeError('memory plateau final window does not cover both comparison buckets')
  }

  const startWorkingSetBytes = median(startBucket.map((sample) => sample.workingSetBytes))
  const endWorkingSetBytes = median(endBucket.map((sample) => sample.workingSetBytes))
  const growthPercent = ((endWorkingSetBytes - startWorkingSetBytes) / startWorkingSetBytes) * 100
  const maxRendererGeometries = Math.max(...finalWindow.map((sample) => sample.rendererGeometries))
  const maxRendererTextures = Math.max(...finalWindow.map((sample) => sample.rendererTextures))
  const last = finalWindow.at(-1)!

  return {
    sampleCount: samples.length,
    finalWindowSampleCount: finalWindow.length,
    finalWindowMs: options.finalWindowMs,
    startWorkingSetBytes,
    endWorkingSetBytes,
    growthPercent,
    maxGrowthPercent: options.maxGrowthPercent,
    maxRendererGeometries,
    finalRendererGeometries: last.rendererGeometries,
    maxRendererTextures,
    finalRendererTextures: last.rendererTextures,
    passed: growthPercent < options.maxGrowthPercent,
  }
}
