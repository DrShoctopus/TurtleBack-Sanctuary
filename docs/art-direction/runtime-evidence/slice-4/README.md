# Slice 4 — Crownwood and Arrival runtime evidence

The captures in this folder are generated from the live game by
`visual/crownwood.capture.ts`. They use the canonical `arrival-bridge` and
`forest-interior` normal-player cameras at clear noon.

Review set:

- `arrival-high.png`
- `forest-interior-high.png`
- `arrival-low.png`
- `forest-interior-low.png`
- `forest-interior-reduced-motion.png`

High is judged against the Slice 1 frames for foreground framing, route anchor,
continuous canopy, readable forest layers, authored discoveries, and a controlled
mist opening. Low intentionally reduces detail and uses LOD2 tree forms while
preserving the forest walls and route identity.

The production kit is original code-authored geometry: nine stable tree forms
across ancient conifer, wind-pine, and broadleaf families, each with LOD0/1/2;
seven streamed forest layers; thirteen authored discoveries; retained-cell
horizon forms; and traversal-safe retained-cell trunk colliders. Forest bark
adds a seeded 256 px normal/roughness pair, so encoded runtime asset delta is
**0 bytes** and decoded procedural GPU detail is about **0.5 MiB**.

The five PNG review artifacts total about **2.05 MiB** and the largest is below
**0.45 MiB**. The final 60-second High-tier SwiftShader diagnostic recorded p50
**724.9 ms**, p95 **741.7 ms**, p99 **758.1 ms**, 578 calls, 2,209,769 scene
triangles, 6,292 Crownwood instances, LOD0 active, and no console errors. The
software-renderer result is topology/error evidence, not the dedicated-GPU
acceptance measurement. Legacy meadow cells were folded into near/horizon
batches during this pass; the same diagnostic view dropped from 642 to 578
calls without changing residency counts.
