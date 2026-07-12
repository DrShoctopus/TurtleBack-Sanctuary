import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  IcosahedronGeometry,
  CylinderGeometry,
} from 'three'
import { mergeGeometries } from './kit/merge'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { mulberry32, type Rng } from '../core/rng'
import {
  distanceToPath,
  isInsideShell,
  splatWeights,
  terrainHeight,
} from '../world/shell/shellShape'
import { BUILDINGS, EXTRA_PADS, WATER_FEATURES } from '../config/layout'
import { runtime } from '../core/runtime'
import { useSettings } from '../state/settingsStore'

/** true when (x,z) is clear of buildings, pads, paths and water features */
function clearOfStructures(x: number, z: number, margin = 2): boolean {
  if (distanceToPath(x, z) < margin) return false
  for (const b of BUILDINGS) {
    const dx = x - b.x
    const dz = z - b.z
    if (dx * dx + dz * dz < (b.padR - 2) * (b.padR - 2)) return false
  }
  for (const pad of EXTRA_PADS) {
    const dx = x - pad.x
    const dz = z - pad.z
    if (dx * dx + dz * dz < pad.r * pad.r) return false
  }
  for (const w of WATER_FEATURES) {
    const dx = x - w.x
    const dz = z - w.z
    if (dx * dx + dz * dz < (w.r + 1.5) * (w.r + 1.5)) return false
  }
  return true
}

function scatter(
  rng: Rng,
  count: number,
  accept: (x: number, z: number) => boolean,
): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let attempts = count * 6
  while (out.length < count && attempts-- > 0) {
    const x = (rng() * 2 - 1) * 168
    const z = (rng() * 2 - 1) * 248
    if (!isInsideShell(x, z, 0.93)) continue
    if (!accept(x, z)) continue
    out.push([x, z])
  }
  return out
}

/** Broad deterministic habitat fields create meadows, clearings and thickets. */
function habitatDensity(x: number, z: number): number {
  const broad = Math.sin(x * 0.047 + z * 0.021) * 0.28
  const cross = Math.sin(z * 0.064 - x * 0.033 + 1.7) * 0.22
  const pockets = Math.sin(Math.hypot(x + 22, z - 35) * 0.075) * 0.16
  return Math.min(1, Math.max(0, 0.52 + broad + cross + pockets))
}

let windUniform: { value: number } | null = null

