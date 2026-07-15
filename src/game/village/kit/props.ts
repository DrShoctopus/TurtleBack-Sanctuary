/**
 * Furniture & prop vocabulary. Each helper appends beveled-primitive parts to a
 * BuildPlan at a local transform. Rotation is around Y at (x, z) on the floor.
 * Props marked with colliders get simplified box collision only.
 */
import { BuildPlan, cylGeo, sphereGeo } from './geometry'
import { mulberry32 } from '../../core/rng'
import type { MatKey } from './materials'

type P = BuildPlan

const rot = (x: number, z: number, r: number, dx: number, dz: number): [number, number] => {
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [x + dx * c + dz * s, z - dx * s + dz * c]
}

/** low seating — sofa with arms and cushions */
export function sofa(
  p: P,
  x: number,
  z: number,
  r: number,
  fabric: 'fabricSand' | 'fabricTeal' | 'fabricRust' = 'fabricSand',
): void {
  const at = (dx: number, dz: number): [number, number] => rot(x, z, r, dx, dz)
  const [bx, bz] = at(0, 0)
  p.solid(fabric, { pos: [bx, 0.24, bz], size: [2.1, 0.48, 0.95], rot: [0, r, 0] })
  const [backX, backZ] = at(0, -0.38)
  p.box(fabric, { pos: [backX, 0.62, backZ], size: [2.1, 0.62, 0.22], rot: [0, r, 0] })
  for (const side of [-1, 1]) {
    const [ax, az] = at(side * 1.02, 0)
    p.box(fabric, { pos: [ax, 0.5, az], size: [0.18, 0.55, 0.95], rot: [0, r, 0] })
  }
  for (const side of [-0.5, 0.5]) {
    const [cx, cz] = at(side, 0.05)
    p.box(fabric === 'fabricSand' ? 'fabricTeal' : 'fabricSand', {
      pos: [cx, 0.53, cz],
      size: [0.88, 0.14, 0.8],
      rot: [0, r, 0],
    })
  }
  const [lx, lz] = at(0, 0)
  p.box('woodDark', { pos: [lx, 0.06, lz], size: [2.0, 0.12, 0.85], rot: [0, r, 0] })
}

export function armchair(
  p: P,
  x: number,
  z: number,
  r: number,
  fabric: 'fabricSand' | 'fabricTeal' | 'fabricRust' = 'fabricTeal',
): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  const [bx, bz] = at(0, 0)
  p.solid(fabric, { pos: [bx, 0.26, bz], size: [0.85, 0.5, 0.85], rot: [0, r, 0] })
  const [backX, backZ] = at(0, -0.33)
  p.box(fabric, { pos: [backX, 0.66, backZ], size: [0.85, 0.66, 0.2], rot: [0, r, 0] })
  for (const side of [-1, 1]) {
    const [ax, az] = at(side * 0.43, 0)
    p.box(fabric, { pos: [ax, 0.5, az], size: [0.14, 0.5, 0.8], rot: [0, r, 0] })
  }
}

export function coffeeTable(p: P, x: number, z: number, r: number): void {
  p.solid('woodWarm', { pos: [x, 0.36, z], size: [1.15, 0.06, 0.6], rot: [0, r, 0] })
  for (const [dx, dz] of [
    [-0.5, -0.22],
    [0.5, -0.22],
    [-0.5, 0.22],
    [0.5, 0.22],
  ]) {
    const [lx, lz] = rot(x, z, r, dx, dz)
    p.box('woodDark', { pos: [lx, 0.17, lz], size: [0.07, 0.34, 0.07], rot: [0, r, 0] })
  }
}

export function diningTable(p: P, x: number, z: number, r: number, seats = 4): void {
  p.solid('woodWarm', { pos: [x, 0.74, z], size: [1.7, 0.07, 0.95], rot: [0, r, 0] })
  p.box('metalDark', { pos: [x, 0.37, z], size: [0.12, 0.74, 0.12] })
  const spots: Array<[number, number, number]> = [
    [0, 0.75, r + Math.PI],
    [1, -0.75, r],
    [2, 0, r + Math.PI / 2],
    [3, 0, r - Math.PI / 2],
  ]
  for (let i = 0; i < Math.min(seats, 4); i++) {
    const [idx, dz, cr] = spots[i]
    const [cxp, czp] = idx <= 1 ? rot(x, z, r, 0, dz) : rot(x, z, r, idx === 2 ? 1.15 : -1.15, 0)
    chair(p, cxp, czp, cr)
  }
}

export function chair(p: P, x: number, z: number, r: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  const [sx, sz] = at(0, 0)
  p.box('woodWarm', { pos: [sx, 0.45, sz], size: [0.46, 0.05, 0.46], rot: [0, r, 0] })
  const [bx, bz] = at(0, -0.21)
  p.box('woodWarm', { pos: [bx, 0.78, bz], size: [0.46, 0.62, 0.05], rot: [0, r, 0] })
  for (const [dx, dz] of [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19],
  ]) {
    const [lx, lz] = at(dx, dz)
    p.box('woodDark', { pos: [lx, 0.22, lz], size: [0.05, 0.45, 0.05], rot: [0, r, 0] })
  }
}

export function stool(p: P, x: number, z: number, r = 0): void {
  p.add(cylGeo(12), 'woodWarm', { pos: [x, 0.62, z], size: [0.38, 0.06, 0.38] })
  p.add(cylGeo(10), 'metalDark', { pos: [x, 0.3, z], size: [0.06, 0.6, 0.06], rot: [0, r, 0] })
  p.add(cylGeo(12), 'metalDark', { pos: [x, 0.03, z], size: [0.34, 0.05, 0.34] })
}

