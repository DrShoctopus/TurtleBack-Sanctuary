import { useFrame } from '@react-three/fiber'
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { runtime } from '../../core/runtime'
import { useQualityProfile } from '../../core/useQualityProfile'
import { SpatialCellTracker } from './cells'
import {
  DEFAULT_SPATIAL_GRID,
  type CellTransition,
  type SpatialGridConfig,
  type SpatialRuntimeState,
} from './types'

const SPATIAL_TICK_SECONDS = 0.1

interface SpatialCellStore {
  getSnapshot: () => CellTransition
  subscribe: (listener: () => void) => () => void
  reconfigure: (config: SpatialGridConfig) => void
  sample: (x: number, z: number) => void
}

function runtimeSnapshot(transition: CellTransition): SpatialRuntimeState {
  return Object.freeze({
    center: transition.center,
    active: transition.active,
    retained: transition.retained,
  })
}

function createSpatialCellStore(config: SpatialGridConfig): SpatialCellStore {
  const tracker = new SpatialCellTracker(config)
  const initial = tracker.update(runtime.player.pos.x, runtime.player.pos.z)
  if (!initial) throw new Error('the first spatial sample must produce a transition')

  let snapshot = initial
  const listeners = new Set<() => void>()
  runtime.spatial = runtimeSnapshot(snapshot)

  const publish = (transition: CellTransition | null): void => {
    if (!transition) return
    snapshot = transition
    runtime.spatial = runtimeSnapshot(transition)
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    reconfigure: (nextConfig) => publish(tracker.reconfigure(nextConfig)),
    sample: (x, z) => publish(tracker.update(x, z)),
  }
}

const SpatialCellContext = createContext<SpatialCellStore | null>(null)

export function SpatialCellProvider({ children }: { children: ReactNode }) {
  const quality = useQualityProfile()
  const storeRef = useRef<SpatialCellStore | null>(null)
  if (!storeRef.current) {
    storeRef.current = createSpatialCellStore({
      ...DEFAULT_SPATIAL_GRID,
      loadRadius: quality.cellLoadRadius,
      retainRadius: quality.cellRetainRadius,
    })
  }
  const store = storeRef.current
  const elapsed = useRef(0)

  useLayoutEffect(() => {
    store.reconfigure({
      ...DEFAULT_SPATIAL_GRID,
      loadRadius: quality.cellLoadRadius,
      retainRadius: quality.cellRetainRadius,
    })
  }, [quality.cellLoadRadius, quality.cellRetainRadius, store])

  useFrame((_, delta) => {
    if (!Number.isFinite(delta) || delta <= 0) return
    elapsed.current += delta
    if (elapsed.current < SPATIAL_TICK_SECONDS) return

    // Discard backlog after a long frame: residency samples at most once per
    // rendered frame and never performs a React-notifying catch-up loop.
    elapsed.current %= SPATIAL_TICK_SECONDS
    store.sample(runtime.player.pos.x, runtime.player.pos.z)
  })

  return <SpatialCellContext.Provider value={store}>{children}</SpatialCellContext.Provider>
}

export function useSpatialCellSnapshot(): CellTransition {
  const store = useContext(SpatialCellContext)
  if (!store) throw new Error('useSpatialCellSnapshot must be used within SpatialCellProvider')
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
