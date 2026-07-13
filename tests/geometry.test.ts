import { describe, expect, it } from 'vitest'
import { BuildPlan } from '../src/game/village/kit/geometry'

describe('BuildPlan colliders', () => {
  it('preserves the complete visual rotation for inclined solid parts', () => {
    const plan = new BuildPlan()
    const rotation: [number, number, number] = [-0.18, 0.72, 0.04]

    plan.solid('woodDeck', {
      pos: [4, 2, -3],
      size: [2.4, 0.18, 8],
      rot: rotation,
    })

    expect(plan.colliders).toEqual([
      {
        pos: [4, 2, -3],
        size: [2.4, 0.18, 8],
        rot: rotation,
      },
    ])
  })
})
