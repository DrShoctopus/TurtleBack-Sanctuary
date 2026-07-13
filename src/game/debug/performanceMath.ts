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
