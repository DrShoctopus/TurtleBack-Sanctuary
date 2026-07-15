import { describe, expect, it } from 'vitest'
import {
  GRAPHICS_REFERENCE_IDS,
  parseGraphicsArgs,
  parseGraphicsReferenceId,
  parseRegisteredId,
  parseUniqueLongOptions,
  stripLeadingPackageManagerSeparator,
} from '../scripts/lib/graphicsCli'

const DEFAULT_SCENARIO = 'arrival-bridge-high-noon-clear'

describe('graphics CLI parser', () => {
  it('uses the full default matrix when no options are present', () => {
    expect(parseGraphicsArgs([])).toEqual({ scenario: null })
    expect(parseGraphicsArgs(['--'])).toEqual({ scenario: null })
  })

  it('accepts one registered scenario', () => {
    expect(parseGraphicsArgs([`--scenario=${DEFAULT_SCENARIO}`])).toEqual({
      scenario: DEFAULT_SCENARIO,
    })
  })

  it.each([
    ['position'],
    ['--unknown=value'],
    ['--scenario'],
    ['--scenario='],
    ['--scenario=not-registered'],
    ['--variant=default'],
    [`--scenario=${DEFAULT_SCENARIO}`, `--scenario=${DEFAULT_SCENARIO}`],
    ['--', '--', `--scenario=${DEFAULT_SCENARIO}`],
  ])('rejects malformed, unknown, empty, positional, or duplicate input: %j', (...args) => {
    expect(() => parseGraphicsArgs(args)).toThrow()
  })
})

describe('shared strict CLI primitives', () => {
  it('strips at most one leading package-manager separator', () => {
    expect(stripLeadingPackageManagerSeparator(['--', '--reference=high-dedicated'])).toEqual([
      '--reference=high-dedicated',
    ])
    expect(stripLeadingPackageManagerSeparator(['--', '--'])).toEqual(['--'])
  })

  it('parses unique long options for later benchmark extensions', () => {
    expect(
      parseUniqueLongOptions(
        ['--reference=high-dedicated', `--scenario=${DEFAULT_SCENARIO}`],
        ['reference', 'scenario'],
      ),
    ).toEqual(
      new Map([
        ['reference', 'high-dedicated'],
        ['scenario', DEFAULT_SCENARIO],
      ]),
    )
  })

  it('validates registered and reference IDs through one primitive', () => {
    expect(parseRegisteredId('reference', 'high-dedicated', GRAPHICS_REFERENCE_IDS)).toBe(
      'high-dedicated',
    )
    expect(parseGraphicsReferenceId('low-integrated')).toBe('low-integrated')
    expect(() => parseGraphicsReferenceId('other')).toThrow()
  })
})
