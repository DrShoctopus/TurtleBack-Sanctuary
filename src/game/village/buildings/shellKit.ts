/** Exterior architecture: walls with openings, roofs, porches, window glazing. */
import type { MatKey } from '../kit/materials'
import { BuildPlan, wallWithOpenings, type Opening } from '../kit/geometry'

export interface WindowSpec {
  /** wall index: 0 front (+z), 1 back (-z), 2 east (+x), 3 west (-x) */
  wall: 0 | 1 | 2 | 3
  /** offset along the wall from its center */
  x: number
  w?: number
  h?: number
  sill?: number
}

export interface ShellSpec {
  w: number
  d: number
  h: number
  wallMat: MatKey
  trimMat?: MatKey
  floorMat?: MatKey
  roof?: 'flat' | 'shed' | 'butterfly'
  door?: { wall: 0 | 1 | 2 | 3; x: number; w?: number }
  windows?: WindowSpec[]
  porch?: boolean
  /** raise interior floor slab this much above terrain pad */
  plinth?: number
}

export interface DoorSpec {
  pos: [number, number, number]
  rotY: number
  width: number
  height: number
}

const T = 0.24 // wall thickness

interface WallFrame {
  cx: number
  cz: number
  rotY: number
  length: number
}

function wallFrame(spec: ShellSpec, wall: 0 | 1 | 2 | 3): WallFrame {
  const { w, d } = spec
  switch (wall) {
    case 0:
      return { cx: 0, cz: d / 2, rotY: 0, length: w }
    case 1:
      return { cx: 0, cz: -d / 2, rotY: Math.PI, length: w }
    case 2:
      return { cx: w / 2, cz: 0, rotY: -Math.PI / 2, length: d }
    case 3:
      return { cx: -w / 2, cz: 0, rotY: Math.PI / 2, length: d }
  }
}

/**
 * Builds the building envelope into `plan` (structure) and `glow` (night
 * window emissive quads). Returns the door metadata for the sliding panels.
 */
