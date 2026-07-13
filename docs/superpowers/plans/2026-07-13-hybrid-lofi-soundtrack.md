# Hybrid Lo-fi Soundtrack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a calm, deterministic hybrid soundtrack with twelve licensed produced lo-fi tracks, repaired and expanded procedural arrangements, biome-specific ambient beds, and spatial wildlife/turtle audio that falls back cleanly, preserves every existing audio bus and media feature, and remains stable through browser and packaged Electron soak tests.

**Architecture:** Keep AudioManager as the lazily-created Web Audio composition root and preserve the master, music, ambient, SFX, and media buses. Move all musical decisions into pure seeded plans and a MusicDirector; render produced score through a two-deck HTMLAudioElement player on the music bus while MediaPlayer continues to own only user files, radio, and manual built-in mood controls on the media path. Feed music and ambience an explicit low-frequency AudioWorldContext derived from the shared biome/runtime state. Register every shipped audio asset in the shared asset registry, fail builds on license or file drift, and synchronize positional calls through the existing typed event bus from represented wildlife and turtle events.

**Tech Stack:** React 19, TypeScript 5.9, Web Audio API, HTMLAudioElement, Zod 4, Three.js runtime positions, Zustand settings, Vitest 3, Playwright, Vite 7, Electron 43 custom protocols, pnpm 11.12, Node 20+, tsx for shared validation scripts, and ffmpeg/ffprobe for offline loudness and delivery checks.

---

This plan implements Phase E of `docs/superpowers/specs/2026-07-13-sanctuary-graphics-audio-overhaul-design.md` and supplies the soundtrack/ambience pilot consumed by the Phase B hero slice.

## Accepted implementation values

These values are part of this plan and are not deferred product decisions:

- Produced score ships as exactly twelve stereo MP3 files at 48 kHz and 192 kbps CBR, each 120–240 seconds long.
- Production masters are archived outside the runtime bundle as 48 kHz, 24-bit stereo WAV files.
- Produced score is normalized to -18.0 LUFS-I with a tolerance of ±0.5 LU and true peak no higher than -1.0 dBTP.
- Ambient beds are stereo MP3 at 48 kHz and 192 kbps CBR, 90–180 seconds long, normalized to -30 LUFS-I ±1 LU with true peak no higher than -6 dBTP.
- Spatial wildlife, turtle, water, village, and interior one-shots are mono MP3 at 48 kHz and 160 kbps CBR, normalized to -24 LUFS-I ±1 LU with true peak no higher than -3 dBTP.
- Every loop supplies measured loop-start and loop-end seconds. Runtime crossfades over 250 ms at the loop boundary so MP3 encoder delay cannot create a click or gap.
- Automatic score uses a deterministic two-produced-to-one-procedural source cadence. A missing or failed produced candidate immediately consumes the procedural slot without silence.
- Normal score transitions crossfade for 10 seconds. A procedural transition waits for the next bar only when that wait is four seconds or less.
- A produced track cannot repeat within the previous four produced selections.
- A procedural arrangement fingerprint cannot repeat within 45 minutes of audio-context time.
- Quiet Mode applies a 0.65 music-layer energy multiplier, a 0.55 wildlife/detail event-rate multiplier, and a 0.75 ambience-detail gain multiplier. It never removes an entire biome bed or wildlife category.
- Selection and call history are session-only. They are not added to the portable save.
- The existing originalMusic boolean remains the single soundtrack enable switch; no new source-preference setting is added.
- Low, Medium, High, and Ultra retain all ambient layer categories. Quality changes only concurrency, preload radius, HRTF range, and decoded one-shot cache size.

## Cross-plan dependencies and ownership

- This plan consumes BiomeId, biome blend weights, and biome soundscape metadata from src/game/world/biomes/types.ts and src/game/world/biomes/registry.ts. The biome-composition plan owns those files; do not create a second audio-only biome registry.
- This plan consumes represented agent/group IDs, positions, and the canonical `WildlifeCall` event from `src/game/world/wildlife/WildlifeDirector.ts`, `src/game/world/wildlife/WildlifeWorld.tsx`, and `src/game/core/events.ts`. The wildlife plan owns behavior, representation, event emission, and the sole `WildlifeAudioEngine`; this plan only adapts that engine to the shared asset cache and spatial-emitter pool.
- This plan consumes the canonical `TurtleSoundEvent` emitted from `src/game/world/turtle/TurtleHero.tsx`. The turtle plan owns animation timing, event emission, and the sole `TurtleAudioEngine`; this plan only adapts registered sound selection and routing without creating a second renderer or subscription.
- This plan extends the one shared authored-asset manifest at src/game/assets/manifest.json. Phase A owns creation of manifest.json, schema.ts, registry.ts, validate.node.ts, scripts/validate-assets.ts, the canonical validation scripts, and the tsx dependency. Do not recreate or fork that foundation.
- This plan consumes Phase A's shared `assetFailureRouter` from `src/game/assets/AssetFailureRouter.ts`. Produced-track and ambience-bed decks use its `streaming-media` channel; `AudioBufferCache` uses its `audio-buffer` channel. The existing development/diagnostics-only `window.__turtlebackDebug.failAsset(id)` remains the one injection API; do not route audio failure through model/texture acquisition, add another injector, or create another audio renderer.
- Complete the Phase A asset-registry foundation and biome type exports before this plan. Tasks 1–5 can then be developed against typed fixtures while the final authored files are in production.

## Task 1: Extend the shared asset registry with the authored-audio contract

**Files**

- Modify: src/game/assets/schema.ts
- Modify: src/game/assets/registry.ts
- Modify: src/game/assets/validate.node.ts
- Modify: scripts/validate-assets.ts
- Modify: src/game/assets/manifest.json
- Modify: tests/assetRegistry.test.ts
- Create: tests/fixtures/assets/valid-audio-manifest.json
- Create: tests/fixtures/assets/public/audio/music/test-track.mp3
- Create: tests/fixtures/assets/ASSET_LICENSES.md
- Modify: package.json

- [ ] Write failing schema tests in tests/assetRegistry.test.ts that refine the five Phase A audio discriminants with kind-specific metadata, delivery, loop, and fallback rules. Retain the existing duplicate-ID, path-traversal, missing-file, unsupported-license, missing-attribution, bad-SHA-256, and otherwise-valid fixture coverage.

```ts
import { describe, expect, it } from 'vitest'
import { parseAssetManifest } from '@/game/assets/schema'

describe('authored audio manifest', () => {
  it('requires produced score to declare a procedural fallback', () => {
    const candidate = makeMusicAsset()
    delete candidate.fallback
    expect(() => parseAssetManifest({ schemaVersion: 1, assets: [candidate] })).toThrow(
      /procedural fallback/i,
    )
  })

  it('rejects static paths outside public', () => {
    const candidate = makeMusicAsset()
    candidate.variants[0].path = '../private/song.mp3'
    expect(() => parseAssetManifest({ schemaVersion: 1, assets: [candidate] })).toThrow(
      /static asset boundary/i,
    )
  })
})
```

- [ ] Run the focused test and confirm the red state:

```sh
pnpm test -- tests/assetRegistry.test.ts
```

Expected: FAIL because the Phase A provisional timed-audio records do not yet require produced-music metadata, delivery measurements, loop constraints, or kind-specific fallback rules.

- [ ] Confirm the red failure is a missing or invalid kind-specific audio field while the existing `music-track`, `ambience-bed`, `ambient-detail`, `wildlife-call`, and `turtle-sound` discriminants continue to parse their Phase A base fields.

- [ ] Extend the existing shared discriminated asset types and Zod schemas in src/game/assets/schema.ts. Preserve every Phase A model, texture, LOD, material-capability, and license field.

```ts
export type AudioAssetKind = Extract<
  AssetKind,
  'music-track' | 'ambience-bed' | 'ambient-detail' | 'wildlife-call' | 'turtle-sound'
>

export interface ProducedMusicMetadata {
  title: string
  moods: readonly MusicMood[]
  biomes: readonly BiomeId[]
  times: readonly MusicTimeTag[]
  weather: readonly ('clear' | 'rain')[]
  indoors: 'preferred' | 'allowed' | 'excluded'
  tempoBpm: number
  key: string
  loudnessLufs: number
  truePeakDbtp: number
  energy: 'low' | 'medium'
  downbeatOffsetSec: number
  ending:
    | { mode: 'natural'; crossfadeOutSec: number }
    | { mode: 'loop'; loopStartSec: number; loopEndSec: number }
}

export interface AudioDeliveryMetadata {
  codec: 'mp3'
  sampleRateHz: 48000
  channels: 1 | 2
  bitrateBps: 160000 | 192000
  loudnessLufs: number
  truePeakDbtp: number
}

export type TurtleSoundCategory = 'breath' | 'shell-resonance' | 'flipper' | 'wake'

export type ProducedMusicAssetRecord = TimedAudioAssetRecord<'music-track'> & {
  delivery: AudioDeliveryMetadata & { channels: 2; bitrateBps: 192000 }
  music: ProducedMusicMetadata
}

export type AmbienceBedAssetRecord = TimedAudioAssetRecord<'ambience-bed'> & {
  delivery: AudioDeliveryMetadata & { channels: 2; bitrateBps: 192000 }
  ambience: { biome: BiomeId; loopStartSec: number; loopEndSec: number }
}

export type AmbientDetailAssetRecord = TimedAudioAssetRecord<'ambient-detail'> & {
  delivery: AudioDeliveryMetadata & { channels: 1; bitrateBps: 160000 }
  detail: { layer: 'water' | 'canopy' | 'village' | 'interior'; variant: number }
}

export type WildlifeCallAssetRecord = TimedAudioAssetRecord<'wildlife-call'> & {
  delivery: AudioDeliveryMetadata & { channels: 1; bitrateBps: 160000 }
  wildlife: { speciesId: string; variant: number }
}

export type TurtleSoundAssetRecord = TimedAudioAssetRecord<'turtle-sound'> & {
  delivery: AudioDeliveryMetadata & { channels: 1; bitrateBps: 160000 }
  turtle: { category: TurtleSoundCategory; variant: number }
}

export function parseAssetManifest(value: unknown): AssetManifest
```

