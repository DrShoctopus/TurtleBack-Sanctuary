import type { WildlifeQualityBudget } from '../../core/quality'
import { SHOWCASE_WILDLIFE_ANCHORS, type WildlifeHabitatAnchor } from './habitat'
import {
  WILDLIFE_TICK_SECONDS,
  type WildlifeAgent,
  type WildlifeBehavior,
  type WildlifeCallEvent,
  type WildlifeCategory,
  type WildlifeContext,
  type WildlifeDirectorSnapshot,
  type WildlifeFrame,
  type WildlifeHabitat,
  type WildlifePosition,
  type WildlifeSpeciesId,
} from './types'

const CATEGORY_BY_SPECIES: Readonly<Record<WildlifeSpeciesId, WildlifeCategory>> = {
  'crownwood-songbird': 'canopy',
  'shell-hare': 'ground',
  'blossom-pollinators': 'insects',
  'lumenfen-insects': 'insects',
  'galecrest-seabird': 'coast',
  'shell-ray': 'ocean',
  'blossom-grazer': 'ground',
  'lumenfen-heron': 'wetland',
}

const GROUP_SIZE_BY_SPECIES: Readonly<Record<WildlifeSpeciesId, number>> = {
  'crownwood-songbird': 3,
  'shell-hare': 2,
  'blossom-pollinators': 5,
  'lumenfen-insects': 7,
  'galecrest-seabird': 3,
  'shell-ray': 3,
  'blossom-grazer': 1,
  'lumenfen-heron': 1,
}

const REPRESENTATION_BY_SPECIES: Readonly<Record<WildlifeSpeciesId, 'near' | 'distant'>> = {
  'crownwood-songbird': 'near',
  'shell-hare': 'near',
  'blossom-pollinators': 'near',
  'lumenfen-insects': 'near',
  'galecrest-seabird': 'distant',
  'shell-ray': 'distant',
  'blossom-grazer': 'near',
  'lumenfen-heron': 'near',
}

const CALL_INTERVAL_BY_SPECIES: Partial<Record<WildlifeSpeciesId, number>> = {
  'crownwood-songbird': 83,
  'galecrest-seabird': 137,
}

function hashString(value: string, seed: number): number {
  let hash = seed | 0
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 0x45d9f3b)
  return (hash ^ (hash >>> 16)) >>> 0
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function sortedUnique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort()
}

function behaviorFor(
  anchor: WildlifeHabitatAnchor,
  tick: number,
  context: WildlifeContext,
): WildlifeBehavior {
  const phase = mod(tick + hashString(anchor.id, 17), 240)
  if (anchor.speciesId === 'crownwood-songbird') {
    if (context.rain > 0.52 || context.time > 0.82 || context.time < 0.18) return 'perch'
    if (phase < 96) return 'perch'
    if (phase < 116) return 'takeoff'
    return phase < 218 ? 'flock' : 'perch'
  }
  if (anchor.speciesId === 'shell-hare') {
    const [x, , z] = anchor.position
    if (Math.hypot(context.player[0] - x, context.player[2] - z) < 8.5) return 'flee'
    if (context.rain > 0.58 || phase > 176) return 'rest'
    return 'forage'
  }
  if (anchor.speciesId === 'blossom-pollinators') {
    return context.rain > 0.44 || context.time > 0.78 || context.time < 0.2 ? 'rest' : 'drift'
  }
  if (anchor.speciesId === 'lumenfen-insects') {
    return context.time > 0.76 || context.time < 0.18 ? 'glow' : context.rain > 0.48 ? 'rest' : 'drift'
  }
  if (anchor.speciesId === 'blossom-grazer') {
    const [x, , z] = anchor.position
    if (Math.hypot(context.player[0] - x, context.player[2] - z) < 11) return 'flee'
    return context.rain > 0.6 || phase > 205 ? 'rest' : 'browse'
  }
  if (anchor.speciesId === 'lumenfen-heron') {
    if (context.rain > 0.72) return 'rest'
    return phase < 122 ? 'wade' : 'stalk'
  }
  if (anchor.speciesId === 'galecrest-seabird') return context.rain > 0.62 ? 'perch' : 'soar'
  return 'glide'
}

