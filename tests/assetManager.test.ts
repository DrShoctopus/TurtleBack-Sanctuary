import { describe, expect, it, vi } from 'vitest'
import {
  AnimationClip,
  Bone,
  BoxGeometry,
  DataTexture,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  ShaderMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  type WebGLRenderer,
} from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  AssetManager,
  type AssetDiagnostics,
  type AssetPreloadLease,
  type ProceduralFallbackFactories,
} from '@/game/assets/AssetManager'
import {
  ASSET_PIPELINE_AUTHORED_MARK,
  ASSET_PIPELINE_FALLBACK_MARK,
  AssetPreloadCoordinator,
  markAssetPipelineReadiness,
} from '@/game/assets/AssetProvider'
import { AssetFailureRouter } from '@/game/assets/AssetFailureRouter'
import {
  readActiveAssetDiagnostics,
  registerActiveAssetDiagnostics,
} from '@/game/assets/diagnostics'
import {
  bridgeBasisWorkerFailures,
  cloneModelAsset,
  createAuthoredAssetLoaders,
  type AuthoredAssetLoaders,
  type ModelAsset,
} from '@/game/assets/loaders'
import { createAssetRegistry } from '@/game/assets/registry'
import type {
  AssetFallback,
  AssetRecord,
  AssetVariant,
  ModelAssetRecord,
  TextureAssetRecord,
} from '@/game/assets/schema'
import {
  BASIS_TRANSCODER_BOOTSTRAP_MESSAGE,
  BASIS_TRANSCODER_WORKER_FILENAME,
} from '@/shared/basisTranscoder'

const QUALITIES = ['low', 'medium', 'high', 'ultra'] as const
const SHA = 'a'.repeat(64)
const PROCEDURAL_KEYS = new Set([
  'procedural.debug-box',
  'procedural.debug-checker',
  'procedural.model-throws',
])

function variant(id: string, path: string, decodedBytes: number, lod?: 0 | 1 | 2): AssetVariant {
  return {
    id,
    path,
    quality: QUALITIES,
    ...(lod === undefined ? {} : { lod }),
    sha256: SHA,
    encodedBytes: 10,
    decodedBytes,
  }
}

function modelRecord(
  id: string,
  fallback: AssetFallback,
  variants: readonly AssetVariant[] = [variant(`${id}.lod0`, `assets/${id}.glb`, 42, 0)],
): ModelAssetRecord {
  return {
    id,
    kind: 'model',
    slice: 'rendering',
    variants,
    author: 'Tests',
    license: 'Original',
    attribution: 'Test fixture',
    preloadRegions: [],
    fallback,
    capabilities: { animation: false },
  }
}

function textureRecord(id: string, fallback: AssetFallback): TextureAssetRecord {
  return {
    id,
    kind: 'texture',
    slice: 'rendering',
    variants: [variant(`${id}.color`, `assets/${id}.ktx2`, 84)],
    author: 'Tests',
    license: 'Original',
    attribution: 'Test fixture',
    preloadRegions: [],
    fallback,
    capabilities: {},
    textureRole: 'color',
  }
}

function animationRecord(id: string, fallback: AssetFallback): AssetRecord {
  return {
    ...modelRecord(id, fallback),
    kind: 'animation',
    capabilities: { animation: true },
  }
}

function environmentRecord(id: string, fallback: AssetFallback): AssetRecord {
  const texture = textureRecord(id, fallback)
  const { textureRole, ...record } = texture
  void textureRole
  return { ...record, kind: 'environment' }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function disposableModel() {
  const texture = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshBasicMaterial({ map: texture })
  const disposeTexture = vi.spyOn(texture, 'dispose')
  const disposeGeometry = vi.spyOn(geometry, 'dispose')
  const disposeMaterial = vi.spyOn(material, 'dispose')
  const scene = new Group()
  scene.add(new Mesh(geometry, material))
  const gltf = { scene, animations: [new AnimationClip('idle', 1, [])] } as unknown as GLTF
  return { gltf, disposeTexture, disposeGeometry, disposeMaterial }
}

function sharedResourceModel() {
  const texture = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshBasicMaterial({ map: texture })
  const disposeTexture = vi.spyOn(texture, 'dispose')
  const disposeGeometry = vi.spyOn(geometry, 'dispose')
  const disposeMaterial = vi.spyOn(material, 'dispose')
  const scene = new Group()
  scene.add(new Mesh(geometry, material), new Mesh(geometry, material))
  const gltf = { scene, animations: [] } as unknown as GLTF
  return { gltf, disposeTexture, disposeGeometry, disposeMaterial }
}

function proceduralModel(dispose = vi.fn()): ModelAsset {
  const geometry = new BoxGeometry(1, 1, 1)
  geometry.dispose = dispose
  const scene = new Group()
  scene.add(new Mesh(geometry, new MeshBasicMaterial()))
  return { scene, animations: [] }
}

function skinnedModel(material: MeshBasicMaterial | ShaderMaterial) {
  const geometry = new BoxGeometry(1, 1, 1)
  const vertexCount = geometry.getAttribute('position').count
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(vertexCount * 4), 4))
  const weights = new Float32Array(vertexCount * 4)
  for (let index = 0; index < vertexCount; index++) weights[index * 4] = 1
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4))
  const bone = new Bone()
  const mesh = new SkinnedMesh(geometry, material)
  mesh.add(bone)
  const skeleton = new Skeleton([bone])
  mesh.bind(skeleton)
  const scene = new Group()
  scene.add(mesh)
  return {
    gltf: { scene, animations: [] } as unknown as GLTF,
    geometry,
    material,
    skeleton,
  }
}

interface ManagerHarness {
  manager: AssetManager
  gltfLoad: ReturnType<typeof vi.fn>
  textureLoad: ReturnType<typeof vi.fn>
  disposeLoaders: ReturnType<typeof vi.fn>
  cloneModel: ReturnType<typeof vi.fn>
  resolveUrl: ReturnType<typeof vi.fn>
}

