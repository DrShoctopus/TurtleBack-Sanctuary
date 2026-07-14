import { afterEach, describe, expect, it } from 'vitest'
import {
  collectSceneProbe,
  registerProbeContributor,
  registerProbeSection,
  type SceneProbeSnapshot,
} from '@/game/debug/probes'

const unregister: Array<() => void> = []

function track(cleanup: () => void): () => void {
  unregister.push(cleanup)
  return cleanup
}

function baseSnapshot(overrides: Partial<SceneProbeSnapshot> = {}): SceneProbeSnapshot {
  return {
    activeCells: [],
    retainedCells: [],
    instancesByFamily: {},
    lodsByFamily: {},
    loadedAssetIds: [],
    fallbackAssetIds: [],
    decodedAssetBytesById: {},
    renderer: { calls: 0, triangles: 0, points: 0, geometries: 0, textures: 0 },
    estimatedTextureBytes: 0,
    sections: {},
    ...overrides,
  }
}

afterEach(() => {
  for (const cleanup of unregister.splice(0).reverse()) cleanup()
})

describe('scene probe contributors', () => {
  it('collects root contributors in stable contributor-ID order', () => {
    const calls: string[] = []
    track(
      registerProbeContributor('z-renderer', () => {
        calls.push('z-renderer')
        return { estimatedTextureBytes: 200 }
      }),
    )
    track(
      registerProbeContributor('a-assets', () => {
        calls.push('a-assets')
        return { estimatedTextureBytes: 100, loadedAssetIds: ['texture.oak'] }
      }),
    )

    const snapshot = collectSceneProbe(baseSnapshot())

    expect(calls).toEqual(['a-assets', 'z-renderer'])
    expect(snapshot.estimatedTextureBytes).toBe(200)
    expect(snapshot.loadedAssetIds).toEqual(['texture.oak'])
  })

  it('rejects a duplicate root contributor ID', () => {
    track(registerProbeContributor('assets', () => ({ loadedAssetIds: [] })))

    expect(() => registerProbeContributor('assets', () => ({}))).toThrow(/duplicate.*assets/i)
  })

  it('unregisters idempotently and allows the contributor ID to be reused', () => {
    const cleanup = track(
      registerProbeContributor('assets', () => ({ loadedAssetIds: ['texture.oak'] })),
    )
    expect(collectSceneProbe(baseSnapshot()).loadedAssetIds).toEqual(['texture.oak'])

    cleanup()
    cleanup()
    expect(collectSceneProbe(baseSnapshot()).loadedAssetIds).toEqual([])

    track(registerProbeContributor('assets', () => ({ loadedAssetIds: ['texture.pine'] })))
    expect(collectSceneProbe(baseSnapshot()).loadedAssetIds).toEqual(['texture.pine'])
  })

  it('merges multiple named contributors into sections.world', () => {
    const calls: string[] = []
    track(
      registerProbeSection('world', 'vegetation', () => {
        calls.push('vegetation')
        return { vegetationInstances: 37 }
      }),
    )
    track(
      registerProbeSection('world', 'spatial', () => {
        calls.push('spatial')
        return {
          centerCell: '2:-1' as const,
          activeCellCount: 9,
          retainedCellCount: 25,
        }
      }),
    )

    const snapshot = collectSceneProbe(baseSnapshot())

    expect(calls).toEqual(['spatial', 'vegetation'])
    expect(snapshot.sections.world).toEqual({
      activeCellCount: 9,
      centerCell: '2:-1',
      retainedCellCount: 25,
      vegetationInstances: 37,
    })
    expect(Object.keys(snapshot.sections.world ?? {})).toEqual([
      'activeCellCount',
      'centerCell',
      'retainedCellCount',
      'vegetationInstances',
    ])
  })

  it('rejects duplicate contributor IDs within one named section', () => {
    track(registerProbeSection('world', 'spatial', () => ({ activeCellCount: 9 })))

    expect(() =>
      registerProbeSection('world', 'spatial', () => ({ retainedCellCount: 25 })),
    ).toThrow(/duplicate.*world.*spatial/i)
  })

  it('unregisters named-section contributors independently and permits ID reuse', () => {
    const cleanup = track(
      registerProbeSection('world', 'vegetation', () => ({ vegetationInstances: 12 })),
    )
    expect(collectSceneProbe(baseSnapshot()).sections.world).toEqual({ vegetationInstances: 12 })

    cleanup()
    cleanup()
    expect(collectSceneProbe(baseSnapshot()).sections.world).toBeUndefined()

    track(registerProbeSection('world', 'vegetation', () => ({ vegetationInstances: 24 })))
    expect(collectSceneProbe(baseSnapshot()).sections.world).toEqual({ vegetationInstances: 24 })
  })

  it('rejects duplicate leaf ownership within one named section', () => {
    track(registerProbeSection('world', 'a-spatial', () => ({ activeCellCount: 9 })))
    track(registerProbeSection('world', 'b-vegetation', () => ({ activeCellCount: 25 })))

    expect(() => collectSceneProbe(baseSnapshot())).toThrow(
      /world.*activeCellCount.*a-spatial.*b-vegetation/i,
    )
  })

  it('leaves optional sections absent when no contributor owns them', () => {
    const snapshot = collectSceneProbe(baseSnapshot())

    expect(snapshot.sections).toEqual({})
    expect(snapshot.sections.turtle).toBeUndefined()
    expect(snapshot.sections.wildlife).toBeUndefined()
    expect(snapshot.sections.audio).toBeUndefined()
    expect(snapshot.sections.atmosphere).toBeUndefined()
  })

  it('sorts IDs and map keys while retaining zero-valued renderer counters', () => {
    const snapshot = collectSceneProbe(
      baseSnapshot({
        activeCells: ['2:0', '-1:0', '0:0'],
        retainedCells: ['1:1', '-2:-2', '0:0'],
        instancesByFamily: { zed: 0, birch: 4, alder: 2 },
        lodsByFamily: {
          zed: { lod2: 0, lod0: 3 },
          alder: { lod1: 2, lod0: 0 },
        },
        loadedAssetIds: ['texture.zed', 'model.alder', 'texture.birch'],
        fallbackAssetIds: ['procedural.zed', 'model.alder'],
        decodedAssetBytesById: {
          'texture.zed': 0,
          'model.alder': 42,
          'texture.birch': 84,
        },
        renderer: { calls: 0, triangles: 0, points: 0, geometries: 0, textures: 0 },
      }),
    )

    expect(snapshot.activeCells).toEqual(['-1:0', '0:0', '2:0'])
    expect(snapshot.retainedCells).toEqual(['-2:-2', '0:0', '1:1'])
    expect(snapshot.loadedAssetIds).toEqual(['model.alder', 'texture.birch', 'texture.zed'])
    expect(snapshot.fallbackAssetIds).toEqual(['model.alder', 'procedural.zed'])
    expect(Object.keys(snapshot.instancesByFamily)).toEqual(['alder', 'birch', 'zed'])
    expect(Object.keys(snapshot.lodsByFamily)).toEqual(['alder', 'zed'])
    expect(Object.keys(snapshot.lodsByFamily.alder)).toEqual(['lod0', 'lod1'])
    expect(Object.keys(snapshot.decodedAssetBytesById)).toEqual([
      'model.alder',
      'texture.birch',
      'texture.zed',
    ])
    expect(snapshot.renderer).toEqual({
      calls: 0,
      triangles: 0,
      points: 0,
      geometries: 0,
      textures: 0,
    })
  })
})
