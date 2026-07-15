/** Pure music-theory helpers for the generative engine. No audio deps — testable. */

/** MIDI note → frequency (A4 = 69 = 440Hz). */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Scale interval sets (semitones from root). */
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
} as const

export type ScaleName = keyof typeof SCALES

/** Build a chord (root-position triad or seventh) as MIDI notes from a scale degree. */
export function chordFromDegree(
  rootMidi: number,
  scale: readonly number[],
  degree: number,
  opts: { seventh?: boolean; add9?: boolean } = {},
): number[] {
  const at = (d: number) => {
    const octave = Math.floor(d / scale.length)
    const idx = ((d % scale.length) + scale.length) % scale.length
    return rootMidi + octave * 12 + scale[idx]
  }
  const notes = [at(degree), at(degree + 2), at(degree + 4)]
  if (opts.seventh) notes.push(at(degree + 6))
  if (opts.add9) notes.push(at(degree + 8))
  return notes
}

/** Nearest scale note at or above a midi value. */
export function quantizeToScale(midi: number, rootMidi: number, scale: readonly number[]): number {
  const rel = midi - rootMidi
  const octave = Math.floor(rel / 12)
  const within = ((rel % 12) + 12) % 12
  let best = scale[0]
  let bestDist = 99
  for (const s of scale) {
    const d = Math.abs(s - within)
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  return rootMidi + octave * 12 + best
}
