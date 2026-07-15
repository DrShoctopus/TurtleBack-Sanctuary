import { describe, expect, it } from 'vitest'
import {
  TURTLE_REQUIRED_CLIPS,
  TURTLE_REQUIRED_NODES,
  validateTurtleModelContract,
  type TurtleModelContract,
  type TurtleModelContractIssue,
  type TurtleLod,
} from '../src/game/world/turtle/modelContract'
import { MONUMENTAL_TURTLE_CONTRACT } from '../src/game/world/turtle/heroContract'

const VALID_CONTRACT: TurtleModelContract = {
  metreScale: 1,
  bowAxis: '-z',
  nodes: [...TURTLE_REQUIRED_NODES],
  clips: [...TURTLE_REQUIRED_CLIPS],
  lods: [
    { level: 0, triangleCount: 220_000, bounds: [-170, -30, -250, 170, 30, 250] },
    { level: 1, triangleCount: 82_000, bounds: [-169, -29.8, -248, 169, 29.8, 248] },
    { level: 2, triangleCount: 22_000, bounds: [-168, -29.6, -247, 168, 29.6, 247] },
  ],
  shellAnchor: { semiX: 170, semiZ: 250, rimY: 9 },
  collision: { animated: false, overlapsTraversal: false },
}

function validContract(): TurtleModelContract {
  return structuredClone(VALID_CONTRACT)
}

function codes(contract: TurtleModelContract): string[] {
  return validateTurtleModelContract(contract).map((issue) => issue.code)
}

function replaceLod(
  contract: TurtleModelContract,
  level: TurtleLod,
  replacement: Partial<TurtleModelContract['lods'][number]>,
): TurtleModelContract {
  return {
    ...contract,
    lods: contract.lods.map((lod) => (lod.level === level ? { ...lod, ...replacement } : lod)),
  }
}

