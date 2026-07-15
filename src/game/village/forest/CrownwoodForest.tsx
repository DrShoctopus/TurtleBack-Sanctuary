import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import {
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  type BufferGeometry,
} from 'three'
import { ComfortMotionClock } from '../../core/comfortMotion'
import { runtime } from '../../core/runtime'
import { useQualityProfile } from '../../core/useQualityProfile'
import { createPainterlyMaterial } from '../../rendering/painterlyMaterials'
import { useSettings } from '../../state/settingsStore'
import { useSpatialCellSnapshot } from '../../world/spatial/SpatialCellProvider'
import { getSurfaceDetail } from '../../world/textures'
import {
  addForestWindWeight,
  makeBoulderClusterGeometry,
  makeDeadfallGeometry,
  makeFernGeometry,
  makeForestTreeForms,
  makeGroundCoverGeometry,
  makeMushroomClusterGeometry,
  makeRootArchGeometry,
  makeSaplingGeometry,
  type ForestTreeGeometry,
} from './geometry'
import {
  buildCrownwoodLayout,
  selectCrownwoodLayout,
  treeLodForQuality,
  type ForestDiscovery,
  type ForestTransform,
} from './layout'

interface MutableUniform {
  value: number
}

interface ForestInstanceResource {
  geometry: BufferGeometry
  material: MeshStandardMaterial
  colors?: readonly Color[]
  castShadow?: boolean
  yOffset?: number
}

const BARK_COLORS = [new Color('#4a352b'), new Color('#594032'), new Color('#674936')]
const FOLIAGE_COLORS = [
  new Color('#30483a'),
  new Color('#3c5540'),
  new Color('#496247'),
  new Color('#58704b'),
  new Color('#6b8056'),
]
const FERN_COLORS = [
  new Color('#48633f'),
  new Color('#58744a'),
  new Color('#6b8056'),
  new Color('#789164'),
]
const FLOOR_COLORS = [
  new Color('#30483a'),
  new Color('#435744'),
  new Color('#55654d'),
  new Color('#6f7652'),
  new Color('#7b6b4f'),
]
const BOULDER_COLORS = [
  new Color('#59645d'),
  new Color('#697269'),
  new Color('#78817a'),
  new Color('#708067'),
]
const DISCOVERY_COLORS = [
  new Color('#8b9a72'),
  new Color('#d29a4a'),
  new Color('#d8735f'),
  new Color('#d8e2da'),
]