Refine the five existing `AssetByKind` members with the exact record types above while extending their Phase A `TimedAudioAssetRecord` base. Require nonnegative integer variant ordinals, `loopStartSec < loopEndSec <= durationSec`, unique `(owner/category, variant)` pairs, and the accepted delivery bounds at the top of this plan. Do not add duplicate discriminants, move `variants[].path` to the record root, rename `schemaVersion`, or introduce a parallel `AuthoredAsset` union.

- [ ] Apply the Phase A source and license contract to every audio kind: require either sourceUrl or generationRecord, require attribution when the shared allowlist says it is mandatory, and reject licenses outside that shared allowlist.

- [ ] Make path validation reject absolute paths, URL schemes, leading slashes, backslashes, empty segments, and parent traversal.

- [ ] Keep the Phase A `AssetRegistry` and its canonical `get()`/`getByKind()` signatures. Use `getByKind<K extends AudioAssetKind>()` directly for typed audio lookup; do not redeclare the registry interface or change `get()` from `AssetRecord` to a second union.

- [ ] Extend the implementation behind the exact Phase A `validateAssetRegistry(rootDirectory, options): Promise<AssetValidationReport>` API. Reuse its file existence, SHA-256, byte-size, source/generation-record, ID, static-boundary, LOD, and license-ledger checks; add per-record audio delivery, loop, fallback, and variant-integrity checks without redeclaring or narrowing `AssetValidationOptions` or `AssetValidationReport`. Keep milestone inventory counts out of this present-record validator; task-specific tests obtain exact kind and biome counts from the parsed registry.

- [ ] Keep validation modes distinct: `validate:assets:audio` enforces audio schema, binary, provenance, and fallback integrity for every record currently present; task-specific tests enforce the pilot, twelve-track, six-bed, and one-shot milestones; only Phase F's `validate:assets:final` requires the complete cross-phase release inventory.

- [ ] Keep Phase A's existing `--slice=audio` parser and option mapping unchanged; extend the shared validator implementation reached by that option with the new kind-specific audio checks. Make each audio error print the stable asset ID and fail with exit code 1.

- [ ] Add only the specialized audio slice command. Preserve the canonical Phase A validate:assets, write:asset-licenses, and validate:assets:final scripts:

```json
{
  "validate:assets:audio": "tsx scripts/validate-assets.ts --slice=audio"
}
```

- [ ] Run the focused test and validator:

```sh
pnpm test -- tests/assetRegistry.test.ts
pnpm validate:assets:audio
```

Expected: PASS; the fixture proves audio schema and filesystem validation while the production manifest may contain fewer than the final twelve tracks until Task 6.

- [ ] Commit checkpoint:

```sh
git add package.json scripts/validate-assets.ts src/game/assets tests/assetRegistry.test.ts tests/fixtures/assets
git commit -m "test: define authored audio asset contract"
```

## Task 2: Extract deterministic procedural event plans and expose the phrase bug

**Files**

- Create: src/game/audio/proceduralMusic/arrangements.ts
- Create: src/game/audio/proceduralMusic/plan.ts
- Create: tests/musicPlan.test.ts
- Modify: src/game/audio/proceduralMusic/moods.ts
- Modify: tests/music.test.ts

- [ ] Write a failing reachability test that covers all four moods and verifies every generated progression index appears in one phrase.

```ts
import { describe, expect, it } from 'vitest'
import { MOODS } from '@/game/audio/proceduralMusic/moods'
import { createMusicalEventPlan, progressionIndexAtStep } from '@/game/audio/proceduralMusic/plan'

describe('procedural phrase planning', () => {
  it.each(Object.keys(MOODS) as MusicMood[])('%s reaches every progression chord', (mood) => {
    const plan = createMusicalEventPlan({
      mood,
      seed: 20260713,
      arrangementIndex: 0,
      quietMode: false,
    })
    const reached = new Set(
      Array.from({ length: plan.phraseSteps }, (_, step) =>
        progressionIndexAtStep(step, MOODS[mood].chordBars, plan.progression.length),
      ),
    )
    expect([...reached].sort((a, b) => a - b)).toEqual(plan.progression.map((_, index) => index))
  })
})
```

- [ ] Add deterministic equality, fingerprint inequality, calm tempo, bounded velocity/pan/timing, and required A/A-prime/B/break form tests.

- [ ] Run the new test and confirm the red state:

```sh
pnpm test -- tests/musicPlan.test.ts
```

Expected: FAIL because plan.ts does not exist; the current engine’s fixed eight-bar wrap would also fail dawn, rain, and night reachability.

- [ ] Define arrangement data in arrangements.ts. Give every mood exactly three arrangement families named drift, conversation, and open-space. Each family must declare A, A-prime, B, and break sections, chord patterns, inversion rules, bass movement, percussion pattern, melody motif strategy, fills, and layer dropout rules.

```ts
export type ArrangementSection = 'A' | 'A-prime' | 'B' | 'break'

export interface ArrangementFamily {
  id: 'drift' | 'conversation' | 'open-space'
  form: readonly ArrangementSection[]
  progressionPatterns: readonly (readonly number[])[]
  bass: 'roots' | 'passing' | 'pedal'
  percussion: 'brushes' | 'half-time' | 'sparse'
  melody: 'motif' | 'call-response' | 'fragments'
}

export const ARRANGEMENTS: Record<
  MusicMood,
  readonly [ArrangementFamily, ArrangementFamily, ArrangementFamily]
>
```

- [ ] Define the pure event-plan API in plan.ts:

```ts
export type ProceduralVoice =
  | 'electric-piano'
  | 'guitar-pluck'
  | 'mallet'
  | 'pad'
  | 'bass'
  | 'kick'
  | 'brush'
  | 'hat'
  | 'melody'
  | 'tape'
  | 'crackle'

export interface MusicalEvent {
  step: number
  durationSteps: number
  voice: ProceduralVoice
  midi: readonly number[]
  velocity: number
  pan: number
  timingOffsetSec: number
  section: ArrangementSection
}

export interface MusicalEventPlan {
  fingerprint: string
  mood: MusicMood
  arrangementFamilyId: ArrangementFamily['id']
  bpm: number
  progression: readonly number[]
  phraseBars: number
  phraseSteps: number
  events: readonly MusicalEvent[]
}

export function createMusicalEventPlan(input: {
  mood: MusicMood
  seed: number
  arrangementIndex: number
  quietMode: boolean
}): MusicalEventPlan
```

- [ ] Calculate phraseBars as progression.length multiplied by chordBars and phraseSteps as phraseBars multiplied by 16. Do not retain any fixed eight-bar wrap.

- [ ] Route form, progression choice, inversions, voicing, motif, fills, swing, velocity, pan, timing, tape modulation, and crackle events through mulberry32-derived streams. Do not call Math.random anywhere below src/game/audio/proceduralMusic.

- [ ] Make Quiet Mode remove bright mallet/guitar doubling probabilistically through the seeded plan and apply the accepted 0.65 energy multiplier without removing core chord, bass, or pulse events.

- [ ] Run procedural tests:

```sh
pnpm test -- tests/music.test.ts tests/musicPlan.test.ts
```

Expected: PASS; every mood reaches every chord and equal inputs produce structurally equal plans and fingerprints.

- [ ] Commit checkpoint:

```sh
git add src/game/audio/proceduralMusic/arrangements.ts src/game/audio/proceduralMusic/plan.ts src/game/audio/proceduralMusic/moods.ts tests/music.test.ts tests/musicPlan.test.ts
git commit -m "feat: plan deterministic procedural arrangements"
```

## Task 3: Convert MusicEngine into a disposable plan renderer

**Files**

- Modify: src/game/audio/proceduralMusic/MusicEngine.ts
- Modify: src/game/audio/proceduralMusic/engineHandle.ts
- Create: tests/musicEngineLifecycle.test.ts

- [ ] Write a failing lifecycle test using a small fake AudioContext that records created sources, oscillators, timers, starts, stops, and disconnects.

```ts
it('stops every long-lived node and scheduler on dispose', () => {
  const audio = createFakeAudioContext()
  const engine = new MusicEngine(audio.context, audio.destination, 7)
  engine.startPlan(makePlan())
  engine.dispose()
  expect(audio.activeTimers()).toBe(0)
  expect(audio.unstoppedLongLivedNodes()).toEqual([])
  expect(audio.connectedNodes()).toEqual([])
})
```

