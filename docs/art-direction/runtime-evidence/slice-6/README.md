# Slice 6 — Wildlife first wave

Captured 2026-07-15 from the live Vite/WebGL build at 1440×900.

## Evidence

- `crownwood-songbirds-high.png` — grouped songbird discovery with perch/takeoff/flock scheduling.
- `shell-hare-and-insects-high.png` — close shell-hare shape and safe meadow placement diagnostic.
- `galecrest-seabirds-high.png` — multiple calm seabird groups above the Galecrest/ocean horizon.
- `ocean-rays-high.png` — distant grouped rays beyond the shell rim.
- `garden-habitat-low.png` — Low-tier garden identity smoke with all habitat categories retained in the probe.
- `garden-fireflies-quiet-night.png` — Quiet Mode/night response and luminous insect representation.
- `crownwood-rain-shelter-high.png` — rain shelter behavior and maintained habitat coverage.

## Runtime contract

- 22 stable pooled schedule owners across six species representations.
- Five categories: canopy, ground, insects, coast, and ocean.
- Five habitats: Crownwood, shell meadow, garden wetland, Galecrest, and open ocean.
- High uses the complete first wave; Low preserves at least one representative per habitat.
- A pure 300-second showcase walk exposes all five categories and produces only represented-emitter calls.
- Rain, day/night, Quiet Mode, Reduced Motion, and player proximity change behavior without violent or blocking states.
- Ground anchors share terrain, path, building, water, story-cluster, and shell-edge exclusions.
- Wildlife is procedural/instanced and adds no binary runtime assets; the Slice 6 runtime-asset budget remains 0 bytes of 10 MiB.

## Recorded gate data

- Production build: 583 modules; final `dist/` is 5.2 MiB.
- Authored asset validator: 2 assets, 2 variants, 1,964 encoded bytes; no fallback IDs.
- Sixty-second `wildlife-grouping-high-noon-clear` probe: 700 renderer calls, 2,372,483 triangles, 476 geometries, 49 textures, and 84 estimated decoded texture bytes.
- Wildlife probe at the end of measurement: 22 represented emitters, 14 near agents, 8 distant groups, 10 owned calls, and 0 orphan calls.
- The headless SwiftShader capture measured p95 632.9 ms. This software-renderer value is retained for reproducibility but is not the named 1080p reference-hardware performance gate; reference-hardware qualification remains part of Slice 10.
- Evidence PNGs total 2.9 MiB and are review-only, not runtime-delivered assets.

## Reproduction

```bash
pnpm capture:wildlife
node_modules/.bin/vitest run tests/wildlifeDirector.test.ts tests/quality.test.ts
node_modules/.bin/playwright test e2e/wildlife.spec.ts
```
