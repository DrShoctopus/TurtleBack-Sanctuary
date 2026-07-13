/** Collision-backed bridges, stairs, ramps, and drainage details for village routes. */
import { TRAVERSAL_SPANS, type TraversalSpan } from '../config/layout'
import type { FootSurface } from '../world/shell/shellShape'
import type { BuildPlan } from './kit/geometry'

export interface TraversalSurface {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  surface: FootSurface
}

interface SpanFrame {
  dx: number
  dz: number
  run: number
  yaw: number
  rightX: number
  rightZ: number
}

function spanFrame(span: TraversalSpan): SpanFrame {
  const dx = span.bx - span.ax
  const dz = span.bz - span.az
  const run = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, dz)
  return { dx, dz, run, yaw, rightX: Math.cos(yaw), rightZ: -Math.sin(yaw) }
}

function pointAt(span: TraversalSpan, frame: SpanFrame, t: number, side = 0): [number, number] {
  return [
    span.ax + frame.dx * t + frame.rightX * side,
    span.az + frame.dz * t + frame.rightZ * side,
  ]
}

export function surfaceForSpan(span: TraversalSpan): TraversalSurface {
  const margin = span.width / 2 + 0.45
  return {
    minX: Math.min(span.ax, span.bx) - margin,
    maxX: Math.max(span.ax, span.bx) + margin,
    minZ: Math.min(span.az, span.bz) - margin,
    maxZ: Math.max(span.az, span.bz) + margin,
    surface: span.material === 'woodDeck' ? 'wood' : 'stone',
  }
}

export function buildTraversalArchitecture(
  plan: BuildPlan,
  heightAt: (x: number, z: number) => number,
): TraversalSurface[] {
  for (const span of TRAVERSAL_SPANS) {
    if (span.kind === 'bridge') buildBridge(plan, span, heightAt)
    else if (span.kind === 'stairs') buildStairs(plan, span, heightAt)
    else buildRamp(plan, span, heightAt)
  }

  // Flush drainage details explain wet-path runoff without adding snag-prone
  // micro-colliders. Wider physical terrain swales can follow in a terrain pass.
  buildRunnel(plan, 0, -58, 0, 7.2, heightAt(0, -58))
  buildRunnel(plan, 48, -31, -0.35, 5.4, heightAt(48, -31))
  buildRunnel(plan, -31, 105, 0.42, 5.8, heightAt(-31, 105))

  return TRAVERSAL_SPANS.map(surfaceForSpan)
}

function buildRamp(
  plan: BuildPlan,
  span: TraversalSpan,
  heightAt: (x: number, z: number) => number,
): void {
  const f = spanFrame(span)
  const yA = heightAt(span.ax, span.az) + 0.14
  const yB = heightAt(span.bx, span.bz) + 0.14
  const rise = yB - yA
  const pitch = -Math.atan2(rise, f.run)
  const slopedLength = Math.hypot(f.run, rise)
  const center: [number, number, number] = [
    (span.ax + span.bx) / 2,
    (yA + yB) / 2,
    (span.az + span.bz) / 2,
  ]

  plan.solid(span.material, {
    pos: center,
    size: [span.width, 0.18, slopedLength],
    rot: [pitch, f.yaw, 0],
  })
  const gripStrips = Math.max(3, Math.floor(f.run / 1.35))
  for (let i = 1; i < gripStrips; i++) {
    const t = i / gripStrips
    const [x, z] = pointAt(span, f, t)
    plan.box('metalDark', {
      pos: [x, yA + rise * t + 0.105, z],
      size: [span.width + 0.04, 0.028, 0.055],
      rot: [pitch, f.yaw, 0],
    })
  }

  if (span.rails) addRampRails(plan, span, f, yA, yB, pitch, slopedLength)
  addSupports(plan, span, f, heightAt, (t) => yA + rise * t)
  addAbutment(plan, span.ax, yA, span.az, span.width, f.yaw)
  addAbutment(plan, span.bx, yB, span.bz, span.width, f.yaw)
}

