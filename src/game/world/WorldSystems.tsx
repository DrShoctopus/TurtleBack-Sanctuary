import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Object3D } from 'three'
import { updatePlayerZone } from '../village/zones'
import { applySimpleWetness } from '../weather/simpleWet'
import { runtime } from '../core/runtime'
import { events } from '../core/events'
import { terrainHeight } from './shell/shellShape'
import {
  BENCHMARKS,
  BENCHMARK_SHORTCUTS,
  isBenchmarkId,
  type BenchmarkId,
  type FixedBenchmark,
} from '../config/benchmarks'
import type { GraphicsBenchmarkVariant } from '../config/benchmarkScenarios'
import { FrameTimeWindow } from '../core/frameTimeStats'
import { cellId } from './spatial/cells'
import {
  collectSceneProbe,
  registerProbeContributor,
  registerProbeSection,
  type SceneProbeSnapshot,
} from '../debug/probes'
import {
  estimateTextureBytes,
  frameTimePercentiles,
  rendererCounters,
} from '../debug/performanceMath'
import { canonicalAssetManifest } from '../assets/registry'
import { assetFailureRouter } from '../assets/AssetFailureRouter'
import {
  invalidateActivePipelineSmokePreload,
  PIPELINE_SMOKE_IDS,
} from '../assets/AssetProvider'
import { readActiveAssetDiagnostics } from '../assets/diagnostics'
import { audio } from '../audio/AudioManager'

export interface TurtlebackDebug {
  teleport: (x: number, z: number, yaw?: number, pitch?: number) => void
  benchmark: (id: string) => boolean
  benchmarks: () => BenchmarkId[]
  player: () => { x: number; y: number; z: number; yaw: number }
  probe: () => SceneProbeSnapshot
  failAsset: (id: string) => boolean
  setBenchmarkVariant: (variant: GraphicsBenchmarkVariant) => boolean
}

type BenchmarkVariantToggle = (variant: GraphicsBenchmarkVariant) => void

const DIAGNOSTICS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_TURTLEBACK_DIAGNOSTICS === '1'
const benchmarkVariantToggles = new Map<string, BenchmarkVariantToggle>()
let benchmarkVariant: GraphicsBenchmarkVariant = 'default'

/** Typed extension seam for later AO and presentation systems. */
export function registerBenchmarkVariantToggle(
  id: string,
  toggle: BenchmarkVariantToggle,
): () => void {
  if (!id || id !== id.trim()) throw new Error('benchmark variant toggle ID must be nonblank')
  if (benchmarkVariantToggles.has(id)) {
    throw new Error(`duplicate benchmark variant toggle ID: ${id}`)
  }
  benchmarkVariantToggles.set(id, toggle)
  toggle(benchmarkVariant)
  return () => {
    if (benchmarkVariantToggles.get(id) === toggle) benchmarkVariantToggles.delete(id)
  }
}

function setGraphicsBenchmarkVariant(candidate: string): candidate is GraphicsBenchmarkVariant {
  if (candidate !== 'default' && candidate !== 'no-ao') return false
  benchmarkVariant = candidate
  for (const [, toggle] of [...benchmarkVariantToggles].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    toggle(candidate)
  }
  return true
}

interface VegetationInstanceCounts {
  total: number
  near: number
  horizon: number
}

function vegetationResidency(
  object: Object3D,
  active: ReadonlySet<string>,
): 'near' | 'horizon' | null {
  let current: Object3D | null = object
  while (current) {
    if (current.name === 'vegetation-aggregate:near') return 'near'
    if (current.name === 'vegetation-aggregate:horizon') return 'horizon'
    if (current.name.startsWith('vegetation-cell:')) {
      return active.has(current.name.slice('vegetation-cell:'.length)) ? 'near' : 'horizon'
    }
    current = current.parent
  }
  return null
}