export function bed(p: P, x: number, z: number, r: number, wide = true): void {
  const w = wide ? 1.7 : 1.1
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  const [bx, bz] = at(0, 0)
  p.solid('woodDark', { pos: [bx, 0.18, bz], size: [w + 0.15, 0.25, 2.15], rot: [0, r, 0] })
  p.box('fabricSand', { pos: [bx, 0.42, bz], size: [w, 0.25, 2.05], rot: [0, r, 0] })
  const [hx, hz] = at(0, -1.02)
  p.box('woodDark', { pos: [hx, 0.65, hz], size: [w + 0.15, 0.9, 0.09], rot: [0, r, 0] })
  const [px1, pz1] = at(-w / 4 - 0.05, -0.7)
  const [px2, pz2] = at(w / 4 + 0.05, -0.7)
  p.box('ceramicWhite', { pos: [px1, 0.58, pz1], size: [0.55, 0.12, 0.35], rot: [0, r, 0] })
  if (wide)
    p.box('ceramicWhite', { pos: [px2, 0.58, pz2], size: [0.55, 0.12, 0.35], rot: [0, r, 0] })
  const [tx, tz] = at(0, 0.45)
  p.box('fabricTeal', { pos: [tx, 0.56, tz], size: [w + 0.02, 0.06, 1.1], rot: [0, r, 0] })
}

export function nightstand(p: P, x: number, z: number, r: number): void {
  p.solid('woodWarm', { pos: [x, 0.28, z], size: [0.5, 0.56, 0.42], rot: [0, r, 0] })
}

export function wardrobe(p: P, x: number, z: number, r: number): void {
  p.solid('woodWarm', { pos: [x, 1.05, z], size: [1.3, 2.1, 0.6], rot: [0, r, 0] })
  const [hx, hz] = rot(x, z, r, 0, 0.31)
  p.box('metalBrushed', { pos: [hx, 1.05, hz], size: [0.04, 0.5, 0.04], rot: [0, r, 0] })
}

/** kitchen run along a wall: counters, sink, stove, upper cabinets, fridge */
export function kitchenette(p: P, x: number, z: number, r: number, length = 3.2): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  const fridgeW = 0.75
  const bayGap = 0.06
  const counterLength = Math.max(0.9, length - fridgeW - bayGap)
  const counterX = -(fridgeW + bayGap) / 2
  const [cx, cz] = at(counterX, 0)
  p.solid('woodPale', { pos: [cx, 0.45, cz], size: [counterLength, 0.9, 0.65], rot: [0, r, 0] })
  p.box('stoneCounter', {
    pos: [cx, 0.93, cz],
    size: [counterLength + 0.06, 0.06, 0.7],
    rot: [0, r, 0],
  })
  const upperDepth = 0.38
  const [ux, uz] = at(counterX, 0.65 / 2 - upperDepth / 2)
  p.box('woodPale', {
    pos: [ux, 2.0, uz],
    size: [counterLength * 0.9, 0.7, upperDepth],
    rot: [0, r, 0],
  })
  const [sx, sz] = at(counterX - counterLength / 4, 0.05)
  p.box('metalBrushed', { pos: [sx, 0.97, sz], size: [0.6, 0.04, 0.45], rot: [0, r, 0] })
  const [fx, fz] = at(length / 2 - fridgeW / 2, -0.05)
  p.solid('metalBrushed', { pos: [fx, 0.95, fz], size: [0.75, 1.9, 0.7], rot: [0, r, 0] })
  const [hx, hz] = at(counterX + counterLength / 4, 0.02)
  p.box('metalDark', { pos: [hx, 0.965, hz], size: [0.65, 0.03, 0.5], rot: [0, r, 0] })
  for (const b of [-0.18, 0.18]) {
    const [bx2, bz2] = at(counterX + counterLength / 4 + b, 0.02)
    p.add(cylGeo(10), 'metalDark', { pos: [bx2, 0.99, bz2], size: [0.13, 0.03, 0.13] })
  }
}

export function shelfUnit(
  p: P,
  x: number,
  z: number,
  r: number,
  w = 1.8,
  h = 2.0,
  withBooks = true,
  seed = 5,
): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  const depth = 0.34
  const frame = 0.08
  const [backX, backZ] = at(0, -depth / 2 + 0.02)
  p.box('woodWarm', { pos: [backX, h / 2, backZ], size: [w, h, 0.04], rot: [0, r, 0] })
  for (const side of [-1, 1]) {
    const [sideX, sideZ] = at(side * (w / 2 - frame / 2), 0)
    p.box('woodWarm', { pos: [sideX, h / 2, sideZ], size: [frame, h, depth], rot: [0, r, 0] })
  }
  for (const y of [frame / 2, h - frame / 2]) {
    const [railX, railZ] = at(0, 0)
    p.box('woodWarm', {
      pos: [railX, y, railZ],
      size: [w - frame * 2, frame, depth],
      rot: [0, r, 0],
    })
  }
  p.collider({ pos: [x, h / 2, z], size: [w, h, depth], rotY: r })
  const shelves = Math.floor(h / 0.42)
  const rng = mulberry32(seed)
  for (let s = 0; s < shelves; s++) {
    const y = 0.28 + s * 0.42
    const [ix, iz] = at(0, 0.02)
    p.box('woodDark', {
      pos: [ix, y - 0.16, iz],
      size: [w - 0.12, 0.05, 0.28],
      rot: [0, r, 0],
    })
    if (withBooks) {
      let cx2 = -w / 2 + 0.12
      while (cx2 < w / 2 - 0.15) {
        const bw = 0.05 + rng() * 0.07
        if (rng() < 0.82) {
          const bh = 0.2 + rng() * 0.1
          const mats = [
            'paint.coral',
            'paint.night',
            'fabricTeal',
            'ceramicTerracotta',
            'fabricRust',
          ] as const
          const [bx2, bz2] = at(cx2 + bw / 2, 0.03)
          p.box(mats[Math.floor(rng() * mats.length)], {
            pos: [bx2, y + bh / 2 - 0.14, bz2],
            size: [bw, bh, 0.2],
            rot: [0, r, 0],
          })
        }
        cx2 += bw + 0.012
      }
    }
  }
}

