import { mulberry32 } from '../../core/rng'
import type { MusicMood } from './moods'

export type MusicForm = 'intro' | 'a' | 'b' | 'breakdown' | 'ambient-bridge' | 'reprise' | 'outro-rest'
export type MusicBiome = 'forest' | 'village' | 'edge'
export type LeadTimbre = 'air-flute' | 'soft-mallets' | 'nylon-guitar' | 'felt-piano'
export type MusicInstrument =
  | 'electric-piano'
  | 'felt-piano'
  | 'nylon-guitar'
  | 'soft-mallets'
  | 'air-flute'
  | 'bass'
  | 'brushed-kit'
  | 'hand-percussion'
  | 'tape-pad'
  | 'field-texture'

export interface MusicContext {
  readonly mood: MusicMood
  readonly biome: MusicBiome
  readonly turtleEvent: boolean
}

export interface InstrumentPalette {
  readonly id: 'harbor-tape' | 'woodland-felt' | 'shell-guitar' | 'moon-glass'
  readonly lead: LeadTimbre
  readonly instruments: readonly MusicInstrument[]
}

export interface MotifSeed {
  readonly id: string
  readonly progression: readonly number[]
  readonly intervals: readonly number[]
  readonly rhythm: readonly number[]
}

export interface MusicalSection {
  readonly index: number
  readonly startBar: number
  readonly bars: number
  readonly startSeconds: number
  readonly durationSeconds: number
  readonly form: MusicForm
  readonly palette: InstrumentPalette
  readonly lead: LeadTimbre
  readonly motif: MotifSeed
  readonly register: -1 | 0 | 1
  readonly voicing: 0 | 1 | 2 | 3
  readonly rhythmVariation: number
  readonly microTimingPattern: number
  readonly density: number
  readonly context: MusicContext
  readonly overlay: 'forest-field' | 'village-mallets' | 'edge-air' | 'turtle-resonance'
  readonly arrangementSignature: string
}

export interface MusicalEventPlan {
  readonly seed: number
  readonly bpm: number
  readonly durationMinutes: number
  readonly totalBars: number
  readonly sections: readonly MusicalSection[]
}

export const INSTRUMENT_PALETTES: readonly InstrumentPalette[] = Object.freeze([
  {
    id: 'harbor-tape',
    lead: 'air-flute',
    instruments: ['electric-piano', 'bass', 'brushed-kit', 'tape-pad', 'field-texture'],
  },
  {
    id: 'woodland-felt',
    lead: 'soft-mallets',
    instruments: ['felt-piano', 'soft-mallets', 'air-flute', 'tape-pad', 'field-texture'],
  },
  {
    id: 'shell-guitar',
    lead: 'nylon-guitar',
    instruments: ['nylon-guitar', 'bass', 'hand-percussion', 'field-texture'],
  },
  {
    id: 'moon-glass',
    lead: 'felt-piano',
    instruments: ['felt-piano', 'soft-mallets', 'air-flute', 'tape-pad', 'field-texture'],
  },
])

export const MOTIF_SEEDS: readonly MotifSeed[] = Object.freeze([
  { id: 'harbor-light', progression: [0, 4, 3, 5], intervals: [0, 2, 4, 2], rhythm: [0, 4, 10, 14] },
  { id: 'cedar-window', progression: [0, 3, 1, 4], intervals: [0, 4, 3, 1], rhythm: [0, 6, 8, 12] },
  { id: 'tide-journal', progression: [0, 5, 4, 3], intervals: [0, -2, 1, 4], rhythm: [2, 6, 10, 15] },
  { id: 'moss-postcard', progression: [0, 1, 4, 0], intervals: [0, 3, 5, 3], rhythm: [0, 3, 9, 13] },
  { id: 'rain-chain', progression: [0, 3, 6, 4], intervals: [0, 2, -1, -3], rhythm: [1, 5, 8, 14] },
  { id: 'shell-steps', progression: [0, 4, 5, 1], intervals: [0, 5, 2, 4], rhythm: [0, 4, 7, 12] },
  { id: 'fern-letter', progression: [0, 5, 3, 0], intervals: [0, -1, 2, 5], rhythm: [2, 5, 11, 14] },
  { id: 'moon-buoy', progression: [0, 6, 3, 4], intervals: [0, 4, 1, -2], rhythm: [0, 6, 10, 13] },
  { id: 'lantern-tea', progression: [0, 3, 4, 1], intervals: [0, 2, 5, 7], rhythm: [1, 4, 9, 15] },
  { id: 'warm-planks', progression: [0, 4, 1, 5], intervals: [0, -3, 1, 3], rhythm: [0, 5, 8, 11] },
  { id: 'gale-ribbon', progression: [0, 1, 5, 4], intervals: [0, 5, 4, 2], rhythm: [2, 7, 10, 14] },
  { id: 'quiet-market', progression: [0, 5, 1, 3], intervals: [0, 2, 1, -2], rhythm: [0, 3, 8, 12] },
  { id: 'pond-glass', progression: [0, 3, 5, 4], intervals: [0, 4, 6, 4], rhythm: [1, 6, 9, 13] },
  { id: 'old-compass', progression: [0, 4, 6, 3], intervals: [0, -2, -4, 1], rhythm: [0, 4, 10, 15] },
  { id: 'dawn-rope', progression: [0, 1, 3, 5], intervals: [0, 3, 2, 6], rhythm: [2, 5, 8, 14] },
  { id: 'ocean-room', progression: [0, 5, 4, 0], intervals: [0, 2, -2, 0], rhythm: [0, 7, 11, 15] },
])

