import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useThree } from '@react-three/fiber'
import type { QualityLevel } from '../core/quality'
import { AssetManager, type AssetPreloadLease } from './AssetManager'
import { assetFailureRouter } from './AssetFailureRouter'
import { registerActiveAssetDiagnostics } from './diagnostics'
import { createAuthoredAssetLoaders } from './loaders'
import { proceduralFallbacks, PROCEDURAL_FALLBACK_KEYS } from './proceduralFallbacks'
import { canonicalAssetManifest, createAssetRegistry } from './registry'
import { resolveStaticAssetUrl } from './urls'

export const PIPELINE_SMOKE_IDS = ['model.pipeline-smoke', 'texture.pipeline-smoke'] as const
export const ASSET_PIPELINE_AUTHORED_MARK = 'turtleback:asset-pipeline-authored'
export const ASSET_PIPELINE_FALLBACK_MARK = 'turtleback:asset-pipeline-fallback'
const AssetManagerContext = createContext<AssetManager | null>(null)
const canonicalAssetRegistry = createAssetRegistry(canonicalAssetManifest.assets, {
  proceduralFallbackKeys: PROCEDURAL_FALLBACK_KEYS,
})

let activePipelineInvalidator:
  | { readonly token: symbol; readonly invalidate: () => boolean }
  | null = null

/**
 * Diagnostic-only cache seam used after a deliberate smoke-asset failure is
 * armed. Releasing the current preload makes the next quality request perform
 * real model/texture work instead of reusing the already-pinned cache entry.
 */
export function invalidateActivePipelineSmokePreload(): boolean {
  return activePipelineInvalidator?.invalidate() ?? false
}

function registerPipelineInvalidator(invalidate: () => boolean): () => void {
  const token = Symbol('active pipeline preload invalidator')
  activePipelineInvalidator = { token, invalidate }
  return () => {
    if (activePipelineInvalidator?.token === token) activePipelineInvalidator = null
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function releasePreloadSafely(lease: AssetPreloadLease | null): void {
  try {
    lease?.release()
  } catch {
    // A teardown listener must not break coordinator generation accounting.
  }
}

export function markAssetPipelineReadiness(
  diagnostics: ReturnType<AssetManager['diagnostics']>,
  mark: (name: string) => void = (name) => globalThis.performance?.mark(name),
): string {
  const authored =
    PIPELINE_SMOKE_IDS.every((id) => diagnostics.loadedIds.includes(id)) &&
    diagnostics.fallbackIds.length === 0
  const name = authored ? ASSET_PIPELINE_AUTHORED_MARK : ASSET_PIPELINE_FALLBACK_MARK
  mark(name)
  return name
}

export class AssetPreloadCoordinator {
  private readonly onReady: () => void
  private readonly onError: (error: Error) => void
  private current: AssetPreloadLease | null = null
  private generation = 0
  private readySignalled = false
  private disposed = false

  constructor(input: { readonly onReady: () => void; readonly onError: (error: Error) => void }) {
    this.onReady = input.onReady
    this.onError = input.onError
  }

  async request(load: () => Promise<AssetPreloadLease>): Promise<void> {
    if (this.disposed) return
    const generation = ++this.generation

    let lease: AssetPreloadLease
    try {
      lease = await load()
    } catch (error) {
      if (!this.disposed && generation === this.generation) this.onError(asError(error))
      return
    }

    if (this.disposed || generation !== this.generation) {
      releasePreloadSafely(lease)
      return
    }
    const previous = this.current
    this.current = lease
    releasePreloadSafely(previous)
    if (!this.readySignalled) {
      this.readySignalled = true
      this.onReady()
    }
  }

  invalidate(): boolean {
    if (this.disposed) return false
    this.generation += 1
    const current = this.current
    this.current = null
    releasePreloadSafely(current)
    return current !== null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    releasePreloadSafely(this.current)
    this.current = null
  }
}

export function AssetProvider(props: {
  readonly quality: QualityLevel
  readonly baseUrl: string
  readonly children: ReactNode
}) {
  const renderer = useThree((state) => state.gl)
  const readyRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [initialError, setInitialError] = useState<Error | null>(null)
  const manager = useMemo(() => {
    const loaders = createAuthoredAssetLoaders({
      renderer,
      transcoderPath: resolveStaticAssetUrl(props.baseUrl, 'assets/decoders/basis/'),
    })
    return new AssetManager({
      registry: canonicalAssetRegistry,
      loaders,
      proceduralFallbacks,
      failureRouter: assetFailureRouter,
      resolveUrl: (path) => resolveStaticAssetUrl(props.baseUrl, path),
    })
  }, [props.baseUrl, renderer])
  const coordinator = useMemo(
    () =>
      new AssetPreloadCoordinator({
        onReady: () => {
          markAssetPipelineReadiness(manager.diagnostics())
          readyRef.current = true
          setInitialError(null)
          setReady(true)
        },
        onError: (error) => {
          if (!readyRef.current) {
            setInitialError(error)
            return
          }
          console.error('Asset quality preload failed; keeping the previous preload', error)
        },
      }),
    [manager],
  )

  useEffect(() => {
    const unregisterDiagnostics = registerActiveAssetDiagnostics(manager)
    const unregisterInvalidator = registerPipelineInvalidator(() => coordinator.invalidate())
    return () => {
      unregisterInvalidator()
      coordinator.dispose()
      unregisterDiagnostics()
      manager.dispose()
    }
  }, [coordinator, manager])

  useEffect(() => {
    void coordinator.request(() => manager.preload(PIPELINE_SMOKE_IDS, props.quality))
  }, [coordinator, manager, props.quality])

  if (initialError) throw initialError
  if (!ready) return null
  return (
    <AssetManagerContext.Provider value={manager}>{props.children}</AssetManagerContext.Provider>
  )
}

export function useAssetManager(): AssetManager {
  const manager = useContext(AssetManagerContext)
  if (!manager) throw new Error('useAssetManager must be used within AssetProvider')
  return manager
}