export function desk(p: P, x: number, z: number, r: number): void {
  p.solid('woodWarm', { pos: [x, 0.73, z], size: [1.5, 0.06, 0.7], rot: [0, r, 0] })
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (const side of [-0.68, 0.68]) {
    const [lx, lz] = at(side, 0)
    p.box('woodDark', { pos: [lx, 0.365, lz], size: [0.06, 0.73, 0.62], rot: [0, r, 0] })
  }
  const [nx, nz] = at(-0.3, -0.1)
  p.box('paint.night', { pos: [nx, 0.8, nz], size: [0.35, 0.05, 0.25], rot: [0, r + 0.2, 0] })
}

export function floorLampBase(p: P, x: number, z: number): void {
  p.add(cylGeo(12), 'metalDark', { pos: [x, 0.02, z], size: [0.3, 0.04, 0.3] })
  p.add(cylGeo(8), 'metalDark', { pos: [x, 0.75, z], size: [0.04, 1.5, 0.04] })
}

export function pendantCord(p: P, x: number, y: number, z: number, drop = 0.6): void {
  p.add(cylGeo(6), 'metalDark', { pos: [x, y - drop / 2, z], size: [0.02, drop, 0.02] })
}

export function rug(p: P, x: number, z: number, r: number, w = 2.4, d = 1.7): void {
  p.add(cylGeo(24), 'rugWeave', { pos: [x, 0.012, z], size: [w, 0.02, d], rot: [0, r, 0] })
}

export function plantPot(p: P, x: number, z: number, size: 's' | 'm' | 'l' = 'm', seed = 3): void {
  const s = size === 's' ? 0.55 : size === 'm' ? 0.85 : 1.25
  p.add(cylGeo(12), 'ceramicTerracotta', {
    pos: [x, 0.14 * s, z],
    size: [0.36 * s, 0.3 * s, 0.36 * s],
  })
  const rng = mulberry32(seed)
  const blobs = size === 's' ? 2 : 4
  for (let i = 0; i < blobs; i++) {
    p.add(sphereGeo(10), i % 2 ? 'leafGreen' : 'leafDeep', {
      pos: [x + (rng() - 0.5) * 0.3 * s, (0.45 + rng() * 0.35) * s, z + (rng() - 0.5) * 0.3 * s],
      size: [0.4 * s, 0.5 * s, 0.4 * s],
    })
  }
  if (size !== 's') {
    p.add(cylGeo(6), 'woodDark', { pos: [x, 0.4 * s, z], size: [0.05 * s, 0.5 * s, 0.05 * s] })
  }
}

export function paintingFrame(
  p: P,
  x: number,
  y: number,
  z: number,
  r: number,
  w = 1.1,
  h = 0.8,
): void {
  p.box('woodDark', { pos: [x, y, z], size: [w + 0.08, h + 0.08, 0.05], rot: [0, r, 0] })
}

export function tvUnit(p: P, x: number, z: number, r: number): void {
  p.solid('woodDark', { pos: [x, 0.25, z], size: [1.9, 0.5, 0.5], rot: [0, r, 0] })
  const [ax, az] = rot(x, z, r, -0.6, 0.05)
  p.box('metalBrushed', { pos: [ax, 0.56, az], size: [0.25, 0.12, 0.25], rot: [0, r, 0] })
}

export function stereoCabinet(p: P, x: number, z: number, r: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  p.solid('woodWarm', { pos: [x, 0.4, z], size: [1.1, 0.8, 0.45], rot: [0, r, 0] })
  const [tx, tz] = at(0, 0.02)
  p.box('metalDark', { pos: [tx, 0.86, tz], size: [0.9, 0.1, 0.36], rot: [0, r, 0] })
  for (const side of [-0.75, 0.75]) {
    const [sx, sz] = at(side, 0)
    p.box('fabricSand', { pos: [sx, 0.55, sz], size: [0.34, 1.1, 0.34], rot: [0, r, 0] })
    const [gx, gz] = at(side, 0.18)
    p.add(cylGeo(12), 'metalDark', {
      pos: [gx, 0.75, gz],
      size: [0.2, 0.02, 0.2],
      rot: [Math.PI / 2, r, 0],
    })
  }
}

export function cafeCounter(p: P, x: number, z: number, r: number, length = 3.4): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  p.solid('woodDark', { pos: [x, 0.55, z], size: [length, 1.1, 0.7], rot: [0, r, 0] })
  p.box('stoneCounter', { pos: [x, 1.13, z], size: [length + 0.08, 0.06, 0.78], rot: [0, r, 0] })
  const [mx, mz] = at(-length / 4, -0.05)
  p.box('metalBrushed', { pos: [mx, 1.38, mz], size: [0.6, 0.44, 0.45], rot: [0, r, 0] })
  const [gx, gz] = at(length / 4, 0)
  p.box('glass', { pos: [gx, 1.42, gz], size: [0.9, 0.5, 0.5], rot: [0, r, 0] })
  const [px, pz] = at(length / 4, 0)
  p.box('ceramicWhite', { pos: [px, 1.22, pz], size: [0.7, 0.08, 0.4], rot: [0, r, 0] })
}

