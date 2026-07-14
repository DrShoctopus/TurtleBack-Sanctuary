/** Single import point for geometry merging (three-stdlib names it *BufferGeometries). */
import type { BufferGeometry } from 'three'
import { mergeBufferGeometries } from 'three-stdlib'

export function mergeGeometries(
  geometries: BufferGeometry[],
  useGroups = false,
): BufferGeometry | null {
  return mergeBufferGeometries(geometries, useGroups)
}