export function buildShell(plan: BuildPlan, glow: BuildPlan, spec: ShellSpec): DoorSpec | null {
  const { w, d, h } = spec
  const trim = spec.trimMat ?? 'woodDark'
  const floor = spec.floorMat ?? 'woodDeck'
  const plinthH = spec.plinth ?? 0.14

  // floor slab + plinth
  plan.solid('concrete', {
    pos: [0, plinthH / 2 - 0.3, 0],
    size: [w + 0.7, plinthH + 0.6, d + 0.7],
  })
  plan.box(floor, { pos: [0, plinthH + 0.015, 0], size: [w - 0.1, 0.05, d - 0.1] })

  // group openings per wall
  const perWall: Record<number, Opening[]> = { 0: [], 1: [], 2: [], 3: [] }
  const winFrames: Array<{ wall: 0 | 1 | 2 | 3; x: number; w: number; h: number; sill: number }> =
    []
  for (const win of spec.windows ?? []) {
    const ww = win.w ?? 1.6
    const wh = win.h ?? 1.5
    const sill = win.sill ?? 0.85
    perWall[win.wall].push({ x: win.x, w: ww, h: wh, sill })
    winFrames.push({ wall: win.wall, x: win.x, w: ww, h: wh, sill })
  }
  let door: DoorSpec | null = null
  if (spec.door) {
    const dw = spec.door.w ?? 1.5
    perWall[spec.door.wall].push({ x: spec.door.x, w: dw + 0.12, h: 2.25, sill: 0 })
  }

  // walls
  for (const wall of [0, 1, 2, 3] as const) {
    const f = wallFrame(spec, wall)
    wallWithOpenings(plan, spec.wallMat, {
      length: f.length,
      height: h,
      thickness: T,
      pos: [f.cx, plinthH, f.cz],
      rotY: f.rotY,
      openings: perWall[wall],
    })
  }

  // window frames + glass + glow quads
  for (const wf of winFrames) {
    const f = wallFrame(spec, wf.wall)
    const cos = Math.cos(f.rotY)
    const sin = Math.sin(f.rotY)
    const px = f.cx + wf.x * cos
    const pz = f.cz - wf.x * sin
    const cy = plinthH + wf.sill + wf.h / 2
    // frame
    plan.box(trim, {
      pos: [px, plinthH + wf.sill + wf.h + 0.05, pz],
      size: [wf.w + 0.16, 0.1, T + 0.06],
      rot: [0, f.rotY, 0],
    })
    plan.box(trim, {
      pos: [px, plinthH + wf.sill - 0.05, pz],
      size: [wf.w + 0.16, 0.1, T + 0.06],
      rot: [0, f.rotY, 0],
    })
    for (const side of [-1, 1]) {
      const ox = (side * (wf.w / 2 + 0.04)) as number
      plan.box(trim, {
        pos: [px + ox * cos, cy, pz - ox * sin],
        size: [0.09, wf.h + 0.2, T + 0.06],
        rot: [0, f.rotY, 0],
      })
    }
    // mullion
    plan.box(trim, { pos: [px, cy, pz], size: [0.05, wf.h, 0.04], rot: [0, f.rotY, 0] })
    // glass (no collider — the wall sill/header boxes block the player)
    plan.box('glass', { pos: [px, cy, pz], size: [wf.w, wf.h, 0.03], rot: [0, f.rotY, 0] })
    plan.collider({ pos: [px, cy, pz], size: [wf.w, wf.h, 0.06], rotY: f.rotY })
    // glow quad slightly inside
    const inset = 0.16
    glow.box('plasterWarm', {
      pos: [px - sin * inset, cy, pz - cos * inset],
      size: [wf.w - 0.06, wf.h - 0.06, 0.02],
      rot: [0, f.rotY, 0],
    })
  }

  // door frame + threshold
  if (spec.door) {
    const dw = spec.door.w ?? 1.5
    const f = wallFrame(spec, spec.door.wall)
    const cos = Math.cos(f.rotY)
    const sin = Math.sin(f.rotY)
    const px = f.cx + spec.door.x * cos
    const pz = f.cz - spec.door.x * sin
    plan.box(trim, {
      pos: [px, plinthH + 2.3, pz],
      size: [dw + 0.24, 0.12, T + 0.1],
      rot: [0, f.rotY, 0],
    })
    for (const side of [-1, 1]) {
      const ox = side * (dw / 2 + 0.07)
      plan.box(trim, {
        pos: [px + ox * cos, plinthH + 1.15, pz - ox * sin],
        size: [0.12, 2.3, T + 0.1],
        rot: [0, f.rotY, 0],
      })
    }
    // outside step
    const stepOut = 0.55
    plan.solid('concrete', {
      pos: [px - sin * stepOut * -1 + 0, plinthH / 2 - 0.02, pz + cos * stepOut],
      size: [dw + 0.5, plinthH + 0.04, 1.0],
      rot: [0, f.rotY, 0],
    })
    door = {
      pos: [px, plinthH, pz],
      rotY: f.rotY,
      width: dw,
      height: 2.25,
    }
  }

  // ceiling
  plan.box('plasterCool', { pos: [0, h + plinthH + 0.02, 0], size: [w + 0.1, 0.1, d + 0.1] })

  // roof
  const roof = spec.roof ?? 'flat'
  if (roof === 'flat') {
    plan.box(trim, { pos: [0, h + plinthH + 0.2, 0], size: [w + 0.65, 0.28, d + 0.65] })
    // parapet fascia
    plan.box(spec.wallMat, {
      pos: [0, h + plinthH + 0.42, d / 2 + 0.28],
      size: [w + 0.65, 0.3, 0.1],
    })
    plan.box(spec.wallMat, {
      pos: [0, h + plinthH + 0.42, -d / 2 - 0.28],
      size: [w + 0.65, 0.3, 0.1],
    })
    plan.box(spec.wallMat, {
      pos: [w / 2 + 0.28, h + plinthH + 0.42, 0],
      size: [0.1, 0.3, d + 0.65],
    })
    plan.box(spec.wallMat, {
      pos: [-w / 2 - 0.28, h + plinthH + 0.42, 0],
      size: [0.1, 0.3, d + 0.65],
    })
  } else if (roof === 'shed') {
    plan.box(trim, {
      pos: [0, h + plinthH + 0.45, 0],
      size: [w + 0.9, 0.22, d + 1.1],
      rot: [0.1, 0, 0],
    })
  } else {
    // butterfly: two slabs dipping toward the middle
    plan.box(trim, {
      pos: [0, h + plinthH + 0.5, -d / 4],
      size: [w + 0.9, 0.2, d / 2 + 0.6],
      rot: [-0.09, 0, 0],
    })
    plan.box(trim, {
      pos: [0, h + plinthH + 0.5, d / 4],
      size: [w + 0.9, 0.2, d / 2 + 0.6],
      rot: [0.09, 0, 0],
    })
  }

  // porch deck
  if (spec.porch && spec.door) {
    const f = wallFrame(spec, spec.door.wall)
    const cos = Math.cos(f.rotY)
    const sin = Math.sin(f.rotY)
    const px = f.cx + spec.door.x * cos + Math.sin(f.rotY) * 0
    const pz = f.cz - spec.door.x * sin
    const off = 1.6
    plan.solid('woodDeck', {
      pos: [px - sin * off, plinthH - 0.04, pz + cos * off],
      size: [3.6, 0.12, 2.6],
      rot: [0, f.rotY, 0],
    })
    for (const side of [-1.55, 1.55]) {
      plan.box('woodDark', {
        pos: [
          px + side * cos - sin * (off + 1.1),
          plinthH + 1.2,
          pz - side * sin + cos * (off + 1.1),
        ],
        size: [0.12, 2.5, 0.12],
        rot: [0, f.rotY, 0],
      })
    }
    plan.box('woodDark', {
      pos: [px - sin * (off + 1.1), plinthH + 2.42, pz + cos * (off + 1.1)],
      size: [3.8, 0.1, 1.2],
      rot: [0, f.rotY, 0],
    })
  }

  return door
}