export function recordBin(p: P, x: number, z: number, r: number): void {
  p.solid('woodWarm', { pos: [x, 0.45, z], size: [1.3, 0.9, 0.8], rot: [0, r, 0] })
  const rng = mulberry32(11)
  for (let i = 0; i < 10; i++) {
    const [dx, dz] = rot(x, z, r, -0.55 + i * 0.115, 0)
    const mats = ['paint.coral', 'paint.night', 'fabricTeal', 'fabricRust', 'ceramicWhite'] as const
    p.box(mats[Math.floor(rng() * mats.length)], {
      pos: [dx, 0.98, dz],
      size: [0.03, 0.34, 0.34],
      rot: [0, r, rng() * 0.1 - 0.05],
    })
  }
}

export function easel(p: P, x: number, z: number, r: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (const side of [-0.3, 0.3]) {
    const [lx, lz] = at(side, 0)
    p.box('woodDark', { pos: [lx, 0.8, lz], size: [0.05, 1.6, 0.05], rot: [side * 0.2, r, 0] })
  }
  const [bx, bz] = at(0, -0.15)
  p.box('woodDark', { pos: [bx, 0.75, bz], size: [0.05, 1.5, 0.05], rot: [-0.25, r, 0] })
  const [cx, cz] = at(0, 0.02)
  p.box('ceramicWhite', { pos: [cx, 1.05, cz], size: [0.72, 0.9, 0.03], rot: [0.06, r, 0] })
}

export function plinth(p: P, x: number, z: number, sculptSeed = 1): void {
  p.solid('concrete', { pos: [x, 0.55, z], size: [0.5, 1.1, 0.5] })
  const rng = mulberry32(sculptSeed)
  const kind = Math.floor(rng() * 3)
  if (kind === 0)
    p.add(sphereGeo(16), 'metalBrushed', { pos: [x, 1.4, z], size: [0.42, 0.58, 0.42] })
  else if (kind === 1) {
    p.add(cylGeo(14), 'ceramicTerracotta', {
      pos: [x, 1.32, z],
      size: [0.3, 0.44, 0.3],
      rot: [0.3, 0.5, 0.2],
    })
  } else {
    p.box('paint.night', { pos: [x, 1.35, z], size: [0.3, 0.5, 0.3], rot: [0.6, 0.8, 0.3] })
  }
}

export function bathPool(p: P, x: number, z: number, w = 4, d = 3): void {
  // sunken pool: rim + inner water handled by caller (water is a dynamic mesh)
  p.solid('stoneCounter', { pos: [x, 0.22, z - d / 2 - 0.2], size: [w + 0.8, 0.44, 0.4] })
  p.solid('stoneCounter', { pos: [x, 0.22, z + d / 2 + 0.2], size: [w + 0.8, 0.44, 0.4] })
  p.solid('stoneCounter', { pos: [x - w / 2 - 0.2, 0.22, z], size: [0.4, 0.44, d] })
  p.solid('stoneCounter', { pos: [x + w / 2 + 0.2, 0.22, z], size: [0.4, 0.44, d] })
}

export function benchOutdoor(p: P, x: number, z: number, r: number, y0 = 0): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  p.solid('woodDeck', { pos: [x, y0 + 0.42, z], size: [1.7, 0.07, 0.5], rot: [0, r, 0] })
  const [bx, bz] = at(0, -0.24)
  p.box('woodDeck', { pos: [bx, y0 + 0.72, bz], size: [1.7, 0.5, 0.06], rot: [0, r, -0.08] })
  for (const side of [-0.7, 0.7]) {
    const [lx, lz] = at(side, 0)
    p.box('metalDark', { pos: [lx, y0 + 0.21, lz], size: [0.08, 0.42, 0.44], rot: [0, r, 0] })
  }
}

export function lampPostBase(p: P, x: number, z: number, y0 = 0): void {
  p.add(cylGeo(10), 'metalDark', { pos: [x, y0 + 0.06, z], size: [0.32, 0.12, 0.32] })
  p.add(cylGeo(8), 'metalDark', { pos: [x, y0 + 1.55, z], size: [0.07, 3.0, 0.07] })
  p.collider({ pos: [x, y0 + 1.5, z], size: [0.18, 3, 0.18] })
}

export function planterBox(p: P, x: number, z: number, r: number, w = 1.6, y0 = 0): void {
  p.solid('concrete', { pos: [x, y0 + 0.25, z], size: [w, 0.5, 0.55], rot: [0, r, 0] })
  const rng = mulberry32(Math.floor(x * 7 + z * 13))
  for (let i = 0; i < 3; i++) {
    const [px, pz] = rot(x, z, r, (i - 1) * (w / 3.2), 0)
    p.add(sphereGeo(8), i % 2 ? 'leafGreen' : 'leafDeep', {
      pos: [px, y0 + 0.62 + rng() * 0.1, pz],
      size: [0.42, 0.4, 0.42],
    })
  }
}

export function towelStack(p: P, x: number, y: number, z: number): void {
  for (let i = 0; i < 3; i++) {
    p.box(i % 2 ? 'ceramicWhite' : 'fabricTeal', {
      pos: [x, y + i * 0.09, z],
      size: [0.45, 0.08, 0.32],
    })
  }
}

export function mugCluster(p: P, x: number, y: number, z: number, n = 3, seed = 9): void {
  const rng = mulberry32(seed)
  for (let i = 0; i < n; i++) {
    p.add(cylGeo(10), i % 2 ? 'ceramicWhite' : 'ceramicTerracotta', {
      pos: [x + (rng() - 0.5) * 0.4, y + 0.05, z + (rng() - 0.5) * 0.3],
      size: [0.09, 0.11, 0.09],
    })
  }
}

