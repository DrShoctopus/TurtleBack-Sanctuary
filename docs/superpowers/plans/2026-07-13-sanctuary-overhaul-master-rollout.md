# Sanctuary Graphics and Audio Overhaul Master Rollout Implementation Plan

**Status:** Superseded on 2026-07-14

> Do not continue this near-photorealistic rollout. It is retained as historical context only.
> The current source of truth is
> `docs/superpowers/plans/2026-07-14-stylized-sanctuary-reset.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved near-photorealistic sanctuary overhaul as six independently verifiable phases without regressing traversal, accessibility, browser delivery, or the secure Electron application.

**Architecture:** Preserve the analytic shell and mutable runtime as the gameplay source of truth, then layer a validated authored-asset pipeline, deterministic spatial composition, pooled wildlife, a hybrid music director, and quality-scaled rendering around those contracts. Each focused plan owns one phase and publishes explicit interfaces to later phases; no phase may hide a failed collision, performance, licensing, or fallback gate.

**Tech Stack:** React 19, TypeScript, React Three Fiber, Three.js/WebGL2, Rapier, Web Audio, Zod, Vite, Electron, Vitest, Playwright, glTF/GLB, Meshopt, KTX2/Basis, MP3, pnpm.

---

## Source of Truth

- Approved design: `docs/superpowers/specs/2026-07-13-sanctuary-graphics-audio-overhaul-design.md`
- Phase A: `docs/superpowers/plans/2026-07-13-rendering-asset-foundation.md`
- Phase B: `docs/superpowers/plans/2026-07-13-turtle-hero-vertical-slice.md`
- Phase C: `docs/superpowers/plans/2026-07-13-biome-world-composition.md`
- Phase D: `docs/superpowers/plans/2026-07-13-wildlife-ecosystem.md`
- Phase E: `docs/superpowers/plans/2026-07-13-hybrid-lofi-soundtrack.md`
- Phase F: `docs/superpowers/plans/2026-07-13-atmosphere-release-polish.md`

The focused phase plans contain the red-green-refactor steps, concrete file mappings, APIs, asset contracts, commands, and commit checkpoints. This document controls order, shared decisions, cross-phase integration, and release acceptance.

## Approved Delivery Decisions

- Firewatch is a research reference for staging, silhouettes, atmosphere, color rhythm, and environmental composition only. No Campo Santo assets, maps, textures, story material, or proprietary content may be copied.
- The visual surface target is near photorealism, with restrained stylization used to preserve clarity and calm.
- The turtle is a mythic world-bearer: monumental, ancient, physically credible, gently animated, and staged through normal traversal rather than only cinematic cameras.
- The world uses six blended fantastical biomes: Crownwood, Lumenfen, Blossomshade, Fernfall, Galecrest, and Hearth Clearings.
- Wildlife is habitat-aware, nonviolent, visible, audible, pooled, deterministic at the simulation boundary, and synchronized with nearby calls.
- The soundtrack is hybrid: repaired and expanded deterministic procedural music plus twelve original or redistribution-safe produced pieces.
- Low, Medium, High, and Ultra preserve the same geography and content categories. Fidelity, density, range, texture resolution, and representation may scale.
- Auto quality is initially capped at High. Ultra is an explicit choice until named-hardware evidence justifies automatic promotion.
- The analytic shell in `src/game/world/shell/shellShape.ts` remains authoritative for walking, path height, and Rapier collision.
- Existing building IDs, interactions, media behavior, save compatibility, Reduced Motion, Quiet Mode, and audio-bus semantics remain stable.

## Shared Contracts

### Quality and performance

```ts
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra'
export type AutoQualityLevel = Exclude<QualityLevel, 'ultra'>

