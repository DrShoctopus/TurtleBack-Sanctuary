import { Color, MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three'
import type { PainterlyEnvironmentSample } from './painterlyPalette'
import { createPainterlyEnvironmentSample } from './painterlyPalette'

export type PainterlySurfaceFamily =
  'bark' | 'foliage' | 'rock' | 'soilPath' | 'paintedWood' | 'turtleSkin'

interface PainterlySurfaceProfile {
  readonly baseColor: string
  readonly roughness: number
  readonly wrap: number
  readonly tonalStrength: number
  readonly macroScale: number
  readonly macroVariation: number
  readonly rimStrength: number
}

export const PAINTERLY_SURFACE_PROFILES: Readonly<
  Record<PainterlySurfaceFamily, PainterlySurfaceProfile>
> = Object.freeze({
  bark: {
    baseColor: '#6c4b35',
    roughness: 0.94,
    wrap: 0.28,
    tonalStrength: 0.28,
    macroScale: 7,
    macroVariation: 0.045,
    rimStrength: 0.008,
  },
  foliage: {
    baseColor: '#496247',
    roughness: 0.96,
    wrap: 0.46,
    tonalStrength: 0.3,
    macroScale: 5.5,
    macroVariation: 0.058,
    rimStrength: 0.026,
  },
  rock: {
    baseColor: '#78817a',
    roughness: 0.92,
    wrap: 0.24,
    tonalStrength: 0.25,
    macroScale: 9,
    macroVariation: 0.038,
    rimStrength: 0.006,
  },
  soilPath: {
    baseColor: '#6f694f',
    roughness: 0.93,
    wrap: 0.32,
    tonalStrength: 0.24,
    macroScale: 12,
    macroVariation: 0.035,
    rimStrength: 0,
  },
  paintedWood: {
    baseColor: '#8a6041',
    roughness: 0.82,
    wrap: 0.3,
    tonalStrength: 0.24,
    macroScale: 8,
    macroVariation: 0.028,
    rimStrength: 0.006,
  },
  turtleSkin: {
    baseColor: '#65745f',
    roughness: 0.84,
    wrap: 0.35,
    tonalStrength: 0.3,
    macroScale: 14,
    macroVariation: 0.052,
    rimStrength: 0.034,
  },
})

interface ShaderPatchTarget {
  uniforms: Record<string, { value: unknown }>
  vertexShader: string
  fragmentShader: string
}

const liveEnvironment = createPainterlyEnvironmentSample()
const environmentUniforms = {
  uPainterlySunDirection: { value: liveEnvironment.sunDirection },
  uPainterlyShadowTint: { value: liveEnvironment.shadowTint },
  uPainterlyHighlightTint: { value: liveEnvironment.highlightTint },
  uPainterlyFogNear: { value: liveEnvironment.fogNear },
  uPainterlyFogMid: { value: liveEnvironment.fogMid },
  uPainterlyFogFar: { value: liveEnvironment.fogFar },
  uPainterlyFogSun: { value: liveEnvironment.fogSun },
}

const FAMILY_KEY = 'turtlebackPainterlyFamily'
const decoratedMaterials = new WeakMap<MeshStandardMaterial, PainterlySurfaceFamily>()

/** Copies the live atmosphere into shared shader uniforms without allocating. */
export function updatePainterlyMaterialEnvironment(sample: PainterlyEnvironmentSample): void {
  liveEnvironment.sunDirection.copy(sample.sunDirection)
  liveEnvironment.shadowTint.copy(sample.shadowTint)
  liveEnvironment.highlightTint.copy(sample.highlightTint)
  liveEnvironment.fogNear.copy(sample.fogNear)
  liveEnvironment.fogMid.copy(sample.fogMid)
  liveEnvironment.fogFar.copy(sample.fogFar)
  liveEnvironment.fogSun.copy(sample.fogSun)
}

export function painterlyFamilyOf(material: MeshStandardMaterial): PainterlySurfaceFamily | null {
  const candidate = material.userData[FAMILY_KEY]
  return typeof candidate === 'string' && Object.hasOwn(PAINTERLY_SURFACE_PROFILES, candidate)
    ? (candidate as PainterlySurfaceFamily)
    : null
}

export function createPainterlyMaterial(
  family: PainterlySurfaceFamily,
  parameters: MeshStandardMaterialParameters = {},
): MeshStandardMaterial {
  const profile = PAINTERLY_SURFACE_PROFILES[family]
  return applyPainterlySurface(
    new MeshStandardMaterial({
      color: profile.baseColor,
      roughness: profile.roughness,
      metalness: 0,
      ...parameters,
    }),
    family,
  )
}

/** Adds soft warm-light/cool-shadow shaping and directional depth fog. */
export function applyPainterlySurface<T extends MeshStandardMaterial>(
  material: T,
  family: PainterlySurfaceFamily,
): T {
  // Material.clone() copies userData but deliberately does not copy shader
  // callbacks, so idempotence must track the actual instance, not metadata.
  if (decoratedMaterials.get(material) === family) return material
  const previousCompile = material.onBeforeCompile
  const previousProgramKey = material.customProgramCacheKey.bind(material)
  material.userData[FAMILY_KEY] = family
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer)
    decoratePainterlyShader(shader, family)
  }
  material.customProgramCacheKey = () => `${previousProgramKey()}|turtleback-painterly-v1:${family}`
  decoratedMaterials.set(material, family)
  material.needsUpdate = true
  return material
}

