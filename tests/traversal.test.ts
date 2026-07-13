import { describe, expect, it } from 'vitest'
import { PATHS, TRAVERSAL_SPANS } from '../src/game/config/layout'
import { BuildPlan } from '../src/game/village/kit/geometry'
import { buildTraversalArchitecture } from '../src/game/village/traversal'
import { isInsideShell, terrainHeight } from '../src/game/world/shell/shellShape'

describe('authored traversal architecture', () => {
  it('keeps every span on the shell and comfort ramps below 18 degrees', () => {
    for (const span of TRAVERSAL_SPANS) {
      expect(isInsideShell(span.ax, span.az, 1.03), span.id).toBe(true)
      expect(isInsideShell(span.bx, span.bz, 1.03), span.id).toBe(true)
      if (span.kind !== 'ramp') continue
      const run = Math.hypot(span.bx - span.ax, span.bz - span.az)
      const rise = Math.abs(terrainHeight(span.bx, span.bz) - terrainHeight(span.ax, span.az))
      expect((Math.atan2(rise, run) * 180) / Math.PI, span.id).toBeLessThan(18)
    }
  })

  it('keeps generated stair risers within the player autostep budget', () => {
    for (const span of TRAVERSAL_SPANS.filter((candidate) => candidate.kind === 'stairs')) {
      const rise = Math.abs(terrainHeight(span.bx, span.bz) - terrainHeight(span.ax, span.az))
      const steps = Math.max(4, Math.ceil(rise / 0.2))
      expect(rise / steps, span.id).toBeLessThanOrEqual(0.2)
      expect(Math.hypot(span.bx - span.ax, span.bz - span.az) / steps, span.id).toBeGreaterThan(
        0.35,
      )
    }
  })

  it('aligns primary bridge and ramp endpoints with the route network', () => {
    const routeNodes = PATHS.flat()
    for (const id of ['garden-pond-bridge', 'observatory-ramp']) {
      const span = TRAVERSAL_SPANS.find((candidate) => candidate.id === id)!
      for (const [x, z] of [
        [span.ax, span.az],
        [span.bx, span.bz],
      ]) {
        expect(
          routeNodes.some((node) => node.x === x && node.z === z),
          `${id}:${x},${z}`,
        ).toBe(true)
      }
    }
  })

  it('builds matching inclined colliders and footstep regions', () => {
    const plan = new BuildPlan()
    const surfaces = buildTraversalArchitecture(plan, terrainHeight)
    const pitched = plan.colliders.filter((collider) => Math.abs(collider.rot?.[0] ?? 0) > 0.001)

    expect(surfaces).toHaveLength(TRAVERSAL_SPANS.length)
    expect(pitched.length).toBeGreaterThan(3)
    expect(plan.colliders.length).toBeGreaterThan(TRAVERSAL_SPANS.length)
  })
})