export interface PerformanceEvidence {
  scenarioId: string
  quality: QualityLevel
  warmupSeconds: number
  p50FrameMs: number
  p95FrameMs: number
  p99FrameMs: number
  drawCalls: number
  triangles: number
  textures: number
  estimatedTextureBytes: number
  processBytes?: number
}
```

- High acceptance: p95 frame time at or below 16.7 ms at 1080p on the named dedicated-GPU reference path after warm-up.
- Low acceptance: p95 frame time at or below 33.3 ms at 1080p-equivalent output on the named integrated-GPU reference path after warm-up.
- Thirty-minute traversal acceptance: less than 10 percent memory growth over the final 20 minutes.
- Two-hour audio acceptance: no scheduler stall, silent transition, unbounded node growth, or anti-repetition violation.
- SwiftShader captures prove structural correctness only; material and frame-time approval requires real reference GPUs.

### Asset provenance

Every binary asset must have one stable registry record containing its kind, path, checksum, encoded and approximate decoded size, author, allowed license, source URL or generation record, attribution, quality/LOD variants, preload regions, capabilities, and fallback. `ASSET_LICENSES.md` must be generated from or checked against that registry.

Accepted asset origins are:

- original project-authored work;
- generated work with a retained generation and editing record;
- CC0 material from a traceable source;
- attribution-licensed material only when redistribution and in-game use are explicitly permitted and the required credit ships with the game.

“Free to download,” editorial-only, unclear-license, or AI-output-with-unclear-rights material is rejected by the intake gate.

### Runtime ownership

```text
settings + quality + time/weather + player cell
                     |
                     v
       deterministic world/runtime contracts
          /          |          |          \
   assets/cells   biome world  wildlife   audio context
          \          |          |          /
                     v
          scene probes + performance evidence
```

- React mounts and unmounts coarse systems; per-frame movement stays in mutable runtime state.
- Spatial composition is deterministic from world seed, cell key, layer, and family ID.
- Asset, wildlife, wet-material, environment-map, media, and audio-node ownership all expose disposal.
- Debug probes report real rendered resources and active audio sources rather than detached configuration values.
- Failure injection is limited to development and benchmark builds.
- Phase A publishes one `AssetFailureRouter` singleton for the exact channels `model`, `texture`, `streaming-media`, and `audio-buffer`. The ID-only `window.__turtlebackDebug.failAsset(id)` delegates to that router; each loader chooses its channel and consumes a pending failure once. Normal production builds keep the router mutation-disabled and expose no debug global. Only the explicitly marked package under `release-diagnostics/` may enable the diagnostics flag; it never substitutes for a normal release artifact.

## Execution Sequence

### Task 1: Freeze the browser and desktop baseline

**Files:**

- Read: `package.json`
- Read: `docs/performance-baseline.md`
- Read: `MANUAL_QA.md`
- Read: `src/game/world/shell/shellShape.ts`
- Create: `docs/performance/overhaul-baseline.json`

- [ ] Run `git status --short` and record any user-owned changes before implementation.
- [ ] Run `pnpm typecheck`; expect exit 0.
- [ ] Run `pnpm lint`; expect exit 0.
- [ ] Run `pnpm test`; expect every existing Vitest test to pass.
- [ ] Run `pnpm build`; expect `dist/` to build with the current relative Vite base.
- [ ] Run `pnpm test:e2e`; expect the current browser traversal, settings, media, and recovery checks to pass.
- [ ] Run `pnpm capture:graphics`; expect the existing benchmark screenshots to complete.
- [ ] Run `pnpm desktop:package:mac && pnpm desktop:smoke` on the supported macOS host; record the real result without treating a browser-only pass as desktop proof.
- [ ] Capture the existing fixed benchmark metrics and write the named host, renderer, resolution, quality, frame-time sample, draw calls, triangles, and process memory to `docs/performance/overhaul-baseline.json`.
- [ ] Commit the evidence: `git add docs/performance/overhaul-baseline.json && git commit -m "test: capture overhaul baseline"`.

### Task 2: Execute Phase A — rendering and asset foundation

**Plan:** `docs/superpowers/plans/2026-07-13-rendering-asset-foundation.md`

- [ ] Correct and test the color-space contract before approving any authored palette or texture values.
- [ ] Add Ultra, monotonic resource budgets, p95-based Auto decisions, and settings migration; keep Auto capped at High.
- [ ] Add the single asset registry, license ledger, base-URL-safe resolver, GLB/Meshopt/KTX2 loaders, cache leases, fallbacks, and disposal.
- [ ] Prove GLB and KTX2 decoding through both Vite and `app://turtleback` with registered smoke assets.
- [ ] Divide current vegetation into deterministic 50-metre cells before increasing density.
- [ ] Add real scene/resource probes, benchmark scenarios, failure injection, and the expanded capture matrix.
- [ ] Pass the complete Phase A gate in its focused plan.

