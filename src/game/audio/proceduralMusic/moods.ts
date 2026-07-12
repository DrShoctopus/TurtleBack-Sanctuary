/** Mood definitions for the four generative music states. Pure data + progression logic. */
import { mulberry32, type Rng } from '../../core/rng'
import { SCALES, type ScaleName } from './theory'

export type MusicMood = 'dawn' | 'day' | 'rain' | 'night'

export interface MoodConfig {
  bpm: number
  rootMidi: number
  scale: ScaleName
  /** chord degrees to draw a progression from */
  degrees: number[]
  /** how likely a melody note lands on a given eighth (0..1) */
  melodyDensity: number
  /** low-pass cutoff in Hz (tape warmth) */
  cutoff: number
  /** overall gain for this mood */
  gain: number
  /** vinyl/tape noise amount 0..1 */
  texture: number
  /** chords per bar changes: bars each chord lasts */
  chordBars: number
  padLevel: number
  bassLevel: number
  percLevel: number
}

export const MOODS: Record<MusicMood, MoodConfig> = {
  dawn: {
    bpm: 66,
    rootMidi: 62, // D
    scale: 'lydian',
    degrees: [0, 3, 4, 1],
    melodyDensity: 0.28,
    cutoff: 1600,
    gain: 0.85,
    texture: 0.35,
    chordBars: 2,
    padLevel: 0.9,
    bassLevel: 0.6,
    percLevel: 0.25,
  },
  day: {
    bpm: 74,
    rootMidi: 60, // C
    scale: 'major',
    degrees: [0, 4, 5, 3],
    melodyDensity: 0.4,
    cutoff: 2400,
    gain: 0.8,
    texture: 0.28,
    chordBars: 1,
    padLevel: 0.75,
    bassLevel: 0.7,
    percLevel: 0.5,
  },
  rain: {
    bpm: 62,
    rootMidi: 57, // A
    scale: 'dorian',
    degrees: [0, 3, 4, 6],
    melodyDensity: 0.22,
    cutoff: 1200,
    gain: 0.9,
    texture: 0.5,
    chordBars: 2,
    padLevel: 1.0,
    bassLevel: 0.55,
    percLevel: 0.3,
  },
  night: {
    bpm: 68,
    rootMidi: 55, // G
    scale: 'minor',
    degrees: [0, 5, 3, 4],
    melodyDensity: 0.2,
    cutoff: 1000,
    gain: 0.82,
    texture: 0.4,
    chordBars: 2,
    padLevel: 0.95,
    bassLevel: 0.65,
    percLevel: 0.22,
  },
}

/**
 * Build a deterministic chord progression (sequence of scale degrees) for a
 * mood + seed. Length is a multiple of the mood's phrase feel.
 */
export function buildProgression(mood: MoodConfig, seed: number, bars = 8): number[] {
  const rng: Rng = mulberry32(seed)
  const out: number[] = []
  const pool = mood.degrees
  let prev = -1
  for (let i = 0; i < bars; i++) {
    let d = pool[Math.floor(rng() * pool.length)]
    // avoid immediate repeats for gentle movement
    if (d === prev && pool.length > 1) d = pool[(pool.indexOf(d) + 1) % pool.length]
    prev = d
    out.push(d)
  }
  // resolve last chord to tonic for a settled loop
  out[out.length - 1] = 0
  return out
}

export function scaleIntervals(mood: MoodConfig): readonly number[] {
  return SCALES[mood.scale]
}
