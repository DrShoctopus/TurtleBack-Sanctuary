# Slice 9 runtime evidence

Slice 9 authors the sanctuary's noon, sunset, blue-hour, night, and rain presentation without relying on debug-only framing. The implementation adds condition-aware fill and value control, colored mist and light rays, restrained wet-material response, ordinary-route turtle scale cues, and a final HUD contrast pass.

## Curated condition review

`pnpm capture:atmosphere` passed and produced the eight High-tier review captures in this directory:

- arrival and forest at noon;
- village and turtle at sunset;
- arrival at blue hour and turtle at night;
- forest and village in settled rain.

The review confirms readable navigation and turtle silhouettes, colored rather than white fog, non-fluorescent wetness, controlled window and seam bloom, and visible foreground/midground/background separation. It also exposed and closed an instance-color material defect in biome, habitat, vegetation, and turtle-transition meshes.

## Exhaustive matrix

The 332-row deterministic graphics registry completed as three independently terminating Playwright partitions:

| Partition                        | Scenarios | Result                 |
| -------------------------------- | --------: | ---------------------- |
| High clear primary               |       159 | Passed in 12.5 minutes |
| Low/Medium/Ultra clear secondary |       120 | Passed in 6.8 minutes  |
| High rain                        |        53 | Passed in 5.3 minutes  |

The partition union is tested to equal the full registry with no duplicate output path. Each capture waits for quality, time, rain, and wetness state before writing a frame and fails on any page error. Temporary exhaustive frames remain ignored; the curated evidence totals 3,060,185 bytes (2.92 MiB), under the 4 MiB Slice 9 budget.

## Runtime contracts

- The atmosphere probe reports authored condition, mist, light-ray, wetness, and puddle response.
- High uses eight restrained painterly light rays; lower tiers reduce their count.
- Six human-scale route markers reinforce the turtle's brow, neck, flipper, wake, breathing shell, and body-scale cues during normal play.
- Puddle opacity is capped at 0.2 and wet-surface darkening at 0.16.
- Reduced motion removes route-ribbon movement and slows or suppresses atmospheric animation.

## Verification

- targeted atmosphere and benchmark tests passed (13/13);
- TypeScript typecheck, lint, 56-file unit suite, asset validation, and production build passed;
- the complete end-to-end suite passed 21/21, including the slow streamed-residency case after receiving an explicit settlement wait;
- the in-app browser normal-play pass reported no errors after the final hot update.

The original monolithic matrix exceeded its 15-minute test timeout after producing 212 frames without a renderer failure. The checked-in deterministic partitions replace that fragile all-at-once verification path while preserving `pnpm capture:graphics` for complete unattended runs.