function animatePosition(
  anchor: WildlifeHabitatAnchor,
  behavior: WildlifeBehavior,
  elapsed: number,
  context: WildlifeContext,
): { position: WildlifePosition; heading: number } {
  const [x, y, z] = anchor.position
  const seed = hashString(anchor.id, 29)
  const phase = (seed % 997) / 997 * Math.PI * 2
  const comfort = context.reducedMotion ? 0.22 : 1
  const time = elapsed * comfort
  if (anchor.speciesId === 'crownwood-songbird') {
    if (behavior === 'perch') return { position: [x, y + Math.sin(time * 1.2 + phase) * 0.05, z], heading: phase }
    const radius = behavior === 'takeoff' ? 2.2 : 7.5 + (seed % 30) * 0.08
    const angle = time * (behavior === 'takeoff' ? 0.52 : 0.34) + phase
    return {
      position: [x + Math.cos(angle) * radius, y + 2.4 + Math.sin(angle * 1.7) * 1.6, z + Math.sin(angle) * radius],
      heading: -angle + Math.PI / 2,
    }
  }
  if (anchor.speciesId === 'shell-hare') {
    if (behavior === 'rest') return { position: [x, y, z], heading: phase }
    if (behavior === 'flee') {
      const dx = x - context.player[0]
      const dz = z - context.player[2]
      const length = Math.hypot(dx, dz) || 1
      const pulse = Math.min(5.5, Math.max(0, 8.5 - Math.hypot(dx, dz)))
      return { position: [x + dx / length * pulse, y, z + dz / length * pulse], heading: Math.atan2(dx, dz) }
    }
    const angle = time * 0.18 + phase
    return { position: [x + Math.cos(angle) * 1.8, y, z + Math.sin(angle) * 1.25], heading: angle + Math.PI / 2 }
  }
  if (anchor.speciesId === 'blossom-pollinators' || anchor.speciesId === 'lumenfen-insects') {
    const active = behavior === 'rest' ? 0.08 : 1
    return {
      position: [x + Math.cos(time * 0.42 + phase) * 2.8 * active, y + Math.sin(time * 0.7 + phase) * 1.1 * active, z + Math.sin(time * 0.31 + phase) * 2.4 * active],
      heading: time * 0.42 + phase,
    }
  }
  if (anchor.speciesId === 'galecrest-seabird') {
    if (behavior === 'perch') return { position: [x, y - 18, z], heading: phase }
    const radius = 22 + (seed % 18)
    const angle = elapsed * 0.075 + phase
    return { position: [x + Math.cos(angle) * radius, y + Math.sin(angle * 1.4) * 5, z + Math.sin(angle) * radius], heading: -angle + Math.PI / 2 }
  }
  if (anchor.speciesId === 'blossom-grazer') {
    if (behavior === 'rest') return { position: [x, y, z], heading: phase }
    if (behavior === 'flee') {
      const away = Math.atan2(x - context.player[0], z - context.player[2])
      return {
        position: [x + Math.sin(away) * 4.2, y, z + Math.cos(away) * 4.2],
        heading: away,
      }
    }
    const angle = time * 0.075 + phase
    return {
      position: [x + Math.cos(angle) * 2.4, y, z + Math.sin(angle) * 1.8],
      heading: angle + Math.PI / 2,
    }
  }
  if (anchor.speciesId === 'lumenfen-heron') {
    const pace = behavior === 'stalk' ? 0.035 : 0.07
    const angle = time * pace + phase
    return {
      position: [x + Math.cos(angle) * 1.6, y, z + Math.sin(angle) * 1.1],
      heading: angle + Math.PI / 2,
    }
  }
  const radius = 34 + (seed % 26)
  const angle = elapsed * 0.035 + phase
  return { position: [x + Math.cos(angle) * radius, y + Math.sin(angle * 1.5) * 1.4, z + Math.sin(angle) * radius], heading: -angle + Math.PI / 2 }
}