export function kettleSet(p: P, x: number, y: number, z: number): void {
  p.add(sphereGeo(12), 'metalBrushed', { pos: [x, y + 0.12, z], size: [0.24, 0.22, 0.24] })
  p.box('metalDark', { pos: [x + 0.16, y + 0.2, z], size: [0.04, 0.12, 0.04], rot: [0, 0, -0.5] })
  mugCluster(p, x + 0.45, y, z, 2, 4)
}

export function telescopeProp(p: P, x: number, z: number, r: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (const a of [0, 2.1, 4.2]) {
    const [lx, lz] = at(Math.cos(a) * 0.4, Math.sin(a) * 0.4)
    p.box('woodDark', {
      pos: [lx, 0.6, lz],
      size: [0.06, 1.2, 0.06],
      rot: [0.3 * Math.cos(a), 0, 0.3 * Math.sin(a)],
    })
  }
  const [tx, tz] = at(0, 0.15)
  p.add(cylGeo(14), 'metalBrushed', {
    pos: [tx, 1.45, tz],
    size: [0.22, 1.5, 0.22],
    rot: [Math.PI / 2 - 0.65, r, 0],
  })
  p.collider({ pos: [x, 0.8, z], size: [0.8, 1.6, 0.8] })
}

export function storeShelf(p: P, x: number, z: number, r: number, seed = 8): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  const w = 2
  const h = 1.8
  const depth = 0.5
  const frame = 0.08
  const [backX, backZ] = at(0, -depth / 2 + 0.02)
  p.box('woodWarm', { pos: [backX, h / 2, backZ], size: [w, h, 0.04], rot: [0, r, 0] })
  for (const side of [-1, 1]) {
    const [sideX, sideZ] = at(side * (w / 2 - frame / 2), 0)
    p.box('woodWarm', { pos: [sideX, h / 2, sideZ], size: [frame, h, depth], rot: [0, r, 0] })
  }
  for (const y of [frame / 2, 0.34, 0.89, 1.44, h - frame / 2]) {
    const [shelfX, shelfZ] = at(0, 0)
    p.box('woodWarm', {
      pos: [shelfX, y, shelfZ],
      size: [w - frame * 2, frame, depth],
      rot: [0, r, 0],
    })
  }
  p.collider({ pos: [x, h / 2, z], size: [w, h, depth], rotY: r })
  const rng = mulberry32(seed)
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 6; i++) {
      if (rng() < 0.3) continue
      const [gx, gz] = at(-0.8 + i * 0.32, 0.05)
      const mats = [
        'ceramicWhite',
        'ceramicTerracotta',
        'paint.coral',
        'fabricSand',
        'paint.night',
      ] as const
      const kind = rng()
      if (kind < 0.5) {
        const itemH = 0.2 + rng() * 0.14
        p.add(cylGeo(8), mats[Math.floor(rng() * mats.length)], {
          pos: [gx, 0.38 + s * 0.55 + itemH / 2, gz],
          size: [0.14, itemH, 0.14],
          rot: [0, r, 0],
        })
      } else {
        const itemH = 0.14 + rng() * 0.14
        p.box(mats[Math.floor(rng() * mats.length)], {
          pos: [gx, 0.38 + s * 0.55 + itemH / 2, gz],
          size: [0.16, itemH, 0.16],
          rot: [0, r + rng() * 0.4, 0],
        })
      }
    }
  }
}

export function windChime(p: P, x: number, y: number, z: number): void {
  p.add(cylGeo(8), 'woodDark', { pos: [x, y, z], size: [0.3, 0.03, 0.3] })
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    p.add(cylGeo(6), 'metalBrushed', {
      pos: [x + Math.cos(a) * 0.11, y - 0.2 - (i % 3) * 0.05, z + Math.sin(a) * 0.11],
      size: [0.018, 0.3 + (i % 3) * 0.08, 0.018],
    })
  }
}

// ---------------------------------------------------------------------------
// Authored outdoor district kit
// ---------------------------------------------------------------------------

export function thresholdFrame(
  p: P,
  x: number,
  z: number,
  r: number,
  y0: number,
  accent: MatKey = 'fabricTeal',
): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (const side of [-1, 1]) {
    const [px, pz] = at(side * 1.65, 0)
    p.box('woodDark', {
      pos: [px, y0 + 1.45, pz],
      size: [0.18, 2.9, 0.18],
      rot: [0, r, 0],
    })
    p.add(cylGeo(12), 'concrete', {
      pos: [px, y0 + 0.1, pz],
      size: [0.42, 0.2, 0.42],
    })
    p.collider({ pos: [px, y0 + 1.35, pz], size: [0.28, 2.7, 0.28] })
  }
  const [tx, tz] = at(0, 0)
  p.box('woodDark', {
    pos: [tx, y0 + 2.82, tz],
    size: [3.6, 0.18, 0.25],
    rot: [0, r, 0],
  })
  p.box(accent, {
    pos: [tx, y0 + 2.57, tz],
    size: [1.45, 0.28, 0.12],
    rot: [0, r, 0],
  })
}

export function marketCanopy(
  p: P,
  x: number,
  z: number,
  r: number,
  y0: number,
  fabric: 'fabricTeal' | 'fabricRust' | 'fabricSand' = 'fabricTeal',
): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (const [dx, dz] of [
    [-1.35, -0.85],
    [1.35, -0.85],
    [-1.35, 0.85],
    [1.35, 0.85],
  ]) {
    const [px, pz] = at(dx, dz)
    p.box('woodDark', {
      pos: [px, y0 + 1.25, pz],
      size: [0.1, 2.5, 0.1],
      rot: [0, r, 0],
    })
  }
  p.box(fabric, {
    pos: [x, y0 + 2.52, z],
    size: [3.15, 0.12, 2.2],
    rot: [-0.035, r, 0.025],
  })
  p.solid('woodWarm', {
    pos: [x, y0 + 0.78, z],
    size: [2.45, 0.12, 0.72],
    rot: [0, r, 0],
  })
  const [baseX, baseZ] = at(0, 0.12)
  p.box('woodDark', {
    pos: [baseX, y0 + 0.38, baseZ],
    size: [1.8, 0.76, 0.48],
    rot: [0, r, 0],
  })
}