function makeHarness(input: {
  records: readonly AssetRecord[]
  modelLoad?: (url: string) => Promise<GLTF>
  textureLoad?: (url: string) => Promise<DataTexture>
  proceduralFallbacks?: ProceduralFallbackFactories
  failureRouter?: AssetFailureRouter
}): ManagerHarness {
  const gltfLoad = vi.fn(input.modelLoad ?? (async () => disposableModel().gltf))
  const textureLoad = vi.fn(
    input.textureLoad ?? (async () => new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)),
  )
  const disposeLoaders = vi.fn()
  const cloneModel = vi.fn((gltf: GLTF) => cloneModelAsset(gltf))
  const loaders = {
    gltf: { loadAsync: gltfLoad },
    ktx2: { loadAsync: textureLoad },
    cloneModel,
    dispose: disposeLoaders,
  } as unknown as AuthoredAssetLoaders
  const resolveUrl = vi.fn((path: string) => `https://assets.test/root/${path}`)
  const proceduralFallbacks =
    input.proceduralFallbacks ??
    ({
      models: { 'procedural.debug-box': () => proceduralModel() },
      textures: {
        'procedural.debug-checker': () => new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1),
      },
    } satisfies ProceduralFallbackFactories)
  const registry = createAssetRegistry(input.records, {
    proceduralFallbackKeys: PROCEDURAL_KEYS,
  })
  const manager = new AssetManager({
    registry,
    loaders,
    proceduralFallbacks,
    resolveUrl,
    ...(input.failureRouter ? { failureRouter: input.failureRouter } : {}),
  })
  return { manager, gltfLoad, textureLoad, disposeLoaders, cloneModel, resolveUrl }
}

