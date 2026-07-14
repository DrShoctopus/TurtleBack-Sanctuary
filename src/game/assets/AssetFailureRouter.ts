import { canonicalAssetManifest } from './registry'
import type { AssetId, AssetKind } from './schema'

export type AssetFailureChannel = 'model' | 'texture' | 'streaming-media' | 'audio-buffer'

export interface ConsumedAssetFailure {
  readonly id: AssetId
  readonly channel: AssetFailureChannel
  readonly sequence: number
}

export interface AssetFailureSnapshot {
  readonly enabled: boolean
  readonly pendingIds: readonly AssetId[]
  readonly consumed: readonly ConsumedAssetFailure[]
}

export class InjectedAssetFailure extends Error {
  readonly assetId: AssetId
  readonly channel: AssetFailureChannel

  constructor(assetId: AssetId, channel: AssetFailureChannel) {
    super(`Injected ${channel} failure for asset ${assetId}`)
    this.name = 'InjectedAssetFailure'
    this.assetId = assetId
    this.channel = channel
  }
}

function failureChannelFor(kind: AssetKind): AssetFailureChannel {
  switch (kind) {
    case 'model':
    case 'animation':
      return 'model'
    case 'texture':
    case 'environment':
      return 'texture'
    case 'music-track':
    case 'ambience-bed':
      return 'streaming-media'
    case 'ambient-detail':
    case 'wildlife-call':
    case 'turtle-sound':
      return 'audio-buffer'
  }
}

export function assetFailureInjectionEnabled(input: {
  readonly dev: boolean
  readonly diagnosticsFlag: string | undefined
}): boolean {
  return input.dev || input.diagnosticsFlag === '1'
}

export class AssetFailureRouter {
  private readonly enabled: boolean
  private readonly kindFor: (id: AssetId) => AssetKind | null
  private readonly pending = new Set<AssetId>()
  private readonly consumed: ConsumedAssetFailure[] = []
  private sequence = 0

  constructor(input: {
    readonly enabled: boolean
    readonly kindFor: (id: AssetId) => AssetKind | null
  }) {
    this.enabled = input.enabled
    this.kindFor = input.kindFor
  }

  failNext(id: AssetId): boolean {
    if (!this.enabled || this.pending.has(id) || this.kindFor(id) === null) return false
    this.pending.add(id)
    return true
  }

  consume(id: AssetId, channel: AssetFailureChannel): boolean {
    if (!this.enabled || !this.pending.has(id)) return false
    const kind = this.kindFor(id)
    if (kind === null || failureChannelFor(kind) !== channel) return false

    this.pending.delete(id)
    this.sequence += 1
    this.consumed.push({ id, channel, sequence: this.sequence })
    if (this.consumed.length > 32) this.consumed.splice(0, this.consumed.length - 32)
    return true
  }

  snapshot(): AssetFailureSnapshot {
    return {
      enabled: this.enabled,
      pendingIds: [...this.pending].sort(),
      consumed: this.consumed.map((entry) => ({ ...entry })),
    }
  }

  reset(): void {
    if (!this.enabled) return
    this.pending.clear()
    this.consumed.length = 0
    this.sequence = 0
  }
}

const canonicalKinds = new Map(
  canonicalAssetManifest.assets.map((record) => [record.id, record.kind] as const),
)

export const assetFailureRouter = new AssetFailureRouter({
  enabled: assetFailureInjectionEnabled({
    dev: import.meta.env.DEV,
    diagnosticsFlag: import.meta.env.VITE_TURTLEBACK_DIAGNOSTICS,
  }),
  kindFor: (id) => canonicalKinds.get(id) ?? null,
})