function scaleFor(anchor: WildlifeHabitatAnchor): number {
  const variation = 0.92 + (hashString(anchor.id, 41) % 19) / 100
  if (anchor.speciesId === 'shell-ray') return variation * 4.1
  if (anchor.speciesId === 'galecrest-seabird') return variation * 1.7
  if (anchor.speciesId === 'shell-hare') return variation * 1.25
  if (anchor.speciesId === 'blossom-grazer') return variation * 1.45
  if (anchor.speciesId === 'lumenfen-heron') return variation * 1.18
  return variation
}

function coverageFirstSelection(
  agents: readonly WildlifeAgent[],
  budget: WildlifeQualityBudget,
): readonly WildlifeAgent[] {
  const selected: WildlifeAgent[] = []
  const used = new Set<string>()
  const addFirst = (predicate: (agent: WildlifeAgent) => boolean) => {
    const candidate = agents.find((agent) => !used.has(agent.id) && predicate(agent))
    if (!candidate) return
    used.add(candidate.id)
    selected.push(candidate)
  }
  for (const habitat of [
    'crownwood',
    'shell-meadow',
    'garden-wetland',
    'galecrest',
    'open-ocean',
    'blossomshade',
    'lumenfen',
  ] as const) {
    addFirst((agent) => agent.habitat === habitat)
  }
  for (const category of ['canopy', 'ground', 'insects', 'coast', 'ocean', 'wetland'] as const) {
    addFirst((agent) => agent.category === category)
  }
  const maxTotal = budget.maxNearAgents + budget.maxDistantGroups
  for (const agent of agents) {
    if (selected.length >= maxTotal) break
    if (used.has(agent.id)) continue
    const cap = agent.representation === 'near' ? budget.maxNearAgents : budget.maxDistantGroups
    const count = selected.filter((entry) => entry.representation === agent.representation).length
    if (count >= cap) continue
    used.add(agent.id)
    selected.push(agent)
  }
  return selected
}

export class WildlifeDirector {
  private readonly anchors: readonly WildlifeHabitatAnchor[]
  private accumulator = 0
  private tick = 0
  private elapsedSeconds = 0
  private ownedCalls = 0
  private orphanCalls = 0
  private lastFrame: WildlifeFrame | null = null
  private lastContext: WildlifeContext | null = null

  constructor(private readonly worldSeed: number, anchors = SHOWCASE_WILDLIFE_ANCHORS) {
    this.anchors = [...anchors].sort((left, right) => right.importance - left.importance || left.id.localeCompare(right.id))
  }

