# Performance Baseline

This document retains the historical Phase 0 browser baseline, the controlled
Phase 1 packaged-Electron measurement, and the Phase A rendering-foundation
software-renderer benchmark below. These observations use different runtimes and
measurement methods and should not be treated as direct before/after regression
comparisons.

## Scope

This Phase 0 baseline captures the reproducible facts available before the
Electron conversion. It is deliberately modest: the runtime observation was a
short development-browser check, not a controlled benchmark and not an Electron
package measurement.

No Windows or Linux measurement, packaged macOS measurement, integrated-graphics
measurement, startup trace, memory profile, power profile, or long-session run
has been completed. The figures below must not be used to claim release hardware
support.

## Baseline source and environment

| Item                 | Value                                    |
| -------------------- | ---------------------------------------- |
| Source commit        | `a1f7ec3`                                |
| Operating system     | macOS 26.5.1                             |
| Hardware             | Apple M5, 10 CPU cores / 10 GPU cores    |
| Memory               | 16 GB                                    |
| Node.js              | 26.5.0                                   |
| pnpm                 | 11.12.0                                  |
| Renderer             | Browser development build served by Vite |
| Observation viewport | 1280 × 720                               |
| Graphics preset      | High                                     |
| Scene                | Playable Arrival Overlook                |

## Functional observation

The application reached the title/start screen and entered playable Arrival
Overlook in the in-app browser. This verifies that the baseline browser renderer,
Rapier world, UI, and initial gameplay path loaded on the audit machine.

The development-only performance overlay displayed **120 FPS** on the High preset
at 1280 × 720 after approximately two seconds in the scene.

This is a short dev-browser observation only:

- It was not captured from a packaged Electron application.
- It does not include Electron main/preload process overhead.
- It is not a statistically sampled average, percentile, or frame-time trace.
- It does not distinguish CPU-bound, GPU-bound, display-refresh, or browser
  scheduling limits.
- Two seconds is insufficient to characterize shader warm-up, automatic quality,
  streaming, memory growth, weather, interiors, remote media, or long-session
  behavior.
- It must not be compared as an Electron before/after number until the same scene,
  viewport, preset, warm-up, and capture method are used in the packaged build.

## Production bundle size

The audited production `dist/` output was approximately **3.5 MB** in total.
Rounded major files were:

| Output                                                            | Approximate size | Observation                                                         |
| ----------------------------------------------------------------- | ---------------: | ------------------------------------------------------------------- |
| Physics JavaScript/WASM wrapper chunk                             |           3.0 MB | Dominant payload; Rapier is split into a separately cacheable chunk |
| Main application JavaScript                                       |           484 KB | React, renderer/game/UI code excluding the physics chunk            |
| CSS                                                               |            16 KB | Global UI styling                                                   |
| HTML, SVG, example config, and documentation copied from `public` |        Remainder | Small relative to JavaScript chunks                                 |

Sizes are on-disk rounded file sizes, not compressed network-transfer sizes. In a
desktop package the relevant follow-up is unpacked/package size and startup I/O,
not browser cacheability alone.

## Current performance architecture

The baseline contains several intentional performance measures:

- high-frequency simulation is stored outside React state;
- one frame driver advances input, time, weather, travel, audio, FPS sampling,
  and automatic quality;
- buildings merge static geometry by material and use simplified colliders;
- landmarks are pooled and scheduled deterministically;
- procedural textures are cached;
- quality profiles scale DPR, shadows, ocean, rain, vegetation, view distance,
  reflections, bloom, clouds, landmarks, and dynamic lights;
- the production build separates the dominant physics chunk.

These design choices are promising but are not substitutes for measurement.
Several shared disposal functions exist without an application-lifecycle owner,
so leak-free shutdown and long-session behavior remain unproven.

## Measurements not yet captured

The following required performance data is unknown after Phase 0:

