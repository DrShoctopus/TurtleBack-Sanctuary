import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, MeshStandardMaterial, RepeatWrapping } from 'three'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import {
  SHELL_SEMI_X,
  SHELL_SEMI_Z,
  shellRadius,
  splatWeights,
  terrainHeight,
} from './shellShape'
import { getTexture } from '../textures'
import { registerWeatherMaterial } from '../../weather/wetMaterials'

const STEP = 2.2
const MARGIN = 1.12 // generate slightly past the rim so the skirt hides the underside

/**
 * The walkable shell surface. One merged mesh (single draw call) with a
 * three-way splat material; physics uses the identical grid as a trimesh.
 */
export function ShellTerrain() {
  const { geometry, vertices, indices } = useMemo(() => buildTerrain(), [])
  const material = useMemo(() => buildMaterial(), [])

  return (
    <RigidBody type="fixed" colliders={false}>
      <TrimeshCollider args={[vertices, indices]} friction={1} restitution={0} />
      <mesh geometry={geometry} material={material} receiveShadow castShadow={false} />
    </RigidBody>
  )
}

function buildTerrain() {
  const minX = -SHELL_SEMI_X * MARGIN
  const maxX = SHELL_SEMI_X * MARGIN
  const minZ = -SHELL_SEMI_Z * MARGIN
  const maxZ = SHELL_SEMI_Z * MARGIN
  const cols = Math.ceil((maxX - minX) / STEP)
  const rows = Math.ceil((maxZ - minZ) / STEP)
  const vertCount = (cols + 1) * (rows + 1)
  const positions = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  let vi = 0
  for (let r = 0; r <= rows; r++) {
    const z = minZ + (r / rows) * (maxZ - minZ)
    for (let c = 0; c <= cols; c++) {
      const x = minX + (c / cols) * (maxX - minX)
      let h = terrainHeight(x, z)
      const rad = shellRadius(x, z)
      if (rad > 1.005) {
        // skirt: fold the border down toward the turtle body so no gap shows
        h -= (rad - 1.005) * 60
      }
      positions[vi * 3] = x
      positions[vi * 3 + 1] = h
      positions[vi * 3 + 2] = z
      const w = splatWeights(x, z)
      colors[vi * 3] = w.path
      colors[vi * 3 + 1] = w.grass
      colors[vi * 3 + 2] = w.rock
      vi++
    }
  }
  const indices = new Uint32Array(cols * rows * 6)
  let ii = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c
      const b = a + 1
      const d = a + (cols + 1)
      const e = d + 1
      indices[ii++] = a
      indices[ii++] = d
      indices[ii++] = b
      indices[ii++] = b
      indices[ii++] = d
      indices[ii++] = e
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setIndex(new BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  return { geometry, vertices: positions, indices }
}

function buildMaterial() {
  const grass = getTexture('grass')
  const stone = getTexture('stonePath')
  const rock = getTexture('shellRock')
  for (const t of [grass, stone, rock]) {
    t.wrapS = t.wrapT = RepeatWrapping
  }
  const mat = new MeshStandardMaterial({
    vertexColors: false,
    roughness: 0.93,
    metalness: 0,
    map: grass, // placeholder so three sets up UV varyings; replaced in shader
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.grassMap = { value: grass }
    shader.uniforms.stoneMap = { value: stone }
    shader.uniforms.rockMap = { value: rock }
    shader.uniforms.wetness = { value: 0 }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 color;
        varying vec3 vSplat;
        varying vec3 vWorldPos2;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSplat = color;
        vWorldPos2 = (modelMatrix * vec4(position, 1.0)).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D grassMap;
        uniform sampler2D stoneMap;
        uniform sampler2D rockMap;
        uniform float wetness;
        varying vec3 vSplat;
        varying vec3 vWorldPos2;`,
      )
      .replace(
        '#include <map_fragment>',
        `{
          vec2 wuv = vWorldPos2.xz;
          vec3 g = texture2D(grassMap, wuv / 7.0).rgb;
          vec3 s = texture2D(stoneMap, wuv / 6.0).rgb;
          vec3 r = texture2D(rockMap, wuv / 11.0).rgb;
          float wPath = clamp(vSplat.r, 0.0, 1.0);
          float wRock = clamp(vSplat.b, 0.0, 1.0) * (1.0 - wPath);
          float wGrass = clamp(1.0 - wPath - wRock, 0.0, 1.0);
          vec3 soil = vec3(0.32, 0.27, 0.2);
          vec3 blended = g * wGrass + s * wPath + r * wRock;
          blended = mix(soil, blended, clamp(wGrass + wPath + wRock, 0.0, 1.0));
          // rain darkening
          blended *= (1.0 - wetness * 0.35);
          diffuseColor.rgb = blended;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.45, wetness * (0.4 + 0.6 * vSplat.r));`,
      )
    registerWeatherMaterial(shader.uniforms as { wetness: { value: number } })
  }
  return mat
}
