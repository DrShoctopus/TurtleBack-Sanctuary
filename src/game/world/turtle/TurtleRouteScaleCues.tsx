import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from 'three'
import { registerProbeSection } from '../../debug/probes'
import { ComfortMotionClock } from '../../core/comfortMotion'
import { runtime } from '../../core/runtime'
import { terrainHeight } from '../shell/shellShape'

export interface TurtleRouteScaleCue {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly yaw: number
  readonly turtleFeature: 'brow' | 'neck' | 'front-flipper' | 'shell-breath' | 'wake' | 'body'
}

/** Human-scale route markers repeat beside vast turtle features in ordinary play. */
export const TURTLE_ROUTE_SCALE_CUES: readonly TurtleRouteScaleCue[] = Object.freeze([
  { id: 'arrival-brow-marker', x: -25, z: -201, yaw: 0.28, turtleFeature: 'brow' },
  { id: 'crownwood-neck-marker', x: -143, z: -53, yaw: 1.42, turtleFeature: 'neck' },
  { id: 'east-flipper-marker', x: 143, z: 43, yaw: -1.46, turtleFeature: 'front-flipper' },
  { id: 'galecrest-wake-marker', x: 104, z: -210, yaw: -0.72, turtleFeature: 'wake' },
  { id: 'garden-breath-marker', x: -133, z: 92, yaw: 1.2, turtleFeature: 'shell-breath' },
  { id: 'observatory-body-marker', x: 30, z: 213, yaw: 2.92, turtleFeature: 'body' },
])

const RIBBON_COLORS = ['#c8755f', '#d7aa6b', '#5f9b91', '#b56f63', '#d0a15f', '#65958f']

export function TurtleRouteScaleCues() {
  const polesRef = useRef<InstancedMesh>(null)
  const ribbonsRef = useRef<InstancedMesh>(null)
  const basesRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const motionClock = useRef(new ComfortMotionClock())
  const poleGeometry = useMemo(() => new CylinderGeometry(0.055, 0.095, 3.8, 7), [])
  const ribbonGeometry = useMemo(() => new PlaneGeometry(1.35, 1.8, 3, 2), [])
  const baseGeometry = useMemo(() => new DodecahedronGeometry(0.34, 0), [])
  const poleMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#493b2f', roughness: 0.92 }),
    [],
  )
  const ribbonMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.84, side: DoubleSide }),
    [],
  )
  const baseMaterial = useMemo(
    () => new MeshStandardMaterial({ color: '#697064', roughness: 0.96 }),
    [],
  )

  useEffect(
    () =>
      registerProbeSection('atmosphere', 'turtle-route-scale-cues', () => ({
        turtleRouteScaleCues: TURTLE_ROUTE_SCALE_CUES.length,
        turtleRouteFeatures: TURTLE_ROUTE_SCALE_CUES.map((cue) => cue.turtleFeature),
      })),
    [],
  )

  useEffect(
    () => () => {
      poleGeometry.dispose()
      ribbonGeometry.dispose()
      baseGeometry.dispose()
      poleMaterial.dispose()
      ribbonMaterial.dispose()
      baseMaterial.dispose()
    },
    [baseGeometry, baseMaterial, poleGeometry, poleMaterial, ribbonGeometry, ribbonMaterial],
  )

  useLayoutEffect(() => {
    const poles = polesRef.current
    const ribbons = ribbonsRef.current
    const bases = basesRef.current
    if (!poles || !ribbons || !bases) return
    TURTLE_ROUTE_SCALE_CUES.forEach((cue, index) => {
      const y = terrainHeight(cue.x, cue.z)
      dummy.position.set(cue.x, y + 1.9, cue.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      poles.setMatrixAt(index, dummy.matrix)

      dummy.position.set(cue.x, y + 3.05, cue.z)
      dummy.rotation.set(0, cue.yaw, index % 2 === 0 ? -0.08 : 0.06)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      ribbons.setMatrixAt(index, dummy.matrix)
      ribbons.setColorAt(index, new Color(RIBBON_COLORS[index]))

      dummy.position.set(cue.x, y + 0.2, cue.z)
      dummy.rotation.set(0, cue.yaw, 0)
      dummy.scale.set(1.25, 0.58, 1.1)
      dummy.updateMatrix()
      bases.setMatrixAt(index, dummy.matrix)
    })
    poles.instanceMatrix.needsUpdate = true
    ribbons.instanceMatrix.needsUpdate = true
    if (ribbons.instanceColor) ribbons.instanceColor.needsUpdate = true
    bases.instanceMatrix.needsUpdate = true
  }, [dummy])

  useFrame((_, dt) => {
    const ribbons = ribbonsRef.current
    if (!ribbons) return
    const time = motionClock.current.advance(dt, runtime.reducedMotion, 0.12)
    TURTLE_ROUTE_SCALE_CUES.forEach((cue, index) => {
      const y = terrainHeight(cue.x, cue.z)
      const flutter = Math.sin(time * 0.7 + index * 1.71) * (runtime.reducedMotion ? 0.025 : 0.075)
      dummy.position.set(cue.x, y + 3.05, cue.z)
      dummy.rotation.set(0, cue.yaw + flutter * 0.3, (index % 2 === 0 ? -0.08 : 0.06) + flutter)
      dummy.scale.set(1 + flutter * 0.08, 1, 1)
      dummy.updateMatrix()
      ribbons.setMatrixAt(index, dummy.matrix)
    })
    ribbons.instanceMatrix.needsUpdate = true
  })

  return (
    <group name="TurtleRouteScaleCues" userData={{ traversalCollision: false }}>
      <instancedMesh
        ref={basesRef}
        args={[baseGeometry, baseMaterial, TURTLE_ROUTE_SCALE_CUES.length]}
      />
      <instancedMesh
        ref={polesRef}
        args={[poleGeometry, poleMaterial, TURTLE_ROUTE_SCALE_CUES.length]}
      />
      <instancedMesh
        ref={ribbonsRef}
        args={[ribbonGeometry, ribbonMaterial, TURTLE_ROUTE_SCALE_CUES.length]}
      />
    </group>
  )
}