describe('AssetManager', () => {
  it('de-duplicates concurrent requests, clones model scenes, and disposes after final release', async () => {
    const source = disposableModel()
    const pending = deferred<GLTF>()
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: () => pending.promise,
    })

    const firstPromise = harness.manager.acquireModel('model.primary', 'high')
    const secondPromise = harness.manager.acquireModel('model.primary', 'high')
    expect(harness.gltfLoad).toHaveBeenCalledOnce()
    expect(harness.gltfLoad).toHaveBeenCalledWith(
      'https://assets.test/root/assets/model.primary.glb',
    )

    pending.resolve(source.gltf)
    const [first, second] = await Promise.all([firstPromise, secondPromise])
    expect(first.value.scene).not.toBe(second.value.scene)
    expect(first.value.scene.children[0]).not.toBe(second.value.scene.children[0])
    expect((first.value.scene.children[0] as Mesh).geometry).toBe(
      (second.value.scene.children[0] as Mesh).geometry,
    )
    const firstMaterial = (first.value.scene.children[0] as Mesh).material as MeshBasicMaterial
    const secondMaterial = (second.value.scene.children[0] as Mesh).material as MeshBasicMaterial
    expect(firstMaterial).not.toBe(secondMaterial)
    expect(firstMaterial.map).toBe(secondMaterial.map)
    expect(first.value.animations[0]).toBe(second.value.animations[0])
    firstMaterial.color.set(0x00ff00)
    expect(secondMaterial.color.getHex()).not.toBe(firstMaterial.color.getHex())
    const disposeFirstMaterial = vi.spyOn(firstMaterial, 'dispose')
    const disposeSecondMaterial = vi.spyOn(secondMaterial, 'dispose')

    first.release()
    first.release()
    expect(disposeFirstMaterial).toHaveBeenCalledOnce()
    expect(disposeSecondMaterial).not.toHaveBeenCalled()
    expect(source.disposeGeometry).not.toHaveBeenCalled()
    second.release()
    expect(disposeSecondMaterial).toHaveBeenCalledOnce()
    expect(source.disposeGeometry).toHaveBeenCalledOnce()
    expect(source.disposeMaterial).toHaveBeenCalledOnce()
  })

  it('disposes shared model geometry, material, and textures exactly once', async () => {
    const source = sharedResourceModel()
    const harness = makeHarness({
      records: [modelRecord('model.shared', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: async () => source.gltf,
    })

    const lease = await harness.manager.acquireModel('model.shared', 'high')
    lease.release()
    lease.release()

    expect(source.disposeGeometry).toHaveBeenCalledOnce()
    expect(source.disposeMaterial).toHaveBeenCalledOnce()
    expect(source.disposeTexture).toHaveBeenCalledOnce()
  })

  it('gives Line and Points lease-owned materials while sharing and disposing base resources', async () => {
    const geometry = new BoxGeometry(1, 1, 1)
    const texture = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    const lineMaterial = new LineBasicMaterial()
    const pointsMaterial = new PointsMaterial({ map: texture })
    const disposeGeometry = vi.spyOn(geometry, 'dispose')
    const disposeTexture = vi.spyOn(texture, 'dispose')
    const disposeLineMaterial = vi.spyOn(lineMaterial, 'dispose')
    const disposePointsMaterial = vi.spyOn(pointsMaterial, 'dispose')
    const scene = new Group()
    scene.add(new Line(geometry, lineMaterial), new Points(geometry, pointsMaterial))
    const gltf = { scene, animations: [] } as unknown as GLTF
    const harness = makeHarness({
      records: [
        modelRecord('model.renderables', { kind: 'procedural', key: 'procedural.debug-box' }),
      ],
      modelLoad: async () => gltf,
    })

    const [first, second] = await Promise.all([
      harness.manager.acquireModel('model.renderables', 'high'),
      harness.manager.acquireModel('model.renderables', 'high'),
    ])
    const firstLine = first.value.scene.children[0] as Line
    const secondLine = second.value.scene.children[0] as Line
    const firstPoints = first.value.scene.children[1] as Points
    const secondPoints = second.value.scene.children[1] as Points
    expect(firstLine.material).not.toBe(secondLine.material)
    expect(firstLine.material).not.toBe(lineMaterial)
    expect(firstPoints.material).not.toBe(secondPoints.material)
    expect(firstPoints.geometry).toBe(geometry)
    expect((firstPoints.material as PointsMaterial).map).toBe(texture)

    first.release()
    expect(disposeGeometry).not.toHaveBeenCalled()
    second.release()
    expect(disposeGeometry).toHaveBeenCalledOnce()
    expect(disposeTexture).toHaveBeenCalledOnce()
    expect(disposeLineMaterial).toHaveBeenCalledOnce()
    expect(disposePointsMaterial).toHaveBeenCalledOnce()
  })

  it('shares ShaderMaterial uniform textures and disposes cloned skeleton ownership', async () => {
    const texture = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    const deepTexture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    const transient = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    const disposeTexture = vi.spyOn(texture, 'dispose')
    const disposeDeepTexture = vi.spyOn(deepTexture, 'dispose')
    const disposeTransient = vi.spyOn(transient, 'dispose')
    vi.spyOn(texture, 'clone').mockReturnValue(transient)
    const cyclic: Record<string, unknown> = {
      level1: { level2: { level3: { level4: { texture: deepTexture } } } },
    }
    cyclic.self = cyclic
    const material = new ShaderMaterial({
      uniforms: { surface: { value: texture }, nested: { value: cyclic } },
    })
    const source = skinnedModel(material)
    const harness = makeHarness({
      records: [modelRecord('model.skinned', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: async () => source.gltf,
    })

    const lease = await harness.manager.acquireModel('model.skinned', 'high')
    const clonedMesh = lease.value.scene.children[0] as SkinnedMesh
    const clonedMaterial = clonedMesh.material as ShaderMaterial
    const disposeClonedMaterial = vi.spyOn(clonedMaterial, 'dispose')
    const disposeClonedSkeleton = vi.spyOn(clonedMesh.skeleton, 'dispose')
    const disposeBaseSkeleton = vi.spyOn(source.skeleton, 'dispose')
    expect(clonedMaterial.uniforms.surface.value).toBe(texture)
    expect(disposeTransient).toHaveBeenCalledOnce()
    expect(clonedMesh.skeleton).not.toBe(source.skeleton)

    lease.release()
    expect(disposeClonedMaterial).toHaveBeenCalledOnce()
    expect(disposeClonedSkeleton).toHaveBeenCalledOnce()
    expect(disposeBaseSkeleton).toHaveBeenCalledOnce()
    expect(disposeTexture).toHaveBeenCalledOnce()
    expect(disposeDeepTexture).toHaveBeenCalledOnce()
  })

  it('de-duplicates normal texture requests and disposes after the final release', async () => {
    const pending = deferred<DataTexture>()
    const texture = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    const dispose = vi.spyOn(texture, 'dispose')
    const harness = makeHarness({
      records: [
        textureRecord('texture.primary', {
          kind: 'procedural',
          key: 'procedural.debug-checker',
        }),
      ],
      textureLoad: () => pending.promise,
    })

    const firstPromise = harness.manager.acquireTexture('texture.primary', 'high')
    const secondPromise = harness.manager.acquireTexture('texture.primary', 'high')
    expect(harness.textureLoad).toHaveBeenCalledOnce()
    pending.resolve(texture)

    const [first, second] = await Promise.all([firstPromise, secondPromise])
    expect(first.value).toBe(texture)
    expect(second.value).toBe(texture)
    first.release()
    first.release()
    expect(dispose).not.toHaveBeenCalled()
    second.release()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('pins a resolved variant until its de-duplicated preload lease releases', async () => {
    const source = disposableModel()
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: async () => source.gltf,
    })

    const preload = await harness.manager.preload(['model.primary', 'model.primary'], 'high')
    expect(preload.ids).toEqual(['model.primary'])
    const lease = await harness.manager.acquireModel('model.primary', 'high')
    lease.release()
    expect(source.disposeGeometry).not.toHaveBeenCalled()

    preload.release()
    preload.release()
    expect(source.disposeGeometry).toHaveBeenCalledOnce()
  })

  it('preloads without cloning and clones only when a consumer acquires', async () => {
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
    })

    const preload = await harness.manager.preload(['model.primary'], 'high')
    expect(harness.cloneModel).not.toHaveBeenCalled()
    const lease = await harness.manager.acquireModel('model.primary', 'high')
    expect(harness.cloneModel).toHaveBeenCalledOnce()
    lease.release()
    preload.release()
  })

  it('rejects wrong-family acquisitions before loading and supports animation/environment families', async () => {
    const harness = makeHarness({
      records: [
        modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' }),
        textureRecord('texture.primary', {
          kind: 'procedural',
          key: 'procedural.debug-checker',
        }),
        animationRecord('animation.primary', {
          kind: 'procedural',
          key: 'procedural.debug-box',
        }),
        environmentRecord('environment.primary', {
          kind: 'procedural',
          key: 'procedural.debug-checker',
        }),
      ],
    })

    await expect(harness.manager.acquireModel('texture.primary', 'high')).rejects.toThrow(
      /texture.primary.*model/i,
    )
    await expect(harness.manager.acquireTexture('model.primary', 'high')).rejects.toThrow(
      /model.primary.*texture/i,
    )
    expect(harness.gltfLoad).not.toHaveBeenCalled()
    expect(harness.textureLoad).not.toHaveBeenCalled()

    const animation = await harness.manager.acquireModel('animation.primary', 'high')
    const environment = await harness.manager.acquireTexture('environment.primary', 'high')
    expect(harness.gltfLoad).toHaveBeenCalledOnce()
    expect(harness.textureLoad).toHaveBeenCalledOnce()
    animation.release()
    environment.release()
  })

  it('rejects a registered procedural fallback key from the wrong resource family at construction', () => {
    expect(() =>
      makeHarness({
        records: [
          modelRecord('model.invalid', {
            kind: 'procedural',
            key: 'procedural.debug-checker',
          }),
        ],
      }),
    ).toThrow(/model.invalid.*model procedural fallback.*procedural.debug-checker/i)
  })

  it('routes a failed primary through an authored fallback with canonical diagnostics', async () => {
    const fallback = disposableModel()
    const harness = makeHarness({
      records: [
        modelRecord('model.primary', { kind: 'asset', id: 'model.fallback' }),
        modelRecord('model.fallback', {
          kind: 'procedural',
          key: 'procedural.debug-box',
        }),
      ],
      modelLoad: async (url) => {
        if (url.endsWith('model.primary.glb')) throw new Error('primary decode failed')
        return fallback.gltf
      },
    })

    const lease = await harness.manager.acquireModel('model.primary', 'high')
    expect(lease.id).toBe('model.primary')
    expect(harness.gltfLoad).toHaveBeenCalledTimes(2)
    expect(harness.manager.diagnostics()).toEqual({
      loadedIds: ['model.fallback'],
      pendingIds: [],
      fallbackIds: ['model.fallback'],
      decodedBytesById: { 'model.fallback': 42 },
      estimatedDecodedBytes: 42,
    })
    lease.release()
    expect(fallback.disposeGeometry).toHaveBeenCalledOnce()
  })

  it('routes failed authored fallbacks to one shared procedural source', async () => {
    const disposeProcedural = vi.fn()
    const proceduralFactory = vi.fn(() => proceduralModel(disposeProcedural))
    const harness = makeHarness({
      records: [
        modelRecord('model.primary', { kind: 'asset', id: 'model.fallback' }),
        modelRecord('model.fallback', {
          kind: 'procedural',
          key: 'procedural.debug-box',
        }),
      ],
      modelLoad: async () => {
        throw new Error('decode failed')
      },
      proceduralFallbacks: {
        models: { 'procedural.debug-box': proceduralFactory },
        textures: {},
      },
    })

    const [first, second] = await Promise.all([
      harness.manager.acquireModel('model.primary', 'high'),
      harness.manager.acquireModel('model.primary', 'high'),
    ])
    expect(proceduralFactory).toHaveBeenCalledOnce()
    expect(harness.manager.diagnostics().fallbackIds).toEqual(['procedural.debug-box'])
    expect(harness.manager.diagnostics().decodedBytesById).toEqual({})
    first.release()
    expect(disposeProcedural).not.toHaveBeenCalled()
    second.release()
    expect(disposeProcedural).toHaveBeenCalledOnce()
  })

  it('tracks fallback use independently from direct leases on the same cached asset', async () => {
    const fallback = disposableModel()
    const harness = makeHarness({
      records: [
        modelRecord('model.primary', { kind: 'asset', id: 'model.fallback' }),
        modelRecord('model.fallback', {
          kind: 'procedural',
          key: 'procedural.debug-box',
        }),
      ],
      modelLoad: async (url) => {
        if (url.endsWith('model.primary.glb')) throw new Error('primary failed')
        return fallback.gltf
      },
    })

    const throughFallback = await harness.manager.acquireModel('model.primary', 'high')
    const direct = await harness.manager.acquireModel('model.fallback', 'high')
    expect(harness.manager.diagnostics().fallbackIds).toEqual(['model.fallback'])

    throughFallback.release()
    expect(harness.manager.diagnostics()).toMatchObject({
      loadedIds: ['model.fallback'],
      fallbackIds: [],
    })
    direct.release()
  })

  it('resolves an authored non-LOD fallback independently of the requested primary LOD', async () => {
    const fallback = disposableModel()
    const harness = makeHarness({
      records: [
        modelRecord('model.primary', { kind: 'asset', id: 'model.fallback' }, [
          variant('model.primary.lod0', 'assets/model.primary-0.glb', 10, 0),
          variant('model.primary.lod1', 'assets/model.primary-1.glb', 20, 1),
        ]),
        modelRecord('model.fallback', { kind: 'procedural', key: 'procedural.debug-box' }, [
          variant('model.fallback.base', 'assets/model.fallback.glb', 30),
        ]),
      ],
      modelLoad: async (url) => {
        if (url.endsWith('model.primary-1.glb')) throw new Error('primary failed')
        return fallback.gltf
      },
    })

    const lease = await harness.manager.acquireModel('model.primary', 'high', 1)
    expect(harness.gltfLoad).toHaveBeenNthCalledWith(
      2,
      'https://assets.test/root/assets/model.fallback.glb',
    )
    lease.release()
  })

  it('consumes injection on an authored fallback ID immediately before its real request', async () => {
    const router = new AssetFailureRouter({
      enabled: true,
      kindFor: (id) => (id === 'model.primary' || id === 'model.fallback' ? 'model' : null),
    })
    const proceduralFactory = vi.fn(() => proceduralModel())
    const harness = makeHarness({
      records: [
        modelRecord('model.primary', { kind: 'asset', id: 'model.fallback' }),
        modelRecord('model.fallback', {
          kind: 'procedural',
          key: 'procedural.debug-box',
        }),
      ],
      modelLoad: async () => {
        throw new Error('primary failed')
      },
      proceduralFallbacks: {
        models: { 'procedural.debug-box': proceduralFactory },
        textures: {},
      },
      failureRouter: router,
    })
    router.failNext('model.fallback')

    const lease = await harness.manager.acquireModel('model.primary', 'high')
    expect(harness.gltfLoad).toHaveBeenCalledOnce()
    expect(router.snapshot().consumed).toEqual([
      { id: 'model.fallback', channel: 'model', sequence: 1 },
    ])
    expect(proceduralFactory).toHaveBeenCalledOnce()
    lease.release()
  })

  it('consumes one injected model failure through the normal concurrent fallback path', async () => {
    const router = new AssetFailureRouter({
      enabled: true,
      kindFor: (id) => (id === 'model.primary' ? 'model' : null),
    })
    const proceduralFactory = vi.fn(() => proceduralModel())
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
      proceduralFallbacks: {
        models: { 'procedural.debug-box': proceduralFactory },
        textures: {},
      },
      failureRouter: router,
    })
    expect(router.failNext('model.primary')).toBe(true)

    const leases = await Promise.all([
      harness.manager.acquireModel('model.primary', 'high'),
      harness.manager.acquireModel('model.primary', 'high'),
    ])
    expect(harness.gltfLoad).not.toHaveBeenCalled()
    expect(proceduralFactory).toHaveBeenCalledOnce()
    expect(router.snapshot().consumed).toEqual([
      { id: 'model.primary', channel: 'model', sequence: 1 },
    ])
    leases.forEach((lease) => lease.release())
  })

  it('consumes texture injection through the texture channel', async () => {
    const router = new AssetFailureRouter({
      enabled: true,
      kindFor: (id) => (id === 'texture.primary' ? 'texture' : null),
    })
    const fallbackTexture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    const dispose = vi.spyOn(fallbackTexture, 'dispose')
    const harness = makeHarness({
      records: [
        textureRecord('texture.primary', {
          kind: 'procedural',
          key: 'procedural.debug-checker',
        }),
      ],
      proceduralFallbacks: {
        models: {},
        textures: { 'procedural.debug-checker': () => fallbackTexture },
      },
      failureRouter: router,
    })
    router.failNext('texture.primary')

    const lease = await harness.manager.acquireTexture('texture.primary', 'high')
    expect(harness.textureLoad).not.toHaveBeenCalled()
    expect(router.snapshot().consumed[0].channel).toBe('texture')
    lease.release()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('aggregates multiple resolved variants under their canonical record ID', async () => {
    const records = [
      modelRecord('model.multi', { kind: 'procedural', key: 'procedural.debug-box' }, [
        variant('model.multi.lod0', 'assets/model.multi-0.glb', 10, 0),
        variant('model.multi.lod1', 'assets/model.multi-1.glb', 20, 1),
      ]),
    ]
    const harness = makeHarness({ records })

    const first = await harness.manager.acquireModel('model.multi', 'high', 0)
    const second = await harness.manager.acquireModel('model.multi', 'high', 1)
    expect(harness.manager.diagnostics()).toMatchObject({
      loadedIds: ['model.multi'],
      decodedBytesById: { 'model.multi': 30 },
      estimatedDecodedBytes: 30,
    })
    first.release()
    second.release()
  })

  it('rolls back unleased resources when a multi-ID preload fails', async () => {
    const good = disposableModel()
    const harness = makeHarness({
      records: [
        modelRecord('model.good', { kind: 'procedural', key: 'procedural.debug-box' }),
        modelRecord('model.bad', { kind: 'procedural', key: 'procedural.model-throws' }),
      ],
      modelLoad: async (url) => {
        if (url.endsWith('model.bad.glb')) throw new Error('bad model')
        return good.gltf
      },
      proceduralFallbacks: {
        models: {
          'procedural.debug-box': () => proceduralModel(),
          'procedural.model-throws': () => {
            throw new Error('procedural.model-throws failed')
          },
        },
        textures: {},
      },
    })

    await expect(harness.manager.preload(['model.good', 'model.bad'], 'high')).rejects.toThrow(
      /procedural.model-throws/,
    )
    expect(good.disposeGeometry).toHaveBeenCalledOnce()
    expect(harness.manager.diagnostics().loadedIds).toEqual([])
  })

  it('keeps model and texture cache entries alive during immediate acquisition handoff', async () => {
    const model = disposableModel()
    const texture = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    const disposeTexture = vi.spyOn(texture, 'dispose')
    const harness = makeHarness({
      records: [
        modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' }),
        textureRecord('texture.primary', {
          kind: 'procedural',
          key: 'procedural.debug-checker',
        }),
      ],
      modelLoad: async () => model.gltf,
      textureLoad: async () => texture,
    })
    const firstModel = await harness.manager.acquireModel('model.primary', 'high')
    const firstTexture = await harness.manager.acquireTexture('texture.primary', 'high')

    const nextModelPromise = harness.manager.acquireModel('model.primary', 'high')
    const nextTexturePromise = harness.manager.acquireTexture('texture.primary', 'high')
    firstModel.release()
    firstTexture.release()
    expect(model.disposeGeometry).not.toHaveBeenCalled()
    expect(disposeTexture).not.toHaveBeenCalled()

    const [nextModel, nextTexture] = await Promise.all([nextModelPromise, nextTexturePromise])
    expect(harness.gltfLoad).toHaveBeenCalledOnce()
    expect(harness.textureLoad).toHaveBeenCalledOnce()
    nextModel.release()
    nextTexture.release()
    expect(model.disposeGeometry).toHaveBeenCalledOnce()
    expect(disposeTexture).toHaveBeenCalledOnce()
  })

  it('reserves fulfilled preload entries while other preload IDs are still pending', async () => {
    const goodPending = deferred<GLTF>()
    const badPending = deferred<GLTF>()
    const good = disposableModel()
    const harness = makeHarness({
      records: [
        modelRecord('model.good', { kind: 'procedural', key: 'procedural.debug-box' }),
        modelRecord('model.bad', { kind: 'procedural', key: 'procedural.model-throws' }),
      ],
      modelLoad: (url) =>
        url.endsWith('model.good.glb') ? goodPending.promise : badPending.promise,
      proceduralFallbacks: {
        models: {
          'procedural.debug-box': () => proceduralModel(),
          'procedural.model-throws': () => {
            throw new Error('procedural.model-throws failed')
          },
        },
        textures: {},
      },
    })

    const preload = harness.manager.preload(['model.good', 'model.bad'], 'high')
    goodPending.resolve(good.gltf)
    await vi.waitFor(() => expect(harness.manager.diagnostics().loadedIds).toContain('model.good'))

    const consumer = await harness.manager.acquireModel('model.good', 'high')
    consumer.release()
    expect(good.disposeGeometry).not.toHaveBeenCalled()

    badPending.reject(new Error('bad model'))
    await expect(preload).rejects.toThrow(/procedural.model-throws/)
    expect(good.disposeGeometry).toHaveBeenCalledOnce()
  })

  it('hands an already-loaded model directly into preload without an eviction gap', async () => {
    const source = disposableModel()
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: async () => source.gltf,
    })
    const lease = await harness.manager.acquireModel('model.primary', 'high')

    const preloadPromise = harness.manager.preload(['model.primary'], 'high')
    lease.release()
    expect(source.disposeGeometry).not.toHaveBeenCalled()

    const preload = await preloadPromise
    expect(harness.gltfLoad).toHaveBeenCalledOnce()
    preload.release()
    expect(source.disposeGeometry).toHaveBeenCalledOnce()
  })

  it('rolls back cache ownership when consumer cloning fails', async () => {
    const source = disposableModel()
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: async () => source.gltf,
    })
    harness.cloneModel.mockImplementationOnce(() => {
      throw new Error('material clone failed')
    })

    await expect(harness.manager.acquireModel('model.primary', 'high')).rejects.toThrow(
      /material clone failed/,
    )
    expect(source.disposeGeometry).toHaveBeenCalledOnce()
    expect(source.disposeTexture).toHaveBeenCalledOnce()
    expect(harness.manager.diagnostics()).toEqual({
      loadedIds: [],
      pendingIds: [],
      fallbackIds: [],
      decodedBytesById: {},
      estimatedDecodedBytes: 0,
    })
  })

  it('disposes resources that resolve after manager shutdown and rejects the acquisition', async () => {
    const pending = deferred<GLTF>()
    const source = disposableModel()
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: () => pending.promise,
    })

    const acquisition = harness.manager.acquireModel('model.primary', 'high')
    harness.manager.dispose()
    harness.manager.dispose()
    expect(harness.disposeLoaders).toHaveBeenCalledOnce()
    pending.resolve(source.gltf)

    await expect(acquisition).rejects.toThrow(/disposed/i)
    expect(source.disposeGeometry).toHaveBeenCalledOnce()
    await expect(harness.manager.acquireModel('model.primary', 'high')).rejects.toThrow(/disposed/i)
    expect(harness.gltfLoad).toHaveBeenCalledOnce()
  })

  it('keeps issued-lease release idempotent after manager disposal', async () => {
    const source = disposableModel()
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: async () => source.gltf,
    })
    const lease = await harness.manager.acquireModel('model.primary', 'high')
    const cloneMaterial = (lease.value.scene.children[0] as Mesh).material as MeshBasicMaterial
    const disposeCloneMaterial = vi.spyOn(cloneMaterial, 'dispose')

    harness.manager.dispose()
    harness.manager.dispose()
    expect(harness.disposeLoaders).toHaveBeenCalledOnce()
    expect(source.disposeGeometry).toHaveBeenCalledOnce()
    expect(source.disposeMaterial).toHaveBeenCalledOnce()
    expect(source.disposeTexture).toHaveBeenCalledOnce()

    lease.release()
    lease.release()
    expect(disposeCloneMaterial).toHaveBeenCalledOnce()
    expect(source.disposeMaterial).toHaveBeenCalledOnce()
  })

  it('completes fallback accounting and sibling teardown when dispose listeners throw', async () => {
    const geometry = new BoxGeometry(1, 1, 1)
    const firstMaterial = new MeshBasicMaterial()
    const secondMaterial = new MeshBasicMaterial()
    const disposeGeometry = vi.spyOn(geometry, 'dispose')
    const disposeSecondMaterial = vi.spyOn(secondMaterial, 'dispose')
    firstMaterial.addEventListener('dispose', () => {
      throw new Error('base dispose listener failed')
    })
    const base = new Group()
    base.add(new Mesh(geometry, firstMaterial), new Mesh(geometry, secondMaterial))
    const harness = makeHarness({
      records: [modelRecord('model.primary', { kind: 'procedural', key: 'procedural.debug-box' })],
      modelLoad: async () => {
        throw new Error('authored load failed')
      },
      proceduralFallbacks: {
        models: { 'procedural.debug-box': () => ({ scene: base, animations: [] }) },
        textures: {},
      },
    })

    const lease = await harness.manager.acquireModel('model.primary', 'high')
    const clonedFirst = (lease.value.scene.children[0] as Mesh).material as MeshBasicMaterial
    clonedFirst.addEventListener('dispose', () => {
      throw new Error('clone dispose listener failed')
    })
    expect(harness.manager.diagnostics().fallbackIds).toEqual(['procedural.debug-box'])

    expect(() => lease.release()).not.toThrow()
    expect(harness.manager.diagnostics().fallbackIds).toEqual([])
    expect(disposeGeometry).toHaveBeenCalledOnce()
    expect(disposeSecondMaterial).toHaveBeenCalledOnce()
    harness.manager.dispose()
    expect(harness.disposeLoaders).toHaveBeenCalledOnce()
  })
})

