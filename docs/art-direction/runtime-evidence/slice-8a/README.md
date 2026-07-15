# Slice 8A — Remaining biome mosaic

Captured 2026-07-15 from the live Vite/WebGL build at 1440×900.

## Evidence

- `blossomshade-high.png` — flowering broadleaf silhouette and pink/green value family.
- `lumenfen-high.png` — wet garden canopy, reeds, ground layers, stone, and luminous accents.
- `fernfall-high.png` — tall ravine canopy, fern understory, deadfall context, and pale fall-stone geology.
- `galecrest-high.png` — wind-shaped conifer silhouette, scrub, saltstone, and exposed ocean edge.
- `hearth-high.png` — framed civic clearing with warm ground accents and layered garden edges.
- `lumenfen-low.png` — Low-tier identity retention across all six layers.

## Runtime contract

- Five named biomes are governed by continuous exposure, moisture, slope, elevation, and district fields.
- Every biome retains canopy, midstory, understory, ground cover, geology, and atmosphere.
- Every biome owns two signature cluster families; thresholds overlap instead of forming hard rings.
- High places 2,510 compact instances; Low places 1,120 while retaining every layer and family.
- Heavy canopy and geology placements share authored route, building, water, pad, and shell exclusions.
- Biome-specific broadleaf, willow, ravine, wind-pine, and civic canopy geometries prevent one repeated tree silhouette from owning the mosaic.
- All content is procedural/instanced and adds 0 bytes of runtime-delivered binary assets against the 12 MiB sub-slice budget.

The capture PNGs total 1.9 MiB and are review-only. Final time/lighting value tuning is intentionally owned by Slice 9 rather than baked into biome materials.

## Reproduction

```bash
pnpm capture:biomes
node_modules/.bin/vitest run tests/biomeMosaic.test.ts
```