| Area             | Missing evidence                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Startup          | Process launch to first paint, title ready, scene ready, and first controllable frame                |
| Frame pacing     | Median, 1% low, 0.1% low, frame-time histogram, and stutter events                                   |
| CPU              | Idle/title/gameplay/interior/weather/remote-media utilization by process                             |
| GPU              | Utilization, VRAM or shared-memory pressure, GPU process stability, and device selection             |
| Memory           | Initial footprint, post-load footprint, scene transitions, and growth over 30–120 minutes            |
| Assets           | Procedural generation cost, Rapier initialization, and any future asset I/O/decode time              |
| Shaders          | First-use compilation stalls for sky, ocean, rain, atmosphere, bloom, and quality changes            |
| Physics          | Character/world step cost in representative districts and during traversal                           |
| Audio            | Context initialization, synthesis cost, media decode, radio behavior, device changes, and sleep/wake |
| React/UI         | Rerender counts and pause/settings/media overlay resource cost                                       |
| Disposal         | Three geometry/material/texture cleanup, audio nodes, event listeners, and remote frames             |
| Package overhead | Electron main/preload/renderer memory, startup time, and IPC cost                                    |

## Platform coverage status

| Target                                      | Phase 0 status                             |
| ------------------------------------------- | ------------------------------------------ |
| macOS Apple Silicon browser development run | Short functional/FPS observation completed |
| macOS packaged Electron                     | Not measured                               |
| macOS Intel                                 | Not measured                               |
| Windows x64                                 | Not measured                               |
| Linux                                       | Not measured                               |
| Integrated graphics reference device        | Not measured                               |
| Mid-range dedicated GPU reference device    | Not measured                               |
| Controller-connected performance            | Not measured                               |
| Offline packaged startup                    | Not measured                               |
| Remote radio/YouTube load                   | Not measured                               |
| Long session                                | Not measured                               |

## Reproducible comparison protocol for later phases

Future measurements should retain the browser baseline and add a production-like
desktop run without changing the test scene during comparison:

1. Record commit, OS build, CPU/GPU, memory, power mode, display refresh rate,
   Electron/Chromium version, viewport, display scale, and graphics preset.
2. Use a clean launch and measure process start to first paint, title ready, scene
   ready, and controllable Arrival Overlook.
3. Warm the scene for a fixed interval before the steady-state sample; separately
   preserve cold-start shader/physics stalls.
4. Capture at least 60 seconds per scene with frame times rather than relying only
   on the FPS overlay.
5. Repeat Arrival Overlook, a dense village/interior route, rain, night lighting,
   pause/settings, and local/remote media cases.
6. Record renderer, main, GPU, and utility-process CPU and memory separately.
7. Run a 30-minute minimum soak first, then a longer release-candidate soak, and
   compare retained memory/event listeners/resources after returning to the same
   scene.
8. Test High and a release-safe default/Auto profile at 1280 × 720 and 1920 ×
   1080 where the hardware supports those modes.
9. Repeat on Apple Silicon macOS, Windows x64, an integrated GPU, and a mid-range
   dedicated GPU. Add Linux only after primary targets are stable.
10. Report failures and unavailable hardware as untested; do not infer platform
    support from the macOS browser observation.

## Baseline conclusion

The browser source of truth loaded successfully and showed ample short-run
headroom on the audit machine at 1280 × 720 High. The production payload is small
overall but dominated by the approximately 3.0 MB physics chunk. These facts are
useful starting points, not release claims. Packaged startup, frame pacing,
memory, CPU/GPU use, cross-platform behavior, and long-session stability remain
open measurement work.

## Phase 1 packaged Electron baseline

The raw record is [phase-1-macos-arm64-measurement.json](phase-1-macos-arm64-measurement.json).
It was produced by `pnpm desktop:measure`, which first runs the full packaged
quit/relaunch smoke and then samples `requestAnimationFrame` for 60 seconds.

### Environment and conditions