**Published interfaces:** `QualityLevel`, `QualityProfile`, `AssetRegistry`, `AssetManager`, `AssetLease`, `AssetFailureRouter`, `InjectedAssetFailure`, `AssetFailureChannel`, `CellKey`, `SpatialCellTracker`, `SceneProbeSnapshot`, the strict graphics CLI contract, and the renderer color contract.

### Task 3: Execute Phase B — turtle hero vertical slice

**Plan:** `docs/superpowers/plans/2026-07-13-turtle-hero-vertical-slice.md`

- [ ] Execute the slice-scoped prerequisite tasks from the biome, wildlife, soundtrack, and atmosphere plans: pure biome fields/composition, the Crownwood/Galecrest corridor, one songbird group, one seabird group, one biome bed, one produced/procedural transition, and the final-quality corridor material/lighting treatment. This is intentional vertical-slice interleaving; the full six-biome, species, catalog, and polish expansion remains in Phases C-F.
- [ ] Validate the turtle source license and archive its source/checksum before editing.
- [ ] Author, retopologize, UV, bake, texture, rig, animate, and export the four required turtle model files and texture tiers.
- [ ] Preserve the current procedural turtle as the registered failure fallback.
- [ ] Validate node, skeleton, clip, pivot, scale, LOD, texture, material, and shell-alignment contracts before scene integration.
- [ ] Replace the visible primitive hero while keeping analytic shell traversal and physics unchanged.
- [ ] Complete the Crownwood-to-Galecrest bow corridor, turtle scale event, wake, spray, foliage response, turtle audio, and one representative wildlife group.
- [ ] Prove Low-to-Ultra resources, four normal-play monumental vistas, collision safety, fallback behavior, and target frame time.
- [ ] Pass the complete Phase B gate in its focused plan.

**Published interfaces:** turtle model contract, `TurtleAnimationPlan`, `TurtleEventDirector`, `runtime.turtle`, wake emitters, and turtle sound events.

### Task 4: Execute Phase C — biome and village composition

**Plan:** `docs/superpowers/plans/2026-07-13-biome-world-composition.md`

- [ ] Treat the biome core and Crownwood/Galecrest work already completed for the hero slice as the first passing Phase C increment; do not rebuild it under a second API.
- [ ] Implement pure habitat fields, continuous biome weights, independent seeded cell layers, placement exclusions, and quality selection.
- [ ] Build close, medium, distant, and horizon representations for every required plant and prop family.
- [ ] Replace the global procedural vegetation renderer only after cell-render parity and fallback coverage pass.
- [ ] Compose all six biomes with canopy, mid-story, understory, ground cover, deadfall, navigation anchors, and intentional sightlines.
- [ ] Decompose village dressing into streamed cells while preserving building IDs, interactions, paths, map markers, spawn, and interior behavior.
- [ ] Rebuild traversal data and Rapier geometry from the same analytic height samples.
- [ ] Prove every biome is identifiable on Low and transitions without hard borders on all tiers.
- [ ] Pass the complete Phase C gate in its focused plan.

**Published interfaces:** `BiomeId`, `HabitatSample`, `BiomeWeights`, `ComposedCell`, biome masks, habitat queries, village cell composition, and stable path specifications.

### Task 5: Execute Phase D — wildlife ecosystem

**Plan:** `docs/superpowers/plans/2026-07-13-wildlife-ecosystem.md`

- [ ] Treat the represented songbird and seabird groups already completed for the hero slice as the first director populations; migrate them into the complete roster without running a parallel slice-only system.
- [ ] Implement a fixed-tick wildlife director, habitat queries, pooling, schedules, state machines, and quality representations.
- [ ] Migrate existing gull activity, then add land, wetland, air, insect, and ocean families in the plan’s order.
- [ ] Keep at least one characteristic wildlife group per biome and every major category on Low.
- [ ] Tie nearby calls only to represented agents or explicit distant groups.
- [ ] Integrate time, rain, wind, Quiet Mode, Reduced Motion, biome context, player avoidance, and turtle events.
- [ ] Remove primitive `AmbientLife` and random bird/cricket scheduling only after parity and fallback tests pass.
- [ ] Prove representative 90-second observation windows, pool reuse, deterministic schedules, and audio ownership.
- [ ] Pass the complete Phase D gate in its focused plan.

