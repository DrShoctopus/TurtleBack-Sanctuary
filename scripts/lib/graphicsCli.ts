import {
  BENCHMARK_SCENARIOS,
  type GraphicsBenchmarkCli,
} from '../../src/game/config/benchmarkScenarios'

/** Phase F extends this exact registry instead of creating a second parser. */
export const GRAPHICS_REFERENCE_IDS = ['high-dedicated', 'low-integrated'] as const
export type GraphicsReferenceId = (typeof GRAPHICS_REFERENCE_IDS)[number]

export function stripLeadingPackageManagerSeparator(argv: readonly string[]): readonly string[] {
  return argv[0] === '--' ? argv.slice(1) : [...argv]
}

/**
 * Parse strict `--name=value` options once. This is the shared primitive used by
 * browser, packaged, and soak benchmark parsers as later phases add flags.
 */
export function parseUniqueLongOptions(
  argv: readonly string[],
  allowedNames: readonly string[],
): ReadonlyMap<string, string> {
  const args = stripLeadingPackageManagerSeparator(argv)
  const allowed = new Set(allowedNames)
  const parsed = new Map<string, string>()

  for (const argument of args) {
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected positional graphics argument: ${argument}`)
    }
    const equals = argument.indexOf('=')
    if (equals <= 2) throw new Error(`Graphics option must use --name=value: ${argument}`)

    const name = argument.slice(2, equals)
    const value = argument.slice(equals + 1)
    if (!allowed.has(name)) throw new Error(`Unknown graphics option: --${name}`)
    if (value.length === 0) throw new Error(`Graphics option --${name} must not be empty`)
    if (parsed.has(name)) throw new Error(`Duplicate graphics option: --${name}`)
    parsed.set(name, value)
  }

  return parsed
}

export function parseRegisteredId<const Id extends string>(
  label: string,
  value: string,
  registeredIds: readonly Id[],
): Id {
  const match = registeredIds.find((candidate) => candidate === value)
  if (!match) throw new Error(`Unregistered ${label} ID: ${value}`)
  return match
}

export function parseGraphicsReferenceId(value: string): GraphicsReferenceId {
  return parseRegisteredId('graphics reference', value, GRAPHICS_REFERENCE_IDS)
}

const SCENARIO_IDS = BENCHMARK_SCENARIOS.map((scenario) => scenario.id)

export function parseGraphicsArgs(argv: readonly string[]): GraphicsBenchmarkCli {
  const options = parseUniqueLongOptions(argv, ['scenario'])
  const scenario = options.has('scenario')
    ? parseRegisteredId('graphics scenario', options.get('scenario')!, SCENARIO_IDS)
    : null
  return { scenario }
}