function stableColorIndex(transform: ForestTransform, count: number): number {
  let hash = transform.variant * 197
  for (let index = 0; index < transform.id.length; index += 1) {
    hash = (hash * 31 + transform.id.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % count
}

/** Owns every shared forest geometry/material and the single wind clock. */
class CrownwoodResourceOwner {
  readonly treeLods: readonly (readonly ForestTreeGeometry[])[]
  readonly barkMaterial: MeshStandardMaterial
  readonly foliageMaterial: MeshStandardMaterial
  readonly fernMaterial: MeshStandardMaterial
  readonly groundMaterial: MeshStandardMaterial
  readonly rockMaterial: MeshStandardMaterial
  readonly mushroomMaterial: MeshStandardMaterial
  readonly saplingGeometry: BufferGeometry
  readonly fernGeometry: BufferGeometry
  readonly groundGeometry: BufferGeometry
  readonly deadfallGeometry: BufferGeometry
  readonly boulderGeometry: BufferGeometry
  readonly rootArchGeometry: BufferGeometry
  readonly mushroomGeometry: BufferGeometry
  readonly mistGeometry: PlaneGeometry
  readonly mistMaterial: ShaderMaterial
  private readonly windUniform: MutableUniform = { value: 0.5 }
  private readonly timeUniform: MutableUniform = { value: 0 }
  private readonly turtleImpulseUniform: MutableUniform = { value: 0 }
  private disposed = false

  constructor() {
    const barkDetail = getSurfaceDetail('forestBark')
    this.barkMaterial = createPainterlyMaterial('bark', {
      color: '#ffffff',
      roughness: 0.96,
      normalMap: barkDetail.normalMap,
      roughnessMap: barkDetail.roughnessMap,
      normalScale: new Vector2(0.34, 0.34),
    })
    this.foliageMaterial = this.makeSwayMaterial(
      createPainterlyMaterial('foliage', {
        color: '#ffffff',
        roughness: 0.98,
        flatShading: true,
      }),
      0.13,
    )
    this.fernMaterial = this.makeSwayMaterial(
      createPainterlyMaterial('foliage', {
        color: '#ffffff',
        roughness: 1,
        side: DoubleSide,
      }),
      0.085,
    )
    this.groundMaterial = createPainterlyMaterial('foliage', {
      color: '#ffffff',
      roughness: 1,
      flatShading: true,
    })
    this.rockMaterial = createPainterlyMaterial('rock', {
      color: '#ffffff',
      roughness: 0.97,
      flatShading: true,
    })
    this.mushroomMaterial = createPainterlyMaterial('foliage', {
      color: '#ffffff',
      roughness: 0.92,
      flatShading: true,
    })
    this.treeLods = ([0, 1, 2] as const).map((lod) => {
      const forms = makeForestTreeForms(lod)
      for (const form of forms) addForestWindWeight(form.canopy)
      return forms
    })
    this.saplingGeometry = makeSaplingGeometry()
    this.fernGeometry = makeFernGeometry()
    this.groundGeometry = makeGroundCoverGeometry()
    this.deadfallGeometry = makeDeadfallGeometry()
    this.boulderGeometry = makeBoulderClusterGeometry()
    this.rootArchGeometry = makeRootArchGeometry()
    this.mushroomGeometry = makeMushroomClusterGeometry()
    this.mistGeometry = new PlaneGeometry(12, 3.4, 3, 1)
    this.mistMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uMistColor: { value: new Color('#9fb4ad') },
        uMistOpacity: { value: 0.075 },
        uMistTime: this.timeUniform,
      },
      vertexShader: `
varying vec2 vCrownwoodMistUv;
uniform float uMistTime;
void main() {
  vCrownwoodMistUv = uv;
  vec3 p = position;
  p.y += sin(uv.x * 5.4 + uMistTime * 0.16) * 0.12;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}`,
      fragmentShader: `
varying vec2 vCrownwoodMistUv;
uniform vec3 uMistColor;
uniform float uMistOpacity;
void main() {
  vec2 centred = abs(vCrownwoodMistUv - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.42, 1.0, centred.x);
  edge *= 1.0 - smoothstep(0.2, 1.0, centred.y);
  float bands = 0.72 + sin(vCrownwoodMistUv.x * 17.0 + vCrownwoodMistUv.y * 9.0) * 0.12;
  float alpha = edge * bands * uMistOpacity;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uMistColor, alpha);
}`,
    })
  }

  update(time: number, wind: number, turtleImpulse: number, rain: number): void {
    if (this.disposed) return
    this.timeUniform.value = time
    this.windUniform.value = 0.4 + wind * 0.76
    this.turtleImpulseUniform.value = turtleImpulse
    this.mistMaterial.uniforms.uMistOpacity.value = 0.075 + rain * 0.055
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const lod of this.treeLods) {
      for (const form of lod) {
        form.trunk.dispose()
        form.canopy.dispose()
      }
    }
    for (const geometry of [
      this.saplingGeometry,
      this.fernGeometry,
      this.groundGeometry,
      this.deadfallGeometry,
      this.boulderGeometry,
      this.rootArchGeometry,
      this.mushroomGeometry,
      this.mistGeometry,
    ]) {
      geometry.dispose()
    }
    for (const material of [
      this.barkMaterial,
      this.foliageMaterial,
      this.fernMaterial,
      this.groundMaterial,
      this.rockMaterial,
      this.mushroomMaterial,
      this.mistMaterial,
    ]) {
      material.dispose()
    }
  }

  private makeSwayMaterial(material: MeshStandardMaterial, strength: number): MeshStandardMaterial {
    const previousCompile = material.onBeforeCompile
    const previousKey = material.customProgramCacheKey.bind(material)
    material.onBeforeCompile = (shader, renderer) => {
      previousCompile(shader, renderer)
      shader.uniforms.uCrownwoodTime = this.timeUniform
      shader.uniforms.uCrownwoodWind = this.windUniform
      shader.uniforms.uCrownwoodImpulse = this.turtleImpulseUniform
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aWindWeight;
uniform float uCrownwoodTime;
uniform float uCrownwoodWind;
uniform float uCrownwoodImpulse;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    float crownwoodPhase = instanceMatrix[3].x * 0.091 + instanceMatrix[3].z * 0.073;
  #else
    float crownwoodPhase = 0.0;
  #endif
  float crownwoodSway = sin(uCrownwoodTime * 0.72 + crownwoodPhase) * ${strength.toFixed(
    3,
  )} * uCrownwoodWind * aWindWeight;
  crownwoodSway += sin(uCrownwoodTime * 0.41 + crownwoodPhase * 1.7) * ${(
    strength * 0.36
  ).toFixed(3)} * aWindWeight;
  crownwoodSway += sin(uCrownwoodTime * 0.83 + crownwoodPhase * 0.6) * ${(
    strength * 1.8
  ).toFixed(3)} * uCrownwoodImpulse * aWindWeight;
  transformed.x += crownwoodSway;
  transformed.z += crownwoodSway * 0.48;
}`,
        )
    }
    material.customProgramCacheKey = () => `${previousKey()}|crownwood-sway:${strength}`
    return material
  }
}

function applyTransforms(
  mesh: InstancedMesh,
  transforms: readonly ForestTransform[],
  colors?: readonly Color[],
  yOffset = 0,
): void {
  const dummy = new Object3D()
  mesh.count = transforms.length
  transforms.forEach((transform, index) => {
    dummy.position.set(transform.x, transform.y + yOffset * transform.scale, transform.z)
    dummy.rotation.set(0, transform.yaw, 0)
    dummy.scale.setScalar(transform.scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    if (colors && colors.length > 0) {
      mesh.setColorAt(index, colors[stableColorIndex(transform, colors.length)])
    }
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
}

function ForestInstances({
  name,
  transforms,
  resource,
}: {
  name: string
  transforms: readonly ForestTransform[]
  resource: ForestInstanceResource
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (ref.current) {
      applyTransforms(ref.current, transforms, resource.colors, resource.yOffset)
    }
  }, [resource.colors, resource.yOffset, transforms])
  if (transforms.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      name={name}
      args={[resource.geometry, resource.material, transforms.length]}
      castShadow={resource.castShadow ?? false}
      receiveShadow
      frustumCulled
    />
  )
}

function Trees({
  transforms,
  forms,
  owner,
  name,
  castShadow,
}: {
  transforms: readonly ForestTransform[]
  forms: readonly ForestTreeGeometry[]
  owner: CrownwoodResourceOwner
  name: string
  castShadow: boolean
}) {
  const variants = useMemo(
    () => forms.map((_, variant) => transforms.filter((tree) => tree.variant === variant)),
    [forms, transforms],
  )
  return variants.map((variantTransforms, variant) => {
    if (variantTransforms.length === 0) return null
    return (
      <group key={variant} name={`${name}:form-${variant}`}>
        <ForestInstances
          name={`${name}:trunks-${variant}`}
          transforms={variantTransforms}
          resource={{
            geometry: forms[variant].trunk,
            material: owner.barkMaterial,
            colors: BARK_COLORS,
            castShadow,
          }}
        />
        <ForestInstances
          name={`${name}:canopy-${variant}`}
          transforms={variantTransforms}
          resource={{
            geometry: forms[variant].canopy,
            material: owner.foliageMaterial,
            colors: FOLIAGE_COLORS,
            castShadow,
          }}
        />
      </group>
    )
  })
}

function HorizonTrees({
  transforms,
  owner,
}: {
  transforms: readonly ForestTransform[]
  owner: CrownwoodResourceOwner
}) {
  const familyTransforms = useMemo(
    () =>
      [0, 1, 2].map((family) =>
        transforms
          .filter((tree) => Math.floor(tree.variant / 3) === family)
          .map((tree) => ({ ...tree, variant: family * 3 })),
      ),
    [transforms],
  )
  const forms = owner.treeLods[2]
  return familyTransforms.map((family, index) => {
    if (family.length === 0) return null
    const form = forms[index * 3]
    return (
      <group key={index} name={`crownwood:horizon-family-${index}`}>
        <ForestInstances
          name={`crownwood:horizon-trunks-${index}`}
          transforms={family}
          resource={{ geometry: form.trunk, material: owner.barkMaterial, colors: BARK_COLORS }}
        />
        <ForestInstances
          name={`crownwood:horizon-canopy-${index}`}
          transforms={family}
          resource={{
            geometry: form.canopy,
            material: owner.foliageMaterial,
            colors: FOLIAGE_COLORS,
          }}
        />
      </group>
    )
  })
}

function DiscoveryClusters({
  discoveries,
  owner,
}: {
  discoveries: readonly ForestDiscovery[]
  owner: CrownwoodResourceOwner
}) {
  const groups = useMemo(
    () => ({
      deadfall: discoveries.filter(
        (discovery) => discovery.kind === 'nurse-log' || discovery.kind === 'fallen-branch',
      ),
      arches: discoveries.filter((discovery) => discovery.kind === 'root-arch'),
      ferns: discoveries.filter((discovery) => discovery.kind === 'fern-bank'),
      mushrooms: discoveries.filter((discovery) => discovery.kind === 'mushroom-ring'),
      boulders: discoveries.filter((discovery) => discovery.kind === 'lichen-rock'),
      saplings: discoveries.filter((discovery) => discovery.kind === 'sapling-grove'),
      flowers: discoveries.filter((discovery) => discovery.kind === 'flower-pocket'),
    }),
    [discoveries],
  )
  return (
    <group name="crownwood:discoveries">
      <ForestInstances
        name="crownwood:discovery-deadfall"
        transforms={groups.deadfall}
        resource={{
          geometry: owner.deadfallGeometry,
          material: owner.barkMaterial,
          colors: BARK_COLORS,
          castShadow: true,
        }}
      />
      <ForestInstances
        name="crownwood:discovery-root-arches"
        transforms={groups.arches}
        resource={{
          geometry: owner.rootArchGeometry,
          material: owner.barkMaterial,
          colors: BARK_COLORS,
          castShadow: true,
        }}
      />
      <ForestInstances
        name="crownwood:discovery-ferns"
        transforms={groups.ferns}
        resource={{
          geometry: owner.fernGeometry,
          material: owner.fernMaterial,
          colors: FERN_COLORS,
        }}
      />
      <ForestInstances
        name="crownwood:discovery-mushrooms"
        transforms={groups.mushrooms}
        resource={{
          geometry: owner.mushroomGeometry,
          material: owner.mushroomMaterial,
          colors: DISCOVERY_COLORS,
        }}
      />
      <ForestInstances
        name="crownwood:discovery-lichen-rocks"
        transforms={groups.boulders}
        resource={{
          geometry: owner.boulderGeometry,
          material: owner.rockMaterial,
          colors: BOULDER_COLORS,
          castShadow: true,
        }}
      />
      <ForestInstances
        name="crownwood:discovery-saplings"
        transforms={groups.saplings}
        resource={{
          geometry: owner.saplingGeometry,
          material: owner.fernMaterial,
          colors: FERN_COLORS,
        }}
      />
      <ForestInstances
        name="crownwood:discovery-flowers"
        transforms={groups.flowers}
        resource={{
          geometry: owner.groundGeometry,
          material: owner.groundMaterial,
          colors: DISCOVERY_COLORS,
        }}
      />
    </group>
  )
}

/** Streamed professional forest pass for Crownwood and the Arrival corridor. */
export function CrownwoodForest() {
  const quality = useQualityProfile()
  const seed = useSettings((state) => state.worldSeed)
  const spatial = useSpatialCellSnapshot()
  const motionClock = useRef(new ComfortMotionClock())
  const owner = useMemo(() => new CrownwoodResourceOwner(), [])
  const layout = useMemo(() => buildCrownwoodLayout(seed), [seed])
  const selection = useMemo(
    () => selectCrownwoodLayout(layout, spatial.active, spatial.retained, quality.level),
    [layout, quality.level, spatial.active, spatial.retained],
  )
  const discoveries = useMemo(() => {
    const active = new Set(spatial.active)
    return layout.discoveries.filter((discovery) => active.has(discovery.cell))
  }, [layout.discoveries, spatial.active])
  const retainedColliders = useMemo(() => {
    const retained = new Set(spatial.retained)
    return layout.layers.trees.filter((tree) => retained.has(tree.cell))
  }, [layout.layers.trees, spatial.retained])
  const lod = treeLodForQuality(quality.level)
  const nearCount = Object.values(selection.near).reduce((sum, layer) => sum + layer.length, 0)
  const discoveryCount = discoveries.length

  runtime.forest = {
    lod,
    nearInstances: nearCount + discoveryCount,
    horizonInstances: selection.horizonTrees.length,
    discoveries: discoveryCount,
    layers: Object.fromEntries(
      Object.entries(selection.near).map(([layer, transforms]) => [layer, transforms.length]),
    ),
  }

  useEffect(() => () => owner.dispose(), [owner])
  useFrame((_, delta) => {
    const time = motionClock.current.advance(delta, runtime.reducedMotion)
    owner.update(time, runtime.weather.wind, runtime.turtle.foliageImpulse, runtime.weather.rain)
  })

  return (
    <group name="crownwood:streamed-forest">
      <Trees
        name={`crownwood:near-lod${lod}`}
        transforms={selection.near.trees}
        forms={owner.treeLods[lod]}
        owner={owner}
        castShadow={quality.shadowsEnabled && lod === 0}
      />
      <HorizonTrees transforms={selection.horizonTrees} owner={owner} />
      <ForestInstances
        name="crownwood:midstory"
        transforms={selection.near.midstory}
        resource={{
          geometry: owner.saplingGeometry,
          material: owner.fernMaterial,
          colors: FERN_COLORS,
          castShadow: quality.shadowsEnabled && quality.level !== 'low',
        }}
      />
      <ForestInstances
        name="crownwood:understory"
        transforms={selection.near.understory}
        resource={{ geometry: owner.fernGeometry, material: owner.fernMaterial, colors: FERN_COLORS }}
      />
      <ForestInstances
        name="crownwood:ground-cover"
        transforms={selection.near.groundCover}
        resource={{
          geometry: owner.groundGeometry,
          material: owner.groundMaterial,
          colors: FLOOR_COLORS,
        }}
      />
      <ForestInstances
        name="crownwood:deadfall"
        transforms={selection.near.deadfall}
        resource={{
          geometry: owner.deadfallGeometry,
          material: owner.barkMaterial,
          colors: BARK_COLORS,
          castShadow: quality.shadowsEnabled,
        }}
      />
      <ForestInstances
        name="crownwood:boulders"
        transforms={selection.near.boulders}
        resource={{
          geometry: owner.boulderGeometry,
          material: owner.rockMaterial,
          colors: BOULDER_COLORS,
          castShadow: quality.shadowsEnabled,
        }}
      />
      <MistInstances transforms={selection.near.mist} owner={owner} />
      <DiscoveryClusters discoveries={discoveries} owner={owner} />

      <RigidBody type="fixed" colliders={false} name="crownwood:tree-colliders">
        {retainedColliders.map((tree) => (
          <CylinderCollider
            key={tree.id}
            args={[3.7 * tree.scale, 0.38 * tree.scale]}
            position={[tree.x, tree.y + 3.7 * tree.scale, tree.z]}
          />
        ))}
      </RigidBody>
    </group>
  )
}

function MistInstances({
  transforms,
  owner,
}: {
  transforms: readonly ForestTransform[]
  owner: CrownwoodResourceOwner
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const dummy = new Object3D()
    transforms.forEach((transform, index) => {
      dummy.position.set(transform.x, transform.y + 2.05 * transform.scale, transform.z)
      dummy.rotation.set(0, transform.yaw, 0)
      dummy.scale.setScalar(transform.scale)
      dummy.updateMatrix()
      ref.current?.setMatrixAt(index, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingBox()
    ref.current.computeBoundingSphere()
  }, [transforms])
  if (transforms.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      name="crownwood:mist"
      args={[owner.mistGeometry, owner.mistMaterial, transforms.length]}
      renderOrder={-3}
      frustumCulled
    />
  )
}