describe('authored turtle model contract', () => {
  it('accepts the shipped monumental hero and all three measured LODs', () => {
    expect(validateTurtleModelContract(MONUMENTAL_TURTLE_CONTRACT)).toEqual([])
    expect(MONUMENTAL_TURTLE_CONTRACT.lods.map((lod) => lod.level)).toEqual([0, 1, 2])
  })

  it('publishes the exact required rig nodes and animation clips', () => {
    expect(TURTLE_REQUIRED_NODES).toEqual([
      'WorldRoot',
      'Body',
      'Neck',
      'Head',
      'Jaw',
      'Nostril_L',
      'Nostril_R',
      'Eyelid_L',
      'Eyelid_R',
      'Eye_L',
      'Eye_R',
      'EyeFocus',
      'Flipper_FL',
      'Flipper_FR',
      'Flipper_BL',
      'Flipper_BR',
      'ShellSkirt',
      'Wake_FL',
      'Wake_FR',
      'Wake_BL',
      'Wake_BR',
    ])
    expect(TURTLE_REQUIRED_CLIPS).toEqual([
      'Idle_Breathe',
      'Swim_Stroke',
      'Neck_Drift',
      'Blink',
      'Head_Turn',
      'Eye_Contact',
      'Jaw_Micro',
      'Nostril_Micro',
    ])
  })

  it('accepts a complete valid contract', () => {
    expect(validateTurtleModelContract(validContract())).toEqual([])
  })

  it('reports stable coverage codes for missing nodes, clips, and wake emitters', () => {
    const missingNode = validContract()
    missingNode.nodes = missingNode.nodes.filter((name) => name !== 'Head')
    expect(codes(missingNode)).toContain('missing-node')

    const missingClip = validContract()
    missingClip.clips = missingClip.clips.filter((name) => name !== 'Blink')
    expect(codes(missingClip)).toContain('missing-clip')

    const missingEmitter = validContract()
    missingEmitter.nodes = missingEmitter.nodes.filter((name) => name !== 'Wake_FL')
    expect(codes(missingEmitter)).toContain('missing-wake-emitter')
    expect(codes(missingEmitter)).not.toContain('missing-node')
  })

  it('requires metre scale, a negative-Z bow, and exact shell anchors', () => {
    expect(codes({ ...validContract(), metreScale: 0.01 as 1 })).toContain('invalid-metre-scale')
    expect(codes({ ...validContract(), bowAxis: '+z' as '-z' })).toContain('invalid-bow-axis')

    const anchor = validContract()
    anchor.shellAnchor = { semiX: 169, semiZ: 251, rimY: 8.5 }
    expect(codes(anchor).filter((code) => code === 'invalid-shell-anchor')).toHaveLength(3)
  })

  it('requires each exact LOD level once', () => {
    const missing = validContract()
    missing.lods = missing.lods.filter((lod) => lod.level !== 1)
    expect(codes(missing)).toContain('missing-lod-level')

    const duplicate = validContract()
    duplicate.lods = [...duplicate.lods, structuredClone(duplicate.lods[1])]
    expect(codes(duplicate)).toContain('duplicate-lod-level')

    const invalid = validContract()
    invalid.lods = [...invalid.lods, { ...structuredClone(invalid.lods[2]), level: 3 as TurtleLod }]
    expect(codes(invalid)).toContain('invalid-lod-level')
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY, Number.NaN])(
    'rejects unsafe or non-positive triangle count %s',
    (triangleCount) => {
      const invalid = replaceLod(validContract(), 1, { triangleCount })
      expect(codes(invalid)).toContain('invalid-triangle-count')
    },
  )

  it('requires triangle counts to decrease strictly from LOD0 through LOD2', () => {
    expect(codes(replaceLod(validContract(), 1, { triangleCount: 220_000 }))).toContain(
      'lod-triangle-order',
    )
    expect(codes(replaceLod(validContract(), 2, { triangleCount: 82_001 }))).toContain(
      'lod-triangle-order',
    )
  })

  it.each([
    { bounds: [Number.NaN, -30, -250, 170, 30, 250] },
    { bounds: [-170, -30, -250, Number.POSITIVE_INFINITY, 30, 250] },
    { bounds: [170, -30, -250, -170, 30, 250] },
    { bounds: [-170, 30, -250, 170, 30, 250] },
    { bounds: [-170, -30, 250, 170, 30, -250] },
    { bounds: [-170, -30, -250, 170, 30] },
  ])('rejects non-finite, unordered, or malformed bounds %j', (bounds) => {
    const invalid = replaceLod(validContract(), 1, {
      bounds: bounds.bounds as unknown as TurtleModelContract['lods'][number]['bounds'],
    })
    expect(codes(invalid)).toContain('invalid-lod-bounds')
  })

  it('measures per-axis extent drift against the LOD0 extent with an inclusive 1.5% limit', () => {
    const baseBounds = [-100, -50, -200, 100, 50, 200] as const
    const base = replaceLod(replaceLod(validContract(), 0, { bounds: baseBounds }), 2, {
      bounds: baseBounds,
    })
    const atLimit = replaceLod(base, 1, { bounds: [-101.5, -50.75, -203, 101.5, 50.75, 203] })
    expect(codes(atLimit)).not.toContain('lod-bounds-extent-drift')

    const outside = replaceLod(base, 1, {
      bounds: [-101.501, -50.751, -203.001, 101.501, 50.751, 203.001],
    })
    expect(codes(outside).filter((code) => code === 'lod-bounds-extent-drift')).toHaveLength(3)
  })

  it('measures center drift against each nonzero LOD0 extent with an inclusive 1.5% limit', () => {
    const baseBounds = [-100, -50, -200, 100, 50, 200] as const
    const base = replaceLod(replaceLod(validContract(), 0, { bounds: baseBounds }), 2, {
      bounds: baseBounds,
    })
    const atLimit = replaceLod(base, 1, { bounds: [-97, -48.5, -194, 103, 51.5, 206] })
    expect(codes(atLimit)).not.toContain('lod-bounds-center-drift')

    const outside = replaceLod(base, 1, {
      bounds: [-96.999, -48.499, -193.999, 103.001, 51.501, 206.001],
    })
    expect(codes(outside).filter((code) => code === 'lod-bounds-center-drift')).toHaveLength(3)
  })

  it('rejects animated or traversal-overlapping body collision', () => {
    expect(
      codes({
        ...validContract(),
        collision: { animated: true as false, overlapsTraversal: false },
      }),
    ).toContain('animated-collision')
    expect(
      codes({
        ...validContract(),
        collision: { animated: false, overlapsTraversal: true as false },
      }),
    ).toContain('collision-overlaps-traversal')
  })

  it('orders issues deterministically regardless of metadata array order', () => {
    const first = validContract()
    first.nodes = [...first.nodes.filter((name) => name !== 'Head'), 'Body']
    first.clips = [...first.clips.filter((name) => name !== 'Jaw_Micro'), 'Blink']
    first.lods = [...first.lods, structuredClone(first.lods[1])]

    const second: TurtleModelContract = {
      ...first,
      nodes: [...first.nodes].reverse(),
      clips: [...first.clips].reverse(),
      lods: [...first.lods].reverse(),
    }
    expect(codes(first)).toEqual([
      'duplicate-node',
      'missing-node',
      'duplicate-clip',
      'missing-clip',
      'duplicate-lod-level',
    ])
    expect(validateTurtleModelContract(second)).toEqual(validateTurtleModelContract(first))
  })

  it('returns issues rather than throwing for typed but runtime-invalid input', () => {
    expect(() => validateTurtleModelContract(null as unknown as TurtleModelContract)).not.toThrow()
    expect(
      validateTurtleModelContract(null as unknown as TurtleModelContract).map(
        (issue: TurtleModelContractIssue) => issue.code,
      ),
    ).toEqual(['invalid-contract'])

    const malformed = {
      ...validContract(),
      nodes: null,
      clips: 'Blink',
      lods: [{ level: 'near', triangleCount: 'many', bounds: null }],
      shellAnchor: null,
      collision: null,
    } as unknown as TurtleModelContract
    expect(() => validateTurtleModelContract(malformed)).not.toThrow()
    expect(codes(malformed)).toEqual([
      'invalid-node-list',
      'invalid-clip-list',
      'invalid-lod-level',
      'missing-lod-level',
      'missing-lod-level',
      'missing-lod-level',
      'invalid-shell-anchor',
      'invalid-collision',
    ])

    const malformedValues = {
      ...validContract(),
      nodes: [...TURTLE_REQUIRED_NODES, null],
      clips: [...TURTLE_REQUIRED_CLIPS, ''],
      lods: validContract().lods.map((lod) =>
        lod.level === 1 ? { ...lod, triangleCount: 'many', bounds: null } : lod,
      ),
    } as unknown as TurtleModelContract
    expect(() => validateTurtleModelContract(malformedValues)).not.toThrow()
    expect(codes(malformedValues)).toEqual([
      'invalid-node-name',
      'invalid-clip-name',
      'invalid-triangle-count',
      'invalid-lod-bounds',
    ])
  })
})
