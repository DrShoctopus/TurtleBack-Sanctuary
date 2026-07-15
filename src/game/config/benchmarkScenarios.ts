import type { QualityLevel } from '../core/quality'
import { TIME_PRESETS } from '../time/timeMath'
import { BENCHMARKS, type BenchmarkId } from './benchmarks'

export type BenchmarkWeather = 'clear' | 'rain'
export type BenchmarkTimeName = 'noon' | 'sunset' | 'night'

export interface BenchmarkScenario {
  id: string
  view: BenchmarkId
  quality: QualityLevel
  time: number
  weather: BenchmarkWeather
  warmupMs: number
  tags: readonly string[]
}

export interface GraphicsBenchmarkCli {
  scenario: BenchmarkScenario['id'] | null
}

export const BENCHMARK_TIMES = {
  noon: TIME_PRESETS.noon,
  sunset: TIME_PRESETS.sunset,
  night: TIME_PRESETS.night,
} as const satisfies Readonly<Record<BenchmarkTimeName, number>>

interface ScenarioCondition {
  readonly timeName: BenchmarkTimeName
  readonly weather: BenchmarkWeather
}

const HIGH_CONDITIONS: readonly ScenarioCondition[] = [
  { timeName: 'noon', weather: 'clear' },
  { timeName: 'sunset', weather: 'clear' },
  { timeName: 'night', weather: 'clear' },
  // Rain stays last so earlier clear captures cannot inherit wetness state.
  { timeName: 'noon', weather: 'rain' },
]

const MEDIUM_CONDITIONS: readonly ScenarioCondition[] = [
  { timeName: 'noon', weather: 'clear' },
  { timeName: 'night', weather: 'clear' },
]

const ALL_VIEWS = Object.keys(BENCHMARKS) as BenchmarkId[]

function scenario(
  view: BenchmarkId,
  quality: QualityLevel,
  condition: ScenarioCondition,
  tags: readonly string[] = [],
): BenchmarkScenario {
  const id = `${view}-${quality}-${condition.timeName}-${condition.weather}`
  return Object.freeze({
    id,
    view,
    quality,
    time: BENCHMARK_TIMES[condition.timeName],
    weather: condition.weather,
    warmupMs: condition.weather === 'rain' ? 1_500 : 750,
    tags: Object.freeze([...tags]),
  })
}

const high = HIGH_CONDITIONS.flatMap((condition) =>
  ALL_VIEWS.map((view) => scenario(view, 'high', condition)),
)

const medium = MEDIUM_CONDITIONS.flatMap((condition) =>
  ALL_VIEWS.map((view) => scenario(view, 'medium', condition)),
)

const low = [
  scenario('arrival-bridge', 'low', { timeName: 'noon', weather: 'clear' }, ['smoke']),
  scenario('garden-pond', 'low', { timeName: 'noon', weather: 'clear' }, ['smoke']),
  scenario('village-threshold', 'low', { timeName: 'noon', weather: 'clear' }, [
    'smoke',
    'village',
  ]),
  scenario('market-lane', 'low', { timeName: 'noon', weather: 'clear' }, [
    'village',
    'story-clusters',
  ]),
  scenario('east-edge', 'low', { timeName: 'noon', weather: 'clear' }, ['smoke']),
  scenario('galecrest-turtle-reveal', 'low', { timeName: 'noon', weather: 'clear' }, ['smoke']),
  scenario('forest-interior', 'low', { timeName: 'noon', weather: 'clear' }, [
    'dense-forest',
    'traversal',
  ]),
]

const ultra = [
  scenario('turtle-material-close', 'ultra', { timeName: 'noon', weather: 'clear' }, [
    'hero',
    'turtle',
  ]),
  scenario('forest-interior', 'ultra', { timeName: 'noon', weather: 'clear' }, ['hero', 'forest']),
  scenario('wildlife-grouping', 'ultra', { timeName: 'noon', weather: 'clear' }, [
    'hero',
    'wetland',
  ]),
  scenario('plaza', 'ultra', { timeName: 'noon', weather: 'clear' }, ['hero', 'village']),
  scenario('galecrest-turtle-reveal', 'ultra', { timeName: 'noon', weather: 'clear' }, [
    'hero',
    'turtle',
  ]),
  scenario('turtle-eye-encounter', 'ultra', { timeName: 'noon', weather: 'clear' }, [
    'hero',
    'turtle',
  ]),
  scenario('turtle-distant-silhouette', 'ultra', { timeName: 'noon', weather: 'clear' }, [
    'hero',
    'ocean',
  ]),
]

export const BENCHMARK_SCENARIOS: readonly BenchmarkScenario[] = Object.freeze([
  ...high.filter((entry) => entry.weather === 'clear'),
  ...medium,
  ...low,
  ...ultra,
  ...high.filter((entry) => entry.weather === 'rain'),
])
