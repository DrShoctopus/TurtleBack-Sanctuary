import { useLayoutEffect, useMemo, useRef } from 'react'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { Color, InstancedMesh, MeshStandardMaterial, Object3D, type BufferGeometry } from 'three'
import type { VegetationCellPopulation, VegetationTransform } from './types'

export interface VegetationInstanceResource {
  geometry: BufferGeometry
  material: MeshStandardMaterial
  colors?: readonly Color[]
  castShadow?: boolean
  /** Local-space allowance for shader displacement beyond analytic geometry. */
  boundsPadding?: number
}

export interface VegetationRenderResources {
  grass: VegetationInstanceResource
  flowers: VegetationInstanceResource
  bushes: VegetationInstanceResource
  rocks: VegetationInstanceResource
  trees: readonly [
    VegetationInstanceResource,
    VegetationInstanceResource,
    VegetationInstanceResource,
  ]
  treeTrunkMaterial: MeshStandardMaterial
  treeTrunks: readonly [BufferGeometry, BufferGeometry, BufferGeometry]
  horizonTrees: VegetationInstanceResource
}

export interface TreeColliderDescriptor {
  id: string
  halfHeight: number
  radius: number
  position: readonly [number, number, number]
}

export function buildTreeColliderDescriptors(
  trees: readonly VegetationTransform[],
): readonly TreeColliderDescriptor[] {
  return trees.map((tree) => ({
    id: tree.id,
    halfHeight: 1.4,
    radius: 0.22 * tree.scale,
    position: [tree.x, tree.y + 1.4, tree.z],
  }))
}

/** Populate a static instanced mesh and calculate the aggregate culling bounds. */
export function applyVegetationTransforms(
  mesh: InstancedMesh,
  transforms: readonly VegetationTransform[],
  colors?: readonly Color[],
  boundsPadding = 0,
): void {
  const dummy = new Object3D()
  mesh.count = transforms.length
  transforms.forEach((transform, index) => {
    dummy.position.set(transform.x, transform.y, transform.z)
    dummy.rotation.set(0, transform.yaw, 0)
    dummy.scale.setScalar(transform.scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    if (colors && colors.length > 0) {
      mesh.setColorAt(index, colors[transform.variant % colors.length])
    }
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = true
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  if (boundsPadding > 0) {
    mesh.boundingBox?.expandByScalar(boundsPadding)
    if (mesh.boundingSphere) mesh.boundingSphere.radius += boundsPadding
  }
}

function Instances({
  transforms,
  resource,
}: {
  transforms: readonly VegetationTransform[]
  resource: VegetationInstanceResource
}) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    if (!ref.current) return
    applyVegetationTransforms(ref.current, transforms, resource.colors, resource.boundsPadding)
  }, [resource.boundsPadding, resource.colors, transforms])

  if (transforms.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[resource.geometry, resource.material, transforms.length]}
      castShadow={resource.castShadow ?? false}
      receiveShadow
      frustumCulled
    />
  )
}

function FullTrees({
  trees,
  resources,
}: {
  trees: readonly VegetationTransform[]
  resources: VegetationRenderResources
}) {
  const byVariant = useMemo(
    () =>
      [
        trees.filter((tree) => tree.variant === 0),
        trees.filter((tree) => tree.variant === 1),
        trees.filter((tree) => tree.variant === 2),
      ] as const,
    [trees],
  )

  return byVariant.map((transforms, variant) => (
    <group key={variant}>
      <Instances
        transforms={transforms}
        resource={{
          geometry: resources.treeTrunks[variant],
          material: resources.treeTrunkMaterial,
          castShadow: true,
        }}
      />
      <Instances transforms={transforms} resource={resources.trees[variant]} />
    </group>
  ))
}

/**
 * One stable retained-cell owner. Its collider subtree never depends on active
 * state; only the full-detail versus bounded-horizon visual subtree toggles.
 */
export function VegetationCell({
  cell,
  active,
  resources,
}: {
  cell: VegetationCellPopulation
  active: boolean
  resources: VegetationRenderResources
}) {
  const colliders = useMemo(() => buildTreeColliderDescriptors(cell.near.trees), [cell.near.trees])

  return (
    <group name={`vegetation-cell:${cell.cellId}`}>
      {active ? (
        <>
          <Instances transforms={cell.near.grass} resource={resources.grass} />
          <Instances transforms={cell.near.flowers} resource={resources.flowers} />
          <Instances transforms={cell.near.bushes} resource={resources.bushes} />
          <Instances transforms={cell.near.rocks} resource={resources.rocks} />
          <FullTrees trees={cell.near.trees} resources={resources} />
        </>
      ) : (
        <Instances transforms={cell.horizonTrees} resource={resources.horizonTrees} />
      )}

      <RigidBody type="fixed" colliders={false}>
        {colliders.map((collider) => (
          <CylinderCollider
            key={collider.id}
            args={[collider.halfHeight, collider.radius]}
            position={collider.position}
          />
        ))}
      </RigidBody>
    </group>
  )
}