describe('model clone transactions', () => {
  it('disposes partial clone-owned materials without touching shared base resources', () => {
    const geometry = new BoxGeometry(1, 1, 1)
    const firstBase = new MeshBasicMaterial()
    const secondBase = new MeshBasicMaterial()
    const disposeGeometry = vi.spyOn(geometry, 'dispose')
    const disposeFirstBase = vi.spyOn(firstBase, 'dispose')
    const firstOwned = new MeshBasicMaterial()
    const disposeFirstOwned = vi.spyOn(firstOwned, 'dispose')
    vi.spyOn(firstBase, 'clone').mockReturnValue(firstOwned)
    vi.spyOn(secondBase, 'clone').mockImplementation(() => {
      throw new Error('second material failed')
    })
    const scene = new Group()
    scene.add(new Mesh(geometry, firstBase), new Mesh(geometry, secondBase))

    expect(() => cloneModelAsset({ scene, animations: [] })).toThrow(/second material failed/)
    expect(disposeFirstOwned).toHaveBeenCalledOnce()
    expect(disposeGeometry).not.toHaveBeenCalled()
    expect(disposeFirstBase).not.toHaveBeenCalled()
  })

  it('cleans transient shader textures, cloned materials, and skeletons on later clone failure', () => {
    const texture = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    const transient = new DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1)
    const disposeTexture = vi.spyOn(texture, 'dispose')
    const disposeTransient = vi.spyOn(transient, 'dispose')
    vi.spyOn(texture, 'clone').mockReturnValue(transient)
    const shader = new ShaderMaterial({ uniforms: { surface: { value: texture } } })
    const disposeShader = vi.spyOn(shader, 'dispose')
    const source = skinnedModel(shader)
    let clonedShader: ShaderMaterial | null = null
    let disposeClonedShader: ReturnType<typeof vi.spyOn> | null = null
    const cloneShader = shader.clone.bind(shader)
    vi.spyOn(shader, 'clone').mockImplementation(() => {
      clonedShader = cloneShader()
      disposeClonedShader = vi.spyOn(clonedShader, 'dispose')
      return clonedShader
    })
    const failing = new MeshBasicMaterial()
    vi.spyOn(failing, 'clone').mockImplementation(() => {
      throw new Error('later material failed')
    })
    source.gltf.scene.add(new Mesh(new BoxGeometry(1, 1, 1), failing))
    const disposeSkeletons = vi.spyOn(Skeleton.prototype, 'dispose')

    try {
      expect(() => cloneModelAsset(source.gltf)).toThrow(/later material failed/)
      expect(clonedShader).not.toBeNull()
      expect(disposeClonedShader).not.toBeNull()
      expect(disposeClonedShader).toHaveBeenCalledOnce()
      expect(disposeTransient).toHaveBeenCalledOnce()
      expect(disposeSkeletons).toHaveBeenCalledOnce()
      expect(disposeTexture).not.toHaveBeenCalled()
      expect(disposeShader).not.toHaveBeenCalled()
    } finally {
      disposeSkeletons.mockRestore()
    }
  })
})

