import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  Vector2,
} from 'three'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { SHELL_SEMI_X, SHELL_SEMI_Z, shellRadius, splatWeights, terrainHeight } from './shellShape'
import { getSurfaceDetail, getTexture } from '../textures'
import { registerWeatherMaterial } from '../../weather/wetMaterials'
import { ShellTransitionBand } from '../turtle/ShellTransitionBand'
import { authoredTraversalCollisionViolations } from '../turtle/shellAlignment'

const STEP = 2.2
const MARGIN = 1.12 // generate slightly past the rim so the skirt hides the underside

/**
 * The walkable shell surface. One merged mesh (single draw call) with a
 * three-way splat material; physics uses the identical grid as a trimesh.
 */
export function ShellTerrain() {
  const { geometry, vertices, indices } = useMemo(() => buildTerrain(), [])
  const material = useMemo(() => buildMaterial(), [])
  const scene = useThree((state) => state.scene)
  const assertionClock = useRef(0)

  useFrame((_, dt) => {
    if (!import.meta.env.DEV) return
    assertionClock.current += Number.isFinite(dt) && dt > 0 ? dt : 0
    if (assertionClock.current < 1) return
    assertionClock.current = 0
    const violations = authoredTraversalCollisionViolations(scene)
    if (violations.length > 0) {
      throw new Error(`Authored traversal collision is forbidden: ${violations.join(', ')}`)
    }
  })

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider args={[vertices, indices]} friction={1} restitution={0} />
        <mesh
          name="AnalyticShellTraversal"
          geometry={geometry}
          material={material}
          receiveShadow
          castShadow={false}
          userData={{ traversalCollision: true, traversalSource: 'analytic-shell' }}
        />
      </RigidBody>
      <ShellTransitionBand />
    </>
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
  const uvs = new Float32Array(vertCount * 2)
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
      // World-scaled UVs feed the subtle shared ground normal. The colour
      // layers use world projection below so they can each keep their own scale.
      uvs[vi * 2] = x / 1.45
      uvs[vi * 2 + 1] = z / 1.45
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
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(new BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  return { geometry, vertices: positions, indices }
}

function buildMaterial() {
  const grass = getTexture('grass')
  const stone = getTexture('stonePath')
  const rock = getTexture('shellRock')
  const groundDetail = getSurfaceDetail('ground')
  for (const t of [grass, stone, rock]) {
    t.wrapS = t.wrapT = RepeatWrapping
  }
  const mat = new MeshStandardMaterial({
    vertexColors: false,
    roughness: 0.93,
    metalness: 0,
    map: grass, // placeholder so three sets up UV varyings; replaced in shader
    normalMap: groundDetail.normalMap,
    normalScale: new Vector2(0.085, 0.085),
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
        varying vec3 vWorldPos2;

        float terrainHash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float terrainNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(terrainHash(i), terrainHash(i + vec2(1.0, 0.0)), f.x),
            mix(terrainHash(i + vec2(0.0, 1.0)), terrainHash(i + 1.0), f.x),
            f.y
          );
        }

        float terrainFbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.55;
          for (int i = 0; i < 4; i++) {
            value += terrainNoise(p) * amplitude;
            p = mat2(1.62, 1.18, -1.18, 1.62) * p;
            amplitude *= 0.48;
          }
          return value;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `{
          vec2 wuv = vWorldPos2.xz;
          vec2 rotated = mat2(0.8, 0.6, -0.6, 0.8) * wuv;
          float macro = terrainFbm(wuv / 34.0);
          float patches = terrainFbm(rotated / 13.0);

          // Two differently oriented scales suppress obvious texture repetition
          // while retaining readable detail both near the player and at distance.
          vec3 gBroad = texture2D(grassMap, wuv / 6.2).rgb;
          vec3 gFine = texture2D(grassMap, rotated / 2.15).rgb;
          vec3 g = mix(gBroad, gFine, 0.28);
          g *= mix(vec3(0.66, 0.78, 0.58), vec3(0.98, 0.96, 0.8), macro);
          g = mix(g, g * vec3(0.68, 0.84, 0.63), smoothstep(0.56, 0.88, patches) * 0.48);

          vec3 sBroad = texture2D(stoneMap, wuv / 5.4).rgb;
          vec3 sFine = texture2D(stoneMap, rotated / 2.8).rgb;
          vec3 s = mix(sBroad, sFine, 0.22) * mix(0.9, 1.08, macro);

          vec3 rBroad = texture2D(rockMap, wuv / 9.5).rgb;
          vec3 rFine = texture2D(rockMap, rotated / 3.6).rgb;
          vec3 r = mix(rBroad, rFine, 0.2) * mix(0.82, 1.08, patches);

          // Break mathematically smooth splat borders at two scales so paths
          // feel settled into the landscape instead of painted on top of it.
          float edgeNoise = (patches - 0.5) * 0.2 + (terrainNoise(wuv * 0.45) - 0.5) * 0.08;
          float wPath = smoothstep(0.16, 0.76, clamp(vSplat.r + edgeNoise, 0.0, 1.0));
          float wRock = smoothstep(0.1, 0.72, clamp(vSplat.b - edgeNoise * 0.45, 0.0, 1.0)) * (1.0 - wPath);
          float wGrass = clamp(1.0 - wPath - wRock, 0.0, 1.0);
          vec3 soil = mix(vec3(0.25, 0.22, 0.16), vec3(0.39, 0.33, 0.23), macro);
          vec3 blended = g * wGrass + s * wPath + r * wRock;
          blended = mix(soil, blended, clamp(wGrass + wPath + wRock, 0.0, 1.0));
          // Rain deepens soil and stone more than vegetation and leaves the
          // path with a restrained cool sheen.
          blended *= (1.0 - wetness * mix(0.22, 0.4, wPath + wRock * 0.5));
          blended = mix(blended, blended * vec3(0.88, 0.96, 1.04), wetness * wPath * 0.16);
          diffuseColor.rgb = blended;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float dryRoughness = mix(0.96, 0.83, clamp(vSplat.r, 0.0, 1.0));
        dryRoughness = mix(dryRoughness, 0.9, clamp(vSplat.b, 0.0, 1.0));
        roughnessFactor = mix(dryRoughness, 0.36, wetness * (0.22 + 0.78 * vSplat.r));`,
      )
    registerWeatherMaterial(shader.uniforms as { wetness: { value: number } })
  }
  return mat
}
