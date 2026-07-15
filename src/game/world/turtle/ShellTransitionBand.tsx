import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { mulberry32 } from '../../core/rng'
import { runtime } from '../../core/runtime'
import { terrainHeight } from '../shell/shellShape'
import { sampleShellTransitionAnchors } from './shellAlignment'

interface TransitionBandResources {
  readonly plates: InstancedMesh
  readonly roots: InstancedMesh
  readonly algae: InstancedMesh
  readonly seam: Mesh
  dispose(): void
}

const UP = new Vector3(0, 1, 0)

function buildTransitionBand(): TransitionBandResources {
  const anchors = sampleShellTransitionAnchors(128)
  const rng = mulberry32(0x74_75_72_74)
  const plateGeometry = new DodecahedronGeometry(1, 1)
  const rootGeometry = new CylinderGeometry(0.34, 0.72, 1, 7, 4, false)
  const algaeGeometry = new SphereGeometry(1, 12, 6)
  const plateMaterial = new MeshStandardMaterial({
    color: '#586058',
    roughness: 0.92,
    metalness: 0,
    vertexColors: true,
  })
  const rootMaterial = new MeshStandardMaterial({
    color: '#313b2e',
    roughness: 0.96,
    metalness: 0,
  })
  const algaeMaterial = new MeshStandardMaterial({
    color: '#304b36',
    roughness: 0.98,
    metalness: 0,
    vertexColors: true,
  })
  const seamMaterial = new MeshStandardMaterial({
    color: '#13251f',
    emissive: '#4fb99b',
    emissiveIntensity: 0,
    roughness: 0.8,
    metalness: 0,
    toneMapped: false,
  })

  const plates = new InstancedMesh(plateGeometry, plateMaterial, anchors.length)
  plates.name = 'ShellTransitionGeology'
  plates.castShadow = true
  plates.receiveShadow = true
  plates.userData.traversalCollision = false
  plates.userData.materialFamily = 'shell-transition'
  const dummy = new Object3D()
  const tint = new Color()
  for (const anchor of anchors) {
    const bowReveal = Math.max(0, Math.min(1, (-anchor.z - 145) / 95))
    const inset = 0.979 + rng() * 0.012
    const x = anchor.x * inset
    const z = anchor.z * inset
    dummy.position.set(x, terrainHeight(x, z) + 0.1 + rng() * 0.18, z)
    dummy.rotation.set((rng() - 0.5) * 0.18, -anchor.theta + (rng() - 0.5) * 0.12, 0)
    dummy.scale.set(
      (2.1 + rng() * 2.4) * (1 - bowReveal * 0.92),
      (0.34 + rng() * 0.65) * (1 - bowReveal * 0.86),
      (2.8 + rng() * 4.4) * (1 - bowReveal * 0.94),
    )
    dummy.updateMatrix()
    plates.setMatrixAt(anchor.index, dummy.matrix)
    tint.setRGB(0.69 + rng() * 0.14, 0.72 + rng() * 0.12, 0.66 + rng() * 0.13)
    plates.setColorAt(anchor.index, tint)
  }
  plates.instanceMatrix.needsUpdate = true
  if (plates.instanceColor) plates.instanceColor.needsUpdate = true

  const rootAnchors = anchors.filter(({ index }) => index % 4 === 0)
  const roots = new InstancedMesh(rootGeometry, rootMaterial, rootAnchors.length)
  roots.name = 'ShellTransitionRootButtresses'
  roots.castShadow = true
  roots.receiveShadow = true
  roots.userData.traversalCollision = false
  roots.userData.materialFamily = 'shell-transition'
  rootAnchors.forEach((anchor, index) => {
    const radial = new Vector3(anchor.x, 0, anchor.z).normalize()
    const length = 7 + rng() * 7
    const midpointScale = 0.956
    const x = anchor.x * midpointScale
    const z = anchor.z * midpointScale
    const direction = radial.clone().multiplyScalar(-1).addScaledVector(UP, 0.11).normalize()
    dummy.position.set(x, terrainHeight(x, z) + 0.25, z)
    dummy.quaternion.setFromUnitVectors(UP, direction)
    dummy.scale.set(0.7 + rng() * 0.5, length, 0.7 + rng() * 0.45)
    dummy.updateMatrix()
    roots.setMatrixAt(index, dummy.matrix)
  })
  roots.instanceMatrix.needsUpdate = true

  const algaeAnchors = anchors.filter(({ index }) => index % 2 === 0)
  const algae = new InstancedMesh(algaeGeometry, algaeMaterial, algaeAnchors.length)
  algae.name = 'ShellTransitionAlgae'
  algae.receiveShadow = true
  algae.userData.traversalCollision = false
  algae.userData.materialFamily = 'shell-transition'
  algaeAnchors.forEach((anchor, index) => {
    const inset = 0.988 - rng() * 0.018
    const x = anchor.x * inset
    const z = anchor.z * inset
    dummy.position.set(x, terrainHeight(x, z) + 0.16, z)
    dummy.rotation.set(0, anchor.theta + rng(), 0)
    dummy.scale.set(1.2 + rng() * 2.4, 0.08 + rng() * 0.12, 1.8 + rng() * 4.2)
    dummy.updateMatrix()
    algae.setMatrixAt(index, dummy.matrix)
    tint.setRGB(0.5 + rng() * 0.16, 0.66 + rng() * 0.18, 0.48 + rng() * 0.12)
    algae.setColorAt(index, tint)
  })
  algae.instanceMatrix.needsUpdate = true
  if (algae.instanceColor) algae.instanceColor.needsUpdate = true

  const seamPoints = anchors.map(({ x, z }) => {
    const seamX = x * 0.989
    const seamZ = z * 0.989
    return new Vector3(seamX, terrainHeight(seamX, seamZ) + 0.16, seamZ)
  })
  const seamGeometry = new TubeGeometry(
    new CatmullRomCurve3(seamPoints, true, 'centripetal'),
    256,
    0.075,
    5,
    true,
  )
  const seam = new Mesh(seamGeometry, seamMaterial)
  seam.name = 'ShellTransitionLivingSeam'
  seam.userData.traversalCollision = false
  seam.userData.materialFamily = 'shell-transition'

  return {
    plates,
    roots,
    algae,
    seam,
    dispose() {
      plateGeometry.dispose()
      rootGeometry.dispose()
      algaeGeometry.dispose()
      seamGeometry.dispose()
      plateMaterial.dispose()
      rootMaterial.dispose()
      algaeMaterial.dispose()
      seamMaterial.dispose()
    },
  }
}

/** Visual-only geology and living tissue that hides the analytic/hero seam. */
export function ShellTransitionBand() {
  const resources = useMemo(buildTransitionBand, [])

  useEffect(() => () => resources.dispose(), [resources])
  useFrame((state) => {
    const wetness = runtime.weather.wetness
    const plates = resources.plates.material as MeshStandardMaterial
    const roots = resources.roots.material as MeshStandardMaterial
    const algae = resources.algae.material as MeshStandardMaterial
    const seam = resources.seam.material as MeshStandardMaterial
    plates.roughness = 0.92 - wetness * 0.42
    roots.roughness = 0.96 - wetness * 0.24
    algae.roughness = 0.98 - wetness * 0.5
    const night = runtime.time.celest.nightFactor
    const pulse = 0.88 + Math.sin(state.clock.elapsedTime * 0.32) * 0.12
    seam.emissiveIntensity = night * pulse * 0.42
    seam.visible = seam.emissiveIntensity > 0.012
  })

  return (
    <group name="ShellTransitionBand" userData={{ traversalCollision: false }}>
      <primitive object={resources.plates} />
      <primitive object={resources.roots} />
      <primitive object={resources.algae} />
      <primitive object={resources.seam} />
    </group>
  )
}
