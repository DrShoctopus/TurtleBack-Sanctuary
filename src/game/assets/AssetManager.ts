import type { Material, Object3D, Skeleton, Texture } from 'three'
import type { QualityLevel } from '../core/quality'
import { AssetFailureRouter, InjectedAssetFailure, assetFailureRouter } from './AssetFailureRouter'
import { cloneModelAsset, type AuthoredAssetLoaders, type ModelAsset } from './loaders'
import { resolveAssetVariant } from './registry'
import type { AssetId, AssetRecord, AssetRegistry, AssetVariant } from './schema'

export interface AssetLease<T> {
  readonly id: AssetId
  readonly value: T
  release(): void
}

export interface AssetPreloadLease {
  readonly ids: readonly AssetId[]
  release(): void
}

export interface AssetDiagnostics {
  readonly loadedIds: readonly AssetId[]
  readonly pendingIds: readonly AssetId[]
  readonly fallbackIds: readonly AssetId[]
  readonly decodedBytesById: Readonly<Record<string, number>>
  readonly estimatedDecodedBytes: number
}

export interface ProceduralFallbackFactories {
  readonly models: Readonly<Record<string, () => ModelAsset>>
  readonly textures: Readonly<Record<string, () => Texture>>
}

interface ModelCacheValue {
  readonly base: ModelAsset
  clone(): ModelAsset
}

type CacheResource = ModelCacheValue | Texture
type ResourceKind = 'model' | 'texture'
type CacheStatus = 'pending' | 'loaded' | 'failed'

interface CacheEntry<T extends CacheResource> {
  readonly key: string
  readonly resourceKind: ResourceKind
  readonly recordId: AssetId | null
  readonly variant: AssetVariant | null
  promise: Promise<T>
  status: CacheStatus
  value: T | null
  waiters: number
  references: number
  pins: number
  disposed: boolean
}

type AnyCacheEntry = CacheEntry<CacheResource>

interface AssetResolution<T extends CacheResource> {
  readonly entry: CacheEntry<T>
  readonly fallbackId: AssetId | null
}

function isModelRecord(record: AssetRecord): boolean {
  return record.kind === 'model' || record.kind === 'animation'
}

function isTextureRecord(record: AssetRecord): boolean {
  return record.kind === 'texture' || record.kind === 'environment'
}

interface RenderableObject extends Object3D {
  readonly geometry?: object
  material: Material | Material[]
}

function renderableObject(object: Object3D): RenderableObject | null {
  const material = (object as Object3D & { material?: unknown }).material
  const valid = Array.isArray(material)
    ? material.every((item) => (item as { isMaterial?: unknown })?.isMaterial === true)
    : (material as { isMaterial?: unknown } | undefined)?.isMaterial === true
  return valid ? (object as RenderableObject) : null
}

function materialsFor(renderable: RenderableObject): readonly Material[] {
  return Array.isArray(renderable.material) ? renderable.material : [renderable.material]
}

function skeletonFor(object: Object3D): Skeleton | null {
  const candidate = object as Object3D & {
    readonly isSkinnedMesh?: boolean
    readonly skeleton?: Skeleton
  }
  return candidate.isSkinnedMesh && candidate.skeleton ? candidate.skeleton : null
}

function isTexture(value: unknown): value is Texture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isTexture' in value &&
    (value as { isTexture?: unknown }).isTexture === true
  )
}

function collectTextures(value: unknown, textures: Set<Texture>, seen: Set<object>): void {
  if (isTexture(value)) {
    textures.add(value)
    return
  }
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  seen.add(value)
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectTextures(child, textures, seen)
  }
}

function disposeModelClone(model: ModelAsset): void {
  const materials = new Set<Material>()
  const skeletons = new Set<Skeleton>()
  model.scene.traverse((object) => {
    const renderable = renderableObject(object)
    if (renderable) materialsFor(renderable).forEach((material) => materials.add(material))
    const skeleton = skeletonFor(object)
    if (skeleton) skeletons.add(skeleton)
  })
  materials.forEach(disposeSafely)
  skeletons.forEach(disposeSafely)
  clearSceneSafely(model.scene)
}

function disposeSafely(resource: { dispose(): void }): void {
  try {
    resource.dispose()
  } catch {
    // Teardown is best-effort so a listener cannot strand ownership counts.
  }
}