**Published interfaces:** `WildlifeDirector`, `WildlifeFrame`, wildlife events/calls, represented owner IDs, and diagnostics.

### Task 6: Execute Phase E — hybrid lo-fi soundtrack

**Plan:** `docs/superpowers/plans/2026-07-13-hybrid-lofi-soundtrack.md`

- [ ] Retain the biome bed and hybrid transition proven in the hero slice as production code and expand the same manifest/director rather than replacing it.
- [ ] Repair phrase length and seeded event planning so every progression chord is reachable and reproducible.
- [ ] Add distinct arrangement families, timbres, motifs, dynamics, timing, and texture variation for each mood.
- [ ] Implement the two-deck produced-track player and deterministic hybrid selector on the existing music bus.
- [ ] Produce, normalize, register, license, package, and verify twelve original or redistribution-safe tracks.
- [ ] Add blended biome beds and explicit world-audio context.
- [ ] Synchronize wildlife and turtle calls with represented visual/event owners.
- [ ] Preserve local file and radio playback on the media bus and preserve the existing soundtrack enable setting.
- [ ] Pass the two-hour audio soak and the complete Phase E gate.

**Published interfaces:** `MusicalEventPlan`, `MusicDirector`, `ProducedTrackPlayer`, `AudioWorldContext`, `AudioDiagnostics`, and asset-backed ambient events.

### Task 7: Execute Phase F — atmosphere and release polish

**Plan:** `docs/superpowers/plans/2026-07-13-atmosphere-release-polish.md`

- [ ] Centralize continuous time/weather atmosphere and grading without adding a second tone mapper.
- [ ] Add cached sky-derived image-based lighting and restrained High/Ultra contact AO.
- [ ] Finish biome-aware height fog, mist, rain shafts, light rays, wet material policies, runoff, puddles, interiors, ocean wake, and foam.
- [ ] Verify every streamed/global registry unregisters and releases GPU, DOM media, timer, and Web Audio resources.
- [ ] Tune Low, Medium, High, and Ultra from measured scenarios rather than arbitrary object counts.
- [ ] Run the complete capture matrix and human material/atmosphere review on reference GPUs.
- [ ] Add Phase F's Node-only final release inventory contract and prove `validate:assets:final` enforces all six world packs/material tiers, turtle assets and sound variants, the canonical fourteen-species wildlife registry, the exact twelve music tracks, exactly six biome beds, and every required turtle/wildlife/ambient-detail one-shot reference.
- [ ] Build a distinct marked diagnostics package under `release-diagnostics/`; launch desktop benchmark/soak only from that artifact, while normal package smoke and release verifiers remain `release/`-only and prove mutation surfaces are absent.
- [ ] Pass browser, packaged Electron, licensing, performance, memory, audio, accessibility, and release gates.

## Cross-Phase Change Protocol

Before changing a published interface:

- [ ] Search all focused plans and live consumers with `rg -n "InterfaceName|eventName|asset-id" src tests e2e docs/superpowers/plans`.
- [ ] Update the owning phase tests first and run them red.
- [ ] Update every consuming plan or implementation in the same commit.
- [ ] Retain a compatibility adapter when the old API is already used by stable game behavior.
- [ ] Record the reason and migration in the commit body.

When an authored asset misses its contract:

- [ ] Reject it at registry/model validation rather than weakening runtime checks.
- [ ] Keep the registered procedural or lower-detail fallback playable.
- [ ] Store the corrected generation/source/edit record and new checksum with the replacement.
- [ ] Re-run the browser and packaged Electron decode proof.

When a performance gate fails:

- [ ] Save the failing scenario evidence before tuning.
- [ ] Identify the dominant budget using probe output: calls, triangles, instances, texture bytes, active cells, wildlife agents, atmosphere passes, or audio nodes.
- [ ] Reduce decorative fidelity within the failing tier without removing geography, routes, biomes, hero landmarks, or wildlife categories.
- [ ] Re-run the targeted scenario and the nearest higher/lower tier to prove monotonic budgets.
- [ ] Do not advance phases with an unresolved collision, disposal, or p95 regression.

## Final Verification Gate