export function raisedGardenBed(
  p: P,
  x: number,
  z: number,
  r: number,
  y0: number,
  w = 3.8,
  d = 1.35,
  seed = 1,
): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  p.box('woodDeck', {
    pos: [x, y0 + 0.28, z],
    size: [w, 0.5, d],
    rot: [0, r, 0],
  })
  p.box('paint.night', {
    pos: [x, y0 + 0.52, z],
    size: [w - 0.24, 0.08, d - 0.22],
    rot: [0, r, 0],
  })
  const rng = mulberry32(seed)
  const plants = Math.max(5, Math.floor(w * 2.2))
  for (let i = 0; i < plants; i++) {
    const dx = -w * 0.42 + (i / Math.max(1, plants - 1)) * w * 0.84
    const [px, pz] = at(dx, (rng() - 0.5) * d * 0.38)
    const height = 0.28 + rng() * 0.3
    p.add(sphereGeo(8), i % 3 === 0 ? 'leafDeep' : 'leafGreen', {
      pos: [px, y0 + 0.58 + height * 0.55, pz],
      size: [0.25 + rng() * 0.18, height, 0.25 + rng() * 0.15],
    })
  }
}

export function fenceRun(p: P, x: number, z: number, r: number, length: number, y0: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (const h of [0.42, 0.82]) {
    p.box('woodPale', {
      pos: [x, y0 + h, z],
      size: [length, 0.08, 0.1],
      rot: [0, r, 0],
    })
  }
  const posts = Math.max(2, Math.ceil(length / 1.5))
  for (let i = 0; i <= posts; i++) {
    const [px, pz] = at(-length / 2 + (i / posts) * length, 0)
    p.box('woodDark', {
      pos: [px, y0 + 0.48, pz],
      size: [0.1, 0.96, 0.1],
      rot: [0, r, 0],
    })
  }
}

export function outdoorSculpture(
  p: P,
  x: number,
  z: number,
  r: number,
  y0: number,
  accent: 'paint.coral' | 'paint.night' | 'fabricTeal' = 'paint.coral',
  seed = 1,
): void {
  const rng = mulberry32(seed)
  p.add(cylGeo(24), 'concrete', {
    pos: [x, y0 + 0.2, z],
    size: [1.45, 0.4, 1.45],
  })
  for (let i = 0; i < 3; i++) {
    const a = r + i * 1.95 + rng() * 0.25
    const h = 1.4 + rng() * 1.05
    p.box(i === 1 ? 'metalBrushed' : accent, {
      pos: [
        x + Math.cos(a) * (0.18 + i * 0.12),
        y0 + 0.38 + h / 2,
        z + Math.sin(a) * (0.18 + i * 0.12),
      ],
      size: [0.22 + rng() * 0.12, h, 0.38 + rng() * 0.16],
      rot: [0.08 * (i - 1), a, (i - 1) * 0.18],
    })
  }
  p.collider({ pos: [x, y0 + 0.7, z], size: [1.6, 1.4, 1.6] })
}

// ---------------------------------------------------------------------------
// Slice 5 village-life vocabulary
// ---------------------------------------------------------------------------

/** Soft irregular earth/moss shapes keep prop groups visually attached. */
export function contactPatch(p: P, x: number, z: number, r: number, y0: number, scale = 1): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (const [index, values] of [
    [0, 0, 1.65, 1.05],
    [1, -0.62, 1.05, 0.72],
    [2, 0.66, 0.88, 0.64],
  ].entries()) {
    const [, offset, width, depth] = values
    const [px, pz] = at(offset * scale, (index - 1) * 0.13 * scale)
    p.add(sphereGeo(10), index === 1 ? 'weatheringMoss' : 'earthDark', {
      pos: [px, y0 + 0.015 + index * 0.002, pz],
      size: [width * scale, 0.035, depth * scale],
      rot: [0, r + index * 0.27, 0],
    })
  }
}

export function iconSignpost(
  p: P,
  x: number,
  z: number,
  r: number,
  y0: number,
  accent: 'fabricTeal' | 'fabricRust' | 'fabricSand' | 'paint.coral' = 'fabricTeal',
): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  contactPatch(p, x, z, r, y0, 0.85)
  for (const side of [-0.62, 0.62]) {
    const [px, pz] = at(side, 0)
    p.box('woodDark', { pos: [px, y0 + 0.85, pz], size: [0.12, 1.7, 0.12], rot: [0, r, 0] })
  }
  p.box('woodWarm', { pos: [x, y0 + 1.45, z], size: [1.55, 0.78, 0.16], rot: [0, r, 0] })
  const [panelX, panelZ] = at(0, 0.1)
  p.box(accent, {
    pos: [panelX, y0 + 1.49, panelZ],
    size: [1.2, 0.48, 0.055],
    rot: [0, r, 0],
  })
  const [leafX, leafZ] = at(0, 0.145)
  p.add(sphereGeo(8), 'woodPale', {
    pos: [leafX - Math.cos(r) * 0.14, y0 + 1.5, leafZ + Math.sin(r) * 0.14],
    size: [0.18, 0.28, 0.035],
    rot: [0, r, 0.45],
  })
  p.add(sphereGeo(8), 'woodPale', {
    pos: [leafX + Math.cos(r) * 0.14, y0 + 1.5, leafZ - Math.sin(r) * 0.14],
    size: [0.18, 0.28, 0.035],
    rot: [0, r, -0.45],
  })
  p.collider({ pos: [x, y0 + 0.78, z], size: [1.5, 1.6, 0.24], rot: [0, r, 0] })
}

