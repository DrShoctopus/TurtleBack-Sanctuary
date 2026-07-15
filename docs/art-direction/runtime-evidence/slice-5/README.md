# Slice 5 runtime evidence

Slice 5 replaces uniform village decoration with an authored, reusable story-cluster system. The live route now contains 28 functional vignettes across seven inhabited districts, backed by 21 district anchors and 21 prop families. Forest and legacy vegetation placement consume the same conservative prop exclusion zones, while route, spawn, bridge, and interaction masks are validated separately.

## Captures

| File                                | Review purpose                                                        |
| ----------------------------------- | --------------------------------------------------------------------- |
| `village-threshold-high.png`        | Arrival-to-village threshold, route framing, plaza anchors, High noon |
| `market-lane-high.png`              | Produce stall, baskets/crates, path edge, forest enclosure, High noon |
| `garden-workyard-high.png`          | Potting/seed workyard at walking distance inside Crownwood            |
| `market-lane-low.png`               | Low-tier district and story-cluster identity                          |
| `market-lane-night.png`             | Window, path-lamp, and story-lantern hierarchy at night               |
| `village-threshold-sunset-rain.png` | Wet materials, runoff language, rain readability, sunset              |

All cameras are normal-player teleports. The focused capture task completed with zero page errors and no asset fallback IDs. The optional `VILLAGE_CAPTURE_ONLY` file list allows fast camera iteration while the default task still renders the complete matrix.

## Runtime and size record

- No encoded runtime art assets were added. The prop system reuses existing procedural texture families; evidence PNGs total approximately 2.5 MiB.
- Largest new binary: `village-threshold-sunset-rain.png`, approximately 0.51 MiB. No normal-Git binary approaches the 10 MiB cap.
- The 60-second `market-lane-high-noon-clear` SwiftShader diagnostic recorded 91 frame samples, 568 renderer calls, 2,764,101 triangles, 458 geometries, 53 textures, 28 story clusters, 21 anchors, 21 prop families, seven districts, and no console or fallback errors.
- SwiftShader p50/p95/p99 were 650.1/700.5/1483.9 ms. Those values are software-render diagnostics only and do not satisfy or replace the named dedicated-GPU acceptance gate.
- Asset validation remains two assets, two variants, and 1,964 encoded bytes. The production build completed with 578 modules.

## Automated proof

- `441/441` Vitest tests passed across 50 files.
- `19/19` browser E2E tests passed, including the new High/Low village probe contract.
- TypeScript, ESLint, asset validation, production build, desktop bundle, focused visual capture, and the market benchmark completed successfully.