  update(dt: number, context: WildlifeContext, budget: WildlifeQualityBudget): WildlifeFrame {
    const safeDt = Number.isFinite(dt) ? Math.min(0.5, Math.max(0, dt)) : 0
    // Microsecond quantization makes visual time independent of equivalent
    // 50/100 ms render-frame chunking while remaining far below perception.
    this.elapsedSeconds = Math.round((this.elapsedSeconds + safeDt) * 1_000_000) / 1_000_000
    this.accumulator += safeDt
    const calls: WildlifeCallEvent[] = []
    let catchup = 0
    while (this.accumulator + 1e-9 >= WILDLIFE_TICK_SECONDS && catchup++ < 5) {
      this.accumulator -= WILDLIFE_TICK_SECONDS
      this.tick++
    }
    if (catchup >= 5) this.accumulator = 0

    const canonical = this.anchors.map((anchor): WildlifeAgent => {
      const behavior = behaviorFor(anchor, this.tick, context)
      const animated = animatePosition(anchor, behavior, this.elapsedSeconds, context)
      return {
        id: `wildlife:${anchor.id}`,
        speciesId: anchor.speciesId,
        category: CATEGORY_BY_SPECIES[anchor.speciesId],
        habitat: anchor.habitat,
        representation: REPRESENTATION_BY_SPECIES[anchor.speciesId],
        position: animated.position,
        home: anchor.position,
        heading: animated.heading,
        phase: (hashString(anchor.id, this.worldSeed) % 1000) / 1000,
        scale: scaleFor(anchor),
        behavior,
        groupSize: GROUP_SIZE_BY_SPECIES[anchor.speciesId],
        callCapable: anchor.speciesId in CALL_INTERVAL_BY_SPECIES,
      }
    })
    const selected = coverageFirstSelection(canonical, budget)

    for (const agent of selected) {
      const interval = CALL_INTERVAL_BY_SPECIES[agent.speciesId]
      if (!interval || context.rain > 0.62 || context.time > 0.82 || context.time < 0.17) continue
      const offset = hashString(agent.id, this.worldSeed) % interval
      if (mod(this.tick, interval) !== offset) continue
      if (context.quietMode && mod(Math.floor(this.tick / interval), 3) !== 0) continue
      calls.push({
        tick: this.tick,
        emitterId: agent.id,
        speciesId: agent.speciesId,
        variant: hashString(`${agent.id}:${this.tick}`, this.worldSeed) % 3,
        position: agent.position,
        gain: context.quietMode ? 0.38 : context.rain > 0.2 ? 0.62 : 1,
      })
      this.ownedCalls++
    }

    const frame: WildlifeFrame = {
      tick: this.tick,
      elapsedSeconds: this.elapsedSeconds,
      agents: selected,
      calls,
      categories: sortedUnique(selected.map((agent) => agent.category)),
      habitats: sortedUnique(selected.map((agent) => agent.habitat)),
      representedEmitterIds: selected.map((agent) => agent.id),
      budget,
    }
    this.lastFrame = frame
    this.lastContext = context
    return frame
  }

  snapshot(): WildlifeDirectorSnapshot {
    const frame = this.lastFrame
    const context = this.lastContext
    const agents = frame?.agents ?? []
    return {
      tick: this.tick,
      pooledAgents: this.anchors.length,
      activeAgents: agents.length,
      nearAgents: agents.filter((agent) => agent.representation === 'near').length,
      distantGroups: agents.filter((agent) => agent.representation === 'distant').length,
      categories: sortedUnique(agents.map((agent) => agent.category)),
      habitats: sortedUnique(agents.map((agent) => agent.habitat)),
      species: sortedUnique(agents.map((agent) => agent.speciesId)),
      behaviors: sortedUnique(agents.map((agent) => agent.behavior)),
      representedEmitters: frame?.representedEmitterIds.length ?? 0,
      ownedCalls: this.ownedCalls,
      orphanCalls: this.orphanCalls,
      quietMode: context?.quietMode ?? false,
      rainResponse: (context?.rain ?? 0) > 0.5 ? 'sheltering' : 'clear-weather',
      timeResponse: (context?.time ?? 0.5) > 0.78 || (context?.time ?? 0.5) < 0.18 ? 'night' : 'day',
    }
  }

  dispose(): void {
    this.lastFrame = null
    this.lastContext = null
    this.accumulator = 0
  }
}

export function simulateFiveMinuteShowcase(
  worldSeed: number,
  budget: WildlifeQualityBudget,
): Readonly<{ seconds: number; categories: readonly WildlifeCategory[]; habitats: readonly WildlifeHabitat[]; calls: number }> {
  const director = new WildlifeDirector(worldSeed)
  const categories = new Set<WildlifeCategory>()
  const habitats = new Set<WildlifeHabitat>()
  let calls = 0
  for (let step = 0; step < 3_000; step++) {
    const progress = step / 2_999
    const frame = director.update(0.1, {
      player: [Math.sin(progress * Math.PI * 2) * 112, 18, -205 + progress * 390],
      time: 0.34 + progress * 0.32,
      rain: step > 1_900 && step < 2_200 ? 0.72 : 0,
      wind: 0.5,
      quietMode: false,
      reducedMotion: false,
    }, budget)
    frame.categories.forEach((category) => categories.add(category))
    frame.habitats.forEach((habitat) => habitats.add(habitat))
    calls += frame.calls.length
  }
  director.dispose()
  return { seconds: 300, categories: [...categories].sort(), habitats: [...habitats].sort(), calls }
}