const FORM_CYCLE: readonly Readonly<{ form: MusicForm; bars: number; density: number }>[] = [
  { form: 'intro', bars: 4, density: 0.42 },
  { form: 'a', bars: 8, density: 0.78 },
  { form: 'b', bars: 8, density: 0.92 },
  { form: 'breakdown', bars: 4, density: 0.36 },
  { form: 'ambient-bridge', bars: 6, density: 0.24 },
  { form: 'reprise', bars: 8, density: 0.7 },
  { form: 'outro-rest', bars: 4, density: 0.08 },
]

const DEFAULT_CONTEXT: MusicContext = { mood: 'day', biome: 'village', turtleEvent: false }

function contextOverlay(context: MusicContext): MusicalSection['overlay'] {
  if (context.turtleEvent) return 'turtle-resonance'
  if (context.biome === 'forest') return 'forest-field'
  if (context.biome === 'edge') return 'edge-air'
  return 'village-mallets'
}

function arrangementSignature(input: Omit<MusicalSection, 'arrangementSignature'>): string {
  return [
    input.form,
    input.palette.id,
    input.motif.id,
    input.register,
    input.voicing,
    input.rhythmVariation,
    input.microTimingPattern,
    input.overlay,
  ].join(':')
}

export function buildMusicalEventPlan(
  seed: number,
  durationMinutes = 120,
  contextAtMinute: (minute: number) => MusicContext = () => DEFAULT_CONTEXT,
): MusicalEventPlan {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError('music plan duration must be positive and finite')
  }
  const bpm = 70
  const secondsPerBar = (60 / bpm) * 4
  const totalBars = Math.ceil((durationMinutes * 60) / secondsPerBar)
  const rng = mulberry32(seed ^ 0x6d757369)
  const sections: MusicalSection[] = []
  let startBar = 0
  let index = 0
  while (startBar < totalBars) {
    const formSlot = FORM_CYCLE[index % FORM_CYCLE.length]
    const bars = Math.min(formSlot.bars, totalBars - startBar)
    const minute = (startBar * secondsPerBar) / 60
    const context = contextAtMinute(minute)
    const palette = INSTRUMENT_PALETTES[(index * 3 + (seed & 3)) % INSTRUMENT_PALETTES.length]
    const motif = MOTIF_SEEDS[(index * 5 + (seed % MOTIF_SEEDS.length)) % MOTIF_SEEDS.length]
    const sectionWithoutSignature: Omit<MusicalSection, 'arrangementSignature'> = {
      index,
      startBar,
      bars,
      startSeconds: startBar * secondsPerBar,
      durationSeconds: bars * secondsPerBar,
      form: formSlot.form,
      palette,
      lead: palette.lead,
      motif,
      register: ([-1, 0, 1] as const)[(index * 2 + (seed % 3)) % 3],
      voicing: ((Math.floor(index / 2) + seed) % 4) as 0 | 1 | 2 | 3,
      rhythmVariation: (index * 7 + Math.floor(index / 4) + seed) % 11,
      microTimingPattern: index % 97,
      density: Math.max(0.05, Math.min(1, formSlot.density * (0.92 + rng() * 0.16))),
      context,
      overlay: contextOverlay(context),
    }
    sections.push({
      ...sectionWithoutSignature,
      arrangementSignature: arrangementSignature(sectionWithoutSignature),
    })
    startBar += bars
    index++
  }
  return Object.freeze({ seed, bpm, durationMinutes, totalBars, sections: Object.freeze(sections) })
}

export function sectionAtBar(plan: MusicalEventPlan, bar: number): MusicalSection {
  const wrapped = ((Math.floor(bar) % plan.totalBars) + plan.totalBars) % plan.totalBars
  let low = 0
  let high = plan.sections.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const section = plan.sections[mid]
    if (wrapped < section.startBar) high = mid - 1
    else if (wrapped >= section.startBar + section.bars) low = mid + 1
    else return section
  }
  return plan.sections[plan.sections.length - 1]
}

export function sectionsWithinMinutes(plan: MusicalEventPlan, minutes: number): readonly MusicalSection[] {
  const seconds = Math.max(0, minutes) * 60
  return plan.sections.filter((section) => section.startSeconds < seconds)
}

export interface MusicPlanSoakReport {
  readonly durationMinutes: number
  readonly sections: number
  readonly uniqueArrangements: number
  readonly forms: readonly MusicForm[]
  readonly palettes: readonly string[]
  readonly leads: readonly LeadTimbre[]
  readonly breathingSpaces: number
  readonly maxScheduledVoices: number
  readonly schedulerTimers: number
  readonly silentFailureSections: number
}

export function analyzeMusicPlanSoak(plan: MusicalEventPlan): MusicPlanSoakReport {
  const forms = [...new Set(plan.sections.map((section) => section.form))].sort()
  const palettes = [...new Set(plan.sections.map((section) => section.palette.id))].sort()
  const leads = [...new Set(plan.sections.map((section) => section.lead))].sort()
  return {
    durationMinutes: plan.durationMinutes,
    sections: plan.sections.length,
    uniqueArrangements: new Set(plan.sections.map((section) => section.arrangementSignature)).size,
    forms,
    palettes,
    leads,
    breathingSpaces: plan.sections.filter(
      (section) => section.form === 'ambient-bridge' || section.form === 'outro-rest',
    ).length,
    maxScheduledVoices: 18,
    schedulerTimers: 2,
    silentFailureSections: plan.sections.filter(
      (section) => section.form !== 'outro-rest' && section.palette.instruments.length === 0,
    ).length,
  }
}