- [ ] Run the lifecycle test and confirm the red state:

```sh
pnpm test -- tests/musicEngineLifecycle.test.ts
```

Expected: FAIL because current looping tape sources and oscillators are not retained/stopped and MusicEngine does not accept a plan.

- [ ] Replace content generation inside scheduleStep with plan-event rendering. Keep the existing 100 ms lookahead and 500 ms schedule-ahead windows.

```ts
export class MusicEngine {
  constructor(ctx: AudioContext, destination: AudioNode, legacySeed?: number)
  startPlan(plan: MusicalEventPlan, startAt?: number): void
  crossfadeTo(plan: MusicalEventPlan, seconds: number): void
  nextBarTime(): number
  stop(seconds?: number): void
  diagnostics(): ProceduralEngineDiagnostics
  dispose(): void
}
```

- [ ] Add the guitar-pluck, mallet, chorus, delay, and room-reverb render paths. Keep all effects bounded by plan data and route every voice through a per-plan gain node.

- [ ] Retain every looping source, oscillator, timeout, and effect node in owned collections. Remove ended one-shots with onended and explicitly stop/disconnect all owned nodes during stop and dispose.

- [ ] Remove bindMusicPreview and bindMusicPlayer calls from MusicEngine. MusicDirector will own those control bindings in Task 5.

- [ ] Keep constructor legacySeed, start(), setMood(), preview(), and setPlayerState() as a compatibility adapter through Task 6 so AudioManager remains type-correct at each checkpoint. The adapter creates plans through createMusicalEventPlan and delegates all rendering to startPlan/crossfadeTo; it contains no separate arrangement logic.

- [ ] Run focused and existing music tests:

```sh
pnpm test -- tests/music.test.ts tests/musicPlan.test.ts tests/musicEngineLifecycle.test.ts
```

Expected: PASS with zero tracked timers or long-lived nodes after disposal.

- [ ] Commit checkpoint:

```sh
git add src/game/audio/proceduralMusic tests/musicEngineLifecycle.test.ts
git commit -m "refactor: render and dispose procedural music plans"
```

## Task 4: Build the pure hybrid selector and anti-repetition history

**Files**

- Create: src/game/audio/music/types.ts
- Create: src/game/audio/music/selection.ts
- Create: tests/musicSelection.test.ts

- [ ] Define MusicWorldContext, history, source, and selection types:

```ts
export type MusicTimeTag = 'dawn' | 'day' | 'sunset' | 'blue-hour' | 'night'

export interface MusicWorldContext {
  biome: BiomeId
  biomeWeights: Readonly<Partial<Record<BiomeId, number>>>
  time: MusicTimeTag
  mood: MusicMood
  weather: 'clear' | 'rain'
  indoors: boolean
  quietMode: boolean
}

export interface MusicHistoryEntry {
  kind: 'produced' | 'procedural'
  id: string
  fingerprint?: string
  startedAtSec: number
}

export interface MusicSelectionState {
  ordinal: number
  recent: readonly MusicHistoryEntry[]
  failedAssetIds: ReadonlySet<AssetId>
}
```

- [ ] Write failing tests for deterministic equality, the exact 2:1 source cadence, last-four produced exclusion, 45-minute fingerprint exclusion, context scoring, failed-ID exclusion, and deterministic constraint relaxation.

```ts
it('does not repeat any of the previous four produced tracks', () => {
  const result = selectNextMusic({
    context: crownwoodDawn,
    tracks,
    proceduralCandidates,
    seed: 42,
    nowSec: 900,
    state: {
      ordinal: 5,
      failedAssetIds: new Set(),
      recent: ['a', 'b', 'c', 'd'].map((id, index) => ({
        kind: 'produced',
        id,
        startedAtSec: index * 180,
      })),
    },
  })
  expect(['a', 'b', 'c', 'd']).not.toContain(result.id)
})

it('excludes a procedural fingerprint used within 45 minutes', () => {
  const result = selectNextMusic(
    makeInput({
      nowSec: 3000,
      recent: [
        {
          kind: 'procedural',
          id: 'rain-conversation',
          fingerprint: 'fp-rain-7',
          startedAtSec: 600,
        },
      ],
    }),
  )
  expect(result.fingerprint).not.toBe('fp-rain-7')
})
```

- [ ] Run the test and confirm the red state:

```sh
pnpm test -- tests/musicSelection.test.ts
```

Expected: FAIL because selection.ts does not exist.

- [ ] Implement selectNextMusic as a pure function:

```ts
export function selectNextMusic(input: {
  context: MusicWorldContext
  tracks: readonly ProducedMusicAsset[]
  proceduralCandidates: readonly MusicalEventPlan[]
  state: MusicSelectionState
  seed: number
  nowSec: number
}): MusicSelection
```

- [ ] Score produced tracks by primary biome, secondary biome weight, time, weather, indoor policy, mood, and Quiet Mode suitability. Break equal scores with a seeded stable sort, never array insertion order.

- [ ] Relax unavailable produced matches in this exact order: indoor preference, weather, time, biome. Never relax failed-ID or previous-four exclusions.

- [ ] Select procedural candidates by mood first, then nearest time mood. Never relax the 45-minute fingerprint exclusion; generate a fresh arrangement index when the finite candidate list is exhausted.

- [ ] Simulate two hours in a fast unit test and assert source cadence, produced gaps, fingerprint gaps, deterministic replay, and no empty selection.

- [ ] Run the selector suite:

```sh
pnpm test -- tests/musicSelection.test.ts
```

Expected: PASS; a two-hour simulation completes in under one second and meets all anti-repetition guarantees.

- [ ] Commit checkpoint:

```sh
git add src/game/audio/music/types.ts src/game/audio/music/selection.ts tests/musicSelection.test.ts
git commit -m "feat: select hybrid score deterministically"
```

## Task 5: Implement the two-deck produced player and MusicDirector

**Files**

- Create: src/game/audio/music/ProducedTrackPlayer.ts
- Create: src/game/audio/music/MusicDirector.ts
- Create: tests/producedTrackPlayer.test.ts
- Create: tests/musicDirector.test.ts
- Modify: src/game/audio/proceduralMusic/engineHandle.ts
- Read: src/game/assets/AssetFailureRouter.ts

- [ ] Define injectable ports so MusicDirector logic can be tested in Node without AudioContext:

```ts
export interface ProducedTrackPort {
  play(
    track: ProducedMusicAsset,
    options: { startAtSec: number; crossfadeSec: number },
  ): Promise<void>
  stop(fadeSec: number): void
  snapshot(): ProducedTrackSnapshot
  dispose(): void
}

export interface ProceduralTrackPort {
  startPlan(plan: MusicalEventPlan, startAt?: number): void
  crossfadeTo(plan: MusicalEventPlan, seconds: number): void
  nextBarTime(): number
  stop(seconds?: number): void
  dispose(): void
}
```

- [ ] Write a failing two-deck test that verifies deck B begins before deck A stops, gains cross over exactly 10 seconds, and an error rejects with the stable asset ID. Add an enabled-router case in which Phase A's `assetFailureRouter.failNext(track.id)` makes exactly the next produced load reject with `InjectedAssetFailure` through the `streaming-media` channel and the following load proceeds normally.

- [ ] Write a failing MusicDirector test in which the produced port rejects and the procedural port begins in the same transition without a stopped/silent state.

```ts
it('falls back to procedural when produced decode fails', async () => {
  const produced = rejectingProducedPort('music.crownwood.dawn.01')
  const procedural = recordingProceduralPort()
  const director = makeDirector({ produced, procedural })

  await director.start(crownwoodDawn)

  expect(director.snapshot().source).toBe('procedural')
  expect(director.snapshot().failedAssetIds).toContain('music.crownwood.dawn.01')
  expect(procedural.startedPlans).toHaveLength(1)
})
```

- [ ] Run both tests and confirm the red state:

```sh
pnpm test -- tests/producedTrackPlayer.test.ts tests/musicDirector.test.ts
```

Expected: FAIL because the player and director do not exist.

- [ ] Implement ProducedTrackPlayer with exactly two owned HTMLAudioElement decks. Each deck routes MediaElementAudioSourceNode → GainNode → the supplied music destination.

```ts
export class ProducedTrackPlayer implements ProducedTrackPort {
  constructor(ctx: AudioContext, destination: AudioNode)
  play(
    track: ProducedMusicAsset,
    options: { startAtSec: number; crossfadeSec: number },
  ): Promise<void>
  stop(fadeSec?: number): void
  snapshot(): ProducedTrackSnapshot
  dispose(): void
}
```

- [ ] Resolve every source with resolvePublicAssetPath. Set preload to metadata until selected, then auto. Do not set crossOrigin for same-origin public assets.

- [ ] Immediately before a produced deck begins its media load, call the Phase A singleton's `assetFailureRouter.consume(track.id, 'streaming-media')`. Reject with Phase A's common `InjectedAssetFailure` when it returns true so `MusicDirector` follows the same procedural fallback path as a real media/decode error. Do not call `AssetManager` failure methods or add a player-specific failure registry.