describe('authored loader configuration', () => {
  it('detects KTX2 support, installs Three bundled Meshopt, and disposes once', () => {
    const renderer = {
      extensions: {
        has: vi.fn(() => false),
        get: vi.fn(),
      },
    } as unknown as WebGLRenderer
    const loaders = createAuthoredAssetLoaders({
      renderer,
      transcoderPath: 'https://assets.test/assets/decoders/basis',
    })
    const ktx2State = loaders.ktx2 as unknown as {
      readonly transcoderPath: string
      readonly workerConfig: Record<string, boolean>
    }
    const gltfState = loaders.gltf as unknown as { readonly meshoptDecoder: unknown }

    expect(renderer.extensions.has).toHaveBeenCalled()
    expect(ktx2State.transcoderPath).toBe('https://assets.test/assets/decoders/basis/')
    expect(Object.values(ktx2State.workerConfig).every((supported) => !supported)).toBe(true)
    expect(gltfState.meshoptDecoder).toBe(MeshoptDecoder)

    const dispose = vi.spyOn(loaders.ktx2, 'dispose')
    loaders.dispose()
    loaders.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('boots the isolated worker before transferring the Basis init payload', async () => {
    const sourceUrl = 'blob:https://assets.test/transcoder-source'
    const transcoderBytes = new Uint8Array([1, 2, 3, 4])
    const init = vi.spyOn(KTX2Loader.prototype, 'init').mockImplementation(function (
      this: KTX2Loader,
    ) {
      this.workerSourceURL = sourceUrl
      this.transcoderBinary = transcoderBytes.buffer.slice(0)
      return Promise.resolve()
    })
    const constructed: Array<{
      readonly url: string
      readonly options?: WorkerOptions
      readonly messages: Array<{ message: unknown; transfer?: Transferable[] }>
    }> = []
    class FakeWorker {
      readonly messages: Array<{ message: unknown; transfer?: Transferable[] }> = []
      readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

      constructor(
        readonly url: string,
        readonly options?: WorkerOptions,
      ) {
        constructed.push(this)
      }

      postMessage(message: unknown, transfer?: Transferable[]) {
        this.messages.push({ message, ...(transfer ? { transfer } : {}) })
      }

      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        const registered = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
        registered.add(listener)
        this.listeners.set(type, registered)
      }

      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        this.listeners.get(type)?.delete(listener)
      }

      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker)

    try {
      const renderer = {
        extensions: { has: vi.fn(() => false), get: vi.fn() },
      } as unknown as WebGLRenderer
      const loaders = createAuthoredAssetLoaders({
        renderer,
        transcoderPath: 'https://assets.test/assets/decoders/basis',
      })
      await loaders.ktx2.init()
      const worker = loaders.ktx2.workerPool.workerCreator()

      expect(constructed).toHaveLength(1)
      expect(constructed[0]?.url).toBe(
        `https://assets.test/assets/decoders/basis/${BASIS_TRANSCODER_WORKER_FILENAME}`,
      )
      expect(constructed[0]?.options).toEqual({ name: 'turtleback-basis-transcoder' })
      expect(worker).not.toBe(constructed[0])
      expect(constructed[0]?.messages[0]).toEqual({
        message: { type: BASIS_TRANSCODER_BOOTSTRAP_MESSAGE, sourceUrl },
      })
      const initMessage = constructed[0]?.messages[1]
      expect(initMessage?.message).toMatchObject({ type: 'init' })
      const payload = initMessage?.message as { transcoderBinary: ArrayBuffer }
      expect([...new Uint8Array(payload.transcoderBinary)]).toEqual([...transcoderBytes])
      expect(initMessage?.transfer).toEqual([payload.transcoderBinary])
    } finally {
      init.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('turns owner-side worker load failure into current and future rejections', async () => {
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    const nativeMessages: unknown[] = []
    const nativeWorker = {
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        const registered = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
        registered.add(listener)
        listeners.set(type, registered)
      },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.get(type)?.delete(listener)
      },
      postMessage(message: unknown) {
        nativeMessages.push(message)
      },
      terminate: vi.fn(),
    } as unknown as Worker
    const emit = (type: string, event: Event) => {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        if (typeof listener === 'function') listener(event)
        else listener.handleEvent(event)
      }
    }
    const worker = bridgeBasisWorkerFailures(nativeWorker)
    const responses: unknown[] = []
    worker.addEventListener('message', (event) => responses.push(event.data))
    worker.postMessage({ type: 'transcode', buffer: new ArrayBuffer(0) })
    const preventDefault = vi.fn()

    emit('error', {
      error: new Error('relay returned 404'),
      message: 'relay returned 404',
      preventDefault,
    } as unknown as ErrorEvent)
    await Promise.resolve()

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(responses).toEqual([
      expect.objectContaining({
        type: 'error',
        error: 'Basis worker failed to load or communicate: Error: relay returned 404',
      }),
    ])
    worker.postMessage({ type: 'transcode', buffer: new ArrayBuffer(0) })
    await Promise.resolve()
    expect(responses).toHaveLength(2)
    expect(nativeMessages).toEqual([{ type: 'transcode', buffer: expect.any(ArrayBuffer) }])
  })
})