export function decoratePainterlyShader(
  shader: ShaderPatchTarget,
  family: PainterlySurfaceFamily,
): void {
  const profile = PAINTERLY_SURFACE_PROFILES[family]
  Object.assign(shader.uniforms, environmentUniforms, {
    uPainterlyWrap: { value: profile.wrap },
    uPainterlyToneStrength: { value: profile.tonalStrength },
    uPainterlyMacroScale: { value: profile.macroScale },
    uPainterlyMacroVariation: { value: profile.macroVariation },
    uPainterlyRimStrength: { value: profile.rimStrength },
    uPainterlyRimColor: { value: new Color('#d8e2da') },
  })

  shader.vertexShader = replaceRequired(
    shader.vertexShader,
    '#include <common>',
    `#include <common>
varying vec3 vPainterlyWorldPosition;`,
    'vertex common',
  )
  shader.vertexShader = replaceRequired(
    shader.vertexShader,
    '#include <project_vertex>',
    `#include <project_vertex>
vec4 painterlyWorldPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
  painterlyWorldPosition = batchingMatrix * painterlyWorldPosition;
#endif
#ifdef USE_INSTANCING
  painterlyWorldPosition = instanceMatrix * painterlyWorldPosition;
#endif
vPainterlyWorldPosition = (modelMatrix * painterlyWorldPosition).xyz;`,
    'vertex projection',
  )

  shader.fragmentShader = replaceRequired(
    shader.fragmentShader,
    '#include <common>',
    `#include <common>
varying vec3 vPainterlyWorldPosition;
uniform vec3 uPainterlySunDirection;
uniform vec3 uPainterlyShadowTint;
uniform vec3 uPainterlyHighlightTint;
uniform vec3 uPainterlyFogNear;
uniform vec3 uPainterlyFogMid;
uniform vec3 uPainterlyFogFar;
uniform vec3 uPainterlyFogSun;
uniform vec3 uPainterlyRimColor;
uniform float uPainterlyWrap;
uniform float uPainterlyToneStrength;
uniform float uPainterlyMacroScale;
uniform float uPainterlyMacroVariation;
uniform float uPainterlyRimStrength;`,
    'fragment common',
  )
  shader.fragmentShader = replaceRequired(
    shader.fragmentShader,
    'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
    `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
{
  vec3 painterlyNormal = normalize(inverseTransformDirection(normal, viewMatrix));
  vec3 painterlyView = normalize(cameraPosition - vPainterlyWorldPosition);
  float facing = dot(painterlyNormal, normalize(uPainterlySunDirection));
  float wrapped = clamp((facing + uPainterlyWrap) / (1.0 + uPainterlyWrap), 0.0, 1.0);
  float tonalPlane = smoothstep(0.12, 0.88, wrapped);
  vec3 tonalTint = mix(uPainterlyShadowTint, uPainterlyHighlightTint, tonalPlane);
  outgoingLight *= mix(vec3(1.0), tonalTint, uPainterlyToneStrength);

  vec3 macroPosition = vPainterlyWorldPosition / max(0.001, uPainterlyMacroScale);
  float macroField = (
    sin(macroPosition.x * 1.31 + macroPosition.z * 0.47) +
    sin(macroPosition.z * 1.17 - macroPosition.y * 0.33) +
    sin((macroPosition.x + macroPosition.z) * 0.61)
  ) / 3.0;
  outgoingLight *= 1.0 + macroField * uPainterlyMacroVariation;

  float rim = pow(1.0 - max(0.0, dot(painterlyNormal, painterlyView)), 3.0);
  outgoingLight += uPainterlyRimColor * rim * uPainterlyRimStrength;
}`,
    'outgoing light',
  )
  shader.fragmentShader = replaceRequired(
    shader.fragmentShader,
    '#include <fog_fragment>',
    `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  float nearBand = smoothstep(34.0, 145.0, vFogDepth);
  float farBand = smoothstep(165.0, 560.0, vFogDepth);
  vec3 painterlyFog = mix(uPainterlyFogNear, uPainterlyFogMid, nearBand);
  painterlyFog = mix(painterlyFog, uPainterlyFogFar, farBand);
  vec3 viewRay = normalize(vPainterlyWorldPosition - cameraPosition);
  float sunFacing = pow(max(0.0, dot(viewRay, normalize(uPainterlySunDirection))), 7.0);
  float horizonBand = 1.0 - smoothstep(0.08, 0.58, abs(viewRay.y));
  painterlyFog = mix(painterlyFog, uPainterlyFogSun, sunFacing * horizonBand * 0.42);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, painterlyFog, fogFactor);
#endif`,
    'fog fragment',
  )
}

function replaceRequired(
  source: string,
  search: string,
  replacement: string,
  label: string,
): string {
  if (!source.includes(search)) throw new Error(`Painterly shader is missing ${label} hook`)
  return source.replace(search, replacement)
}