- [ ] Use AudioParam scheduling for the 10-second equal-power crossfade. Clear the retiring deck’s src and call load only after its gain reaches zero.

- [ ] Use manifest duration and actual media duration defensively. Schedule natural-ending transitions before crossfadeOutSec; apply loopStartSec/loopEndSec for loop entries.

- [ ] Implement MusicDirector as the only owner of automatic selection, procedural plans, player/preview overrides, failure history, and engineHandle bindings:

```ts
export class MusicDirector {
  constructor(options: {
    ctx: AudioContext
    destination: AudioNode
    assets: AssetRegistry
    seed: number
    produced?: ProducedTrackPort
    procedural?: ProceduralTrackPort
  })
  start(context: MusicWorldContext): Promise<void>
  update(context: MusicWorldContext): void
  preview(mood: MusicMood): void
  setPlayerState(mood: MusicMood | null, playing: boolean): void
  setEnabled(enabled: boolean): void
  snapshot(): MusicDirectorSnapshot
  dispose(): void
}
```

- [ ] Preserve the current record-shop 30-second preview and home-stereo built-in mood behavior. A manual built-in mood always chooses procedural rendering; local/radio playback ducks the world score through MusicDirector without changing the music-bus volume.

- [ ] Unbind engineHandle callbacks during MusicDirector.dispose so a recovered renderer cannot call a dead context.

- [ ] Run focused tests:

```sh
pnpm test -- tests/producedTrackPlayer.test.ts tests/musicDirector.test.ts tests/musicSelection.test.ts
```

Expected: PASS; deck transitions overlap, decode errors fall back, and all player/preview overrides release owned callbacks on disposal.

- [ ] Commit checkpoint:

```sh
git add src/game/audio/music src/game/audio/proceduralMusic/engineHandle.ts tests/producedTrackPlayer.test.ts tests/musicDirector.test.ts
git commit -m "feat: add two-deck hybrid music director"
```

## Phase B pilot checkpoint: prove one produced track and one biome bed

This checkpoint is the soundtrack portion of the turtle hero vertical slice. Execute it after Tasks 1–5, then interleave the named pilot portions of Tasks 6–8 before returning to the full Phase E catalog. The pilot uses the final production IDs and files; it is not a disposable fixture or a second manifest.

**Files**

- Create: tests/audioPilotSlice.test.ts
- Create: public/audio/music/crownwood-canopy-hush.mp3
- Create: docs/assets/audio-production-records/crownwood-canopy-hush.md
- Create: public/audio/ambience/biomes/crownwood-bed-01.mp3
- Create: docs/assets/audio-production-records/crownwood-bed-01.md
- Modify: src/game/assets/manifest.json
- Modify: ASSET_LICENSES.md

- [ ] Complete the normalizer, delivery tests, provenance record, manifest entry, and license row for `music.crownwood.canopy-hush`; defer the other eleven produced files until the Phase E resume step in Task 6.
- [ ] Execute Task 7 against that real track so the two-deck player can select it on the music bus and fall back to a deterministic procedural plan without silence.
- [ ] Complete the Task 8 plan/player/cache interfaces and deliver `ambience.crownwood.bed-01`; defer the other five biome beds until the Phase E resume step in Task 8.
- [ ] Write `tests/audioPilotSlice.test.ts` against the real parsed manifest. Assert the two stable IDs and shipped files exist, both records pass delivery/provenance rules, Crownwood selects the authored bed, the produced-to-procedural transition is deterministic, and a forced pilot-track failure starts the procedural port in the same transition.
- [ ] Generate the ledger and run the scoped pilot gate. Do not run the global release inventory validator during Phase B.

```sh
pnpm write:asset-licenses
pnpm validate:assets:audio
pnpm test -- tests/audioPilotSlice.test.ts tests/producedTrackPlayer.test.ts tests/musicDirector.test.ts tests/ambiencePlan.test.ts tests/ambienceLifecycle.test.ts
pnpm build
```

Expected: PASS with exactly one produced pilot track and one Crownwood bed required by the pilot test, both on their final buses and paths, plus seamless procedural fallback. The generic production build validates every record currently present; Phase F alone runs the whole-release `validate:assets:final` inventory gate.

- [ ] Commit the reusable pilot; later Phase E work extends these same records and implementations.

```sh
git add public/audio/music/crownwood-canopy-hush.mp3 public/audio/ambience/biomes/crownwood-bed-01.mp3 docs/assets/audio-production-records/crownwood-canopy-hush.md docs/assets/audio-production-records/crownwood-bed-01.md scripts/normalize-audio.ts src/game/audio src/game/assets/manifest.json ASSET_LICENSES.md package.json tests/audioPilotSlice.test.ts tests/audioDelivery.test.ts tests/producedTrackPlayer.test.ts tests/musicDirector.test.ts tests/ambiencePlan.test.ts tests/ambienceLifecycle.test.ts
git commit -m "feat: prove hybrid audio hero slice"
```

## Task 6: Produce, normalize, register, and license the twelve-track score

**Files**

- Read: public/audio/music/crownwood-canopy-hush.mp3
- Create: public/audio/music/crownwood-mosslight-steps.mp3
- Create: public/audio/music/lumenfen-lantern-water.mp3
- Create: public/audio/music/lumenfen-rain-on-reeds.mp3
- Create: public/audio/music/blossomshade-petal-static.mp3
- Create: public/audio/music/blossomshade-hearth-window.mp3
- Create: public/audio/music/fernfall-root-and-rill.mp3
- Create: public/audio/music/fernfall-blue-hour-drift.mp3
- Create: public/audio/music/galecrest-saltwind-tape.mp3
- Create: public/audio/music/galecrest-moonwake.mp3
- Create: public/audio/music/hearth-clearings-market-drowse.mp3
- Create: public/audio/music/hearth-clearings-afterglow.mp3
- Read: docs/assets/audio-production-records/crownwood-canopy-hush.md
- Create: docs/assets/audio-production-records/crownwood-mosslight-steps.md
- Create: docs/assets/audio-production-records/lumenfen-lantern-water.md
- Create: docs/assets/audio-production-records/lumenfen-rain-on-reeds.md
- Create: docs/assets/audio-production-records/blossomshade-petal-static.md
- Create: docs/assets/audio-production-records/blossomshade-hearth-window.md
- Create: docs/assets/audio-production-records/fernfall-root-and-rill.md
- Create: docs/assets/audio-production-records/fernfall-blue-hour-drift.md
- Create: docs/assets/audio-production-records/galecrest-saltwind-tape.md
- Create: docs/assets/audio-production-records/galecrest-moonwake.md
- Create: docs/assets/audio-production-records/hearth-clearings-market-drowse.md
- Create: docs/assets/audio-production-records/hearth-clearings-afterglow.md
- Create: scripts/normalize-audio.ts
- Create: tests/audioDelivery.test.ts
- Modify: src/game/assets/manifest.json
- Modify: ASSET_LICENSES.md
- Modify: public/audio/music/README.md
- Modify: package.json

- [ ] Treat `music.crownwood.canopy-hush` as the already-shipped Phase B pilot entry. At the Phase E resume point, retain its stable ID, file, checksum, production record, and listening approval; do not regenerate it merely to restart this task.

- [ ] Produce the remaining eleven entries and close the exact twelve-track matrix below. Any intentional remaster of the pilot must update its production record, checksum, review evidence, and manifest entry in the same change.

- [ ] Deliver the exact track/tag matrix:

| Stable asset ID                  | File                               | Primary biome   | Time/weather emphasis   |
| -------------------------------- | ---------------------------------- | --------------- | ----------------------- |
| music.crownwood.canopy-hush      | crownwood-canopy-hush.mp3          | crownwood       | dawn, day, clear        |
| music.crownwood.mosslight-steps  | crownwood-mosslight-steps.mp3      | crownwood       | sunset, rain            |
| music.lumenfen.lantern-water     | lumenfen-lantern-water.mp3         | lumenfen        | blue-hour, night, clear |
| music.lumenfen.rain-on-reeds     | lumenfen-rain-on-reeds.mp3         | lumenfen        | day, rain               |
| music.blossomshade.petal-static  | blossomshade-petal-static.mp3      | blossomshade    | dawn, day, clear        |
| music.blossomshade.hearth-window | blossomshade-hearth-window.mp3     | blossomshade    | sunset, night           |
| music.fernfall.root-and-rill     | fernfall-root-and-rill.mp3         | fernfall        | day, rain               |
| music.fernfall.blue-hour-drift   | fernfall-blue-hour-drift.mp3       | fernfall        | blue-hour, night        |
| music.galecrest.saltwind-tape    | galecrest-saltwind-tape.mp3        | galecrest       | day, clear              |
| music.galecrest.moonwake         | galecrest-moonwake.mp3             | galecrest       | night, clear            |
| music.hearth.market-drowse       | hearth-clearings-market-drowse.mp3 | hearth-clearing | day, clear              |
| music.hearth.afterglow           | hearth-clearings-afterglow.mp3     | hearth-clearing | sunset, night, rain     |

- [ ] Produce against this variation matrix; a track may refine its key or tempo during review, but it may not collapse into another row's lead palette and form:

| Track           | Tempo/key target                   | Lead palette                                     | Required structural contrast                                     |
| --------------- | ---------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Canopy Hush     | 64–68 BPM, D major                 | felt piano, bowed glass, soft tape               | spacious A–B form, percussion enters only after the first minute |
| Mosslight Steps | 70–74 BPM, B minor                 | nylon guitar, brushed kit, warm bass             | short call-and-response phrases and a rain-softened breakdown    |
| Lantern Water   | 58–62 BPM, E Dorian                | Rhodes, waterphone-like mallet, sub pad          | long suspended harmony, no kick, slow stereo movement            |
| Rain on Reeds   | 66–70 BPM, A minor                 | muted kalimba, rim brush, filtered field texture | syncopated reed motif and two low-density dropouts               |
| Petal Static    | 72–76 BPM, G major                 | upright piano, harp-like pluck, cassette flutter | bright but soft three-part motif with a half-time middle         |
| Hearth Window   | 62–66 BPM, C major                 | felt piano, vibraphone, upright bass             | indoor close-mic intimacy and a natural unaccompanied ending     |
| Root and Rill   | 60–64 BPM, D minor                 | wooden mallet, muted guitar, low drone           | descending ravine motif and asymmetrical four-plus-four phrasing |
| Blue-hour Drift | 54–58 BPM, F minor                 | granular pad, sparse piano, reverse texture      | beatless opening, late pulse, longest reverb tail in the set     |
| Saltwind Tape   | 68–72 BPM, A Mixolydian            | electric piano, soft tom, wind-tonal layer       | open fifths, broad stereo field, strongest forward motion        |
| Moonwake        | 56–60 BPM, E minor                 | bowed pad, bell harmonics, tape bass             | no drum kit, slow two-section tidal rise and release             |
| Market Drowse   | 74–78 BPM, F major                 | brushed kit, muted keys, hand percussion         | gentle ensemble conversation and the shortest phrase cycle       |
| Afterglow       | 60–64 BPM, C minor to E-flat major | felt piano, soft strings, vinyl texture          | minor-to-relative-major arc and a fully resolved natural ending  |

- [ ] Author each master from original performance/synthesis or traceable CC0 source material. Reject lyrical samples, Content-ID-encumbered loops, “royalty free” material without redistribution terms, and generated-audio services whose terms do not clearly permit commercial redistribution inside the game.

- [ ] Retain the DAW session or deterministic generation project, MIDI, custom patches, source recordings, stems, and 48 kHz/24-bit master in the project-controlled production archive outside `public/`. Record the archive identifier and SHA-256 in the corresponding production record; only the normalized MP3 ships in browser/Electron builds.

- [ ] Review rough mixes as a twelve-track sequence before mastering. Reject any pair that shares the same opening gesture, lead instrument, drum pattern, form, or dominant tape effect; also reject startling transients, busy lead density, unresolved sample rights, or a mix that masks biome ambience at the accepted bus gains.

- [ ] If the execution environment cannot provide an approved DAW/offline renderer or licensed source archive, stop at this named music-production gate. Do not count a renamed live procedural capture, an unlicensed stream rip, or a silent file as one of the twelve produced pieces.

- [ ] Require each production record to contain the actual author, creation date, DAW or generation workflow, source-material statement, sample-library licenses, modification notes, master checksum, shipped-file checksum, and either Original or CC0-1.0 rights evidence. CC-BY-4.0 is supported by the registry but is not used for this initial twelve-track set.

- [ ] Write tests/audioDelivery.test.ts for argument validation, ffmpeg/ffprobe process failure, pass-one JSON parsing, exact propagation of measured values into pass two, and rejection when the output misses codec, sample-rate, channel, bitrate, duration, LUFS, or true-peak limits.

- [ ] Run the delivery test and confirm the red state:

```sh
pnpm test -- tests/audioDelivery.test.ts
```

Expected: FAIL because scripts/normalize-audio.ts does not exist.

- [ ] Implement scripts/normalize-audio.ts. It must invoke ffmpeg pass one with loudnorm JSON output, parse measured_I, measured_TP, measured_LRA, measured_thresh, and target_offset, invoke pass two with those exact measured values, encode 48 kHz stereo MP3 at 192 kbps, run ffprobe, and fail if the accepted delivery bounds are missed.

```ts
export interface NormalizeAudioRequest {
  inputWav: string
  outputMp3: string
  targetLufs: -18
  targetTruePeakDbtp: -1
  targetLra: 9
}

export async function normalizeProducedTrack(
  request: NormalizeAudioRequest,
): Promise<DeliveredAudioMeasurement>
```

- [ ] Add the exact package command:

```json
{
  "scripts": {
    "audio:normalize": "tsx scripts/normalize-audio.ts"
  }
}
```

- [ ] Run two-pass loudness normalization for each approved 48 kHz/24-bit WAV master:

```sh
pnpm audio:normalize -- masters/crownwood-canopy-hush.wav public/audio/music/crownwood-canopy-hush.mp3
```

Expected for each invocation: exit 0 and one JSON measurement record showing 48 kHz, two channels, 192000-bit MP3, -18.0 LUFS-I within ±0.5 LU, true peak no higher than -1.0 dBTP, and duration between 120 and 240 seconds.

- [ ] Probe every delivered file:

```sh
ffprobe -v error -show_entries format=duration:stream=codec_name,sample_rate,channels,bit_rate -of json public/audio/music/crownwood-canopy-hush.mp3
```

Expected for every track: codec_name mp3, sample_rate 48000, channels 2, bit_rate 192000, duration between 120 and 240 seconds.

- [ ] Add all twelve actual metadata entries, checksums, byte sizes, loudness results, keys, tempos, downbeat offsets, tags, and procedural fallbacks to src/game/assets/manifest.json.

- [ ] Generate the ledger and run the final audio-set gate:

```sh
pnpm write:asset-licenses
pnpm validate:assets:audio
```

Expected: PASS with the focused registry test observing exactly twelve music-track records and with no license, checksum, metadata, or path errors.

- [ ] Keep the production-build lifecycle on present-record validation during Phases B–E. The whole-release inventory gate belongs to Phase F:

```json
{
  "scripts": {
    "prebuild": "pnpm validate:assets"
  }
}
```

- [ ] Update public/audio/music/README.md to point exclusively to the registry workflow and accepted delivery values. Remove the old instruction to route shipped score through MediaPlayer’s media bus.

- [ ] Run:

```sh
pnpm build
```

Expected: PASS and dist/audio/music contains exactly the twelve registered MP3 files plus README.md.

- [ ] Commit checkpoint:

```sh
git add public/audio/music docs/assets/audio-production-records scripts/normalize-audio.ts tests/audioDelivery.test.ts src/game/assets/manifest.json ASSET_LICENSES.md package.json public/audio/music/README.md
git commit -m "assets: deliver licensed twelve-track sanctuary score"
```

## Task 7: Integrate MusicDirector without changing user-media or save semantics

**Files**

- Modify: src/game/audio/AudioManager.ts
- Create: src/game/audio/worldContext.ts
- Create: tests/audioWorldContext.test.ts
- Modify: src/game/core/FrameDriver.tsx
- Modify: src/game/media/MediaPlayer.ts
- Modify: src/game/ui/media/MusicOverlay.tsx
- Modify: src/game/ui/menus/MenuOverlay.tsx
- Modify: tests/audioBus.test.ts
- Modify: e2e/media.spec.ts

- [ ] Write failing tests for pure world-to-music context mapping: rain mood precedence, dawn/day/sunset/blue-hour/night tags, indoor state, biome weights, and Quiet Mode.

```ts
export function deriveMusicWorldContext(input: {
  runtime: RuntimeAudioFields
  settings: Pick<GameSettings, 'quietMode'>
}): MusicWorldContext
```

- [ ] Run the context test and confirm the red state:

```sh
pnpm test -- tests/audioWorldContext.test.ts
```

Expected: FAIL because worldContext.ts does not exist.

- [ ] Implement deriveMusicWorldContext without importing Zustand or the runtime singleton. AudioManager supplies snapshots explicitly.

- [ ] Replace AudioManager.music: MusicEngine with AudioManager.music: MusicDirector. Construct it with the existing music bus and world seed after the user gesture.

- [ ] Remove MusicEngine’s transitional legacySeed, start(), setMood(), preview(), and setPlayerState() compatibility adapter after AudioManager and engineHandle compile against MusicDirector.

- [ ] Add a private scoreGate GainNode between MusicDirector and the music bus. setMusicEnabled and originalMusic update only scoreGate; applyVolumes remains the single writer of public bus volumes.

- [ ] Keep BusName exactly:

```ts
export type BusName = 'master' | 'music' | 'ambient' | 'sfx' | 'media'
```

- [ ] Make AudioManager.update derive one context at the existing 10 Hz cadence, update MusicDirector, and leave updateListener per-frame.

- [ ] Keep BUILTIN_ITEMS in MediaPlayer as the four procedural mood controls. Do not append the twelve automatic score files to MediaPlayer.playlist.

- [ ] Refactor MediaPlayer event handlers into owned named callbacks. On dispose, remove listeners, disconnect srcNode/panner/mediaGain, revoke every local track URL, clear src, and release MusicDirector’s player override.