describe('asset diagnostics registration', () => {
  function snapshot(id: string): AssetDiagnostics {
    return {
      loadedIds: [id],
      pendingIds: [],
      fallbackIds: [],
      decodedBytesById: { [id]: 1 },
      estimatedDecodedBytes: 1,
    }
  }

  it('does not let stale cleanup clear a newer active manager', () => {
    const clearFirst = registerActiveAssetDiagnostics({
      diagnostics: () => snapshot('model.first'),
    })
    const clearSecond = registerActiveAssetDiagnostics({
      diagnostics: () => snapshot('model.second'),
    })

    clearFirst()
    expect(readActiveAssetDiagnostics()?.loadedIds).toEqual(['model.second'])
    clearSecond()
    clearSecond()
    expect(readActiveAssetDiagnostics()).toBeNull()
  })

  it('marks authored readiness only when both smoke records loaded without fallback', () => {
    const mark = vi.fn()
    const authored: AssetDiagnostics = {
      loadedIds: ['model.pipeline-smoke', 'texture.pipeline-smoke'],
      pendingIds: [],
      fallbackIds: [],
      decodedBytesById: {
        'model.pipeline-smoke': 42,
        'texture.pipeline-smoke': 84,
      },
      estimatedDecodedBytes: 126,
    }
    expect(markAssetPipelineReadiness(authored, mark)).toBe(ASSET_PIPELINE_AUTHORED_MARK)
    expect(mark).toHaveBeenLastCalledWith(ASSET_PIPELINE_AUTHORED_MARK)

    expect(
      markAssetPipelineReadiness({ ...authored, fallbackIds: ['procedural.debug-box'] }, mark),
    ).toBe(ASSET_PIPELINE_FALLBACK_MARK)
    expect(mark).toHaveBeenLastCalledWith(ASSET_PIPELINE_FALLBACK_MARK)
  })
})