function makeSwayMaterial(base: MeshStandardMaterial, strength: number): MeshStandardMaterial {
  base.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.uWind = windUniform ?? (windUniform = { value: 0.5 })
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.47;
          #else
            float ph = 0.0;
          #endif
          float sway = sin(uTime * 1.4 + ph) * ${strength.toFixed(3)} * uWind * max(0.0, transformed.y);
          transformed.x += sway;
          transformed.z += sway * 0.6;
        }`,
      )
    swayShaders.push(shader.uniforms as { uTime: { value: number } })
  }
  return base
}

const swayShaders: Array<{ uTime: { value: number } }> = []

export function Vegetation() {
  const density = useSettings((s) => s.graphics.particleDensity)
  const veg = runtime.quality.vegetationDensity * Math.max(0.4, density)

  const data = useMemo(() => {
    const rng = mulberry32(useSettings.getState().worldSeed ^ 0x7e61)
    return buildVegetation(rng, veg)
  }, [veg])

  useFrame((state) => {
    for (const s of swayShaders) s.uTime.value = state.clock.elapsedTime
    if (windUniform) windUniform.value = 0.35 + runtime.weather.wind * 0.8
  })

  return (
    <>
      <Instanced set={data.grass} />
      <Instanced set={data.flowers} />
      <Instanced set={data.bushes} />
      <Instanced set={data.rocks} />
      <Trees trees={data.trees} />
    </>
  )
}

interface InstSet {
  geometry: BufferGeometry
  material: MeshStandardMaterial
  transforms: Array<{ x: number; y: number; z: number; s: number; ry: number }>
  colors?: Color[]
  shadow?: boolean
}

function Instanced({ set }: { set: InstSet }) {
  const dummy = useMemo(() => new Object3D(), [])
  const ref = useMemo(() => ({ current: null as InstancedMesh | null }), [])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    set.transforms.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z)
      dummy.rotation.set(0, t.ry, 0)
      dummy.scale.setScalar(t.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (set.colors) mesh.setColorAt(i, set.colors[i % set.colors.length])
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [set, dummy, ref])

  if (set.transforms.length === 0 || !set.geometry) return null
  return (
    <instancedMesh
      ref={(el) => {
        ref.current = el
      }}
      args={[set.geometry, set.material, set.transforms.length]}
      castShadow={set.shadow ?? false}
      receiveShadow
      frustumCulled={false}
    />
  )
}

function buildVegetation(rng: Rng, density: number) {
  // Grass is a compact seven-blade tuft. Instancing several blades together
  // makes the meadow feel continuous without increasing draw calls.
  const grassGeo = (() => {
    const merged = makeGrassTuft()
    // vertex-color gradient: darker near root, brighter at tip
    const posAttr = merged.getAttribute('position')
    const cols = new Float32Array(posAttr.count * 3)
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i)
      const t = Math.min(1, y / 0.42)
      const shade = 0.68 + t * 0.48
      cols[i * 3] = shade
      cols[i * 3 + 1] = shade
      cols[i * 3 + 2] = shade
    }
    merged.setAttribute('color', new BufferAttribute(cols, 3))
    return merged
  })()
  // brighter base greens; vertexColors gradient + instanceColor variation
  const grassMat = makeSwayMaterial(
    new MeshStandardMaterial({
      color: '#ffffff',
      side: DoubleSide,
      roughness: 1,
      vertexColors: true,
    }),
    0.05,
  )
  const grassSpots = scatter(rng, Math.floor(8200 * density), (x, z) => {
    if (!clearOfStructures(x, z, 1.6)) return false
    const habitat = habitatDensity(x, z)
    return splatWeights(x, z).grass > 0.3 + rng() * 0.3 && rng() < 0.24 + habitat * 0.9
  })
  const grass: InstSet = {
    geometry: grassGeo,
    material: grassMat,
    transforms: grassSpots.map(([x, z]) => ({
      x,
      y: terrainHeight(x, z) - 0.02,
      z,
      s: 0.66 + rng() * 0.62,
      ry: rng() * Math.PI,
    })),
    colors: [
      new Color('#799e57'),
      new Color('#89ad62'),
      new Color('#6e914f'),
      new Color('#9ab86d'),
    ],
  }

  // flowers: crossed stem-and-petal silhouettes. Unlike an opaque rectangular
  // card, the actual geometry follows the sprig outline from every angle.
  const flowerGeo = makeFlowerSprig()
  const flowerMat = makeSwayMaterial(
    new MeshStandardMaterial({
      color: '#ffffff',
      side: DoubleSide,
      roughness: 0.9,
      vertexColors: true,
    }),
    0.09,
  )
  const flowerSpots = scatter(rng, Math.floor(1400 * density), (x, z) => {
    if (!clearOfStructures(x, z, 1.8)) return false
    const gardenPull = Math.hypot(x + 58, z - 74) < 45 ? 0.25 : 0.62
    return (
      splatWeights(x, z).grass > 0.3 &&
      rng() > gardenPull &&
      rng() < 0.36 + habitatDensity(x, z) * 0.72
    )
  })
  const flowers: InstSet = {
    geometry: flowerGeo,
    material: flowerMat,
    transforms: flowerSpots.map(([x, z]) => ({
      x,
      y: terrainHeight(x, z),
      z,
      s: 0.8 + rng() * 0.7,
      ry: rng() * Math.PI,
    })),
    colors: [
      new Color('#e8a1b4'),
      new Color('#f2c894'),
      new Color('#c4d4f2'),
      new Color('#e8e2f0'),
      new Color('#f2917f'),
    ],
  }

  // Bushes use overlapping lobes instead of isolated geometric balls.
  const bushGeo = makeBushCluster()
  const bushMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 1 })
  const bushSpots = scatter(rng, Math.floor(300 * density), (x, z) => {
    return (
      clearOfStructures(x, z, 2.4) &&
      splatWeights(x, z).grass > 0.4 &&
      rng() < 0.18 + habitatDensity(x, z) * 0.88
    )
  })
  const bushes: InstSet = {
    geometry: bushGeo,
    material: bushMat,
    transforms: bushSpots.map(([x, z]) => {
      const s = 0.5 + rng() * 0.7
      return {
        x,
        y: terrainHeight(x, z) + s * 0.28,
        z,
        s,
        ry: rng() * Math.PI,
      }
    }),
    colors: [
      new Color('#6f9155'),
      new Color('#7d9c62'),
      new Color('#5f8049'),
      new Color('#88a86a'),
    ],
    shadow: true,
  }

  // rocks near ridges and rim
  const rockGeo = new IcosahedronGeometry(0.5, 0)
  const rockMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true })
  const rockSpots = scatter(rng, Math.floor(240 * density), (x, z) => {
    return clearOfStructures(x, z, 2.2) && splatWeights(x, z).rock > 0.32
  })
  const rocks: InstSet = {
    geometry: rockGeo,
    material: rockMat,
    transforms: rockSpots.map(([x, z]) => {
      const s = 0.4 + rng() * 1.0
      return { x, y: terrainHeight(x, z) + s * 0.12, z, s, ry: rng() * Math.PI }
    }),
    colors: [new Color('#8a8072'), new Color('#9a8f7f'), new Color('#786e60')],
    shadow: true,
  }

  // trees: three silhouettes
  const treeSpots = scatter(rng, Math.floor(150 * Math.max(0.55, density)), (x, z) => {
    if (!clearOfStructures(x, z, 3.4)) return false
    const w = splatWeights(x, z)
    return w.grass > 0.25 && w.rock < 0.4 && rng() < 0.12 + habitatDensity(x, z)
  })
  const trees = treeSpots.map(([x, z]) => ({
    x,
    y: terrainHeight(x, z),
    z,
    kind: Math.floor(rng() * 3),
    s: 0.8 + rng() * 0.6,
    ry: rng() * Math.PI * 2,
  }))

  return { grass, flowers, bushes, rocks, trees }
}

function makeGrassTuft(): BufferGeometry {
  const specs = [
    { angle: 0.15, radius: 0.02, height: 0.39, width: 0.052, bend: 0.035 },
    { angle: 0.98, radius: 0.12, height: 0.31, width: 0.046, bend: -0.045 },
    { angle: 1.92, radius: 0.09, height: 0.35, width: 0.05, bend: 0.055 },
    { angle: 2.8, radius: 0.14, height: 0.27, width: 0.043, bend: -0.03 },
    { angle: 3.72, radius: 0.1, height: 0.33, width: 0.048, bend: 0.04 },
    { angle: 4.65, radius: 0.13, height: 0.29, width: 0.044, bend: -0.052 },
    { angle: 5.58, radius: 0.07, height: 0.37, width: 0.05, bend: 0.025 },
  ]
  const blades = specs.map((spec) => {
    const blade = makeTaperedBlade(spec.height, spec.width, spec.bend)
    blade.rotateY(spec.angle)
    blade.translate(Math.cos(spec.angle) * spec.radius, 0, Math.sin(spec.angle) * spec.radius)
    return blade
  })
  const merged = mergeGeometries(blades, false)!
  for (const blade of blades) blade.dispose()
  return merged
}

/** A five-point blade silhouette, wide at the root and tapered to a soft tip. */
function makeTaperedBlade(height: number, width: number, bend: number): BufferGeometry {
  const g = new BufferGeometry()
  const shoulder = height * 0.58
  g.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([
        -width,
        0,
        0,
        width,
        0,
        0,
        width * 0.62 + bend * 0.32,
        shoulder,
        0,
        bend,
        height,
        0,
        -width * 0.62 + bend * 0.32,
        shoulder,
        0,
      ]),
      3,
    ),
  )
  g.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3])
  g.computeVertexNormals()
  return g
}

function makeBushCluster(): BufferGeometry {
  const specs = [
    [0, 0.34, 0, 1, 0.8, 0.95],
    [0.36, 0.28, 0.08, 0.7, 0.62, 0.74],
    [-0.34, 0.26, -0.04, 0.74, 0.58, 0.7],
    [0.08, 0.32, 0.34, 0.66, 0.62, 0.7],
    [-0.08, 0.29, -0.31, 0.62, 0.56, 0.68],
  ] as const
  const lobes = specs.map(([x, y, z, sx, sy, sz]) => {
    const lobe = new IcosahedronGeometry(0.52, 1)
    lobe.scale(sx, sy, sz)
    lobe.translate(x, y, z)
    return lobe
  })
  const merged = mergeGeometries(lobes, false)!
  for (const lobe of lobes) lobe.dispose()
  merged.computeVertexNormals()
  return merged
}

/** Crossed low-poly flower with a narrow green stem and distinct petals. */
function makeFlowerSprig(): BufferGeometry {
  const makeFace = () => {
    const g = new BufferGeometry()
    const positions: number[] = []
    const colors: number[] = []
    const addTri = (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
      color: [number, number, number],
    ) => {
      positions.push(...a, ...b, ...c)
      colors.push(...color, ...color, ...color)
    }
    const green: [number, number, number] = [0.34, 0.58, 0.27]
    const petal: [number, number, number] = [1, 1, 1]
    addTri([-0.016, 0, 0], [0.016, 0, 0], [0.012, 0.31, 0], green)
    addTri([-0.016, 0, 0], [0.012, 0.31, 0], [-0.012, 0.31, 0], green)
    const center: [number, number, number] = [0, 0.33, 0]
    addTri(center, [-0.075, 0.35, 0], [-0.018, 0.38, 0], petal)
    addTri(center, [0.018, 0.38, 0], [0.075, 0.35, 0], petal)
    addTri(center, [-0.035, 0.4, 0], [0, 0.46, 0], petal)
    addTri(center, [0, 0.3, 0], [0.04, 0.27, 0], petal)
    g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    g.computeVertexNormals()
    return g
  }
  const front = makeFace()
  const side = makeFace()
  side.rotateY(Math.PI / 2)
  const merged = mergeGeometries([front, side], false)!
  front.dispose()
  side.dispose()
  return merged
}

// ---------------------------------------------------------------------------

function Trees({
  trees,
}: {
  trees: Array<{ x: number; y: number; z: number; kind: number; s: number; ry: number }>
}) {
  const { geos, mats } = useMemo(() => {
    // kind 0: broadleaf — branching trunk and an asymmetric crown
    const trunk = new CylinderGeometry(0.09, 0.16, 1.6, 7)
    trunk.translate(0, 0.8, 0)
    const branchA = new CylinderGeometry(0.045, 0.075, 0.9, 6)
    branchA.rotateZ(-0.55)
    branchA.translate(0.23, 1.38, 0)
    const branchB = new CylinderGeometry(0.04, 0.07, 0.78, 6)
    branchB.rotateZ(0.62)
    branchB.rotateY(1.2)
    branchB.translate(-0.2, 1.42, 0.12)
    const broadTrunk = mergeGeometries([trunk, branchA, branchB], false)!
    const blob = new IcosahedronGeometry(0.82, 2)
    const c1 = blob.clone()
    c1.scale(1.05, 0.88, 1)
    c1.translate(0, 2.12, 0)
    const c2 = blob.clone()
    c2.scale(0.78, 0.68, 0.78)
    c2.translate(0.62, 1.92, 0.16)
    const c3 = blob.clone()
    c3.scale(0.72, 0.64, 0.76)
    c3.translate(-0.58, 1.95, -0.22)
    const c4 = blob.clone()
    c4.scale(0.65, 0.58, 0.68)
    c4.translate(0.15, 2.48, 0.1)
    const c5 = blob.clone()
    c5.scale(0.62, 0.54, 0.64)
    c5.translate(-0.08, 1.88, 0.58)
    const c6 = blob.clone()
    c6.scale(0.58, 0.52, 0.62)
    c6.translate(0.24, 1.86, -0.56)
    const broadCanopy = mergeGeometries([c1, c2, c3, c4, c5, c6], false)!
    // kind 1: coastal pine — overlapping tapered whorls
    const pTrunk = new CylinderGeometry(0.07, 0.13, 2.0, 7)
    pTrunk.translate(0, 1, 0)
    const cone = (r: number, h: number, y: number) => {
      const c = new CylinderGeometry(0.025, r, h, 12)
      c.translate(0, y, 0)
      return c
    }
    const pineCanopy = mergeGeometries(
      [
        cone(0.92, 0.92, 1.72),
        cone(0.8, 0.9, 2.18),
        cone(0.66, 0.82, 2.62),
        cone(0.5, 0.72, 3.02),
        cone(0.32, 0.58, 3.36),
      ],
      false,
    )!
    // kind 2: dracaena-ish — slim trunk + tufts
    const dTrunk = new CylinderGeometry(0.06, 0.1, 2.4, 6)
    dTrunk.translate(0, 1.2, 0)
    const tuft = new IcosahedronGeometry(0.55, 1)
    const t1 = tuft.clone()
    t1.scale(1, 0.5, 1)
    t1.translate(0, 2.55, 0)
    const t2 = tuft.clone()
    t2.scale(0.7, 0.4, 0.7)
    t2.translate(0.35, 2.3, 0.2)
    const dracCanopy = mergeGeometries([t1, t2], false)!

    const trunkMat = new MeshStandardMaterial({ color: '#6a4e38', roughness: 0.95 })
    const leafMat = new MeshStandardMaterial({ color: '#567d42', roughness: 0.96 })
    const pineMat = new MeshStandardMaterial({ color: '#3f6949', roughness: 0.98 })
    const dracMat = new MeshStandardMaterial({ color: '#628e59', roughness: 0.96 })
    return {
      geos: [
        { trunk: broadTrunk, canopy: broadCanopy },
        { trunk: pTrunk, canopy: pineCanopy },
        { trunk: dTrunk, canopy: dracCanopy },
      ],
      mats: { trunkMat, canopy: [leafMat, pineMat, dracMat] },
    }
  }, [])

  const dummy = useMemo(() => new Object3D(), [])
  const byKind = useMemo(
    () => [
      trees.filter((t) => t.kind === 0),
      trees.filter((t) => t.kind === 1),
      trees.filter((t) => t.kind === 2),
    ],
    [trees],
  )

  return (
    <>
      {byKind.map((list, kind) => (
        <group key={kind}>
          <KindInstances
            list={list}
            geometry={geos[kind].trunk}
            material={mats.trunkMat}
            dummy={dummy}
            shadow
          />
          <KindInstances
            list={list}
            geometry={geos[kind].canopy!}
            material={mats.canopy[kind]}
            dummy={dummy}
            shadow
          />
        </group>
      ))}
      {/* simplified collision: one cylinder per tree */}
      <RigidBody type="fixed" colliders={false}>
        {trees.map((t, i) => (
          <CylinderCollider key={i} args={[1.4, 0.22 * t.s]} position={[t.x, t.y + 1.4, t.z]} />
        ))}
      </RigidBody>
    </>
  )
}

function KindInstances({
  list,
  geometry,
  material,
  dummy,
  shadow,
}: {
  list: Array<{ x: number; y: number; z: number; s: number; ry: number }>
  geometry: NonNullable<ReturnType<typeof mergeGeometries>> | CylinderGeometry
  material: MeshStandardMaterial
  dummy: Object3D
  shadow?: boolean
}) {
  const ref = useMemo(() => ({ current: null as InstancedMesh | null }), [])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    list.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z)
      dummy.rotation.set(0, t.ry, 0)
      dummy.scale.setScalar(t.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [list, dummy, ref])
  if (list.length === 0) return null
  return (
    <instancedMesh
      ref={(el) => {
        ref.current = el
      }}
      args={[geometry as CylinderGeometry, material, list.length]}
      castShadow={shadow}
      receiveShadow
      frustumCulled={false}
    />
  )
}
