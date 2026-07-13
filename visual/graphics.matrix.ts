import {
  BENCHMARK_SCENARIOS,
  BENCHMARK_TIMES,
  type BenchmarkScenario,
  type BenchmarkTimeName,
} from '../src/game/config/benchmarkScenarios'

export type GraphicsCaptureCondition = `${BenchmarkTimeName}-${BenchmarkScenario['weather']}`

export interface GraphicsCaptureEntry {
  readonly scenario: BenchmarkScenario
  readonly condition: GraphicsCaptureCondition
  readonly outputPath: string
}

export function benchmarkTimeName(time: number): BenchmarkTimeName {
  for (const [name, value] of Object.entries(BENCHMARK_TIMES) as Array<
    [BenchmarkTimeName, number]
  >) {
    if (time === value) return name
  }
  throw new RangeError(`Unregistered benchmark time: ${time}`)
}

export function scenarioCondition(scenario: BenchmarkScenario): GraphicsCaptureCondition {
  return `${benchmarkTimeName(scenario.time)}-${scenario.weather}`
}

export function scenarioCapturePath(scenario: BenchmarkScenario): string {
  return `${scenario.quality}/${scenarioCondition(scenario)}/${scenario.view}.png`
}

export function buildGraphicsCaptureMatrix(
  scenarios: readonly BenchmarkScenario[] = BENCHMARK_SCENARIOS,
): readonly GraphicsCaptureEntry[] {
  const paths = new Set<string>()
  return Object.freeze(
    scenarios.map((scenario) => {
      const outputPath = scenarioCapturePath(scenario)
      if (paths.has(outputPath)) throw new Error(`Duplicate graphics capture path: ${outputPath}`)
      paths.add(outputPath)
      return Object.freeze({
        scenario,
        condition: scenarioCondition(scenario),
        outputPath,
      })
    }),
  )
}

export const GRAPHICS_CAPTURE_MATRIX = buildGraphicsCaptureMatrix()
