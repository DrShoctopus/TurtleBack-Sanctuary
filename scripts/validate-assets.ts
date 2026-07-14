import {
  validateAssetRegistry,
  type AssetValidationOptions,
} from '../src/game/assets/validate.node'

const SLICES = new Set(['rendering', 'world', 'audio'] as const)

function parseOptions(args: readonly string[]): AssetValidationOptions {
  let slice: AssetValidationOptions['slice']
  let final = false
  let writeLicenses = false
  const seen = new Set<string>()

  for (const argument of args) {
    if (argument.startsWith('--slice=')) {
      if (seen.has('slice')) throw new Error('Duplicate --slice flag')
      seen.add('slice')
      const value = argument.slice('--slice='.length)
      if (!SLICES.has(value as 'rendering' | 'world' | 'audio')) {
        throw new Error(`Invalid asset slice: ${value || '(empty)'}`)
      }
      slice = value as 'rendering' | 'world' | 'audio'
    } else if (argument === '--final') {
      if (seen.has('final')) throw new Error('Duplicate --final flag')
      seen.add('final')
      final = true
    } else if (argument === '--write-licenses') {
      if (seen.has('write-licenses')) throw new Error('Duplicate --write-licenses flag')
      seen.add('write-licenses')
      writeLicenses = true
    } else {
      throw new Error(`Unknown asset validator flag: ${argument}`)
    }
  }

  if (slice && final) throw new Error('--final cannot be combined with --slice')
  if (slice && writeLicenses) {
    throw new Error('--write-licenses cannot be combined with --slice; the ledger is always global')
  }
  return { slice, final, writeLicenses }
}

try {
  const report = await validateAssetRegistry(process.cwd(), parseOptions(process.argv.slice(2)))
  process.stdout.write(
    `Validated ${report.assetCount} assets, ${report.variantCount} variants, and ${report.verifiedBytes} encoded bytes.\n`,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Asset validation failed: ${message}\n`)
  process.exitCode = 1
}