- [ ] Update menu copy:
  - Sanctuary music → Sanctuary soundtrack.
  - The original generative soundtrack → Produced and generated lo-fi that follows the sanctuary.
  - Original soundtrack toggle → Sanctuary soundtrack.
  - Keep Music player & radio attached to the media slider.

- [ ] Preserve GameSettings, SETTINGS_VERSION, SAVE_SCHEMA_VERSION, portable saves, desktop repositories, and media persistence unchanged.

- [ ] Run:

```sh
pnpm test -- tests/audioBus.test.ts tests/audioWorldContext.test.ts tests/settings.test.ts tests/portableSave.test.ts
pnpm test:e2e -- e2e/media.spec.ts
```

Expected: PASS; built-in Dawn and Night remain visible, the save schema is unchanged, and local/radio media still uses the media bus.

- [ ] Commit checkpoint:

```sh
git add src/game/audio src/game/core/FrameDriver.tsx src/game/media/MediaPlayer.ts src/game/ui/media/MusicOverlay.tsx src/game/ui/menus/MenuOverlay.tsx tests e2e/media.spec.ts
git commit -m "feat: route hybrid score through music bus"
```

## Task 8: Add explicit biome ambience beds and quality budgets

**Files**

- Create: src/game/audio/ambience/types.ts
- Create: src/game/audio/ambience/plan.ts
- Create: src/game/audio/ambience/AmbienceBedPlayer.ts
- Create: src/game/audio/ambience/AudioBufferCache.ts
- Create: src/game/audio/ambience/SpatialEmitterPool.ts
- Create: src/game/audio/ambience/quality.ts
- Create: tests/ambiencePlan.test.ts
- Create: tests/ambienceLifecycle.test.ts
- Read: src/game/assets/AssetFailureRouter.ts
- Modify: src/game/audio/ambience/AmbienceEngine.ts
- Modify: src/game/audio/AudioManager.ts
- Modify: src/game/core/runtime.ts
- Modify: src/game/village/zones.ts
- Modify: src/game/world/biomes/registry.ts
- Modify: src/game/assets/manifest.json
- Read: public/audio/ambience/biomes/crownwood-bed-01.mp3
- Create: public/audio/ambience/biomes/lumenfen-bed-01.mp3
- Create: public/audio/ambience/biomes/blossomshade-bed-01.mp3
- Create: public/audio/ambience/biomes/fernfall-ravine-bed-01.mp3
- Create: public/audio/ambience/biomes/galecrest-bed-01.mp3
- Create: public/audio/ambience/biomes/hearth-clearings-bed-01.mp3
- Read: docs/assets/audio-production-records/crownwood-bed-01.md
- Create: docs/assets/audio-production-records/lumenfen-bed-01.md
- Create: docs/assets/audio-production-records/blossomshade-bed-01.md
- Create: docs/assets/audio-production-records/fernfall-ravine-bed-01.md
- Create: docs/assets/audio-production-records/galecrest-bed-01.md
- Create: docs/assets/audio-production-records/hearth-clearings-bed-01.md

- [ ] Treat `ambience.crownwood.bed-01` as the already-shipped Phase B pilot bed. Retain its stable ID, loop points, file, checksum, production record, and listening approval.

- [ ] At the Phase E resume point, produce and register the remaining five beds for `lumenfen`, `blossomshade`, `fernfall`, `galecrest`, and `hearth-clearing`. Keep display names and filenames free to say “Fernfall Ravine” or “Hearth Clearings,” but manifest biome fields must use the canonical `BiomeId` values.

- [ ] Define explicit inputs and internal layers:

```ts
export type AmbienceLayer =
  'biome-bed' | 'weather' | 'wildlife' | 'turtle' | 'water' | 'canopy' | 'village' | 'interior'

export interface AudioWorldContext {
  biome: BiomeId
  biomeWeights: Readonly<Partial<Record<BiomeId, number>>>
  rain: number
  wind: number
  night: number
  indoors: boolean
  interiorFlavor: InteriorFlavor | null
  quietMode: boolean
  reducedMotion: boolean
  quality: QualityLevel
}
```

- [ ] Extend runtime’s player/environment audio fields with interiorFlavor and biomeWeights. Make updatePlayerZone copy ZoneBox.flavor into runtime and clear it outdoors.

- [ ] Write failing pure-plan tests for dominant-bed selection, continuous two-biome blend, rain and indoor layer gains, Quiet Mode multipliers, and no hard transition at equal weights.

- [ ] Extend the lifecycle tests with the Phase A router: an injected bed failure is consumed once through `streaming-media`, an injected mono one-shot failure is consumed once through `audio-buffer`, both surface `InjectedAssetFailure`, registered fallbacks run, and all deck/cache/emitter reservations return to baseline. Assert that neither path consumes the router's `model` or `texture` channels.

```ts
it('crossfades rather than switching at a biome boundary', () => {
  const mix = createAmbienceMixPlan(
    makeContext({
      biomeWeights: { crownwood: 0.51, lumenfen: 0.49 },
    }),
  )
  expect(mix.beds).toEqual([
    expect.objectContaining({ biome: 'crownwood', gain: 0.51 }),
    expect.objectContaining({ biome: 'lumenfen', gain: 0.49 }),
  ])
})
```

- [ ] Run and confirm red:

```sh
pnpm test -- tests/ambiencePlan.test.ts tests/ambienceLifecycle.test.ts
```

Expected: FAIL because the explicit plan, bed player, and lifecycle accounting do not exist.

- [ ] Define accepted audio budgets:

```ts
export interface AmbienceQualityBudget {
  maxSpatialEmitters: number
  oneShotCacheBytes: number
  hrtfMaxDistance: number
  detailRate: number
}

export const AMBIENCE_QUALITY_BUDGETS = {
  low: {
    maxSpatialEmitters: 8,
    oneShotCacheBytes: 16_000_000,
    hrtfMaxDistance: 28,
    detailRate: 0.45,
  },
  medium: {
    maxSpatialEmitters: 16,
    oneShotCacheBytes: 32_000_000,
    hrtfMaxDistance: 45,
    detailRate: 0.7,
  },
  high: {
    maxSpatialEmitters: 32,
    oneShotCacheBytes: 64_000_000,
    hrtfMaxDistance: 70,
    detailRate: 1,
  },
  ultra: {
    maxSpatialEmitters: 48,
    oneShotCacheBytes: 96_000_000,
    hrtfMaxDistance: 100,
    detailRate: 1.25,
  },
} as const
```

- [ ] Produce the six accepted ambient beds to the delivery contract, record their actual rights/provenance, add measured loop points, and register them. At the Phase E resume gate, the focused ambience/catalog test must require one bed for every `BiomeId`; the shared audio-slice validator continues to validate only records currently present so the one-bed Phase B pilot remains valid.

- [ ] Implement AmbienceBedPlayer with two streaming media-element decks and a 2-second biome crossfade. Implement 250 ms same-bed loop-boundary crossfades using the manifest loop points. Before either deck loads an authored bed, call `assetFailureRouter.consume(assetId, 'streaming-media')` and surface `InjectedAssetFailure` through the existing procedural-bed fallback path.

- [ ] Implement AudioBufferCache only for mono one-shots. Enforce byte-budget LRU eviction and never decode multi-minute music or biome beds into AudioBuffers. Before fetching/decoding a cache miss, call `assetFailureRouter.consume(assetId, 'audio-buffer')` and reject with `InjectedAssetFailure` when it returns true. The calling engine releases any reserved cache/emitter state and follows the record's registered fallback; neither layer creates a second failure injector.

- [ ] Implement SpatialEmitterPool with bounded PannerNode/GainNode voices, priority by category and listener distance, HRTF inside the quality distance, equal-power panning beyond it, and onended return to pool.

- [ ] Refactor AmbienceEngine.update to accept AudioWorldContext. Remove runtime and settings-store reads from the engine. Keep procedural ocean, wind, and rain as guaranteed fallbacks under authored beds.

```ts
export class AmbienceEngine {
  constructor(ctx: AudioContext, destination: AudioNode, seed: number, assets: AssetRegistry)
  start(): void
  update(input: AudioWorldContext): void
  playSpatial(event: AmbientSpatialEvent): void
  diagnostics(): AmbienceDiagnostics
  dispose(): void
}
```

- [ ] Retain and explicitly stop ocean, wind, rain, LFO, and interior-tone nodes. Remove the random bird/cricket timer entirely; wildlife calls move to Task 9.

- [ ] Run:

```sh
pnpm write:asset-licenses
pnpm validate:assets:audio
pnpm test -- tests/ambiencePlan.test.ts tests/ambienceLifecycle.test.ts
```

Expected: PASS; all six biome beds validate, a boundary produces two blended beds, and dispose leaves zero active bed decks, emitters, timers, or long-lived nodes.

- [ ] Commit checkpoint:

```sh
git add public/audio/ambience src/game/audio/ambience src/game/audio/AudioManager.ts src/game/core/runtime.ts src/game/village/zones.ts src/game/world/biomes/registry.ts src/game/assets/manifest.json ASSET_LICENSES.md tests/ambiencePlan.test.ts tests/ambienceLifecycle.test.ts
git commit -m "feat: add biome-aware ambient sound beds"
```