| Item                | Phase 1 value                                          |
| ------------------- | ------------------------------------------------------ |
| Source commit       | `ba74f47fea7d4af58e022ba66e22f5148fed7951`             |
| Operating system    | macOS 26.5.1, build 25F80                              |
| Hardware            | Apple M5, 10 CPU / 10 GPU cores, 16 GB                 |
| Electron / Chromium | 43.1.0 / 150.0.7871.47                                 |
| Artifact            | Unpacked unsigned arm64 application                    |
| Network condition   | DNS mapped to `NOTFOUND` for startup and both launches |
| Scene / preset      | Arrival Overlook / High                                |
| Viewport            | 1280 × 688 CSS px, DPR 2                               |
| Warm-up / sample    | 5 seconds / 60 seconds                                 |

The viewport is the packaged window's measured content area; it is 32 pixels
shorter than the 1280 × 720 outer window because of native window chrome. This
distinction must be retained for future comparisons.

### Startup and persistence proof

| Milestone                                 |                   Clean-profile result |
| ----------------------------------------- | -------------------------------------: |
| Electron attached / first window observed |                               182.5 ms |
| Renderer DOM content loaded               | 96.1 ms from renderer navigation start |
| Renderer first contentful paint           |  144 ms from renderer navigation start |
| Title and Rapier scene ready              |         1,775.8 ms from process launch |
| First controllable frame                  |         1,888.7 ms from process launch |
| Enter-to-controllable transition          |                               108.2 ms |

This is a clean application-profile launch, not a controlled cold filesystem or
shader-cache run. A second full process launch reached title/Rapier readiness in
1,779.7 ms. FOV 83, High quality, the media repository, and the autosave slot
were present after coordinated quit/relaunch.

### Fixed 60-second frame sample

| Metric                 |       Result |
| ---------------------- | -----------: |
| Elapsed sample         |    60.0066 s |
| Frames                 |        7,201 |
| Average                | 120.0035 FPS |
| Median frame time      |       8.3 ms |
| p95 frame time         |       9.5 ms |
| p99 frame time         |      10.0 ms |
| Maximum frame time     |      10.4 ms |
| Frames over 25 / 50 ms |        0 / 0 |

The result is display-refresh limited on this machine and proves smooth pacing
only for this fixed view, preset, hardware, and short duration. It does not prove
dense traversal, rain/night, interiors, media playback, thermal stability, or
other hardware classes.

### Process footprint

Electron `app.getAppMetrics()` reported aggregate working sets of approximately
746 MiB at title, 806 MiB at gameplay sample start, and 839 MiB at sample end.
At sample end the renderer tab was approximately 416 MiB, GPU 158 MiB, browser
175 MiB, and two utility processes together 90 MiB. A 60-second increase is not a
leak diagnosis; the required 30–120 minute steady-scene and traversal soaks remain
open.

The unpacked application occupied approximately 280.1 MiB including the Electron
runtime. `app.asar` was approximately 4.25 MiB. The package used Electron's
default icon and was unsigned, both as explicitly excluded from Phase 1.

### Phase 1 platform coverage at measurement time

| Target                                          | Current status                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| macOS Apple Silicon packaged Electron           | Offline smoke, persistence/relaunch, crash recovery, and 60-second fixed-scene sample verified |
| macOS Intel                                     | Untested                                                                                       |
| Windows x64                                     | Untested                                                                                       |
| Linux                                           | Untested                                                                                       |
| Integrated / mid-range dedicated GPU references | Untested                                                                                       |
| Controller-connected packaged play              | Untested                                                                                       |
| Real hardware sleep/wake                        | Handler implemented; manual exercise pending                                                   |
| 30–120 minute soak                              | Untested                                                                                       |

No cross-platform or release-hardware support claim should be inferred from the
Apple M5 result.

## Phase 2 native platform proof — 2026-07-13

Phase 2 replaced the default package icon, added separate proof and strict
credentialed release configurations, and completed native automation for the two
declared release targets. This does not change or broaden the fixed-scene
performance measurement above.

