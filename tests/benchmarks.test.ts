import { describe, expect, it } from 'vitest'
import { BENCHMARKS, BENCHMARK_SHORTCUTS, isBenchmarkId } from '../src/game/config/benchmarks'
import { BENCHMARK_SCENARIOS } from '../src/game/config/benchmarkScenarios'
import { isInsideShell } from '../src/game/world/shell/shellShape'
import { GRAPHICS_CAPTURE_MATRIX, scenarioCapturePath } from '../visual/graphics.matrix'

const FOUNDATION_CAMERA_IDS = [
  'forest-interior',
  'biome-threshold',
  'wildlife-grouping',
  'waterfall-rim',
  'flipper-scale',
  'galecrest-turtle-reveal',
  'turtle-eye-encounter',
] as const

describe('visual benchmark registry', () => {
  it('contains valid finite cameras', () => {
    expect(Object.keys(BENCHMARKS).length).toBeGreaterThanOrEqual(18)
    for (const [id, view] of Object.entries(BENCHMARKS)) {
      expect(isBenchmarkId(id)).toBe(true)
      const values =
        view.mode === 'fixed'
          ? [...view.position, ...view.lookAt]
          : [view.x, view.z, view.yaw, view.pitch]
      expect(values.every(Number.isFinite)).toBe(true)
    }
  })

  it('maps every shortcut to a registered view', () => {
    for (const id of Object.values(BENCHMARK_SHORTCUTS)) expect(isBenchmarkId(id)).toBe(true)
  })

  it('provides foundation and hero cameras at safe current-shell positions', () => {
    for (const id of FOUNDATION_CAMERA_IDS) {
      const camera = BENCHMARKS[id]
      expect(camera.mode).toBe('teleport')
      if (camera.mode === 'teleport') expect(isInsideShell(camera.x, camera.z, 1)).toBe(true)
    }
  })

  it('registers a unique scenario ID and valid camera for every matrix row', () => {
    const ids = BENCHMARK_SCENARIOS.map((scenario) => scenario.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const scenario of BENCHMARK_SCENARIOS) {
      expect(isBenchmarkId(scenario.view), scenario.id).toBe(true)
      expect(scenario.warmupMs).toBeGreaterThan(0)
      expect(scenario.time).toBeGreaterThanOrEqual(0)
      expect(scenario.time).toBeLessThanOrEqual(1)
    }
  })

  it('covers the approved tier and condition matrix', () => {
    const conditions = (quality: 'low' | 'medium' | 'high' | 'ultra') =>
      new Set(
        GRAPHICS_CAPTURE_MATRIX.filter((entry) => entry.scenario.quality === quality).map(
          (entry) => entry.condition,
        ),
      )

    expect(conditions('high')).toEqual(
      new Set(['noon-clear', 'noon-rain', 'sunset-clear', 'night-clear']),
    )
    expect(conditions('medium')).toEqual(new Set(['noon-clear', 'night-clear']))
    expect(conditions('low')).toEqual(new Set(['noon-clear']))
    expect(conditions('ultra')).toEqual(new Set(['noon-clear']))

    const high = BENCHMARK_SCENARIOS.filter((scenario) => scenario.quality === 'high')
    const medium = BENCHMARK_SCENARIOS.filter((scenario) => scenario.quality === 'medium')
    for (const view of Object.keys(BENCHMARKS)) {
      expect(high.filter((scenario) => scenario.view === view)).toHaveLength(4)
      expect(medium.filter((scenario) => scenario.view === view)).toHaveLength(2)
    }

    const low = BENCHMARK_SCENARIOS.filter((scenario) => scenario.quality === 'low')
    expect(low.map((scenario) => scenario.view)).toEqual([
      'arrival-bridge',
      'garden-pond',
      'east-edge',
      'galecrest-turtle-reveal',
      'forest-interior',
    ])
    expect(low.some((scenario) => scenario.tags.includes('smoke'))).toBe(true)
    expect(
      low.some(
        (scenario) =>
          scenario.view === 'forest-interior' &&
          scenario.tags.includes('dense-forest') &&
          scenario.tags.includes('traversal'),
      ),
    ).toBe(true)

    const ultraHeroTags = new Set(
      BENCHMARK_SCENARIOS.filter((scenario) => scenario.quality === 'ultra').flatMap(
        (scenario) => scenario.tags,
      ),
    )
    for (const tag of ['turtle', 'forest', 'wetland', 'village', 'ocean']) {
      expect(ultraHeroTags.has(tag), tag).toBe(true)
    }
  })

  it('keeps AO diagnostics targeted and the final turtle scenario canonical', () => {
    const aoReview = BENCHMARK_SCENARIOS.filter((scenario) => scenario.tags.includes('ao-review'))
    expect(aoReview.map((scenario) => scenario.id)).toEqual([
      'turtle-material-close-high-noon-clear',
    ])
  })

  it('runs every dry capture before rain so slow wetness cannot leak into clear evidence', () => {
    const firstRain = BENCHMARK_SCENARIOS.findIndex((scenario) => scenario.weather === 'rain')
    expect(firstRain).toBeGreaterThan(0)
    expect(BENCHMARK_SCENARIOS.slice(0, firstRain).every((scenario) => scenario.weather === 'clear'))
      .toBe(true)
    expect(BENCHMARK_SCENARIOS.slice(firstRain).every((scenario) => scenario.weather === 'rain'))
      .toBe(true)
  })

  it('derives unique quality/condition/view capture paths purely', () => {
    const paths = GRAPHICS_CAPTURE_MATRIX.map((entry) => entry.outputPath)
    expect(new Set(paths).size).toBe(paths.length)
    for (const entry of GRAPHICS_CAPTURE_MATRIX) {
      expect(entry.outputPath).toBe(scenarioCapturePath(entry.scenario))
      expect(entry.outputPath).toBe(
        `${entry.scenario.quality}/${entry.condition}/${entry.scenario.view}.png`,
      )
    }
  })
})