- [ ] Run the exact specialized final rosters first: `pnpm validate:assets:world -- --required-biomes=crownwood,galecrest,lumenfen,fernfall,blossomshade,hearth`, `pnpm validate:assets:turtle`, `pnpm validate:assets:wildlife -- --required-species=mossback-grazer,shell-hare,fernfall-glider,crownwood-songbird,tide-corvid,galecrest-seabird,lumenfen-frog,reed-wader,lumenfen-insects,blossom-pollinators,lumenfen-fish,shell-ray,sanctuary-dolphin,distant-whale`, and `pnpm validate:assets:audio`; expect every specialized pack/model/clip/review/delivery gate to pass.
- [ ] Run `pnpm write:asset-licenses && pnpm validate:assets && pnpm validate:assets:final`; expect every path, checksum, source, license, attribution, fallback, LOD, required final inventory, and generated ledger check to pass.
- [ ] Run `pnpm typecheck`; expect exit 0.
- [ ] Run `pnpm lint`; expect exit 0.
- [ ] Run `pnpm test`; expect the complete Vitest suite to pass.
- [ ] Run `pnpm build`; expect the production static build to pass after asset validation.
- [ ] Run `pnpm test:e2e`; expect browser traversal, resource, wildlife, audio, media, settings, save, recovery, and fallback checks to pass.
- [ ] Run `pnpm capture:graphics`; expect the full quality/time/weather matrix to complete.
- [ ] Run `pnpm benchmark:graphics -- --variant=default`; expect scenario evidence JSON for Crownwood, Lumenfen, village, turtle/flipper, rain, and night. Run the targeted AO comparison only as `pnpm benchmark:graphics -- --scenario=turtle-material-close-high-noon-clear --variant=no-ao`; unknown, duplicate, or unsupported CLI input must fail before launch.
- [ ] Run `AUDIO_SOAK_MINUTES=120 pnpm test:audio-soak`; expect stable selection, fallback, scheduler, and node counts.
- [ ] Run `pnpm desktop:package:mac && pnpm desktop:smoke && pnpm desktop:verify:mac`; expect the normal artifact under `release/` to pass packaged assets, protocol MIME/range behavior, playback, security, and recovery with no diagnostic marker/global.
- [ ] On the named High host, run `pnpm desktop:package:diagnostics`, `pnpm desktop:benchmark -- --reference=high-dedicated`, and `pnpm soak:graphics -- --reference=high-dedicated --minutes=30`. On the named Low host, run `pnpm desktop:package:diagnostics`, `pnpm desktop:benchmark -- --reference=low-integrated`, and `pnpm soak:graphics -- --reference=low-integrated --minutes=30`; expect only each current marked artifact under `release-diagnostics/` to launch and memory growth below 10 percent over the final 20 minutes.
- [ ] Run the Windows packaged proof on the declared Windows runner; expect `pnpm desktop:verify:win` to pass.
- [ ] Review every required capture on the named reference GPUs and record signoff in `MANUAL_QA.md`.
- [ ] Confirm all six biomes, four normal-play monumental turtle vistas, five forest layers on High, representative wildlife observations, twelve produced tracks, deterministic generative forms, and graceful registered fallbacks.
- [ ] Confirm Reduced Motion, Quiet Mode, quality settings, music/ambient/media buses, save/recovery, home return, and all existing interactions remain functional.
- [ ] Commit final evidence and release documentation: `git add ASSET_LICENSES.md MANUAL_QA.md README.md docs/performance && git commit -m "docs: record sanctuary overhaul release evidence"`.

## External Acceptance Dependencies

The implementation can build and structurally verify assets locally, but final approval requires:

- a named integrated-GPU system for the Low 30 FPS contract;
- a named dedicated-GPU system for the High 60 FPS contract;
- a Windows runner for packaged proof;
- a 3D authoring environment capable of retopology, baking, rigging, animation, and glTF export;
- an approved DAW or deterministic offline audio renderer with retained source sessions, stems, rights records, and ffmpeg/ffprobe delivery tools;
- human review of PBR materials, fog, silhouettes, wildlife grouping, mix balance, and the capture matrix.

If one of these is unavailable, preserve the generated evidence and report that specific gate as unverified. Do not substitute SwiftShader, a build pass, or a browser-only launch for the missing hardware or packaged-runtime proof.
