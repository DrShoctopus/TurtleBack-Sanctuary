import type { CellKey } from '../world/spatial/types'
import type { TurtleLod } from '../world/turtle/modelContract'
import type { TurtleScaleEventKind } from '../world/turtle/types'

export interface SceneProbeSnapshot {
  activeCells: readonly CellKey[]
  retainedCells: readonly CellKey[]
  instancesByFamily: Readonly<Record<string, number>>
  lodsByFamily: Readonly<Record<string, Readonly<Record<string, number>>>>
  loadedAssetIds: readonly string[]
  fallbackAssetIds: readonly string[]
  decodedAssetBytesById: Readonly<Record<string, number>>
  renderer: {
    calls: number
    triangles: number
    points: number
    geometries: number
    textures: number
  }
  estimatedTextureBytes: number
  sections: ProbeSections
}

export interface TurtleProbeSection {
  readonly __sectionBrand?: 'turtle'
  model?: string
  fallback?: boolean
  lod?: TurtleLod
  wakeStrength?: number
  resonanceStrength?: number
  activeEvent?: TurtleScaleEventKind | null
}

export interface WildlifeProbeSection {
  readonly __sectionBrand?: 'wildlife'
}

export interface AudioProbeSection {
  readonly __sectionBrand?: 'audio'
}

export interface AtmosphereProbeSection {
  readonly __sectionBrand?: 'atmosphere'
}

export interface WorldProbeSection {
  centerCell: CellKey
  activeCellCount: number
  retainedCellCount: number
  vegetationInstances: number
  forestInstances: number
  forestLod: 0 | 1 | 2
  forestDiscoveries: number
  forestLayers: Readonly<Record<string, number>>
}

export interface ProbeSectionMap {
  turtle: TurtleProbeSection
  world: WorldProbeSection
  wildlife: WildlifeProbeSection
  audio: AudioProbeSection
  atmosphere: AtmosphereProbeSection
}

export type ProbeSections = { [K in keyof ProbeSectionMap]?: ProbeSectionMap[K] }
export type ProbeSectionName = keyof ProbeSectionMap
export type ProbeSectionContributor<K extends ProbeSectionName> = () => Partial<ProbeSectionMap[K]>

export type ProbeContributor = () => Partial<Omit<SceneProbeSnapshot, 'sections'>>

interface RegisteredRootContributor {
  readonly token: symbol
  readonly contributor: ProbeContributor
}

interface RegisteredSectionContributor {
  readonly token: symbol
  readonly contributor: () => object
}

const SECTION_NAMES: readonly ProbeSectionName[] = [
  'atmosphere',
  'audio',
  'turtle',
  'wildlife',
  'world',
]
const rootContributors = new Map<string, RegisteredRootContributor>()
const sectionContributors = new Map<ProbeSectionName, Map<string, RegisteredSectionContributor>>()

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function assertContributorId(id: string): void {
  if (id.trim() === '' || id !== id.trim()) {
    throw new Error('Probe contributor ID must be nonblank with no surrounding whitespace')
  }
}

function sortedStrings<T extends string>(values: readonly T[]): readonly T[] {
  return [...values].sort(compareCodePoints)
}

function sortedRecord<T>(record: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareCodePoints(left, right)),
  )
}

function sortedNestedNumberRecord(
  record: Readonly<Record<string, Readonly<Record<string, number>>>>,
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([family, lods]) => [family, sortedRecord(lods)]),
  )
}

export function registerProbeContributor(name: string, contributor: ProbeContributor): () => void {
  assertContributorId(name)
  if (rootContributors.has(name)) {
    throw new Error(`Duplicate root probe contributor ID: ${name}`)
  }

  const registration = { token: Symbol(name), contributor }
  rootContributors.set(name, registration)
  let unregistered = false
  return () => {
    if (unregistered) return
    unregistered = true
    if (rootContributors.get(name)?.token === registration.token) rootContributors.delete(name)
  }
}

export function registerProbeSection<K extends ProbeSectionName>(
  section: K,
  contributorId: string,
  contributor: ProbeSectionContributor<K>,
): () => void {
  assertContributorId(contributorId)
  const contributors = sectionContributors.get(section) ?? new Map()
  if (contributors.has(contributorId)) {
    throw new Error(`Duplicate probe contributor ID in section ${section}: ${contributorId}`)
  }

  const registration: RegisteredSectionContributor = {
    token: Symbol(`${section}:${contributorId}`),
    contributor,
  }
  contributors.set(contributorId, registration)
  sectionContributors.set(section, contributors)
  let unregistered = false
  return () => {
    if (unregistered) return
    unregistered = true
    const current = sectionContributors.get(section)
    if (current?.get(contributorId)?.token !== registration.token) return
    current.delete(contributorId)
    if (current.size === 0) sectionContributors.delete(section)
  }
}

function collectSections(base: ProbeSections): ProbeSections {
  const sections: Partial<Record<ProbeSectionName, object>> = {}

  for (const section of SECTION_NAMES) {
    const merged: Record<string, unknown> = {}
    const owners = new Map<string, string>()
    const baseSection = base[section]
    if (baseSection) {
      for (const [key, value] of Object.entries(baseSection).sort(([left], [right]) =>
        compareCodePoints(left, right),
      )) {
        if (value === undefined) continue
        merged[key] = value
      }
    }

    const contributors = [...(sectionContributors.get(section)?.entries() ?? [])].sort(
      ([left], [right]) => compareCodePoints(left, right),
    )
    for (const [contributorId, registration] of contributors) {
      const contribution = registration.contributor()
      for (const [key, value] of Object.entries(contribution).sort(([left], [right]) =>
        compareCodePoints(left, right),
      )) {
        if (value === undefined) continue
        const previousOwner = owners.get(key)
        if (previousOwner) {
          throw new Error(
            `Probe section ${section} leaf ${key} is owned by both ${previousOwner} and ${contributorId}`,
          )
        }
        owners.set(key, contributorId)
        merged[key] = value
      }
    }

    if (Object.keys(merged).length > 0) sections[section] = sortedRecord(merged)
  }

  return sections as ProbeSections
}

export function collectSceneProbe(base: SceneProbeSnapshot): SceneProbeSnapshot {
  const merged: Omit<SceneProbeSnapshot, 'sections'> = { ...base }
  const contributors = [...rootContributors.entries()].sort(([left], [right]) =>
    compareCodePoints(left, right),
  )
  for (const [, registration] of contributors) {
    const contribution = registration.contributor()
    for (const [key, value] of Object.entries(contribution)) {
      if (value !== undefined) (merged as unknown as Record<string, unknown>)[key] = value
    }
  }

  return {
    activeCells: sortedStrings(merged.activeCells),
    retainedCells: sortedStrings(merged.retainedCells),
    instancesByFamily: sortedRecord(merged.instancesByFamily),
    lodsByFamily: sortedNestedNumberRecord(merged.lodsByFamily),
    loadedAssetIds: sortedStrings(merged.loadedAssetIds),
    fallbackAssetIds: sortedStrings(merged.fallbackAssetIds),
    decodedAssetBytesById: sortedRecord(merged.decodedAssetBytesById),
    renderer: {
      calls: merged.renderer.calls,
      triangles: merged.renderer.triangles,
      points: merged.renderer.points,
      geometries: merged.renderer.geometries,
      textures: merged.renderer.textures,
    },
    estimatedTextureBytes: merged.estimatedTextureBytes,
    sections: collectSections(base.sections),
  }
}