| Target                            | Phase 2 automated proof                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| macOS 12+ Apple silicon           | Arm64 identity, branded icon, ad-hoc proof signature, offline launch/relaunch, persistence, second-instance, and synthetic suspend/resume |
| Windows 10/11 x64                 | AMD64 payload and version resources, NSIS install, installed-app lifecycle/persistence smoke, shortcuts, uninstall, and cleanup           |
| Credentialed public release       | Not yet verified; Developer ID/notarization and Authenticode credentials are external gates                                               |
| Physical target-device checks     | Audio, controller, real sleep/wake, fullscreen/display scaling, and long-session soak remain manual gates                                 |
| Intel macOS / Windows Arm / Linux | Explicitly deferred                                                                                                                       |

The exact native CI evidence is recorded in
[phase-2-native-ci-proof.json](phase-2-native-ci-proof.json). No Windows frame
rate or memory baseline was collected, so the Apple M5 figures above remain the
only performance measurements and must not be generalized to Windows hardware.

## Phase A rendering-foundation benchmark — 2026-07-13

The checked-in evidence summary is
[phase-a-high-rain-swiftshader.json](performance/phase-a-high-rain-swiftshader.json);
it records the location of the much larger raw runner artifact under
`test-results/`.
It was produced by `pnpm benchmark:graphics -- --scenario=arrival-bridge-high-noon-rain`
against a Vite development server. The runner fixed the art-review camera and
condition, waited for rain/wetness and quality to settle, warmed the scene, then
sampled `requestAnimationFrame` for 60 seconds while collecting a scene probe
approximately once per second.

### Environment and condition

| Item               | Phase A artifact value                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| Captured           | 2026-07-13 22:31:50.991 UTC                                                    |
| Browser            | Headless Playwright Chromium 149.0.7827.55                                     |
| Renderer path      | **SwiftShader software renderer** via `--use-gl=angle --use-angle=swiftshader` |
| Viewport           | 1920 × 1080 CSS px                                                             |
| Scenario / variant | `arrival-bridge-high-noon-rain` / `default`                                    |
| Camera / condition | Arrival Bridge / noon rain (`time = 0.5`, rain and wetness settled)            |
| Graphics preset    | High                                                                           |
| Warm-up / sample   | 1.5 seconds / 60 seconds                                                       |

The JSON artifact does not record a source commit or hardware/driver identity.
The renderer label above comes from the checked-in benchmark launch flags, not
an inference from the host machine.

### Frame-time result

| Metric                                  | Measured result |
| --------------------------------------- | --------------: |
| Frame samples                           |             149 |
| p50 frame time                          |        418.3 ms |
| p95 frame time                          |        500.0 ms |
| p99 frame time                          |        525.0 ms |
| Minimum / maximum raw delta             |  8.3 / 925.2 ms |
| Renderer console errors during scenario |               0 |

### Probe summary

All 62 probe snapshots kept the same spatial and asset state during the fixed
camera sample:

| Probe field                      | Observed value or range                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| Center / active / retained cells | `0:-4` / 49 / 81                                                            |
| Vegetation instances             | 4,187 total: 4,168 near + 19 retained-horizon                               |
| Authored assets                  | `model.pipeline-smoke` and `texture.pipeline-smoke` loaded; no fallback IDs |
| Manifest decoded-byte estimates  | 42 B model + 84 B texture; 84 B estimated texture memory                    |
| Renderer calls                   | 179–182                                                                     |
| Rendered triangles               | 628,770–632,658                                                             |
| Points                           | 7,656                                                                       |
| Geometry / texture objects       | 253–256 / 44                                                                |

### Acceptance interpretation

This capture proves that the fixed High/noon/rain scenario can boot, that the
Meshopt GLB and Basis/KTX2 paths decode, that the retained horizon-vegetation
path contributes instances, and that the deterministic probe remains populated
without a renderer console error. It also provides a repeatable software-path
regression artifact.

It is **not** High-preset 16.7 ms acceptance and it is **not** Low-preset 33.3 ms
acceptance. SwiftShader is a CPU software rasterizer, the artifact contains no
named integrated or dedicated reference GPU, and its p95 is 500.0 ms. The Apple
M5 packaged result above remains useful historical hardware evidence but uses a
different scene condition, viewport, runtime, and measurement path. Release
acceptance still requires separate Low and High captures on the named integrated
and dedicated reference hardware, respectively.
