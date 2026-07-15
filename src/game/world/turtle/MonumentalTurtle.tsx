import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import {
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { events } from '../../core/events'
import { runtime } from '../../core/runtime'
import { useQualityProfile } from '../../core/useQualityProfile'
import { createPainterlyMaterial } from '../../rendering/painterlyMaterials'
import { useSettings } from '../../state/settingsStore'
import { getSurfaceDetail, getTexture } from '../textures'
import { buildTurtleAnimationPlan } from './animationPlan'
import { MONUMENTAL_TURTLE_CONTRACT } from './heroContract'
import { selectTurtleLod } from './lod'
import type { TurtleLod } from './modelContract'
import { TurtleEventDirector } from './TurtleEventDirector'
import { TurtleWaterResponse } from './TurtleWaterResponse'

const HEAD_WORLD = new Vector3(0, 5, -309)

/**
 * Original code-authored world bearer: a single asymmetrical ancient animal,
 * not a frontal mascot. The analytic shell remains the traversal authority.
 */
export function MonumentalTurtle() {
  const quality = useQualityProfile()
  const seed = useSettings((state) => state.worldSeed)
  const [lod, setLod] = useState<TurtleLod>(() => selectTurtleLod(500, quality.level, 2))
  const lodRef = useRef(lod)
  const geometry = useMemo(() => buildHeroGeometry(lod), [lod])
  const materials = useMemo(buildHeroMaterials, [])
  const director = useRef(new TurtleEventDirector(seed ^ 0x74_75_72_74))
  const elapsed = useRef(0)
  const lastEventId = useRef(0)
  const blink = useRef({ next: 5.8, phase: 0, count: 0 })
  const bodyRef = useRef<Group>(null)
  const neckRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const jawRef = useRef<Group>(null)
  const eyelidL = useRef<Mesh>(null)
  const eyelidR = useRef<Mesh>(null)
  const pupilL = useRef<Mesh>(null)
  const pupilR = useRef<Mesh>(null)
  const nostrilL = useRef<Mesh>(null)
  const nostrilR = useRef<Mesh>(null)
  const flipperFL = useRef<Group>(null)
  const flipperFR = useRef<Group>(null)
  const flipperBL = useRef<Group>(null)
  const flipperBR = useRef<Group>(null)
  const lodAccumulator = useRef(0)

  useEffect(() => {
    director.current.reset(seed ^ 0x74_75_72_74)
  }, [seed])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => Object.values(materials).forEach((material) => material.dispose()),
    [materials],
  )

  useFrame((state, dt) => {
    elapsed.current += Math.max(0, Number.isFinite(dt) ? dt : 0)
    lodAccumulator.current += dt
    if (lodAccumulator.current >= 0.25) {
      lodAccumulator.current = 0
      const next = selectTurtleLod(state.camera.position.distanceTo(HEAD_WORLD), quality.level, lodRef.current)
      if (next !== lodRef.current) {
        lodRef.current = next
        setLod(next)
      }
    }

    const time = elapsed.current
    const vista = runtime.player.pos.z < -150 && Math.abs(runtime.player.pos.x) < 168
    const activeEvent = director.current.update(dt, {
      elapsedTime: time,
      playerInVista: vista,
      rain: runtime.weather.rain,
      reducedMotion: runtime.reducedMotion,
    })
    if (activeEvent && activeEvent.id !== lastEventId.current) {
      lastEventId.current = activeEvent.id
      events.emit('turtleScaleEvent', activeEvent)
    }

    const blinkState = blink.current
    blinkState.next -= dt
    if (blinkState.next <= 0) {
      blinkState.phase = 0.34
      blinkState.count += 1
      blinkState.next = 5.1 + ((blinkState.count * 3.17) % 7.2)
    }
    const blinkWeight =
      blinkState.phase > 0 ? Math.sin((1 - blinkState.phase / 0.34) * Math.PI) : 0
    blinkState.phase = Math.max(0, blinkState.phase - dt)

    const plan = buildTurtleAnimationPlan({
      dt,
      comfortTime: time,
      reducedMotion: runtime.reducedMotion,
      player: [runtime.player.pos.x, runtime.player.pos.y, runtime.player.pos.z],
      rain: runtime.weather.rain,
      blink: blinkWeight,
      event: activeEvent,
    })
    runtime.turtle.lod = lodRef.current
    runtime.turtle.breath = plan.clipWeights.Idle_Breathe
    runtime.turtle.stroke = plan.clipWeights.Swim_Stroke
    runtime.turtle.wakeStrength = plan.wakeStrength
    runtime.turtle.foliageImpulse = plan.foliageImpulse
    runtime.turtle.resonanceStrength = plan.resonanceStrength
    runtime.turtle.sprayStrength = plan.sprayStrength
    runtime.turtle.activeEvent = activeEvent

    const breath = plan.clipWeights.Idle_Breathe - 0.62
    const stroke = plan.clipWeights.Swim_Stroke
    const neckDrift = plan.clipWeights.Neck_Drift
    const headTurn = plan.clipWeights.Head_Turn
    if (bodyRef.current) bodyRef.current.scale.y = 1 + breath * 0.06
    if (neckRef.current) {
      neckRef.current.rotation.y = Math.sin(time * 0.21) * 0.09 * neckDrift
      neckRef.current.rotation.x = Math.sin(time * 0.13) * 0.025 * neckDrift
      neckRef.current.scale.set(1 + breath * 0.018, 1 + breath * 0.028, 1 + breath * 0.018)
    }
    if (headRef.current) {
      headRef.current.rotation.y =
        -1.0 + plan.gazeTarget[0] * 0.42 + Math.sin(time * 0.085) * 0.16 * headTurn
      headRef.current.rotation.x = -0.025 + Math.sin(time * 0.12 + 0.8) * 0.055 * headTurn
      headRef.current.position.y = 8 + Math.sin(time * 0.19) * 0.65 * neckDrift
    }
    if (jawRef.current) jawRef.current.rotation.x = plan.clipWeights.Jaw_Micro * 0.055
    setLid(eyelidL.current, blinkWeight, -1)
    setLid(eyelidR.current, blinkWeight, 1)
    setPupil(pupilL.current, -29.35, plan.gazeTarget)
    setPupil(pupilR.current, 29.35, plan.gazeTarget)
    const nostrilPulse = 1 + plan.clipWeights.Nostril_Micro * 0.18
    nostrilL.current?.scale.setScalar(nostrilPulse)
    nostrilR.current?.scale.setScalar(nostrilPulse * 0.96)

    animateFlippers(time, stroke, flipperFL.current, flipperFR.current, flipperBL.current, flipperBR.current)

    materials.skin.roughness = 0.9 - plan.wetness * 0.34
    materials.keratin.roughness = 0.86 - plan.wetness * 0.29
    materials.algae.roughness = 0.98 - plan.wetness * 0.44
  })

  const sideBarnacles = BARNACLES.filter((barnacle) => barnacle[1] < 12)
  const sideAlgae = ALGAE_PATCHES.filter((patch) => patch[1] < 12)
  const barnacles = sideBarnacles.slice(0, lod === 0 ? 9 : lod === 1 ? 6 : 2)
  const algae = sideAlgae.slice(0, lod === 0 ? sideAlgae.length : lod === 1 ? 4 : 2)

  return (
    <group
      name="WorldRoot"
      userData={{
        turtleHero: true,
        lod,
        contract: MONUMENTAL_TURTLE_CONTRACT,
        traversalCollision: false,
      }}
    >
      <group ref={bodyRef} name="Body">
        <mesh
          name="ShellSkirt"
          geometry={geometry.shellSkirt}
          material={materials.hide}
          position={[0, -7, 3]}
          receiveShadow
        />
        <mesh
          geometry={geometry.body}
          material={materials.hide}
          position={[0, -22, 7]}
          scale={[181, 36, 270]}
          receiveShadow
        />
      </group>

      <group ref={neckRef} name="Neck" position={[0, -3, -244]}>
        <mesh
          geometry={geometry.neck}
          material={materials.skin}
          position={[0, 0, -27]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        />
        {NECK_FOLDS.slice(0, lod === 2 ? 3 : NECK_FOLDS.length).map((fold) => (
          <mesh
            key={fold.z}
            geometry={geometry.fold}
            material={materials.fold}
            position={[fold.x, fold.y, fold.z]}
            scale={[fold.radius, fold.radius * fold.squash, 1]}
            rotation={[fold.tilt, 0, fold.roll]}
          />
        ))}

        <group ref={headRef} name="Head" position={[0, 8, -65]} rotation={[0, -1.0, 0]}>
          <mesh geometry={geometry.head} material={materials.skin} scale={[29, 19, 34]} castShadow receiveShadow />

          <mesh
            name="HeavyBrow_L"
            geometry={geometry.brow}
            material={materials.brow}
            position={[-25.8, 7.4, 4.8]}
            rotation={[0.08, -0.22, -0.12]}
            scale={[3.4, 2.45, 5.9]}
            castShadow
          />
          <mesh
            name="HeavyBrow_R"
            geometry={geometry.brow}
            material={materials.brow}
            position={[25.9, 6.8, 5.4]}
            rotation={[0.03, 0.19, 0.08]}
            scale={[3.2, 2.3, 5.6]}
            castShadow
          />

          <group name="EyeFocus">
            <group name="Eye_L">
              <mesh geometry={geometry.eye} material={materials.eye} position={[-28.15, 3.35, 8.2]} scale={[1.05, 1.32, 1.68]} />
              <mesh ref={pupilL} geometry={geometry.eye} material={materials.pupil} position={[-29.15, 3.3, 8.72]} scale={[0.34, 0.68, 0.55]} />
            </group>
            <group name="Eye_R">
              <mesh geometry={geometry.eye} material={materials.eye} position={[28.15, 3.15, 8.5]} scale={[1.0, 1.25, 1.62]} />
              <mesh ref={pupilR} geometry={geometry.eye} material={materials.pupil} position={[29.15, 3.1, 9.02]} scale={[0.32, 0.64, 0.52]} />
            </group>
          </group>
          <mesh ref={eyelidL} name="Eyelid_L" geometry={geometry.eye} material={materials.skin} position={[-28.7, 4.25, 8.5]} scale={[1.05, 0.35, 1.85]} />
          <mesh ref={eyelidR} name="Eyelid_R" geometry={geometry.eye} material={materials.skin} position={[28.7, 4.05, 8.8]} scale={[1.0, 0.33, 1.78]} />

          <mesh
            name="UpperBeak"
            geometry={geometry.beak}
            material={materials.keratin}
            position={[0, -3.8, -25.7]}
            rotation={[0.04, -0.015, 0]}
            castShadow
          />
          <group ref={jawRef} name="Jaw" position={[0, -10.2, -22.3]} rotation={[0.02, 0, -0.015]}>
            <mesh geometry={geometry.jaw} material={materials.jaw} castShadow />
          </group>
          <mesh ref={nostrilL} name="Nostril_L" geometry={geometry.nostril} material={materials.nostril} position={[-3.4, -1.35, -39.4]} scale={[0.62, 0.28, 0.24]} />
          <mesh ref={nostrilR} name="Nostril_R" geometry={geometry.nostril} material={materials.nostril} position={[5.2, -2.3, -37.7]} scale={[0.42, 0.2, 0.18]} />

          {geometry.scars.map((scar, index) => (
            <mesh key={index} geometry={scar} material={materials.scar} position={[0, 0, 0]} />
          ))}
          <DetailInstances
            name="HeadAlgaePatches"
            geometry={geometry.algaePatch}
            material={materials.algae}
            transforms={algae}
            yOffset={-1.1}
          />
          <DetailInstances
            name="HeadBarnacleCluster"
            geometry={geometry.barnacle}
            material={materials.barnacle}
            transforms={barnacles}
            yOffset={-1.6}
          />
        </group>
      </group>

      <Flipper name="Flipper_FL" target={flipperFL} geometry={geometry.flipperLeft} material={materials.skin} position={[-142, -5, -88]} meshPosition={[-36, 1, -2]} scale={[58, 10, 29]} rotation={[0.04, 0.82, 0.24]} />
      <Flipper name="Flipper_FR" target={flipperFR} geometry={geometry.flipperRight} material={materials.skin} position={[142, -5, -88]} meshPosition={[36, 0.4, 1]} scale={[61, 10.5, 31]} rotation={[-0.03, -0.78, -0.2]} />
      <Flipper name="Flipper_BL" target={flipperBL} geometry={geometry.flipperLeft} material={materials.skin} position={[-121, -10, 178]} meshPosition={[-28, 0, 4]} scale={[44, 7, 22]} rotation={[0, -0.57, 0.12]} />
      <Flipper name="Flipper_BR" target={flipperBR} geometry={geometry.flipperRight} material={materials.skin} position={[121, -10, 178]} meshPosition={[29, 0, 2]} scale={[46, 7.5, 23]} rotation={[0, 0.62, -0.1]} />
      <mesh geometry={geometry.tail} material={materials.hide} position={[0, -13, 269]} scale={[15, 8, 23]} />

      <TurtleCollisionProxy />
      <TurtleWaterResponse />
    </group>
  )
}

function Flipper({
  name,
  target,
  geometry,
  material,
  position,
  meshPosition,
  scale,
  rotation,
}: {
  name: string
  target: React.RefObject<Group | null>
  geometry: BufferGeometry
  material: MeshStandardMaterial
  position: [number, number, number]
  meshPosition: [number, number, number]
  scale: [number, number, number]
  rotation: [number, number, number]
}) {
  return (
    <group ref={target} name={name} position={position} rotation={rotation}>
      <mesh geometry={geometry} material={material} position={meshPosition} scale={scale} castShadow receiveShadow />
    </group>
  )
}

function DetailInstances({
  name,
  geometry,
  material,
  transforms,
  yOffset,
}: {
  name: string
  geometry: BufferGeometry
  material: MeshStandardMaterial
  transforms: readonly (readonly number[])[]
  yOffset: number
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new Object3D()
    mesh.count = transforms.length
    transforms.forEach((transform, index) => {
      dummy.position.set(transform[0], transform[1] + yOffset, transform[2])
      dummy.rotation.set(transform[3], transform[4], transform[5])
      if (transform.length >= 9) dummy.scale.set(transform[6], transform[7], transform[8])
      else dummy.scale.setScalar(transform[6])
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
  }, [transforms, yOffset])
  return (
    <instancedMesh
      ref={ref}
      name={name}
      args={[geometry, material, Math.max(1, transforms.length)]}
      castShadow
      receiveShadow
    />
  )
}

function TurtleCollisionProxy() {
  return (
    <RigidBody name="TurtleCollision" type="fixed" colliders={false} userData={{ traversalCollision: false }}>
      <CuboidCollider name="HeadCollision" args={[27, 18, 34]} position={[0, 3, -315]} />
      <CuboidCollider name="NeckCollision" args={[15, 12, 33]} position={[0, -17, -269]} />
      <CuboidCollider name="FlipperCollision_L" args={[48, 7, 27]} position={[-190, -13, -90]} rotation={[0, 0.34, 0]} />
      <CuboidCollider name="FlipperCollision_R" args={[49, 7, 28]} position={[190, -13, -90]} rotation={[0, -0.31, 0]} />
    </RigidBody>
  )
}

function setLid(lid: Mesh | null, closed: number, side: -1 | 1): void {
  if (!lid) return
  lid.scale.y = 0.35 + closed * 1.72
  lid.position.y = (side < 0 ? 4.25 : 4.05) - closed * 1.05
  lid.rotation.z = side * (0.08 + closed * 0.03)
}

function setPupil(
  pupil: Mesh | null,
  baseX: number,
  gaze: readonly [number, number, number],
): void {
  if (!pupil) return
  pupil.position.x = baseX + gaze[0] * 2.4
  pupil.position.y += (3.2 + gaze[1] * 1.1 - pupil.position.y) * 0.04
}

function animateFlippers(
  time: number,
  stroke: number,
  frontLeft: Group | null,
  frontRight: Group | null,
  backLeft: Group | null,
  backRight: Group | null,
): void {
  const wave = Math.sin(time * 0.52)
  if (frontLeft) {
    frontLeft.rotation.z = 0.24 + wave * 0.23 * stroke
    frontLeft.rotation.x = 0.04 + Math.sin(time * 0.52 + 0.6) * 0.1 * stroke
  }
  if (frontRight) {
    frontRight.rotation.z = -0.2 - Math.sin(time * 0.52 + 0.38) * 0.2 * stroke
    frontRight.rotation.x = -0.03 + Math.sin(time * 0.52 + 1.02) * 0.11 * stroke
  }
  if (backLeft) backLeft.rotation.z = 0.12 + Math.sin(time * 0.34 + 2.2) * 0.1 * stroke
  if (backRight) backRight.rotation.z = -0.1 - Math.sin(time * 0.34 + 2.75) * 0.09 * stroke
}

interface HeroGeometry {
  body: BufferGeometry
  shellSkirt: BufferGeometry
  neck: BufferGeometry
  head: BufferGeometry
  brow: BufferGeometry
  eye: BufferGeometry
  beak: BufferGeometry
  jaw: BufferGeometry
  nostril: BufferGeometry
  flipperLeft: BufferGeometry
  flipperRight: BufferGeometry
  fold: BufferGeometry
  scar: BufferGeometry
  scars: BufferGeometry[]
  algaePatch: BufferGeometry
  barnacle: BufferGeometry
  tail: BufferGeometry
  dispose(): void
}

function buildHeroGeometry(lod: TurtleLod): HeroGeometry {
  const segments = lod === 0 ? [64, 40] : lod === 1 ? [40, 24] : [22, 14]
  const head = sculptSphere(2.17, segments[0], segments[1], 'head')
  const body = sculptSphere(1.21, Math.max(18, segments[0] / 2), Math.max(12, segments[1] / 2), 'body')
  const flipperLeft = sculptFlipper(-1, segments[0], Math.max(12, segments[1] / 2))
  const flipperRight = sculptFlipper(1, segments[0], Math.max(12, segments[1] / 2))
  const neck = new LatheGeometry(
    [
      new Vector2(15.8, -35),
      new Vector2(15.4, -28),
      new Vector2(13.8, -17),
      new Vector2(12.2, -5),
      new Vector2(11.4, 7),
      new Vector2(12.7, 18),
      new Vector2(15.2, 30),
    ],
    lod === 0 ? 48 : lod === 1 ? 30 : 18,
  )
  const shellSkirt = new CylinderGeometry(1, 1.055, 22, lod === 0 ? 96 : lod === 1 ? 64 : 32, 4, true)
  shellSkirt.scale(176, 1, 257)
  const brow = new DodecahedronGeometry(1, lod === 0 ? 2 : lod === 1 ? 1 : 0)
  const eye = new SphereGeometry(1, lod === 0 ? 28 : 16, lod === 0 ? 18 : 10)
  const beak = makeBeakGeometry(1)
  const jaw = makeBeakGeometry(-1)
  jaw.scale(0.88, 0.52, 0.84)
  jaw.rotateX(Math.PI)
  const nostril = new DodecahedronGeometry(1, 0)
  const fold = new TorusGeometry(1, 0.018, lod === 0 ? 8 : 5, lod === 0 ? 48 : 24)
  const algaePatch = new DodecahedronGeometry(1, lod === 0 ? 2 : 1)
  const barnacle = new ConeGeometry(1, 1.2, lod === 0 ? 8 : 6, 1, false)
  const tail = sculptSphere(5.2, Math.max(18, segments[0] / 2), Math.max(12, segments[1] / 2), 'body')
  const scars = makeScarGeometry(lod)
  const scar = scars[0]
  const all = [body, shellSkirt, neck, head, brow, eye, beak, jaw, nostril, flipperLeft, flipperRight, fold, algaePatch, barnacle, tail, ...scars]
  return {
    body,
    shellSkirt,
    neck,
    head,
    brow,
    eye,
    beak,
    jaw,
    nostril,
    flipperLeft,
    flipperRight,
    fold,
    scar,
    scars,
    algaePatch,
    barnacle,
    tail,
    dispose: () => all.forEach((entry) => entry.dispose()),
  }
}

function sculptSphere(
  seed: number,
  width: number,
  height: number,
  kind: 'head' | 'body',
): SphereGeometry {
  const geometry = new SphereGeometry(1, width, height)
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index += 1) {
    let x = positions.getX(index)
    let y = positions.getY(index)
    let z = positions.getZ(index)
    const ripple =
      Math.sin(x * 8.1 + y * 5.7 + seed) * 0.018 +
      Math.sin(z * 11.3 - y * 6.4 + seed * 1.7) * 0.012
    if (kind === 'head') {
      const fore = Math.max(0, Math.min(1, (-z - 0.05) / 0.95))
      x *= 1 - fore * 0.24
      y *= 1 - fore * 0.18
      if (y > 0.48) y = 0.48 + (y - 0.48) * 0.52
      x += (0.025 + fore * 0.018) * (1 - y * y)
      z *= 1 + (1 - Math.abs(x)) * 0.05
    } else {
      y *= 0.92 + Math.abs(z) * 0.08
    }
    const scale = 1 + ripple
    positions.setXYZ(index, x * scale, y * scale, z * scale)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function sculptFlipper(direction: -1 | 1, width: number, height: number): SphereGeometry {
  const geometry = new SphereGeometry(1, width, height)
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const tip = Math.max(0, Math.min(1, (direction * x + 0.18) / 1.18))
    const taper = 1 - tip * 0.62
    const swept = z + direction * Math.pow(tip, 1.6) * 0.24
    const edge = Math.sin((x + 1) * 4.6) * 0.045 * (1 - Math.abs(y))
    positions.setXYZ(index, x, y * taper, (swept + edge) * taper)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function makeBeakGeometry(hook: 1 | -1): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setFromPoints([
    new Vector3(-15, 4, 4),
    new Vector3(15, 4, 4),
    new Vector3(-12, -2, 4),
    new Vector3(12, -2, 4),
    new Vector3(-6.4, 2.4, -13),
    new Vector3(6.4, 2.4, -13),
    new Vector3(-4.2, -4.2, -11),
    new Vector3(4.2, -4.2, -11),
    new Vector3(0, -7.6 * hook, -24),
  ])
  geometry.setIndex([
    0, 2, 1, 1, 2, 3, 0, 1, 5, 0, 5, 4, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5,
    2, 6, 7, 2, 7, 3, 4, 5, 8, 5, 7, 8, 7, 6, 8, 6, 4, 8,
  ])
  geometry.computeVertexNormals()
  return geometry
}

function makeScarGeometry(lod: TurtleLod): BufferGeometry[] {
  const paths = [
    [new Vector3(23.2, 8, 13), new Vector3(25.1, 3, 16), new Vector3(24.4, -2, 18)],
    [new Vector3(20.8, 7, 15), new Vector3(23.1, 2, 18), new Vector3(22.6, -3, 20)],
    [new Vector3(25.2, 7, 9), new Vector3(27.0, 2.5, 12), new Vector3(26.1, -1.5, 14)],
  ]
  return paths.slice(0, lod === 0 ? 3 : lod === 1 ? 2 : 1).map(
    (points) =>
      new TubeGeometry(
        new CatmullRomCurve3(points),
        lod === 0 ? 24 : 12,
        lod === 0 ? 0.075 : 0.11,
        lod === 0 ? 7 : 5,
        false,
      ),
  )
}

function buildHeroMaterials() {
  const skinTexture = getTexture('turtleSkin')
  const detail = getSurfaceDetail('turtleSkin')
  const shellTexture = getTexture('shellRock')
  const skin = createPainterlyMaterial('turtleSkin', {
    color: '#d4dac5',
    roughness: 0.88,
    map: skinTexture,
    normalMap: detail.normalMap,
    roughnessMap: detail.roughnessMap,
    normalScale: new Vector2(0.54, 0.54),
  })
  const hide = createPainterlyMaterial('rock', {
    color: '#4a5147',
    roughness: 0.95,
    map: shellTexture,
  })
  const keratin = createPainterlyMaterial('turtleSkin', {
    color: '#b7a77c',
    roughness: 0.86,
    map: shellTexture,
    normalMap: detail.normalMap,
    normalScale: new Vector2(0.24, 0.24),
  })
  const jaw = createPainterlyMaterial('turtleSkin', { color: '#746b55', roughness: 0.92 })
  const brow = createPainterlyMaterial('turtleSkin', { color: '#829078', roughness: 0.94 })
  const fold = createPainterlyMaterial('turtleSkin', { color: '#536052', roughness: 0.96 })
  const algae = createPainterlyMaterial('foliage', { color: '#3f624b', roughness: 0.98 })
  const barnacle = createPainterlyMaterial('rock', { color: '#c8bea0', roughness: 0.96 })
  const scar = createPainterlyMaterial('turtleSkin', { color: '#554f43', roughness: 0.94 })
  const eye = new MeshStandardMaterial({
    color: '#91733a',
    emissive: '#2c210d',
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0,
  })
  const pupil = new MeshStandardMaterial({ color: '#11150f', roughness: 0.82, metalness: 0 })
  const nostril = new MeshStandardMaterial({ color: '#242a23', roughness: 0.94 })
  return { skin, hide, keratin, jaw, brow, fold, algae, barnacle, scar, eye, pupil, nostril }
}

const NECK_FOLDS = [
  { x: -0.8, y: -0.4, z: -49, radius: 14.2, squash: 0.92, tilt: 0.03, roll: -0.08 },
  { x: 0.5, y: 0.2, z: -40, radius: 13.4, squash: 0.88, tilt: -0.025, roll: 0.06 },
  { x: -0.3, y: -0.5, z: -31, radius: 12.5, squash: 0.9, tilt: 0.02, roll: -0.04 },
  { x: 0.7, y: 0.1, z: -21, radius: 11.8, squash: 0.86, tilt: -0.018, roll: 0.08 },
  { x: -0.5, y: -0.25, z: -11, radius: 12.6, squash: 0.9, tilt: 0.025, roll: -0.05 },
  { x: 0.2, y: 0, z: -2, radius: 14.1, squash: 0.93, tilt: -0.015, roll: 0.03 },
] as const

const ALGAE_PATCHES = [
  [-22.5, 8.5, -8.5, 0.1, 0.2, -0.2, 5.8, 1.2, 4.6],
  [-25.8, 1.2, -2.5, 0.3, 0.1, 0.4, 4.8, 1.0, 6.1],
  [-19.2, -7.4, -18.6, -0.4, 0.2, -0.2, 3.6, 0.8, 4.7],
  [14.4, 12.8, 1.2, 0.1, -0.2, 0.4, 3.8, 0.7, 4.2],
  [-7.2, 16.5, -6.4, 0.1, 0.1, 0, 5.2, 0.65, 3.2],
  [24.8, -4.2, -6.5, -0.2, -0.1, 0.3, 2.8, 0.6, 3.9],
  [-13.2, 12.4, 13.5, 0.2, 0, -0.3, 4.2, 0.7, 4.8],
] as const

const BARNACLES = [
  [-23.8, 11.2, -2.2, 0.2, 0, -0.8, 1.25],
  [-25.1, 8.5, -5.1, 0.1, 0.2, -0.9, 0.9],
  [-20.6, 14.8, 2.8, -0.3, 0.1, -0.6, 1.05],
  [-27.1, 3.6, -1.8, 0.4, -0.1, -1.0, 0.72],
  [-18.2, 16.1, -5.3, -0.1, 0.3, -0.55, 0.66],
  [-25.8, -0.2, -10.4, 0.4, 0.1, -1.1, 0.82],
  [-16.4, 12.7, -13.5, 0.1, -0.2, -0.35, 0.58],
  [-11.2, 17.2, -1.2, -0.2, 0.1, -0.2, 0.9],
  [18.8, 14.8, 3.4, -0.25, 0, 0.5, 0.7],
  [23.2, 9.1, -1.8, 0.1, -0.2, 0.8, 0.62],
  [-26.7, 6.2, 1.4, 0.2, 0.1, -1.0, 0.5],
  [-21.5, 4.4, -14.9, 0.1, -0.15, -0.7, 0.76],
  [16.1, 16.7, -2.8, -0.1, 0.1, 0.35, 0.52],
  [-14.6, 15.7, 7.8, -0.2, 0.2, -0.3, 0.64],
  [-24.3, -3.2, -4.1, 0.4, 0.1, -1.0, 0.56],
  [11.8, 17.4, 4.5, -0.2, 0, 0.25, 0.48],
] as const