function addRampRails(
  plan: BuildPlan,
  span: TraversalSpan,
  f: SpanFrame,
  yA: number,
  yB: number,
  pitch: number,
  slopedLength: number,
): void {
  for (const side of [-1, 1]) {
    const [x, z] = pointAt(span, f, 0.5, side * (span.width / 2 - 0.04))
    plan.box('woodDark', {
      pos: [x, (yA + yB) / 2 + 0.88, z],
      size: [0.09, 0.09, slopedLength],
      rot: [pitch, f.yaw, 0],
    })
    plan.box('metalBrushed', {
      pos: [x, (yA + yB) / 2 + 0.49, z],
      size: [0.045, 0.045, slopedLength],
      rot: [pitch, f.yaw, 0],
    })
    plan.collider({
      pos: [x, (yA + yB) / 2 + 0.5, z],
      size: [0.14, 1.1, slopedLength],
      rot: [pitch, f.yaw, 0],
    })
    const posts = Math.max(3, Math.ceil(f.run / 2.1))
    for (let i = 0; i <= posts; i++) {
      const t = i / posts
      const [px, pz] = pointAt(span, f, t, side * (span.width / 2 - 0.04))
      const py = yA + (yB - yA) * t
      plan.box('woodDark', { pos: [px, py + 0.48, pz], size: [0.09, 0.96, 0.09] })
    }
  }
}

function buildBridge(
  plan: BuildPlan,
  span: TraversalSpan,
  heightAt: (x: number, z: number) => number,
): void {
  const f = spanFrame(span)
  const segments = Math.max(10, Math.ceil(f.run / 0.9))
  const yA = heightAt(span.ax, span.az) + 0.18
  const yB = heightAt(span.bx, span.bz) + 0.18
  const arch = span.arch ?? 0.4
  const deckY = (t: number) => yA + (yB - yA) * t + Math.sin(Math.PI * t) * arch

  for (let i = 0; i < segments; i++) {
    const t0 = i / segments
    const t1 = (i + 1) / segments
    const tm = (t0 + t1) / 2
    const [x, z] = pointAt(span, f, tm)
    const length = f.run / segments + 0.055
    plan.solid(span.material, {
      pos: [x, deckY(tm), z],
      size: [span.width, 0.18, length],
      rot: [0, f.yaw, 0],
    })
    plan.box(i % 2 === 0 ? 'woodPale' : 'woodWarm', {
      pos: [x, deckY(tm) + 0.105, z],
      size: [span.width - 0.08, 0.035, length - 0.035],
      rot: [0, f.yaw, 0],
    })
  }

  if (span.rails) addSegmentedRails(plan, span, f, segments, deckY)
  addSupports(plan, span, f, heightAt, deckY)
  addAbutment(plan, span.ax, yA, span.az, span.width, f.yaw)
  addAbutment(plan, span.bx, yB, span.bz, span.width, f.yaw)
}

function buildStairs(
  plan: BuildPlan,
  span: TraversalSpan,
  heightAt: (x: number, z: number) => number,
): void {
  const f = spanFrame(span)
  const yA = heightAt(span.ax, span.az) + 0.14
  const yB = heightAt(span.bx, span.bz) + 0.14
  const rise = yB - yA
  const steps = Math.max(4, Math.ceil(Math.abs(rise) / 0.2))
  const tread = f.run / steps
  const topY = (i: number) => (rise >= 0 ? yA + ((i + 1) / steps) * rise : yA + (i / steps) * rise)

  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps
    const [x, z] = pointAt(span, f, t)
    plan.solid(span.material, {
      pos: [x, topY(i) - 0.14, z],
      size: [span.width, 0.28, tread + 0.06],
      rot: [0, f.yaw, 0],
    })
    const treadMat =
      span.material === 'woodDeck' ? (i % 2 === 0 ? 'woodPale' : 'woodWarm') : 'stoneCounter'
    plan.box(treadMat, {
      pos: [x, topY(i) + 0.018, z],
      size: [span.width - 0.08, 0.045, tread],
      rot: [0, f.yaw, 0],
    })
  }

  if (span.rails) {
    const steppedY = (t: number) => topY(Math.min(steps - 1, Math.floor(t * steps)))
    addSegmentedRails(plan, span, f, steps, steppedY)
  }
  addAbutment(plan, span.ax, yA, span.az, span.width, f.yaw)
  addAbutment(plan, span.bx, yB, span.bz, span.width, f.yaw)
}