function clearSceneSafely(scene: Object3D): void {
  try {
    scene.clear()
  } catch {
    // Ignore teardown listeners; cache/accounting cleanup must continue.
  }
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export class AssetManager {
  private readonly registry: AssetRegistry
  private readonly loaders: AuthoredAssetLoaders
  private readonly proceduralFallbacks: ProceduralFallbackFactories
  private readonly failureRouter: AssetFailureRouter
  private readonly resolveUrl: (path: string) => string
  private readonly cache = new Map<string, AnyCacheEntry>()
  private readonly fallbackHolds = new Map<AssetId, number>()
  private readonly disposedGpuResources = new WeakSet<object>()
  private disposed = false

  constructor(input: {
    readonly registry: AssetRegistry
    readonly loaders: AuthoredAssetLoaders
    readonly proceduralFallbacks: ProceduralFallbackFactories
    readonly resolveUrl: (path: string) => string
    readonly failureRouter?: AssetFailureRouter
  }) {
    this.registry = input.registry
    this.loaders = input.loaders
    this.proceduralFallbacks = input.proceduralFallbacks
    this.resolveUrl = input.resolveUrl
    this.failureRouter = input.failureRouter ?? assetFailureRouter
    this.validateProceduralFamilies()
  }

  async acquireModel(
    id: AssetId,
    quality: QualityLevel,
    lod?: number,
  ): Promise<AssetLease<ModelAsset>> {
    this.assertActive()
    const record = this.registry.get(id)
    if (!isModelRecord(record)) {
      throw new Error(`Asset ${id} cannot be acquired through the model loader`)
    }

    const resolution = await this.resolveModel(record, quality, lod)
    try {
      this.assertActive()
    } catch (error) {
      this.releaseWaiter(resolution.entry)
      throw error
    }
    this.convertWaiterToReference(resolution.entry)
    this.retainFallback(resolution.fallbackId)

    let value: ModelAsset
    try {
      value = this.loadedValue(resolution.entry).clone()
    } catch (error) {
      try {
        this.releaseEntry(resolution.entry)
      } finally {
        this.releaseFallback(resolution.fallbackId)
      }
      throw error
    }

    let released = false
    return {
      id,
      value,
      release: () => {
        if (released) return
        released = true
        try {
          disposeModelClone(value)
        } finally {
          try {
            this.releaseEntry(resolution.entry)
          } finally {
            this.releaseFallback(resolution.fallbackId)
          }
        }
      },
    }
  }

  async acquireTexture(id: AssetId, quality: QualityLevel): Promise<AssetLease<Texture>> {
    this.assertActive()
    const record = this.registry.get(id)
    if (!isTextureRecord(record)) {
      throw new Error(`Asset ${id} cannot be acquired through the texture loader`)
    }

    const resolution = await this.resolveTexture(record, quality)
    try {
      this.assertActive()
    } catch (error) {
      this.releaseWaiter(resolution.entry)
      throw error
    }
    this.convertWaiterToReference(resolution.entry)
    this.retainFallback(resolution.fallbackId)
    const value = this.loadedValue(resolution.entry)
    let released = false
    return {
      id,
      value,
      release: () => {
        if (released) return
        released = true
        try {
          this.releaseEntry(resolution.entry)
        } finally {
          this.releaseFallback(resolution.fallbackId)
        }
      },
    }
  }

  async preload(ids: readonly AssetId[], quality: QualityLevel): Promise<AssetPreloadLease> {
    this.assertActive()
    const uniqueIds = [...new Set(ids)]
    const settled = await Promise.allSettled(
      uniqueIds.map(async (id) => {
        const record = this.registry.get(id)
        let resolution: AssetResolution<CacheResource>
        if (isModelRecord(record)) resolution = await this.resolveModel(record, quality)
        else if (isTextureRecord(record)) resolution = await this.resolveTexture(record, quality)
        else throw new Error(`Asset ${id} cannot be preloaded by AssetManager`)
        return resolution
      }),
    )

    const fulfilled = settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    )
    const uniqueEntries = [...new Set(fulfilled.map((resolution) => resolution.entry))]
    const failure = settled.find((result) => result.status === 'rejected')
    if (failure?.status === 'rejected') {
      fulfilled.forEach((resolution) => {
        this.releaseWaiter(resolution.entry)
      })
      throw failure.reason
    }
    try {
      this.assertActive()
    } catch (error) {
      fulfilled.forEach((resolution) => {
        this.releaseWaiter(resolution.entry)
      })
      throw error
    }

    uniqueEntries.forEach((entry) => {
      entry.pins += 1
    })
    fulfilled.forEach((resolution) => this.releaseWaiter(resolution.entry))
    fulfilled.forEach((resolution) => this.retainFallback(resolution.fallbackId))
    let released = false
    return {
      ids: uniqueIds,
      release: () => {
        if (released) return
        released = true
        uniqueEntries.forEach((entry) => {
          if (entry.pins > 0) entry.pins -= 1
          this.disposeEntryIfUnused(entry)
        })
        fulfilled.forEach((resolution) => this.releaseFallback(resolution.fallbackId))
      },
    }
  }

  diagnostics(): AssetDiagnostics {
    const loadedIds = new Set<AssetId>()
    const pendingIds = new Set<AssetId>()
    const decodedBytesById: Record<string, number> = {}

    for (const entry of this.cache.values()) {
      if (entry.recordId === null) continue
      if (entry.status === 'pending') {
        pendingIds.add(entry.recordId)
        continue
      }
      if (entry.status !== 'loaded' || entry.variant === null) continue
      loadedIds.add(entry.recordId)
      decodedBytesById[entry.recordId] =
        (decodedBytesById[entry.recordId] ?? 0) + entry.variant.decodedBytes
    }

    const orderedBytes = Object.fromEntries(
      Object.entries(decodedBytesById).sort(([left], [right]) => compareIds(left, right)),
    )
    return {
      loadedIds: [...loadedIds].sort(compareIds),
      pendingIds: [...pendingIds].sort(compareIds),
      fallbackIds: [...this.fallbackHolds.keys()].sort(compareIds),
      decodedBytesById: orderedBytes,
      estimatedDecodedBytes: Object.values(orderedBytes).reduce((total, bytes) => total + bytes, 0),
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    try {
      for (const entry of this.cache.values()) {
        if (entry.status !== 'loaded') continue
        try {
          this.disposeEntry(entry)
        } catch {
          // Keep tearing down sibling cache entries.
        }
      }
    } finally {
      this.cache.clear()
      this.fallbackHolds.clear()
      try {
        this.loaders.dispose()
      } catch {
        // The manager is terminal even if a loader teardown listener fails.
      }
    }
  }

  private validateProceduralFamilies(): void {
    for (const record of this.registry.values()) {
      if (record.fallback.kind !== 'procedural') continue
      if (isModelRecord(record) && !this.proceduralFallbacks.models[record.fallback.key]) {
        throw new Error(
          `Asset ${record.id} has no model procedural fallback factory for ${record.fallback.key}`,
        )
      }
      if (isTextureRecord(record) && !this.proceduralFallbacks.textures[record.fallback.key]) {
        throw new Error(
          `Asset ${record.id} has no texture procedural fallback factory for ${record.fallback.key}`,
        )
      }
    }
  }

  private async resolveModel(
    record: AssetRecord,
    quality: QualityLevel,
    requestedLod?: number,
  ): Promise<AssetResolution<ModelCacheValue>> {
    const variant = resolveAssetVariant(record, quality, requestedLod as 0 | 1 | 2 | undefined)
    try {
      const entry = await this.loadAuthoredModel(record, variant)
      return { entry, fallbackId: null }
    } catch (error) {
      this.assertActive()
      return this.resolveModelFallback(record, quality, error)
    }
  }

  private async resolveModelFallback(
    record: AssetRecord,
    quality: QualityLevel,
    _cause: unknown,
  ): Promise<AssetResolution<ModelCacheValue>> {
    if (record.fallback.kind === 'asset') {
      const fallback = this.registry.get(record.fallback.id)
      if (!isModelRecord(fallback)) {
        throw new Error(`Asset ${record.id} has incompatible model fallback ${fallback.id}`)
      }
      const resolution = await this.resolveModel(fallback, quality)
      return {
        entry: resolution.entry,
        fallbackId: resolution.fallbackId ?? fallback.id,
      }
    }

    const key = record.fallback.key
    const factory = this.proceduralFallbacks.models[key]
    if (!factory) throw new Error(`No procedural model fallback factory registered for ${key}`)
    const entry = await this.loadProceduralModel(key, factory)
    return { entry, fallbackId: key }
  }

  private async resolveTexture(
    record: AssetRecord,
    quality: QualityLevel,
  ): Promise<AssetResolution<Texture>> {
    const variant = resolveAssetVariant(record, quality)
    try {
      const entry = await this.loadAuthoredTexture(record, variant)
      return { entry, fallbackId: null }
    } catch (error) {
      this.assertActive()
      return this.resolveTextureFallback(record, quality, error)
    }
  }

  private async resolveTextureFallback(
    record: AssetRecord,
    quality: QualityLevel,
    _cause: unknown,
  ): Promise<AssetResolution<Texture>> {
    if (record.fallback.kind === 'asset') {
      const fallback = this.registry.get(record.fallback.id)
      if (!isTextureRecord(fallback)) {
        throw new Error(`Asset ${record.id} has incompatible texture fallback ${fallback.id}`)
      }
      const resolution = await this.resolveTexture(fallback, quality)
      return {
        entry: resolution.entry,
        fallbackId: resolution.fallbackId ?? fallback.id,
      }
    }

    const key = record.fallback.key
    const factory = this.proceduralFallbacks.textures[key]
    if (!factory) throw new Error(`No procedural texture fallback factory registered for ${key}`)
    const entry = await this.loadProceduralTexture(key, factory)
    return { entry, fallbackId: key }
  }

  private async loadAuthoredModel(
    record: AssetRecord,
    variant: AssetVariant,
  ): Promise<CacheEntry<ModelCacheValue>> {
    const entry = this.getOrCreateEntry<ModelCacheValue>({
      key: `authored:model:${variant.id}`,
      resourceKind: 'model',
      recordId: record.id,
      variant,
      load: async () => {
        if (this.failureRouter.consume(record.id, 'model')) {
          throw new InjectedAssetFailure(record.id, 'model')
        }
        const gltf = await this.loaders.gltf.loadAsync(this.resolveUrl(variant.path))
        return {
          base: { scene: gltf.scene, animations: [...gltf.animations] },
          clone: () => this.loaders.cloneModel(gltf),
        }
      },
    })
    try {
      await entry.promise
      return entry
    } catch (error) {
      this.releaseWaiter(entry)
      throw error
    }
  }

  private async loadAuthoredTexture(
    record: AssetRecord,
    variant: AssetVariant,
  ): Promise<CacheEntry<Texture>> {
    const entry = this.getOrCreateEntry<Texture>({
      key: `authored:texture:${variant.id}`,
      resourceKind: 'texture',
      recordId: record.id,
      variant,
      load: async () => {
        if (this.failureRouter.consume(record.id, 'texture')) {
          throw new InjectedAssetFailure(record.id, 'texture')
        }
        return this.loaders.ktx2.loadAsync(this.resolveUrl(variant.path))
      },
    })
    try {
      await entry.promise
      return entry
    } catch (error) {
      this.releaseWaiter(entry)
      throw error
    }
  }

  private async loadProceduralModel(
    key: string,
    factory: () => ModelAsset,
  ): Promise<CacheEntry<ModelCacheValue>> {
    const entry = this.getOrCreateEntry<ModelCacheValue>({
      key: `procedural:model:${key}`,
      resourceKind: 'model',
      recordId: null,
      variant: null,
      load: async () => {
        const base = factory()
        return { base, clone: () => cloneModelAsset(base) }
      },
    })
    try {
      await entry.promise
      return entry
    } catch (error) {
      this.releaseWaiter(entry)
      throw error
    }
  }

  private async loadProceduralTexture(
    key: string,
    factory: () => Texture,
  ): Promise<CacheEntry<Texture>> {
    const entry = this.getOrCreateEntry<Texture>({
      key: `procedural:texture:${key}`,
      resourceKind: 'texture',
      recordId: null,
      variant: null,
      load: async () => factory(),
    })
    try {
      await entry.promise
      return entry
    } catch (error) {
      this.releaseWaiter(entry)
      throw error
    }
  }

  private getOrCreateEntry<T extends CacheResource>(input: {
    readonly key: string
    readonly resourceKind: ResourceKind
    readonly recordId: AssetId | null
    readonly variant: AssetVariant | null
    readonly load: () => Promise<T>
  }): CacheEntry<T> {
    this.assertActive()
    const existing = this.cache.get(input.key)
    if (existing) {
      if (existing.resourceKind !== input.resourceKind) {
        throw new Error(`Asset cache key ${input.key} changed resource family`)
      }
      existing.waiters += 1
      return existing as CacheEntry<T>
    }

    const entry: CacheEntry<T> = {
      key: input.key,
      resourceKind: input.resourceKind,
      recordId: input.recordId,
      variant: input.variant,
      promise: null as unknown as Promise<T>,
      status: 'pending',
      value: null,
      waiters: 1,
      references: 0,
      pins: 0,
      disposed: false,
    }
    this.cache.set(input.key, entry as AnyCacheEntry)
    let loading: Promise<T>
    try {
      loading = input.load()
    } catch (error) {
      loading = Promise.reject(error)
    }
    entry.promise = loading
      .then((value) => {
        if (this.disposed || entry.disposed) {
          entry.value = value
          this.disposeEntry(entry)
          throw new Error('AssetManager was disposed while an asset was loading')
        }
        entry.value = value
        entry.status = 'loaded'
        return value
      })
      .catch((error) => {
        entry.status = 'failed'
        if (this.cache.get(entry.key) === entry) this.cache.delete(entry.key)
        throw error
      })
    return entry
  }

  private retainFallback(id: AssetId | null): void {
    if (id === null) return
    this.fallbackHolds.set(id, (this.fallbackHolds.get(id) ?? 0) + 1)
  }

  private releaseFallback(id: AssetId | null): void {
    if (id === null) return
    const remaining = (this.fallbackHolds.get(id) ?? 0) - 1
    if (remaining > 0) this.fallbackHolds.set(id, remaining)
    else this.fallbackHolds.delete(id)
  }

  private releaseEntry(entry: AnyCacheEntry): void {
    if (entry.references > 0) entry.references -= 1
    this.disposeEntryIfUnused(entry)
  }

  private convertWaiterToReference(entry: AnyCacheEntry): void {
    if (entry.waiters <= 0) throw new Error(`Asset cache entry ${entry.key} lost its reservation`)
    entry.waiters -= 1
    entry.references += 1
  }

  private releaseWaiter(entry: AnyCacheEntry): void {
    if (entry.waiters > 0) entry.waiters -= 1
    this.disposeEntryIfUnused(entry)
  }

  private disposeEntryIfUnused(entry: AnyCacheEntry): void {
    if (
      entry.status !== 'loaded' ||
      entry.waiters !== 0 ||
      entry.references !== 0 ||
      entry.pins !== 0 ||
      entry.disposed
    ) {
      return
    }
    try {
      this.disposeEntry(entry)
    } catch {
      // Cache ownership is terminal even for malformed custom renderables.
    } finally {
      if (this.cache.get(entry.key) === entry) this.cache.delete(entry.key)
    }
  }

  private disposeEntry(entry: AnyCacheEntry): void {
    if (entry.disposed || entry.value === null) return
    entry.disposed = true
    if (entry.resourceKind === 'texture') {
      this.disposeOnce(entry.value as Texture)
      return
    }
    this.disposeBaseModel((entry.value as ModelCacheValue).base)
  }

  private disposeBaseModel(model: ModelAsset): void {
    const geometries = new Set<object>()
    const materials = new Set<Material>()
    const textures = new Set<Texture>()
    const skeletons = new Set<Skeleton>()
    model.scene.traverse((object) => {
      const renderable = renderableObject(object)
      if (renderable) {
        if (renderable.geometry) geometries.add(renderable.geometry)
        materialsFor(renderable).forEach((material) => materials.add(material))
      }
      const skeleton = skeletonFor(object)
      if (skeleton) skeletons.add(skeleton)
    })
    materials.forEach((material) => collectTextures(material, textures, new Set()))
    textures.forEach((texture) => this.disposeOnce(texture))
    skeletons.forEach((skeleton) => this.disposeOnce(skeleton))
    geometries.forEach((geometry) => this.disposeOnce(geometry))
    materials.forEach((material) => this.disposeOnce(material))
    clearSceneSafely(model.scene)
  }

  private disposeOnce(resource: object): void {
    if (this.disposedGpuResources.has(resource)) return
    this.disposedGpuResources.add(resource)
    const dispose = (resource as { dispose?: () => void }).dispose
    if (typeof dispose !== 'function') return
    try {
      dispose.call(resource)
    } catch {
      // Continue disposing sibling resources and complete cache accounting.
    }
  }

  private loadedValue<T extends CacheResource>(entry: CacheEntry<T>): T {
    if (entry.status !== 'loaded' || entry.value === null) {
      throw new Error(`Asset cache entry ${entry.key} did not finish loading`)
    }
    return entry.value
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('AssetManager is disposed')
  }
}