## Task 9: Synchronize wildlife, turtle, water, village, and interior sound

**Files**

- Modify: src/game/core/events.ts
- Modify: src/game/audio/ambience/WildlifeAudioEngine.ts
- Modify: src/game/audio/ambience/TurtleAudioEngine.ts
- Modify: src/game/audio/ambience/AmbienceEngine.ts
- Modify: src/game/audio/AudioManager.ts
- Create: src/game/audio/ambience/schedule.ts
- Create: tests/ambientSchedule.test.ts
- Modify: tests/wildlifeAudio.test.ts
- Modify: tests/turtleAudio.test.ts
- Modify: tests/comfortMotion.test.ts
- Consume and, only when the approved variant minimum requires it, add registered files under the existing phase-owned roots:
  - public/assets/audio/wildlife/
  - public/assets/audio/turtle/
- Add new registered ambient-detail files under:
  - public/audio/ambience/water/
  - public/audio/ambience/canopy/
  - public/audio/ambience/village/
  - public/audio/ambience/interiors/

- [ ] Consume the Phase D `wildlifeCall: WildlifeCall` and Phase B `turtleSound: TurtleSoundEvent` members from `GameEvents` unchanged. Add only the new general ambient-detail event in this task:

```ts
export interface AmbientOneShotEvent {
  sourceId: string
  assetId: AssetId
  layer: 'water' | 'canopy' | 'village' | 'interior'
  position: readonly [number, number, number]
  gain: number
}

export type AmbientEventAddition = {
  ambientOneShot: AmbientOneShotEvent
}
```

Add the `AmbientEventAddition['ambientOneShot']` property to the existing `GameEvents` object type; do not redeclare or replace its other members.

- [ ] Keep Phase D's schedule/ownership tests as the authority for whether represented wildlife may call. Extend them only to prove that `WildlifeAudioEngine` preserves the event's emitter ID, position, asset ID, and near-agent/distant-group source while using the shared cache/pool.

- [ ] Write failing ambient-detail schedule tests proving rain/time/source eligibility is deterministic, Quiet Mode reduces but does not eliminate details, the same variant does not repeat immediately, and a persistent source cannot acquire two pooled emitters.

```ts
it('quiet mode reduces rather than removes ambient details', () => {
  const normal = simulateAmbientDetails({ quietMode: false, minutes: 30 })
  const quiet = simulateAmbientDetails({ quietMode: true, minutes: 30 })
  expect(quiet.length).toBeGreaterThan(0)
  expect(quiet.length).toBeLessThan(normal.length)
})
```

- [ ] Run and confirm red:

```sh
pnpm test -- tests/ambientSchedule.test.ts
```

Expected: FAIL because the shared cache/pool adapters and deterministic ambient-detail schedule do not exist.

- [ ] Implement deterministic ambient-detail timing with mulberry32 streams keyed by world seed, source ID, layer, and schedule ordinal. Do not create a second wildlife scheduler; Phase D's fixed-tick schedule remains authoritative.

- [ ] Adapt the existing `WildlifeAudioEngine` to resolve its canonical event asset through `AssetRegistry`, decode mono one-shots through `AudioBufferCache`, and borrow voices from `SpatialEmitterPool`. It remains the sole `wildlifeCall` subscriber and renderer.

- [ ] Adapt the existing `TurtleAudioEngine` to select registered variants through the shared asset registry/cache/pool. It remains the sole `turtleSound` subscriber and renderer, and it preserves the event timing and intensity emitted by Turtle Hero.

- [ ] Keep the Phase B/Phase D event payloads and emitters unchanged. Add source tests that reject any second `wildlifeCall` or `turtleSound` subscription in `AmbienceEngine` and verify the old `AmbientLife`/random bird-cricket paths remain absent.

- [ ] Require at least two registered variants for each turtle sound category and at least three for every wildlife species marked audible in the wildlife registry. Reuse the five Phase B turtle files, then close the exact missing categories with `turtle.sound.shell-resonance-deep` at `public/assets/audio/turtle/shell-resonance-deep.mp3`, `turtle.sound.wake-surge` at `public/assets/audio/turtle/wake-surge.mp3`, and `turtle.sound.wake-trail` at `public/assets/audio/turtle/wake-trail.mp3`. Any added wildlife variants stay under `public/assets/audio/wildlife/<species>/`; do not create a mirrored `public/audio/ambience/{turtle,wildlife}` tree.

- [ ] Register falling-water, canopy, village-prop, and interior one-shots by stable source IDs. Persistent waterfalls and room sources use pooled registered emitters; sparse details use ambientOneShot.

- [ ] Subscribe `AmbienceEngine` only to `ambientOneShot`. Release that subscription during dispose; `WildlifeAudioEngine` and `TurtleAudioEngine` own and release their existing event subscriptions independently.

- [ ] Publish sound captions only for meaningful turtle-scale events and weather transitions. Routine wildlife calls do not spam captions.

- [ ] Generate the license ledger and run:

```sh
pnpm write:asset-licenses
pnpm validate:assets:audio
pnpm test -- tests/ambientSchedule.test.ts tests/ambienceLifecycle.test.ts tests/wildlifeAudio.test.ts tests/turtleAudio.test.ts tests/comfortMotion.test.ts
```

Expected: PASS; every audible owner has registered variants, Quiet Mode retains calls, and no event subscriptions survive disposal.

- [ ] Commit checkpoint:

```sh
git add public/assets/audio/wildlife public/assets/audio/turtle public/audio/ambience/water public/audio/ambience/canopy public/audio/ambience/village public/audio/ambience/interiors src/game/core/events.ts src/game/audio/ambience src/game/audio/AudioManager.ts src/game/assets/manifest.json ASSET_LICENSES.md tests
git commit -m "feat: synchronize sanctuary wildlife and turtle audio"
```

## Task 10: Make packaged Electron serve and verify authored audio

**Files**

- Modify: src/desktop/main/index.ts
- Create: src/desktop/main/security/rangeResponse.ts
- Create: tests/rendererAudioProtocol.test.ts
- Modify: scripts/smoke-desktop.mjs
- Modify: scripts/verify-macos-release.mjs
- Modify: scripts/verify-windows-release.mjs
- Modify: .github/workflows/macos-arm64-release.yml
- Modify: .github/workflows/windows-x64-release.yml

- [ ] Export a pure MIME resolver and write failing mappings:

```ts
it.each([
  ['track.mp3', 'audio/mpeg'],
  ['track.m4a', 'audio/mp4'],
  ['track.aac', 'audio/aac'],
  ['track.ogg', 'audio/ogg'],
  ['track.opus', 'audio/ogg'],
  ['track.wav', 'audio/wav'],
  ['track.flac', 'audio/flac'],
])('serves %s as %s', (file, expected) => {
  expect(rendererContentType(file)).toBe(expected)
})
```

- [ ] Add failing pure range tests for no range, bounded range, open-ended range, suffix range, unsatisfiable range, and traversal rejection.

- [ ] Run:

```sh
pnpm test -- tests/rendererAudioProtocol.test.ts
```

Expected: FAIL because audio MIME mappings and rangeResponse.ts do not exist.

- [ ] Add all accepted audio MIME mappings to rendererContentType.

- [ ] Implement range-aware app-protocol responses. Return 206 with Content-Range, Accept-Ranges: bytes, correct Content-Length, and only the requested bytes. Return 416 for an unsatisfiable range. Preserve resolveRendererFile containment.

- [ ] Extend packaged smoke to:
  - load the manifest over app://turtleback;
  - request the first and final 1,024 bytes of a produced track;
  - verify 206, MIME, range headers, and checksum against the packaged file;
  - enter the sanctuary and verify the protocol handler records a successful produced-track range request without exposing renderer internals;
  - suspend/resume and verify context recovery;
  - shut down and verify bounded teardown.

- [ ] Keep the normal production package free of `window.__turtlebackDebug`. Forced decode failure and internal audio-node assertions run through the explicit development/benchmark seam in Task 11; packaged smoke proves secure serving, real playback requests, lifecycle recovery, and teardown.

- [ ] Extend both release verification scripts to require the manifest, exactly twelve produced tracks, six biome beds, all referenced one-shots, and matching checksums inside dist/package resources.

- [ ] Add these workflow path triggers:

```yaml
- 'public/**'
- 'ASSET_LICENSES.md'
- 'MUSIC_PRODUCTION.md'
- 'docs/assets/audio-production-records/**'
- 'src/game/assets/**'
```

- [ ] Run:

```sh
pnpm test -- tests/rendererAudioProtocol.test.ts tests/desktopSecurity.test.ts
pnpm desktop:package:mac
pnpm desktop:smoke
pnpm desktop:verify:mac
```

Expected: PASS; packaged audio serves correct MIME/ranges, issues a real playback request, recovers across suspend/resume, and acknowledges shutdown before the existing three-second deadline.

- [ ] Commit checkpoint:

```sh
git add src/desktop/main scripts .github/workflows tests/rendererAudioProtocol.test.ts
git commit -m "fix: stream and verify packaged sanctuary audio"
```

## Task 11: Add diagnostics, browser E2E, and the two-hour soak

**Files**

