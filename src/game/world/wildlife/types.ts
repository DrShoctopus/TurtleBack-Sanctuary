import type { WildlifeQualityBudget } from '../../core/quality'

export const WILDLIFE_TICK_SECONDS = 0.1

export const WILDLIFE_SPECIES = [
  'crownwood-songbird',
  'shell-hare',
  'blossom-pollinators',
  'lumenfen-insects',
  'galecrest-seabird',
  'shell-ray',
  'blossom-grazer',
  'lumenfen-heron',
] as const

export type WildlifeSpeciesId = (typeof WILDLIFE_SPECIES)[number]
export type WildlifeCategory = 'canopy' | 'ground' | 'insects' | 'coast' | 'ocean' | 'wetland'
export type WildlifeHabitat =
  | 'crownwood'
  | 'shell-meadow'
  | 'garden-wetland'
  | 'galecrest'
  | 'open-ocean'
  | 'blossomshade'
  | 'lumenfen'
export type WildlifeRepresentation = 'near' | 'distant'
export type WildlifeBehavior =
  | 'perch'
  | 'takeoff'
  | 'flock'
  | 'forage'
  | 'rest'
  | 'flee'
  | 'drift'
  | 'glow'
  | 'soar'
  | 'glide'
  | 'browse'
  | 'wade'
  | 'stalk'

export type WildlifePosition = readonly [number, number, number]

export interface WildlifeAgent {
  readonly id: string
  readonly speciesId: WildlifeSpeciesId
  readonly category: WildlifeCategory
  readonly habitat: WildlifeHabitat
  readonly representation: WildlifeRepresentation
  readonly position: WildlifePosition
  readonly home: WildlifePosition
  readonly heading: number
  readonly phase: number
  readonly scale: number
  readonly behavior: WildlifeBehavior
  readonly groupSize: number
  readonly callCapable: boolean
}

export interface WildlifeContext {
  readonly player: WildlifePosition
  readonly time: number
  readonly rain: number
  readonly wind: number
  readonly quietMode: boolean
  readonly reducedMotion: boolean
}

export interface WildlifeCallEvent {
  readonly tick: number
  readonly emitterId: string
  readonly speciesId: WildlifeSpeciesId
  readonly variant: number
  readonly position: WildlifePosition
  readonly gain: number
}

export interface WildlifeFrame {
  readonly tick: number
  readonly elapsedSeconds: number
  readonly agents: readonly WildlifeAgent[]
  readonly calls: readonly WildlifeCallEvent[]
  readonly categories: readonly WildlifeCategory[]
  readonly habitats: readonly WildlifeHabitat[]
  readonly representedEmitterIds: readonly string[]
  readonly budget: WildlifeQualityBudget
}

export interface WildlifeDirectorSnapshot {
  readonly tick: number
  readonly pooledAgents: number
  readonly activeAgents: number
  readonly nearAgents: number
  readonly distantGroups: number
  readonly categories: readonly WildlifeCategory[]
  readonly habitats: readonly WildlifeHabitat[]
  readonly species: readonly WildlifeSpeciesId[]
  readonly behaviors: readonly WildlifeBehavior[]
  readonly representedEmitters: number
  readonly ownedCalls: number
  readonly orphanCalls: number
  readonly quietMode: boolean
  readonly rainResponse: 'sheltering' | 'clear-weather'
  readonly timeResponse: 'night' | 'day'
}
