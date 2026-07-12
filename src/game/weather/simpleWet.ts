/**
 * Simple wetness response for shared standard materials (exteriors):
 * rain lowers roughness and darkens color slightly. Interiors never register.
 */
import type { Color, MeshStandardMaterial } from 'three'

interface Entry {
  mat: MeshStandardMaterial
  dryRoughness: number
  wetRoughness: number
  baseColor: Color
  darken: number
}

const entries: Entry[] = []

export function registerWetMaterial(
  mat: MeshStandardMaterial,
  opts?: { wetRoughness?: number; darken?: number },
): void {
  entries.push({
    mat,
    dryRoughness: mat.roughness,
    wetRoughness: opts?.wetRoughness ?? Math.max(0.25, mat.roughness * 0.45),
    baseColor: mat.color.clone(),
    darken: opts?.darken ?? 0.22,
  })
}

export function applySimpleWetness(wetness: number): void {
  for (const e of entries) {
    e.mat.roughness = e.dryRoughness + (e.wetRoughness - e.dryRoughness) * wetness
    e.mat.color.copy(e.baseColor).multiplyScalar(1 - e.darken * wetness)
  }
}
