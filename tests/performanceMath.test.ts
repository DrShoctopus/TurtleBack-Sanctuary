import { describe, expect, it } from 'vitest'
import {
  analyzeMemoryPlateau,
  estimateRendererMemory,
  estimateTextureBytes,
  frameTimePercentiles,
  rendererCounters,
} from '@/game/debug/performanceMath'
import type { AssetRecord, AssetVariant } from '@/game/assets/schema'
import { GRAPHICS_PERFORMANCE_CONTRACT } from '@/game/debug/performanceContract'

const SHA = 'a'.repeat(64)

function variant(id: string, quality: AssetVariant['quality'], decodedBytes: number): AssetVariant {
  return {
    id,
    path: id.endsWith('environment') ? `assets/${id}.hdr` : `assets/${id}.ktx2`,
    quality,
    sha256: SHA,
    encodedBytes: 10,
    decodedBytes,
  }
}

const records: readonly AssetRecord[] = [
  {
    id: 'texture.canopy',
    kind: 'texture',
    slice: 'rendering',
    variants: [
      variant('texture.canopy.low', ['low', 'medium'], 100),
      variant('texture.canopy.high', ['high', 'ultra'], 400),
    ],
    author: 'Tests',
    license: 'Original',
    attribution: 'Tests',
    preloadRegions: [],
    fallback: { kind: 'procedural', key: 'procedural.debug-checker' },
    capabilities: {},
    textureRole: 'color',
  },
  {
    id: 'environment.sky',
    kind: 'environment',
    slice: 'rendering',
    variants: [
      variant('environment.sky.low.environment', ['low', 'medium'], 200),
      variant('environment.sky.high.environment', ['high', 'ultra'], 800),
    ],
    author: 'Tests',
    license: 'Original',
    attribution: 'Tests',
    preloadRegions: [],
    fallback: { kind: 'procedural', key: 'procedural.debug-checker' },
    capabilities: {},
  },
  {
    id: 'model.tree',
    kind: 'model',
    slice: 'world',
    variants: [
      {
        ...variant('model.tree.lod0', ['low', 'medium', 'high', 'ultra'], 50_000),
        path: 'assets/model.tree.glb',
        lod: 0,
      },
    ],
    author: 'Tests',
    license: 'Original',
    attribution: 'Tests',
    preloadRegions: [],
    fallback: { kind: 'procedural', key: 'procedural.debug-box' },
    capabilities: { animation: false },
  },
  {
    id: 'music.theme',
    kind: 'music-track',
    slice: 'audio',
    variants: [
      {
        ...variant('music.theme.stream', ['low', 'medium', 'high', 'ultra'], 90_000),
        path: 'assets/music.theme.mp3',
      },
    ],
    author: 'Tests',
    license: 'Original',
    attribution: 'Tests',
    preloadRegions: [],
    fallback: { kind: 'asset', id: 'music.theme' },
    capabilities: {},
    durationSec: 60,
  },
]

describe('performance math', () => {
  it('keeps the named frame-time and traversal release thresholds explicit', () => {
    expect(GRAPHICS_PERFORMANCE_CONTRACT).toMatchObject({
      high: { referenceId: 'high-dedicated', maxP95FrameMs: 16.7 },
      low: { referenceId: 'low-integrated', maxP95FrameMs: 33.3 },
      soak: {
        durationMs: 30 * 60_000,
        finalWindowMs: 20 * 60_000,
        maxMemoryGrowthPercent: 10,
        maxCellTransitionsPerMinute: 18,
      },
    })
  })

  it('reports p50, p95, and p99 through the canonical nearest-rank percentile helper', () => {
    const samples = Array.from({ length: 100 }, (_, index) => 100 - index)

    expect(frameTimePercentiles(samples)).toEqual({
      p50FrameMs: 50,
      p95FrameMs: 95,
      p99FrameMs: 99,
    })
    expect(samples[0]).toBe(100)
    expect(samples.at(-1)).toBe(1)
  })

  it('selects the quality variant for each loaded texture or environment exactly once', () => {
    const loaded = [
      'texture.canopy',
      'environment.sky',
      'texture.canopy',
      'model.tree',
      'music.theme',
      'texture.unknown',
    ]

    expect(estimateTextureBytes(records, loaded, 'low')).toBe(300)
    expect(estimateTextureBytes(records, loaded, 'high')).toBe(1_200)
  })

  it('does not inflate texture memory with model, audio, or unloaded texture bytes', () => {
    expect(estimateTextureBytes(records, ['model.tree', 'music.theme'], 'ultra')).toBe(0)
    expect(estimateTextureBytes(records, ['texture.canopy'], 'ultra')).toBe(400)
  })

  it('retains explicit zero renderer counters and combines them with texture estimates', () => {
    const info = {
      render: { calls: 0, triangles: 0, points: 0 },
      memory: { geometries: 0, textures: 0 },
    }

    expect(rendererCounters(info)).toEqual({
      calls: 0,
      triangles: 0,
      points: 0,
      geometries: 0,
      textures: 0,
    })
    expect(
      estimateRendererMemory(info, records, ['texture.canopy', 'environment.sky'], 'high'),
    ).toEqual({
      renderer: {
        calls: 0,
        triangles: 0,
        points: 0,
        geometries: 0,
        textures: 0,
      },
      estimatedTextureBytes: 1_200,
    })
  })

  it('measures final-window memory growth from bounded median buckets', () => {
    const samples = Array.from({ length: 31 }, (_, minute) => ({
      elapsedMs: minute * 60_000,
      workingSetBytes: minute < 10 ? 900 + minute * 10 : 1_000 + (minute - 10) * 3,
      rendererGeometries: 240 + (minute % 2),
      rendererTextures: 44,
    }))

    const report = analyzeMemoryPlateau(samples, {
      finalWindowMs: 20 * 60_000,
      maxGrowthPercent: 10,
    })
    expect(report.sampleCount).toBe(31)
    expect(report.finalWindowSampleCount).toBe(21)
    expect(report.startWorkingSetBytes).toBe(1006)
    expect(report.endWorkingSetBytes).toBe(1051)
    expect(report.growthPercent).toBeCloseTo(4.4732, 4)
    expect(report.maxRendererGeometries).toBe(241)
    expect(report.finalRendererTextures).toBe(44)
    expect(report.passed).toBe(true)
  })

  it('rejects growing, unordered, and under-duration memory traces', () => {
    const growing = [
      { elapsedMs: 0, workingSetBytes: 100, rendererGeometries: 1, rendererTextures: 1 },
      { elapsedMs: 10, workingSetBytes: 120, rendererGeometries: 1, rendererTextures: 1 },
      { elapsedMs: 20, workingSetBytes: 130, rendererGeometries: 1, rendererTextures: 1 },
    ]
    expect(analyzeMemoryPlateau(growing, { finalWindowMs: 20, maxGrowthPercent: 10 }).passed).toBe(
      false,
    )
    expect(() =>
      analyzeMemoryPlateau([growing[1], growing[0]], {
        finalWindowMs: 10,
        maxGrowthPercent: 10,
      }),
    ).toThrow(/strictly increasing/i)
    expect(() =>
      analyzeMemoryPlateau(growing.slice(0, 2), {
        finalWindowMs: 20,
        maxGrowthPercent: 10,
      }),
    ).toThrow(/do not cover/i)
  })
})