export function handcart(p: P, x: number, z: number, r: number, y0: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  contactPatch(p, x, z, r, y0, 1.05)
  p.box('woodWarm', { pos: [x, y0 + 0.63, z], size: [1.85, 0.18, 1.05], rot: [0.02, r, 0] })
  for (const side of [-0.86, 0.86]) {
    const [px, pz] = at(side, 0)
    p.box('woodDark', { pos: [px, y0 + 0.92, pz], size: [0.1, 0.65, 1.05], rot: [0, r, 0] })
  }
  for (const side of [-0.7, 0.7]) {
    const [px, pz] = at(side, -0.5)
    p.add(cylGeo(16), 'woodDark', {
      pos: [px, y0 + 0.42, pz],
      size: [0.65, 0.12, 0.65],
      rot: [Math.PI / 2, r, 0],
    })
    p.add(cylGeo(16), 'metalDark', {
      pos: [px, y0 + 0.42, pz],
      size: [0.18, 0.15, 0.18],
      rot: [Math.PI / 2, r, 0],
    })
  }
  for (const side of [-0.55, 0.55]) {
    const [px, pz] = at(side, 1.15)
    p.box('woodDark', { pos: [px, y0 + 0.54, pz], size: [0.1, 0.1, 1.55], rot: [0, r, 0] })
  }
  p.collider({ pos: [x, y0 + 0.62, z], size: [2.05, 1.05, 1.25], rot: [0, r, 0] })
}

export function crateStack(p: P, x: number, z: number, r: number, y0: number, seed = 1): void {
  const rng = mulberry32(seed)
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (let index = 0; index < 3; index++) {
    const level = index === 2 ? 1 : 0
    const dx = index === 0 ? -0.45 : index === 1 ? 0.45 : 0.05
    const dz = level ? 0.02 : (rng() - 0.5) * 0.12
    const [px, pz] = at(dx, dz)
    const yaw = r + (rng() - 0.5) * 0.16
    p.box(index === 2 ? 'woodPale' : 'woodWarm', {
      pos: [px, y0 + 0.34 + level * 0.66, pz],
      size: [0.78, 0.62, 0.68],
      rot: [0, yaw, 0],
    })
    for (const h of [-0.18, 0.18]) {
      p.box('woodDark', {
        pos: [px, y0 + 0.34 + level * 0.66 + h, pz],
        size: [0.84, 0.055, 0.73],
        rot: [0, yaw, 0],
      })
    }
  }
}

export function basketCluster(p: P, x: number, z: number, r: number, y0: number, seed = 1): void {
  const rng = mulberry32(seed)
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (let index = 0; index < 4; index++) {
    const [px, pz] = at((index - 1.5) * 0.36, (rng() - 0.5) * 0.45)
    const radius = 0.28 + rng() * 0.1
    const height = 0.26 + rng() * 0.22
    p.add(cylGeo(12), index % 2 === 0 ? 'rope' : 'woodPale', {
      pos: [px, y0 + height / 2, pz],
      size: [radius * 2, height, radius * 2],
    })
    p.add(cylGeo(12), 'woodDark', {
      pos: [px, y0 + height, pz],
      size: [radius * 2.12, 0.045, radius * 2.12],
    })
  }
}

export function toolRack(p: P, x: number, z: number, r: number, y0: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (const side of [-0.85, 0.85]) {
    const [px, pz] = at(side, 0)
    p.box('woodDark', { pos: [px, y0 + 0.78, pz], size: [0.1, 1.56, 0.1], rot: [0, r, 0] })
  }
  p.box('woodWarm', { pos: [x, y0 + 1.16, z], size: [1.82, 0.12, 0.18], rot: [0, r, 0] })
  for (let index = 0; index < 5; index++) {
    const [px, pz] = at(-0.65 + index * 0.32, 0.08)
    p.box('woodPale', {
      pos: [px, y0 + 0.58, pz],
      size: [0.055, 1.05 - (index % 2) * 0.16, 0.055],
      rot: [0, r, (index - 2) * 0.025],
    })
    p.box(index % 2 === 0 ? 'metalDark' : 'metalBrushed', {
      pos: [px, y0 + 0.12, pz],
      size: [0.2 + (index % 2) * 0.12, 0.14, 0.08],
      rot: [0, r, 0],
    })
  }
  p.collider({ pos: [x, y0 + 0.7, z], size: [1.9, 1.45, 0.32], rot: [0, r, 0] })
}

export function dryingLine(
  p: P,
  x: number,
  z: number,
  r: number,
  y0: number,
  palette: readonly ('fabricSand' | 'fabricTeal' | 'fabricRust')[] = [
    'fabricSand',
    'fabricTeal',
    'fabricRust',
  ],
): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  contactPatch(p, x, z, r, y0, 1.25)
  for (const side of [-1.65, 1.65]) {
    const [px, pz] = at(side, 0)
    p.box('woodDark', { pos: [px, y0 + 1.15, pz], size: [0.12, 2.3, 0.12], rot: [0, r, 0] })
    p.add(cylGeo(10), 'concrete', { pos: [px, y0 + 0.08, pz], size: [0.34, 0.16, 0.34] })
  }
  p.box('rope', { pos: [x, y0 + 2.02, z], size: [3.35, 0.025, 0.025], rot: [0, r, 0.025] })
  for (let index = 0; index < 5; index++) {
    const [px, pz] = at(-1.25 + index * 0.62, 0.05)
    const height = 0.55 + (index % 2) * 0.18
    p.box(palette[index % palette.length], {
      pos: [px, y0 + 1.73 - height / 2, pz],
      size: [0.48, height, 0.035],
      rot: [0, r, (index - 2) * 0.015],
    })
  }
  for (const side of [-1, 1]) {
    const [px, pz] = at(side * 1.65, 0)
    p.collider({ pos: [px, y0 + 1.0, pz], size: [0.22, 2.0, 0.22] })
  }
}