function addSegmentedRails(
  plan: BuildPlan,
  span: TraversalSpan,
  f: SpanFrame,
  segments: number,
  deckY: (t: number) => number,
): void {
  for (const side of [-1, 1]) {
    const sideOffset = side * (span.width / 2 - 0.04)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const [px, pz] = pointAt(span, f, t, sideOffset)
      plan.box('woodDark', { pos: [px, deckY(t) + 0.52, pz], size: [0.09, 1.04, 0.09] })
    }
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments
      const t1 = (i + 1) / segments
      const tm = (t0 + t1) / 2
      const y0 = deckY(t0)
      const y1 = deckY(t1)
      const [x, z] = pointAt(span, f, tm, sideOffset)
      const length = f.run / segments
      const pitch = -Math.atan2(y1 - y0, length)
      const slopedLength = Math.hypot(length, y1 - y0)
      for (const railH of [0.45, 0.92]) {
        plan.box(railH > 0.8 ? 'woodDark' : 'metalBrushed', {
          pos: [x, (y0 + y1) / 2 + railH, z],
          size: [0.075, 0.075, slopedLength + 0.04],
          rot: [pitch, f.yaw, 0],
        })
      }
      plan.collider({
        pos: [x, (y0 + y1) / 2 + 0.5, z],
        size: [0.14, 1.08, slopedLength + 0.04],
        rot: [pitch, f.yaw, 0],
      })
    }
  }
}

function addSupports(
  plan: BuildPlan,
  span: TraversalSpan,
  f: SpanFrame,
  heightAt: (x: number, z: number) => number,
  deckY: (t: number) => number,
): void {
  const count = Math.max(2, Math.floor(f.run / 4))
  for (let i = 1; i < count; i++) {
    const t = i / count
    for (const side of [-1, 1]) {
      const [x, z] = pointAt(span, f, t, side * span.width * 0.35)
      const ground = heightAt(x, z)
      const top = deckY(t) - 0.08
      const height = top - ground
      if (height < 0.28) continue
      plan.box('woodDark', {
        pos: [x, ground + height / 2, z],
        size: [0.14, height, 0.14],
      })
      plan.box('concrete', { pos: [x, ground + 0.08, z], size: [0.42, 0.16, 0.42] })
    }
  }
}

function addAbutment(
  plan: BuildPlan,
  x: number,
  y: number,
  z: number,
  width: number,
  yaw: number,
): void {
  plan.box('stoneCounter', {
    pos: [x, y - 0.08, z],
    size: [width + 0.5, 0.2, 0.7],
    rot: [0, yaw, 0],
  })
  plan.box('metalDark', {
    pos: [x, y + 0.04, z],
    size: [width + 0.16, 0.035, 0.16],
    rot: [0, yaw, 0],
  })
}

function buildRunnel(
  plan: BuildPlan,
  x: number,
  z: number,
  yaw: number,
  length: number,
  y: number,
): void {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const at = (along: number, across: number): [number, number] => [
    x + along * cos + across * sin,
    z - along * sin + across * cos,
  ]
  for (const across of [-0.2, 0.2]) {
    const [px, pz] = at(0, across)
    plan.box('stoneCounter', {
      pos: [px, y + 0.045, pz],
      size: [length, 0.075, 0.11],
      rot: [0, yaw, 0],
    })
  }
  plan.box('water', { pos: [x, y + 0.025, z], size: [length - 0.12, 0.025, 0.3], rot: [0, yaw, 0] })
  const grates = Math.floor(length / 0.42)
  for (let i = 0; i <= grates; i++) {
    const [gx, gz] = at(-length / 2 + (i / grates) * length, 0)
    plan.box('metalDark', {
      pos: [gx, y + 0.085, gz],
      size: [0.035, 0.035, 0.52],
      rot: [0, yaw, 0],
    })
  }
}
