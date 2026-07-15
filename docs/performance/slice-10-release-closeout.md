# Slice 10 release closeout

## Outcome

The stylized sanctuary overhaul is engineering-complete at source commit `3dd07c29e13cabcf05726c550bf2a075f9c7cab6`. Browser, packaged Electron, asset/license, size, visual-condition, traversal-memory, and two-hour music-plan evidence are complete. Release approval is deliberately not claimed because the named High/Low hardware slots and the owner's normal-play showcase walk remain external gates.

## Performance and resource proof

- The 30-minute offline diagnostic package traversed eight normal-play regions in clear/rain and day/sunset/night, producing 61 samples and 60 cell transitions (2/minute).
- Final-20-minute working-set growth was **−1.20%**: the starting comparison-bucket median was 1,035,042,816 bytes and the ending median was 1,022,656,512 bytes, passing the `<10%` contract.
- Renderer textures stayed at 55 for the entire run. Geometry counts varied by streamed scene and settled within 670–682 over the final 20 samples; the final sample was 682.
- Every High sample retained 49 active and 81 horizon cells. No page error, console error, or asset fallback occurred.
- Music remained active with exactly two scheduler timers, six biome beds, and bounded planned concurrency. The existing pure 120-minute trace covers 350 unique arrangement signatures, seven forms, four palettes, four leads, 100 breathing spaces, and no silent failure section.

The local Apple M5 is a development host, not a registered release reference. The normal packaged High sample ran at a 1280×688 CSS viewport with DPR 2 (2560×1376 backing) and measured p95 17.9 ms over 60 seconds. It does not satisfy or reject the 1080p named `high-dedicated` or `low-integrated` slots; those remain unregistered in `docs/performance-reference-systems.json`.

## Packaged Electron proof

The normal macOS proof package is arm64-only, declares macOS 12.0 and bundle ID `com.turtleback.sanctuary`, carries the project icon, and passes a deep ad-hoc signature check. Publishing and notarization were disabled for this local proof.

With DNS mapped offline, first launch and relaunch both loaded from `app://turtleback`. The preload bridge was available while renderer `require`, `process`, and JavaScript eval remained blocked. GLB, KTX2, Basis JS/WASM, and the isolated worker all returned the expected MIME type from the packaged origin. No fallback was used. FOV/High settings, repositories, and autosave persisted; second-instance focus, synthetic suspend/resume, renderer responsiveness, and coordinated disposal passed with zero renderer errors.

## Asset, size, and decode proof

- Strict final validation passes for seven assets, seven variants, and 622,409 encoded bytes.
- The five original turtle MP3s now have exact hashes, deterministic generation records, all-tier coverage, decoded-size accounting, no preload region, and a procedural-silence fallback.
- The score and ambience are synthesized through bounded Web Audio plans, so there is no produced-track decode cache or large soundtrack payload.
- `app.asar` is 5,979,932 bytes. The largest runtime file is the existing 3,159,356-byte Rapier physics chunk.
- No runtime file exceeds 10 MiB; no uncompressed or unregistered authored binary ships.

## Visual and regression proof

- The exhaustive 332-scenario art registry passed as 159 High-clear, 120 secondary-clear, and 53 High-rain captures.
- The final six-frame release cross-section covers High, Medium, Low, Reduced Motion, Quiet Mode, clear/rain, and day/sunset/night.
- Unit tests passed 482/482 across 57 files; browser E2E passed 21/21; lint, typecheck, strict asset validation, production build, and the in-app normal-play error check passed.

## Remaining external release gates

1. Register and run the named 1080p `high-dedicated` and `low-integrated` hardware slots at p95 ≤16.7 ms and ≤33.3 ms respectively.
2. Complete the owner showcase walk and listening approval in `MANUAL_QA.md`.
3. Run credentialed Developer ID/notarization and Authenticode release flows plus physical macOS/Windows/controller/display/audio checks.

Until those gates have evidence, the accurate status is **engineering-complete, release approval pending**.