- Modify: src/game/audio/AudioManager.ts
- Modify: src/game/debug/probes.ts
- Modify: src/game/world/WorldSystems.tsx
- Read: src/game/assets/AssetFailureRouter.ts
- Create: e2e/audio.spec.ts
- Create: e2e/audio-soak.spec.ts
- Create: playwright.audio-soak.config.ts
- Modify: playwright.config.ts
- Modify: package.json
- Modify: MANUAL_QA.md

- [ ] Export read-only diagnostics:

```ts
export interface AudioDiagnostics {
  contextState: AudioContextState | 'uninitialized'
  buses: Record<BusName, number>
  currentMusicSource: 'produced' | 'procedural' | 'idle'
  music: MusicDirectorSnapshot | null
  ambience: {
    primaryBiome: BiomeId
    activeBedIds: readonly AssetId[]
    activeSpatialEmitters: number
    decodedBufferBytes: number
  }
  activeNodeCounts: Record<string, number>
  activeTimerCount: number
}

export class AudioManager {
  diagnostics(): AudioDiagnostics
}
```

- [ ] Declaration-merge the Phase A `AudioProbeSection` brand-only stub with the read-only `AudioDiagnostics` fields above, then register it through `registerProbeSection('audio', 'audio-manager', () => manager.diagnostics())`. The contributor must unregister during coordinated audio shutdown; no individual engine writes unrelated top-level snapshot fields.

- [ ] Modify the canonical seam only in `src/game/world/WorldSystems.tsx` and `src/game/debug/probes.ts`. Reuse Phase A's existing `probe()` and `failAsset(id)` methods; `failAsset(id)` already delegates to `assetFailureRouter.failNext(id)` and must not be specialized for models, textures, or audio. Do not redefine it in `src/main.tsx`, create a second window global, expose mutable audio-engine objects, or create another audio renderer.

- [ ] Write browser E2E coverage for:
  - score begins only after Enter Sanctuary;
  - produced score reports the music bus and user media reports the media bus;
  - last-four history is visible in diagnostics;
  - forced produced decode failure reports procedural fallback without idle state;
  - forced one-shot `audio-buffer` decode failure follows the registered fallback and returns its cache/emitter reservation without silencing the biome bed;
  - teleporting between two biome probes changes actual active bed IDs;
  - Low-to-Ultra changes emitter/cache budgets without removing layer categories;
  - Quiet Mode reduces event rate while keeping a bed active;
  - existing TV, local-file, radio, and four built-in mood UI flows remain green.

- [ ] Read every E2E assertion through `window.__turtlebackDebug.probe().sections.audio` and inject both streaming-media and AudioBuffer decode failures only through `window.__turtlebackDebug.failAsset(id)`. The consuming player/cache selects the router channel; the window API remains ID-only. Keep both debug methods on the Phase A development/benchmark diagnostics seam.

- [ ] Run:

```sh
pnpm test:e2e -- e2e/audio.spec.ts e2e/media.spec.ts
```

Expected: PASS in headless Chromium with no page errors or unhandled rejections.

- [ ] Add a dedicated soak script:

```json
{
  "scripts": {
    "test:audio-soak": "playwright test -c playwright.audio-soak.config.ts"
  }
}
```

- [ ] Add **/audio-soak.spec.ts to playwright.config.ts testIgnore so pnpm test:e2e remains a short ordinary gate.

- [ ] Create playwright.audio-soak.config.ts by extending the ordinary browser/server settings, clearing testIgnore, matching only e2e/audio-soak.spec.ts, disabling retries, and setting the worker count to one.

- [ ] Make e2e/audio-soak.spec.ts read AUDIO_SOAK_MINUTES, default to 120, set its own timeout to the requested duration plus five minutes, traverse deterministic benchmark points, rotate weather/time/biome contexts, force one streaming-media failure and one AudioBuffer failure through the canonical ID-only API, exercise pause/suspend/resume, and sample diagnostics every 30 seconds.

- [ ] Assert during the soak:
  - no produced track repeats in the previous four;
  - no procedural fingerprint repeats within 45 minutes;
  - active timers remain within the fixed director/ambience baseline;
  - active long-lived nodes remain within the fixed bus/deck/bed baseline;
  - spatial emitters never exceed the active quality budget;
  - decoded one-shot bytes never exceed the active quality budget;
  - node and timer counts return to baseline after each transition;
  - masterLevel reports nonzero samples in at least 95 percent of non-muted intervals;
  - no source remains loading for more than 15 seconds;
  - the final 20 minutes show less than 10 percent growth in tracked audio resources.

- [ ] Run an accelerated two-hour selection simulation in Vitest:

```sh
pnpm test -- tests/musicSelection.test.ts tests/ambientSchedule.test.ts
```

Expected: PASS in under one second.

- [ ] Run the real-time soak:

```sh
AUDIO_SOAK_MINUTES=120 pnpm test:audio-soak
```

Expected: PASS after 120 minutes with the resource plateau and anti-repetition assertions above.

- [ ] Add the real-time soak to the manual release checklist rather than every push workflow. Keep the deterministic fast simulation in ordinary CI.

- [ ] Commit checkpoint:

```sh
git add src/game/audio/AudioManager.ts src/game/debug/probes.ts src/game/world/WorldSystems.tsx e2e/audio.spec.ts e2e/audio-soak.spec.ts playwright.config.ts playwright.audio-soak.config.ts package.json MANUAL_QA.md
git commit -m "test: gate hybrid audio transitions and soak stability"
```

## Task 12: Rewrite audio documentation and execute the Phase E gate

**Files**

- Modify: MUSIC_PRODUCTION.md
- Modify: ARCHITECTURE.md
- Modify: README.md
- Modify: MANUAL_QA.md
- Modify: ASSET_LICENSES.md
- Modify: public/audio/music/README.md

- [ ] Rewrite MUSIC_PRODUCTION.md to describe the actual manifest, two-deck music-bus player, deterministic event plans, accepted production values, ffmpeg two-pass process, license records, validation commands, and fallback behavior.

- [ ] Remove these obsolete claims everywhere:
  - Turtleback ships zero binary media assets.
  - The soundtrack is entirely procedural.
  - Produced soundtrack files should be registered as MediaPlayer local items.
  - Produced soundtrack files use the media bus.
  - The current engine is fully deterministic while crackle still uses Math.random.

- [ ] Update ARCHITECTURE.md with:
  - MusicDirector ownership;
  - produced/procedural selection flow;
  - music versus media bus separation;
  - explicit AudioWorldContext;
  - biome-bed blending;
  - represented wildlife emitters;
  - asset validation and packaged range serving;
  - explicit disposal diagnostics.

- [ ] Update README.md feature and test counts from the final command output. Keep the statement that user local audio is never uploaded.

- [ ] Regenerate ASSET_LICENSES.md and verify a clean diff:

```sh
pnpm write:asset-licenses
pnpm validate:assets:audio
git diff --exit-code ASSET_LICENSES.md
```

Expected: PASS; the generated ledger is reproducible.

- [ ] Run the full automated gate:

```sh
pnpm validate:assets:audio
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Expected: every command exits 0; the production build contains exactly the registered Phase E audio set. Phase F runs `pnpm validate:assets:final` after every visual and audio catalog is complete.

- [ ] Run the packaged macOS gate:

```sh
pnpm desktop:package:mac
pnpm desktop:smoke
pnpm desktop:verify:mac
```

Expected: every command exits 0; packaged playback, range requests, suspend/resume, and bounded shutdown pass, while the development/benchmark E2E gate supplies forced-fallback proof.

- [ ] Trigger the existing Windows x64 unsigned-proof workflow after push and require its installer proof, smoke, and verification artifact to pass before release.

- [ ] Complete manual headphone review on the recorded reference systems:
  - each produced track is calm, original, click-free, and balanced;
  - each biome bed is identifiable within 30 seconds;
  - all crossfades are free of gaps, phase jumps, and abrupt loudness changes;
  - wildlife calls originate from visible or spatially credible represented groups;
  - turtle breath, flipper, wake, and shell resonance read as monumental without startling peaks;
  - Quiet Mode is quieter but not silent;
  - Low retains every major category;
  - local files, radio, TV, subtitles, mute, sliders, save/reload, recovery, and shutdown remain functional.

- [ ] Commit checkpoint:

```sh
git add MUSIC_PRODUCTION.md ARCHITECTURE.md README.md MANUAL_QA.md ASSET_LICENSES.md public/audio/music/README.md
git commit -m "docs: document hybrid soundtrack production and release gates"
```

## Completion evidence

- [ ] Attach the final `pnpm validate:assets:audio` output and focused registry-test output showing exactly twelve produced tracks, six biome beds, complete registered one-shots, and zero audio-slice errors. The Phase F closeout owns the whole-release `pnpm validate:assets:final` artifact.
- [ ] Attach the final Vitest summary, Playwright summary, production-build summary, macOS packaged smoke result, macOS verification JSON, and Windows verification artifact.
- [ ] Attach the two-hour soak summary with selection history, fingerprint history, decode-fallback event, peak node/timer/emitter/cache counts, and final-20-minute growth.
- [ ] Attach the twelve production records and reproducible ASSET_LICENSES.md diff check.
- [ ] Record the manual headphone review hardware, operating system, audio output, and pass/fail result for every checklist item.