export function firewoodRack(p: P, x: number, z: number, r: number, y0: number, seed = 1): void {
  const rng = mulberry32(seed)
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  contactPatch(p, x, z, r, y0, 1.05)
  for (const side of [-1, 1]) {
    const [px, pz] = at(side * 0.92, 0)
    p.box('woodDark', { pos: [px, y0 + 0.7, pz], size: [0.1, 1.4, 0.72], rot: [0, r, 0] })
  }
  p.box('woodDeck', { pos: [x, y0 + 1.47, z], size: [2.15, 0.12, 1.0], rot: [-0.08, r, 0] })
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 7 - (row % 2); column++) {
      const [px, pz] = at(-0.7 + column * 0.23 + (row % 2) * 0.1, (rng() - 0.5) * 0.14)
      p.add(cylGeo(8), row % 2 === 0 ? 'woodWarm' : 'woodPale', {
        pos: [px, y0 + 0.17 + row * 0.24, pz],
        size: [0.19, 0.68, 0.19],
        rot: [Math.PI / 2, r, 0],
      })
    }
  }
  p.collider({ pos: [x, y0 + 0.72, z], size: [2.0, 1.45, 1.0], rot: [0, r, 0] })
}

export function workBench(p: P, x: number, z: number, r: number, y0: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  p.solid('woodWarm', { pos: [x, y0 + 0.78, z], size: [2.25, 0.14, 0.78], rot: [0, r, 0] })
  for (const [dx, dz] of [
    [-0.9, -0.25],
    [0.9, -0.25],
    [-0.9, 0.25],
    [0.9, 0.25],
  ] as const) {
    const [px, pz] = at(dx, dz)
    p.box('woodDark', { pos: [px, y0 + 0.38, pz], size: [0.1, 0.76, 0.1], rot: [0, r, 0] })
  }
  for (let index = 0; index < 5; index++) {
    const [px, pz] = at(-0.78 + index * 0.39, 0)
    p.add(cylGeo(10), index % 2 === 0 ? 'ceramicTerracotta' : 'ceramicWhite', {
      pos: [px, y0 + 0.95, pz],
      size: [0.28, 0.22 + (index % 3) * 0.08, 0.28],
    })
  }
}

export function shrineGarden(p: P, x: number, z: number, r: number, y0: number): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  contactPatch(p, x, z, r, y0, 1.15)
  p.add(cylGeo(18), 'concrete', { pos: [x, y0 + 0.18, z], size: [1.65, 0.36, 1.65] })
  p.add(cylGeo(18), 'stoneCounter', { pos: [x, y0 + 0.43, z], size: [1.2, 0.18, 1.2] })
  p.box('woodDark', { pos: [x, y0 + 1.18, z], size: [0.5, 1.42, 0.44], rot: [0, r, 0] })
  p.box('woodPale', { pos: [x, y0 + 1.92, z], size: [1.1, 0.16, 0.76], rot: [-0.08, r, 0] })
  const [frontX, frontZ] = at(0, 0.42)
  p.add(sphereGeo(10), 'lanternGlass', {
    pos: [frontX, y0 + 1.25, frontZ],
    size: [0.28, 0.42, 0.16],
  })
  for (const side of [-0.78, 0.78]) {
    const [px, pz] = at(side, 0.42)
    p.add(sphereGeo(8), side < 0 ? 'leafDeep' : 'weatheringMoss', {
      pos: [px, y0 + 0.46, pz],
      size: [0.65, 0.75, 0.65],
    })
  }
  p.collider({ pos: [x, y0 + 0.72, z], size: [1.4, 1.45, 1.2], rot: [0, r, 0] })
}

export function lanternStand(p: P, x: number, z: number, r: number, y0: number, count = 3): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  for (let index = 0; index < count; index++) {
    const [px, pz] = at((index - (count - 1) / 2) * 0.85, (index % 2) * 0.22)
    const height = 1.15 + (index % 2) * 0.4
    p.box('woodDark', {
      pos: [px, y0 + height / 2, pz],
      size: [0.09, height, 0.09],
      rot: [0, r, 0],
    })
    p.box('metalDark', {
      pos: [px, y0 + height + 0.02, pz],
      size: [0.38, 0.08, 0.38],
      rot: [0, r, 0],
    })
    p.box('lanternGlass', {
      pos: [px, y0 + height - 0.18, pz],
      size: [0.28, 0.42, 0.28],
      rot: [0, r, 0],
    })
    p.box('metalDark', {
      pos: [px, y0 + height - 0.39, pz],
      size: [0.34, 0.06, 0.34],
      rot: [0, r, 0],
    })
  }
}

export function stonePathEdge(
  p: P,
  x: number,
  z: number,
  r: number,
  y0: number,
  length = 3.6,
): void {
  const at = (dx: number, dz: number) => rot(x, z, r, dx, dz)
  const count = Math.max(4, Math.round(length / 0.55))
  for (const side of [-1, 1]) {
    for (let index = 0; index <= count; index++) {
      const [px, pz] = at(-length / 2 + (index / count) * length, side * 0.92)
      p.add(sphereGeo(8), index % 3 === 0 ? 'weatheringMoss' : 'concrete', {
        pos: [px, y0 + 0.09, pz],
        size: [0.5 + (index % 2) * 0.12, 0.2, 0.42],
        rot: [0, r + index * 0.33, 0],
      })
    }
  }
}