describe('AssetPreloadCoordinator', () => {
  function fakeLease(id: string): AssetPreloadLease & { release: ReturnType<typeof vi.fn> } {
    return { ids: [id], release: vi.fn() }
  }

  it('gates initial readiness on the latest request and releases stale quality results', async () => {
    const onReady = vi.fn()
    const onError = vi.fn()
    const coordinator = new AssetPreloadCoordinator({ onReady, onError })
    const low = deferred<AssetPreloadLease>()
    const high = deferred<AssetPreloadLease>()
    const lowLease = fakeLease('low')
    const highLease = fakeLease('high')

    const lowRequest = coordinator.request(() => low.promise)
    const highRequest = coordinator.request(() => high.promise)
    low.resolve(lowLease)
    await lowRequest
    expect(lowLease.release).toHaveBeenCalledOnce()
    expect(onReady).not.toHaveBeenCalled()

    high.resolve(highLease)
    await highRequest
    expect(onReady).toHaveBeenCalledOnce()
    expect(highLease.release).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()

    coordinator.dispose()
    coordinator.dispose()
    expect(highLease.release).toHaveBeenCalledOnce()
  })

  it('keeps the prior quality pin until a replacement succeeds', async () => {
    const coordinator = new AssetPreloadCoordinator({ onReady: vi.fn(), onError: vi.fn() })
    const current = fakeLease('medium')
    await coordinator.request(async () => current)

    const next = deferred<AssetPreloadLease>()
    const replacement = fakeLease('ultra')
    const request = coordinator.request(() => next.promise)
    expect(current.release).not.toHaveBeenCalled()
    next.resolve(replacement)
    await request
    expect(current.release).toHaveBeenCalledOnce()
    expect(replacement.release).not.toHaveBeenCalled()

    coordinator.dispose()
    expect(replacement.release).toHaveBeenCalledOnce()
  })

  it('reports an initial rejection without readiness and signals ready only once after recovery', async () => {
    const onReady = vi.fn()
    const onError = vi.fn()
    const coordinator = new AssetPreloadCoordinator({ onReady, onError })
    const error = new Error('initial preload failed')

    await coordinator.request(async () => Promise.reject(error))
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(error)
    expect(onReady).not.toHaveBeenCalled()

    const recovered = fakeLease('high')
    await coordinator.request(async () => recovered)
    expect(onReady).toHaveBeenCalledOnce()

    const changed = fakeLease('ultra')
    await coordinator.request(async () => changed)
    expect(recovered.release).toHaveBeenCalledOnce()
    expect(onReady).toHaveBeenCalledOnce()

    coordinator.dispose()
    expect(changed.release).toHaveBeenCalledOnce()
  })

  it('ignores a stale rejection after a newer quality request succeeds', async () => {
    const onReady = vi.fn()
    const onError = vi.fn()
    const coordinator = new AssetPreloadCoordinator({ onReady, onError })
    const stale = deferred<AssetPreloadLease>()
    const current = fakeLease('high')

    const staleRequest = coordinator.request(() => stale.promise)
    await coordinator.request(async () => current)
    stale.reject(new Error('obsolete low-quality failure'))
    await staleRequest

    expect(onReady).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
    expect(current.release).not.toHaveBeenCalled()
    coordinator.dispose()
    expect(current.release).toHaveBeenCalledOnce()
  })

  it('keeps the current preload when the latest quality refresh rejects', async () => {
    const onError = vi.fn()
    const coordinator = new AssetPreloadCoordinator({ onReady: vi.fn(), onError })
    const current = fakeLease('high')
    await coordinator.request(async () => current)

    const error = new Error('ultra refresh failed')
    await coordinator.request(async () => Promise.reject(error))
    expect(onError).toHaveBeenCalledWith(error)
    expect(current.release).not.toHaveBeenCalled()

    coordinator.dispose()
    expect(current.release).toHaveBeenCalledOnce()
  })
})