export function countVegetationInstances(scene: Object3D): VegetationInstanceCounts {
  const active = new Set<string>(runtime.spatial.active)
  const counts: VegetationInstanceCounts = { total: 0, near: 0, horizon: 0 }
  scene.traverse((object) => {
    const candidate = object as Object3D & { readonly isInstancedMesh?: boolean; count?: number }
    if (!candidate.isInstancedMesh) return
    const residency = vegetationResidency(candidate, active)
    if (!residency) return
    const count = candidate.count ?? 0
    counts.total += count
    counts[residency] += count
  })
  return counts
}

/**
 * Low-frequency world housekeeping that doesn't belong to any single object:
 * zone tracking (throttled) and exterior material wetness updates.
 */
export function WorldSystems() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const renderer = useThree((s) => s.gl)
  const fixedCamera = useRef<FixedBenchmark | null>(null)
  const frameTimes = useRef(new FrameTimeWindow(180))
  useEffect(() => {
    const previousAutoReset = renderer.info.autoReset
    renderer.info.autoReset = false
    return () => {
      renderer.info.autoReset = previousAutoReset
      renderer.info.reset()
    }
  }, [renderer])
  useEffect(() => {
    if (DIAGNOSTICS_ENABLED) {
      const devWindow = window as unknown as Record<string, unknown>
      let vegetationInstances = 0
      const unregisterAssets = registerProbeContributor('assets', () => {
        const diagnostics = readActiveAssetDiagnostics()
        if (!diagnostics) return {}
        return {
          loadedAssetIds: diagnostics.loadedIds,
          fallbackAssetIds: diagnostics.fallbackIds,
          decodedAssetBytesById: { ...diagnostics.decodedBytesById },
          estimatedTextureBytes: estimateTextureBytes(
            canonicalAssetManifest.assets,
            diagnostics.loadedIds,
            runtime.quality.level,
          ),
        }
      })
      const unregisterSpatial = registerProbeSection('world', 'spatial', () => ({
        centerCell: cellId(runtime.spatial.center),
        activeCellCount: runtime.spatial.active.length,
        retainedCellCount: runtime.spatial.retained.length,
      }))
      const unregisterVegetation = registerProbeSection('world', 'vegetation', () => ({
        vegetationInstances,
        forestInstances: runtime.forest.nearInstances + runtime.forest.horizonInstances,
        forestLod: runtime.forest.lod,
        forestDiscoveries: runtime.forest.discoveries,
        forestLayers: runtime.forest.layers,
      }))
      const unregisterTurtle = registerProbeSection('turtle', 'hero', () => ({
        model: 'turtle.hero.monumental',
        fallback: false,
        lod: runtime.turtle.lod,
        wakeStrength: runtime.turtle.wakeStrength,
        resonanceStrength: runtime.turtle.resonanceStrength,
        activeEvent: runtime.turtle.activeEvent?.kind ?? null,
      }))
      const unregisterMusic = registerProbeSection('audio', 'music', () => {
        const music = audio.music?.snapshot()
        if (!music) return {}
        return {
          musicForm: music.form,
          musicPalette: music.palette,
          musicLead: music.lead,
          musicSectionIndex: music.sectionIndex,
          musicGlobalBar: music.globalBar,
          musicScheduledEvents: music.scheduledEvents,
          musicSchedulerTimers: music.schedulerTimers,
          musicBiome: music.biome,
          musicTurtleEvent: music.turtleEvent,
        }
      })
      const teleport = (x: number, z: number, yaw = 0, pitch = 0) => {
        fixedCamera.current = null
        events.emit('teleport', {
          x,
          y: terrainHeight(x, z) + 0.08,
          z,
          yaw,
          reason: 'debug',
        })
        runtime.player.pitch = pitch
      }
      const benchmark = (id: string) => {
        if (!isBenchmarkId(id)) return false
        const view = BENCHMARKS[id]
        if (view.mode === 'fixed') fixedCamera.current = view
        else teleport(view.x, view.z, view.yaw, view.pitch)
        return true
      }
      const probe = (): SceneProbeSnapshot => {
        const vegetation = countVegetationInstances(scene)
        vegetationInstances = vegetation.total
        return collectSceneProbe({
          activeCells: runtime.spatial.active,
          retainedCells: runtime.spatial.retained,
          instancesByFamily: {
            forest: runtime.forest.nearInstances + runtime.forest.horizonInstances,
            vegetation: vegetation.total,
          },
          lodsByFamily: {
            forest: {
              horizon: runtime.forest.horizonInstances,
              near: runtime.forest.nearInstances,
              [`lod${runtime.forest.lod}`]: runtime.forest.nearInstances,
            },
            vegetation: { horizon: vegetation.horizon, near: vegetation.near },
          },
          loadedAssetIds: [],
          fallbackAssetIds: [],
          decodedAssetBytesById: {},
          renderer: rendererCounters(renderer.info),
          estimatedTextureBytes: 0,
          sections: {},
        })
      }
      const failAsset = (id: string): boolean => {
        const accepted = assetFailureRouter.failNext(id)
        if (accepted && (PIPELINE_SMOKE_IDS as readonly string[]).includes(id)) {
          invalidateActivePipelineSmokePreload()
        }
        return accepted
      }
      devWindow.__scene = scene
      devWindow.__turtlebackDebug = {
        teleport,
        benchmark,
        benchmarks: () => Object.keys(BENCHMARKS) as BenchmarkId[],
        player: () => ({
          x: runtime.player.pos.x,
          y: runtime.player.pos.y,
          z: runtime.player.pos.z,
          yaw: runtime.player.yaw,
        }),
        probe,
        failAsset,
        setBenchmarkVariant: setGraphicsBenchmarkVariant,
      } satisfies TurtlebackDebug
      const onBenchmarkKey = (event: KeyboardEvent) => {
        const functionKey = ['F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(event.code)
        if (!event.altKey && !functionKey) return
        if (event.code === 'Digit0' && !event.shiftKey) {
          fixedCamera.current = null
          event.preventDefault()
          return
        }
        const shortcut = functionKey ? event.code : `${event.shiftKey ? 'Shift+' : ''}${event.code}`
        const id = BENCHMARK_SHORTCUTS[shortcut]
        if (!id) return
        benchmark(id)
        event.preventDefault()
      }
      window.addEventListener('keydown', onBenchmarkKey)
      return () => {
        unregisterMusic()
        unregisterTurtle()
        unregisterVegetation()
        unregisterSpatial()
        unregisterAssets()
        window.removeEventListener('keydown', onBenchmarkKey)
        delete devWindow.__scene
        delete devWindow.__turtlebackDebug
      }
    }
  }, [renderer, scene])
  let zoneAcc = 0
  // EffectComposer can issue multiple renderer.render() calls for one visual
  // frame. Reset once before every R3F frame so diagnostics accumulate the
  // complete scene plus post-processing passes instead of only the last pass.
  useFrame(() => renderer.info.reset(), -1_000)
  useFrame((_, dt) => {
    if (Number.isFinite(dt) && dt > 0) {
      frameTimes.current.add(dt * 1000)
      if (frameTimes.current.isFull) {
        runtime.perf.p95FrameMs = frameTimePercentiles(frameTimes.current.snapshot()).p95FrameMs
        frameTimes.current.clear()
      }
    }
    zoneAcc += dt
    if (zoneAcc >= 0.25) {
      zoneAcc = 0
      updatePlayerZone()
    }
    applySimpleWetness(runtime.weather.wetness)
    if (DIAGNOSTICS_ENABLED && fixedCamera.current) {
      const view = fixedCamera.current
      camera.position.set(...view.position)
      camera.lookAt(...view.lookAt)
    }
  })
  return null
}
