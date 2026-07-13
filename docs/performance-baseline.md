# Performance Baseline

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

| Item | Value |
| --- | --- |
| Source commit | `a1f7ec3` |
| Operating system | macOS 26.5.1 |
| Hardware | Apple M5, 10 CPU cores / 10 GPU cores |
| Memory | 16 GB |
| Node.js | 26.5.0 |
| pnpm | 11.12.0 |
| Renderer | Browser development build served by Vite |
| Observation viewport | 1280 × 720 |
| Graphics preset | High |
| Scene | Playable Arrival Overlook |

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

| Output | Approximate size | Observation |
| --- | ---: | --- |
| Physics JavaScript/WASM wrapper chunk | 3.0 MB | Dominant payload; Rapier is split into a separately cacheable chunk |
| Main application JavaScript | 484 KB | React, renderer/game/UI code excluding the physics chunk |
| CSS | 16 KB | Global UI styling |
| HTML, SVG, example config, and documentation copied from `public` | Remainder | Small relative to JavaScript chunks |

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

| Area | Missing evidence |
| --- | --- |
| Startup | Process launch to first paint, title ready, scene ready, and first controllable frame |
| Frame pacing | Median, 1% low, 0.1% low, frame-time histogram, and stutter events |
| CPU | Idle/title/gameplay/interior/weather/remote-media utilization by process |
| GPU | Utilization, VRAM or shared-memory pressure, GPU process stability, and device selection |
| Memory | Initial footprint, post-load footprint, scene transitions, and growth over 30–120 minutes |
| Assets | Procedural generation cost, Rapier initialization, and any future asset I/O/decode time |
| Shaders | First-use compilation stalls for sky, ocean, rain, atmosphere, bloom, and quality changes |
| Physics | Character/world step cost in representative districts and during traversal |
| Audio | Context initialization, synthesis cost, media decode, radio behavior, device changes, and sleep/wake |
| React/UI | Rerender counts and pause/settings/media overlay resource cost |
| Disposal | Three geometry/material/texture cleanup, audio nodes, event listeners, and remote frames |
| Package overhead | Electron main/preload/renderer memory, startup time, and IPC cost |

## Platform coverage status

| Target | Phase 0 status |
| --- | --- |
| macOS Apple Silicon browser development run | Short functional/FPS observation completed |
| macOS packaged Electron | Not measured |
| macOS Intel | Not measured |
| Windows x64 | Not measured |
| Linux | Not measured |
| Integrated graphics reference device | Not measured |
| Mid-range dedicated GPU reference device | Not measured |
| Controller-connected performance | Not measured |
| Offline packaged startup | Not measured |
| Remote radio/YouTube load | Not measured |
| Long session | Not measured |

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

