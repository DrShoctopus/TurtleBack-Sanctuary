import {
  LoadingManager,
  type AnimationClip,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import {
  BASIS_TRANSCODER_BOOTSTRAP_MESSAGE,
  BASIS_TRANSCODER_WORKER_FILENAME,
} from '../../shared/basisTranscoder'

export interface ModelAsset {
  readonly scene: Object3D
  readonly animations: readonly AnimationClip[]
}

export interface AuthoredAssetLoaders {
  readonly gltf: GLTFLoader
  readonly ktx2: KTX2Loader
  cloneModel(gltf: GLTF): ModelAsset
  dispose(): void
}

function disposeSafely(resource: { dispose(): void }): void {
  try {
    resource.dispose()
  } catch {
    // GPU teardown is best-effort; ownership accounting must still complete.
  }
}

function clearSafely(scene: Object3D): void {
  try {
    scene.clear()
  } catch {
    // A user event listener must not interrupt clone rollback.
  }
}

function disposeClonedSkeletons(scene: Object3D): void {
  const skeletons = new Set<{ dispose(): void }>()
  scene.traverse((object) => {
    const candidate = object as Object3D & {
      readonly isSkinnedMesh?: boolean
      readonly skeleton?: { dispose(): void }
    }
    if (candidate.isSkinnedMesh && candidate.skeleton) skeletons.add(candidate.skeleton)
  })
  skeletons.forEach(disposeSafely)
}

interface MaterialObject extends Object3D {
  material: Material | Material[]
}

function materialObject(object: Object3D): MaterialObject | null {
  const material = (object as Object3D & { material?: unknown }).material
  const valid = Array.isArray(material)
    ? material.every((item) => (item as { isMaterial?: unknown })?.isMaterial === true)
    : (material as { isMaterial?: unknown } | undefined)?.isMaterial === true
  return valid ? (object as MaterialObject) : null
}

function isTexture(value: unknown): value is Texture {
  return (value as { isTexture?: unknown } | null)?.isTexture === true
}

function rebindSharedTextures(
  source: unknown,
  cloned: unknown,
  transientTextures: Set<Texture>,
  seen: Set<object>,
): unknown {
  if (isTexture(source)) {
    if (isTexture(cloned) && cloned !== source) transientTextures.add(cloned)
    return source
  }
  if (typeof source !== 'object' || source === null || seen.has(source)) return cloned
  seen.add(source)

  if (Array.isArray(source)) {
    if (!Array.isArray(cloned)) {
      seen.delete(source)
      return cloned
    }
    source.forEach((value, index) => {
      const rebound = rebindSharedTextures(value, cloned[index], transientTextures, seen)
      if (rebound !== cloned[index]) cloned[index] = rebound
    })
    seen.delete(source)
    return cloned
  }
  if (typeof cloned !== 'object' || cloned === null) {
    seen.delete(source)
    return cloned
  }
  const sourceRecord = source as Record<string, unknown>
  const clonedRecord = cloned as Record<string, unknown>
  for (const key of Object.keys(sourceRecord)) {
    const rebound = rebindSharedTextures(
      sourceRecord[key],
      clonedRecord[key],
      transientTextures,
      seen,
    )
    if (rebound !== clonedRecord[key]) clonedRecord[key] = rebound
  }
  seen.delete(source)
  return cloned
}

function cloneMaterials(scene: Object3D): void {
  const clones = new Map<Material, Material>()
  const cloneMaterial = (material: Material): Material => {
    const existing = clones.get(material)
    if (existing) return existing
    const cloned = material.clone()
    const transientTextures = new Set<Texture>()
    try {
      rebindSharedTextures(material, cloned, transientTextures, new Set())
    } catch (error) {
      transientTextures.forEach(disposeSafely)
      disposeSafely(cloned)
      throw error
    }
    transientTextures.forEach(disposeSafely)
    clones.set(material, cloned)
    return cloned
  }

  try {
    scene.traverse((object) => {
      const renderable = materialObject(object)
      if (!renderable) return
      renderable.material = Array.isArray(renderable.material)
        ? renderable.material.map(cloneMaterial)
        : cloneMaterial(renderable.material)
    })
  } catch (error) {
    clones.forEach(disposeSafely)
    disposeClonedSkeletons(scene)
    clearSafely(scene)
    throw error
  }
}

export function cloneModelAsset(source: ModelAsset): ModelAsset {
  const scene = cloneSkeleton(source.scene)
  cloneMaterials(scene)
  return { scene, animations: [...source.animations] }
}

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`
}

function workerFailureData(error: string) {
  return {
    type: 'error',
    error,
    data: { faces: [], width: 0, height: 0, format: 0, type: 0, dfdFlags: 0 },
  }
}

/**
 * Three's WorkerPool has no owner-side error listener. Bridge load/parse and
 * message-deserialization failures into the same message contract as decoder
 * failures so the current request rejects and a failed worker never hangs a
 * later request.
 */
export function bridgeBasisWorkerFailures(nativeWorker: Worker): Worker {
  const messageListeners = new Set<EventListenerOrEventListenerObject>()
  let terminalFailure: string | null = null
  let pendingTranscodes = 0

  const emit = (event: MessageEvent) => {
    for (const listener of [...messageListeners]) {
      if (typeof listener === 'function') listener.call(nativeWorker, event)
      else listener.handleEvent(event)
    }
  }
  const emitTerminalFailure = () => {
    if (terminalFailure === null || pendingTranscodes === 0) return
    pendingTranscodes -= 1
    emit({ data: workerFailureData(terminalFailure) } as MessageEvent)
  }
  const fail = (reason: unknown) => {
    if (terminalFailure !== null) return
    terminalFailure = `Basis worker failed to load or communicate: ${String(reason)}`
    if (pendingTranscodes > 0) queueMicrotask(emitTerminalFailure)
  }

  nativeWorker.addEventListener('message', (event) => {
    if (pendingTranscodes > 0) pendingTranscodes -= 1
    emit(event)
  })
  nativeWorker.addEventListener('error', (event) => {
    event.preventDefault()
    fail(event.error ?? event.message ?? 'unknown worker error')
  })
  nativeWorker.addEventListener('messageerror', (event) => {
    event.preventDefault()
    fail(event.data ?? 'unknown worker message error')
  })

  const worker = new Proxy(nativeWorker, {
    get(target, property) {
      if (property === 'addEventListener') {
        return (type: string, listener: EventListenerOrEventListenerObject) => {
          if (type === 'message') messageListeners.add(listener)
          else target.addEventListener(type, listener)
        }
      }
      if (property === 'removeEventListener') {
        return (type: string, listener: EventListenerOrEventListenerObject) => {
          if (type === 'message') messageListeners.delete(listener)
          else target.removeEventListener(type, listener)
        }
      }
      if (property === 'postMessage') {
        return (message: unknown, transfer?: Transferable[]) => {
          if ((message as { type?: unknown } | null)?.type === 'transcode') {
            pendingTranscodes += 1
          }
          if (terminalFailure !== null) {
            queueMicrotask(emitTerminalFailure)
            return
          }
          if (transfer) target.postMessage(message, transfer)
          else target.postMessage(message)
        }
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return worker
}

class IsolatedBasisKTX2Loader extends KTX2Loader {
  constructor(
    manager: LoadingManager,
    private readonly workerRelayUrl: string,
  ) {
    super(manager)
  }

  override async init(): Promise<void> {
    await super.init()
    const sourceUrl = this.workerSourceURL
    const transcoderBinary = this.transcoderBinary
    const config = this.workerConfig
    if (!sourceUrl || !transcoderBinary || !config) {
      throw new Error('Basis transcoder initialized without its worker payload')
    }

    this.workerPool.setWorkerCreator(() => {
      const worker = bridgeBasisWorkerFailures(
        new Worker(this.workerRelayUrl, { name: 'turtleback-basis-transcoder' }),
      )
      worker.postMessage({ type: BASIS_TRANSCODER_BOOTSTRAP_MESSAGE, sourceUrl })
      const binary = transcoderBinary.slice(0)
      worker.postMessage({ type: 'init', config, transcoderBinary: binary }, [binary])
      return worker
    })
  }
}

export function createAuthoredAssetLoaders(input: {
  readonly renderer: WebGLRenderer
  readonly transcoderPath: string
  readonly manager?: LoadingManager
}): AuthoredAssetLoaders {
  const manager = input.manager ?? new LoadingManager()
  const transcoderPath = withTrailingSlash(input.transcoderPath)
  const workerRelayUrl = new URL(BASIS_TRANSCODER_WORKER_FILENAME, transcoderPath).href
  const ktx2 = new IsolatedBasisKTX2Loader(manager, workerRelayUrl)
    .setTranscoderPath(transcoderPath)
    .detectSupport(input.renderer)
  const gltf = new GLTFLoader(manager).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)
  let disposed = false

  return {
    gltf,
    ktx2,
    cloneModel(gltfAsset) {
      return cloneModelAsset(gltfAsset)
    },
    dispose() {
      if (disposed) return
      disposed = true
      ktx2.dispose()
    },
  }
}
