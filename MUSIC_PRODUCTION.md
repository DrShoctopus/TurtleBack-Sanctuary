# Music Production & Replacement

Turtleback Sanctuary ships an **original, real-time generative** lo-fi
soundtrack — no audio files are bundled. This document explains that engine and
the clean path to add professionally produced original tracks later.

## The generative engine (default)

Source: `src/game/audio/proceduralMusic/`.

- `theory.ts` — pure helpers (MIDI↔frequency, scales, chord building, scale
  quantization). Unit-tested.
- `moods.ts` — four mood configs (**dawn / day / rain / night**): tempo (60–78
  BPM), root, scale, chord-degree pool, densities, filter cutoff, texture. Also
  the seeded chord-progression builder. Unit-tested.
- `MusicEngine.ts` — a Web Audio lookahead scheduler that renders, per mood:
  soft electric-piano chords, a sustained pad, gentle sine bass, brushed
  percussion, a sparse non-repeating melody, and procedural vinyl/tape texture
  with wow-and-flutter. Moods crossfade with time of day and weather.

Everything is **deterministic** from the world seed, so a session can be
reproduced for testing. There are no samples, no recognizable melodies, and no
copyrighted material.

### Tuning it

- Change tempo, key, chords, or feel per mood in `moods.ts`.
- Change synthesis (voices, envelopes, filters) in `MusicEngine.ts`.
- The mood-selection rules live in `AudioManager.moodFromWorld()`.

## Adding professionally produced original tracks

The real-time engine always works with **no assets present**. To layer in
produced audio (which you must create or license for redistribution):

1. **Create original tracks.** They must be your own work or explicitly licensed
   for redistribution (see ASSET_LICENSES.md). Do not use copyrighted songs,
   melodies, stems, or samples.
2. **Drop the files** into `public/audio/music/`. Use broadly compatible formats
   (`.mp3`, `.m4a`, `.ogg`/`.opus`). Keep them reasonably sized; they are lazy-loaded.
3. **Register them.** Add entries to a config array consumed by the media
   player. The simplest hook is to extend `BUILTIN_ITEMS` in
   `src/game/media/MediaPlayer.ts` with `{ kind: 'local', title, ... }`-style
   items whose `track.getUrl()` resolves to `import.meta.env.BASE_URL +
   'audio/music/your-track.mp3'`, or add a small loader that fetches a
   `public/config/music.json` manifest at startup. These play through the
   **media** bus, independent of the generative **music** bus, so both can
   coexist and each keeps its own volume slider.
4. **(Optional) prefer produced over generative.** If you want produced tracks
   to replace the generative soundtrack for a given mood, call
   `audio.setMusicEnabled(false)` (via the Sanctuary → Audio "Original
   soundtrack" toggle) and drive the produced playlist instead.

### Offline-render approach (documented, optional)

If you want to bake the *generative* engine's output into files (e.g. to ship a
fixed soundtrack), render it offline with an `OfflineAudioContext`:

```ts
// scripts/render-music.ts (illustrative; run with a DOM-less Web Audio shim
// such as `node-web-audio-api`, or in a headless browser page)
import { MusicEngine } from '../src/game/audio/proceduralMusic/MusicEngine'

async function render(mood: 'dawn' | 'day' | 'rain' | 'night', seconds = 120) {
  const ctx = new OfflineAudioContext(2, 44100 * seconds, 44100)
  const engine = new MusicEngine(ctx as unknown as AudioContext, ctx.destination, 20260712)
  engine.setMood(mood)
  engine.start()
  // NOTE: the engine uses setTimeout scheduling for the real-time path; for a
  // true offline render, adapt the scheduler to advance against ctx.currentTime
  // deterministically. This is left as a documented exercise since the shipped
  // game intentionally runs the engine in real time.
  const buffer = await ctx.startRendering()
  // encode `buffer` to WAV/OGG and write into public/audio/music/
}
```

Because the shipped game runs the engine in real time (which needs no build
step and stays deterministic), no binary tracks are required for the game to
work. The offline path above is provided for teams that want fixed files.

## License reminder

Any audio you add must be original or redistributable and **must be recorded in
`ASSET_LICENSES.md`**. Never add copyrighted music, and never circumvent
YouTube or radio platform controls.
