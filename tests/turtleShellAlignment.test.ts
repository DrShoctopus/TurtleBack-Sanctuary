import { describe, expect, it } from 'vitest'
import { Group, Mesh } from 'three'
import { HOME_SPAWN, WORLD } from '../src/game/config/constants'
import { EXTRA_PADS, PLAZA, TRAVERSAL_SPANS } from '../src/game/config/layout'
import {
  SHELL_SEMI_X,
  SHELL_SEMI_Z,
  shellRadius,
  terrainHeight,
} from '../src/game/world/shell/shellShape'
import { TURTLE_SHELL_ANCHOR } from '../src/game/world/turtle/modelContract'
import {
  TERRAIN_GOLDEN_SAMPLES,
  authoredTraversalCollisionViolations,
  collisionTriangleOverlapsTraversal,
  sampleShellTransitionAnchors,
} from '../src/game/world/turtle/shellAlignment'

function pointKey(x: number, z: number): string {
  return `${x},${z}`
}

describe('turtle and analytic shell alignment', () => {
  it('keeps the authored rim contract aligned with at least 64 analytic anchors', () => {
    expect(Math.abs(TURTLE_SHELL_ANCHOR.semiX - SHELL_SEMI_X)).toBeLessThanOrEqual(0.75)
    expect(Math.abs(TURTLE_SHELL_ANCHOR.semiZ - SHELL_SEMI_Z)).toBeLessThanOrEqual(0.75)
    expect(Math.abs(TURTLE_SHELL_ANCHOR.rimY - WORLD.rimHeight)).toBeLessThanOrEqual(0.75)

    const anchors = sampleShellTransitionAnchors(96)
    expect(anchors).toHaveLength(96)
    for (const anchor of anchors) {
      expect(shellRadius(anchor.x, anchor.z)).toBeCloseTo(1, 10)
      expect(anchor.y).toBe(terrainHeight(anchor.x, anchor.z))
      expect(anchor.normal).toHaveLength(3)
    }
  })

  it('rejects body collision on walkable terrain while allowing high collision outside it', () => {
    expect(
      collisionTriangleOverlapsTraversal([
        [-1, terrainHeight(-1, 0) + 0.1, 0],
        [1, terrainHeight(1, 0) + 0.1, 0],
        [0, terrainHeight(0, 1) + 0.1, 1],
      ]),
    ).toBe(true)
    expect(
      collisionTriangleOverlapsTraversal([
        [-1, WORLD.rimHeight - 2, 0],
        [1, WORLD.rimHeight - 2, 0],
        [0, WORLD.rimHeight - 2, 1],
      ]),
    ).toBe(false)
    expect(
      collisionTriangleOverlapsTraversal([
        [0, 40, -280],
        [8, 42, -282],
        [-8, 42, -282],
      ]),
    ).toBe(false)
  })

  it('keeps the golden building, deck, plaza, and traversal heights unchanged', () => {
    const expectedCoordinates = new Set([
      pointKey(HOME_SPAWN.x, HOME_SPAWN.z),
      pointKey(PLAZA.x, PLAZA.z),
      ...EXTRA_PADS.slice(1, 5).map(({ x, z }) => pointKey(x, z)),
      ...TRAVERSAL_SPANS.flatMap(({ ax, az, bx, bz }) => [pointKey(ax, az), pointKey(bx, bz)]),
    ])
    const goldenCoordinates = new Set(TERRAIN_GOLDEN_SAMPLES.map(({ x, z }) => pointKey(x, z)))

    expect(goldenCoordinates).toEqual(expectedCoordinates)
    for (const sample of TERRAIN_GOLDEN_SAMPLES) {
      expect(terrainHeight(sample.x, sample.z), sample.id).toBe(sample.y)
    }
  })

  it('flags authored meshes that attempt to become traversal collision', () => {
    const scene = new Group()
    const analytic = new Mesh()
    analytic.userData.traversalCollision = true
    analytic.userData.traversalSource = 'analytic-shell'
    const visualOnly = new Mesh()
    visualOnly.userData.traversalCollision = false
    scene.add(analytic, visualOnly)
    expect(authoredTraversalCollisionViolations(scene)).toEqual([])

    const authored = new Mesh()
    authored.name = 'AuthoredTurtleCollision'
    authored.userData.traversalCollision = true
    authored.userData.traversalSource = 'authored-turtle'
    scene.add(authored)
    expect(authoredTraversalCollisionViolations(scene)).toEqual(['AuthoredTurtleCollision'])
  })
})
