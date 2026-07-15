/** Exterior architecture: walls with openings, roofs, porches, window glazing. */
import type { MatKey } from '../kit/materials'
import { BuildPlan, cylGeo, sphereGeo, wallWithOpenings, type Opening } from '../kit/geometry'

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
  roof?: 'flat' | 'shed' | 'butterfly' | 'glassGable'
  door?: { wall: 0 | 1 | 2 | 3; x: number; w?: number }
  windows?: WindowSpec[]
  porch?: boolean
  /** raise interior floor slab this much above terrain pad */
  plinth?: number
  /** Exterior silhouette and entrance treatment for this destination. */
  identity?:
    | 'home'
    | 'cafe'
    | 'bookshop'
    | 'records'
    | 'plants'
    | 'gallery'
    | 'bathhouse'
    | 'observatory'
    | 'store'
    | 'cottage'
  /** Optional material used for signs, awnings, and other identity accents. */
  accentMat?: MatKey
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

  // Corner battens turn the wall planes into a deliberate timber-and-plaster
  // construction system. A restrained shady-side moss field grounds the shell
  // without applying noisy decals to every facade.
  for (const [x, z] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ] as const) {
    plan.box(trim, {
      pos: [x, plinthH + h / 2, z],
      size: [0.13, h + 0.12, 0.13],
    })
  }
  for (let index = 0; index < Math.max(3, Math.floor(w / 2.4)); index++) {
    const x = -w * 0.4 + (index / Math.max(1, Math.floor(w / 2.4) - 1)) * w * 0.8
    plan.add(sphereGeo(8), index % 2 === 0 ? 'weatheringMoss' : 'earthDark', {
      pos: [x, plinthH + 0.04, -d / 2 - 0.125],
      size: [0.72 + (index % 3) * 0.16, 0.1, 0.08],
      rot: [0, 0, (index - 1) * 0.04],
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
    // A projecting sill and shallow drip cap give the glazing a readable
    // recess in both flat daylight and strong night window glow.
    plan.box(trim, {
      pos: [px - sin * 0.16, plinthH + wf.sill - 0.1, pz + cos * 0.16],
      size: [wf.w + 0.3, 0.1, T + 0.36],
      rot: [0, f.rotY, 0],
    })
    plan.box(trim, {
      pos: [px - sin * 0.09, plinthH + wf.sill + wf.h + 0.09, pz + cos * 0.09],
      size: [wf.w + 0.24, 0.09, T + 0.22],
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
      pos: [px + sin * inset, cy, pz - cos * inset],
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
      pos: [px - sin * stepOut, plinthH / 2 - 0.02, pz + cos * stepOut],
      size: [dw + 0.5, plinthH + 0.04, 1.0],
      rot: [0, f.rotY, 0],
    })
    plan.box('stoneCounter', {
      pos: [px - sin * 0.76, plinthH + 0.025, pz + cos * 0.76],
      size: [dw + 0.24, 0.08, 0.38],
      rot: [0, f.rotY, 0],
    })
    door = {
      pos: [px, plinthH, pz],
      rotY: f.rotY,
      width: dw,
      height: 2.25,
    }
  }

  // roof
  const roof = spec.roof ?? 'flat'
  const ceilingTop = h + plinthH + 0.07
  const roofClearance = 0.18
  if (roof !== 'glassGable') {
    plan.box('plasterCeiling', { pos: [0, h + plinthH + 0.02, 0], size: [w + 0.1, 0.1, d + 0.1] })
  }
  if (roof === 'flat') {
    // Keep the roof underside clear of the ceiling slab. The old 0.20 offset
    // overlapped it by 1 cm, producing striping and self-shadowing.
    plan.box(trim, {
      pos: [0, ceilingTop + roofClearance + 0.14, 0],
      size: [w + 0.65, 0.28, d + 0.65],
    })
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
    const pitch = 0.1
    const thickness = 0.22
    // At the edge of the ceiling footprint, account for both the pitched
    // depth and slab thickness so the roof cannot cut through the ceiling.
    const halfVerticalSpan = Math.sin(pitch) * ((d + 0.1) / 2) + Math.cos(pitch) * (thickness / 2)
    plan.box(trim, {
      pos: [0, ceilingTop + roofClearance + halfVerticalSpan, 0],
      size: [w + 0.9, thickness, d + 1.1],
      rot: [pitch, 0, 0],
    })
  } else if (roof === 'butterfly') {
    // butterfly: two slabs dipping toward the middle
    plan.box(trim, {
      pos: [0, h + plinthH + 0.5, -d / 4],
      size: [w + 0.9, 0.2, d / 2 + 0.6],
      rot: [0.09, 0, 0],
    })
    plan.box(trim, {
      pos: [0, h + plinthH + 0.5, d / 4],
      size: [w + 0.9, 0.2, d / 2 + 0.6],
      rot: [-0.09, 0, 0],
    })
  } else {
    // A true transparent greenhouse roof: glass planes and repeated metal
    // rafters with no opaque ceiling hidden beneath them.
    const pitch = 0.24
    plan.box('glass', {
      pos: [-w / 4 - 0.1, h + plinthH + 0.75, 0],
      size: [w / 2 + 0.45, 0.06, d + 0.6],
      rot: [0, 0, pitch],
    })
    plan.box('glass', {
      pos: [w / 4 + 0.1, h + plinthH + 0.75, 0],
      size: [w / 2 + 0.45, 0.06, d + 0.6],
      rot: [0, 0, -pitch],
    })
    for (let z = -d / 2; z <= d / 2 + 0.01; z += 1.55) {
      plan.box('metalDark', {
        pos: [-w / 4 - 0.1, h + plinthH + 0.79, z],
        size: [w / 2 + 0.48, 0.08, 0.08],
        rot: [0, 0, pitch],
      })
      plan.box('metalDark', {
        pos: [w / 4 + 0.1, h + plinthH + 0.79, z],
        size: [w / 2 + 0.48, 0.08, 0.08],
        rot: [0, 0, -pitch],
      })
    }
    plan.box('metalDark', {
      pos: [0, h + plinthH + 1.3, 0],
      size: [0.14, 0.14, d + 0.65],
    })
  }

  if (roof !== 'glassGable') {
    // Repeated eave blocks create a crafted roof cadence from walking distance.
    const bracketCount = Math.max(4, Math.floor(w / 1.65))
    for (const side of [-1, 1]) {
      for (let index = 0; index <= bracketCount; index++) {
        const x = -w / 2 + (index / bracketCount) * w
        plan.box(trim, {
          pos: [x, h + plinthH + 0.12, side * (d / 2 + 0.25)],
          size: [0.12, 0.28, 0.42],
          rot: [side * 0.16, 0, 0],
        })
      }
    }
  }

  // A single rain chain and dark runoff landing tell the weathering story
  // without turning every wall into a photoreal texture exercise.
  const chainX = w / 2 + 0.24
  const chainZ = -d / 2 - 0.24
  for (let index = 0; index < 8; index++) {
    plan.add(cylGeo(8), index % 2 === 0 ? 'metalDark' : 'metalBrushed', {
      pos: [chainX, plinthH + 0.28 + index * 0.38, chainZ],
      size: [0.07, 0.31, 0.07],
      rot: [0, 0, (index % 2 === 0 ? 1 : -1) * 0.34],
    })
  }
  plan.add(sphereGeo(8), 'earthDark', {
    pos: [chainX, plinthH + 0.01, chainZ],
    size: [0.72, 0.035, 0.58],
  })

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

  if (spec.identity && door && spec.door) {
    buildExteriorIdentity(plan, spec, door, plinthH)
  }

  return door
}

function buildExteriorIdentity(plan: BuildPlan, spec: ShellSpec, door: DoorSpec, plinthH: number) {
  const identity = spec.identity
  if (!identity || !spec.door) return

  const f = wallFrame(spec, spec.door.wall)
  const cos = Math.cos(f.rotY)
  const sin = Math.sin(f.rotY)
  const accent = spec.accentMat ?? spec.trimMat ?? 'woodDark'
  const entry = (along: number, outward: number, y: number): [number, number, number] => [
    door.pos[0] + along * cos - sin * outward,
    y,
    door.pos[2] - along * sin + cos * outward,
  ]
  const addCanopy = (mat: MatKey, width: number, depth: number, y = plinthH + 2.58) => {
    plan.box(mat, {
      pos: entry(0, depth * 0.43, y),
      size: [width, 0.14, depth],
      rot: [0.05, f.rotY, 0],
    })
    for (const side of [-1, 1]) {
      plan.box(spec.trimMat ?? 'woodDark', {
        pos: entry(side * (width / 2 - 0.12), depth * 0.78, y - 0.5),
        size: [0.07, 1.0, 0.07],
        rot: [0, f.rotY, 0],
      })
    }
  }
  const addSignBand = (mat: MatKey, width: number, y = plinthH + 2.82) => {
    plan.box('woodDark', {
      pos: entry(0, 0.2, y),
      size: [width + 0.14, 0.5, 0.12],
      rot: [0, f.rotY, 0],
    })
    plan.box(mat, {
      pos: entry(0, 0.27, y),
      size: [width, 0.34, 0.05],
      rot: [0, f.rotY, 0],
    })
  }
  const addFrontFins = (mat: MatKey, count: number, spacing: number, height: number, start = 0) => {
    for (let i = 0; i < count; i++) {
      const along = start + (i - (count - 1) / 2) * spacing
      plan.box(mat, {
        pos: entry(along, 0.22, plinthH + height / 2),
        size: [0.1, height, 0.38],
        rot: [0, f.rotY, 0],
      })
    }
  }

  switch (identity) {
    case 'home':
    case 'cottage': {
      // A warm trellis cadence and a small chimney make residential roofs
      // legible from the village paths without relying on signage.
      for (const along of [-1.2, -0.6, 0, 0.6, 1.2]) {
        plan.box('woodPale', {
          pos: entry(along, 2.12, plinthH + 2.48),
          size: [0.08, 0.08, 2.5],
          rot: [0, f.rotY, 0],
        })
      }
      plan.solid('woodDark', {
        pos: [spec.w * 0.28, spec.h + plinthH + 0.78, -spec.d * 0.22],
        size: [0.48, 1.15, 0.48],
      })
      plan.box('metalDark', {
        pos: [spec.w * 0.28, spec.h + plinthH + 1.38, -spec.d * 0.22],
        size: [0.64, 0.1, 0.64],
      })
      break
    }
    case 'cafe':
      addCanopy('fabricRust', door.width + 2.5, 1.65, plinthH + 2.72)
      addSignBand('woodPale', door.width + 1.0, plinthH + 3.02)
      addFrontFins('woodPale', 2, 0.25, 0.72, -door.width / 2 - 0.58)
      break
    case 'bookshop':
      addCanopy('woodWarm', door.width + 1.7, 1.25)
      addSignBand('fabricSand', door.width + 1.3)
      addFrontFins('woodDark', 5, 0.18, 1.35, -door.width / 2 - 0.72)
      break
    case 'records':
      addCanopy('metalDark', door.width + 1.5, 1.05)
      addSignBand('paint.coral', door.width + 1.45)
      plan.box('fabricTeal', {
        pos: entry(0, 0.31, plinthH + 2.82),
        size: [0.22, 0.36, 0.06],
        rot: [0, f.rotY, 0],
      })
      addFrontFins('metalBrushed', 3, 0.2, 1.1, door.width / 2 + 0.6)
      break
    case 'plants': {
      addCanopy('metalBrushed', door.width + 1.5, 1.1)
      addSignBand('plasterSage', door.width + 1.2)
      for (const along of [-1.35, 1.35]) {
        plan.solid('ceramicTerracotta', {
          pos: entry(along, 0.55, plinthH + 0.3),
          size: [0.82, 0.5, 0.58],
        })
        plan.sphere(
          'leafDeep',
          { pos: entry(along, 0.55, plinthH + 0.78), size: [0.75, 0.7, 0.75] },
          10,
        )
        plan.sphere(
          'leafGreen',
          {
            pos: entry(along + 0.18, 0.52, plinthH + 1.08),
            size: [0.52, 0.62, 0.52],
          },
          10,
        )
      }
      break
    }
    case 'gallery':
      addCanopy('metalBrushed', door.width + 2.0, 1.4, plinthH + 2.7)
      addSignBand('ceramicWhite', door.width + 1.2, plinthH + 3.08)
      addFrontFins('metalDark', 4, 0.26, spec.h + 0.9, -spec.w / 2 + 0.62)
      break
    case 'bathhouse':
      addCanopy('woodPale', door.width + 2.2, 1.75, plinthH + 2.62)
      addSignBand('stoneCounter', door.width + 1.25, plinthH + 2.94)
      addFrontFins('woodWarm', 7, 0.23, 2.5, -door.width / 2 - 1.45)
      break
    case 'observatory':
      addCanopy('metalBrushed', door.width + 1.6, 1.3, plinthH + 2.64)
      addSignBand('paint.night', door.width + 1.0, plinthH + 2.95)
      addFrontFins('metalBrushed', 2, door.width + 0.75, spec.h + 0.7)
      plan.box('paint.coral', {
        pos: entry(0, 0.34, plinthH + 2.95),
        size: [0.12, 0.38, 0.07],
        rot: [0, f.rotY, Math.PI / 4],
      })
      break
    case 'store':
      addCanopy('fabricSand', door.width + 1.9, 1.45)
      addSignBand(accent, door.width + 1.45)
      addFrontFins('woodPale', 4, 0.22, 1.2, -door.width / 2 - 0.72)
      break
  }
}
