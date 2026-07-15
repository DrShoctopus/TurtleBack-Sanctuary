# Slice 8B — Habitat detail and wildlife contrast

Captured 2026-07-15 from the live Vite/WebGL build at 1440×900.

## Evidence

- `blossomshade-grazer-high.png` — flowering arches, petal details, and the calm second-wave grazer.
- `lumenfen-heron-high.png` — reeds, lily pads, pool edge, and the Lumenfen wading bird.
- `lumenfen-lights-night.png` — restrained luminous pool/insect accents at night.
- `fernfall-roots-high.png` — root arches, fall stones, reed pockets, and ravine enclosure.
- `galecrest-saltstone-high.png` — exposed scrub, root windbreaks, saltstone markers, and seabirds.
- `hearth-lanterns-high.png` — lantern court and civic planters framing the public clearing.

## Runtime contract

- Ten stable authored discovery clusters cover two signature families in each remaining biome.
- High renders 200 compact signature details; Low retains all ten kinds and all ten families in 88 details.
- The detail kit includes reeds, lily pads, glow bulbs, root arches, fall stones, blossom sprigs, coastal scrub, saltstone markers, lanterns, and civic planters.
- Six procedural ambient beds crossfade continuously across Crownwood and the five-biome mosaic; all share one source and restart neither audio nor music at thresholds.
- The deterministic wildlife pool now has 26 schedule owners, eight species, seven habitats, six categories, represented-emitter calls, and zero orphan calls.
- The second wave is intentionally small and contrasting: a nonviolent Blossomshade grazer browses/rests/flees, while a Lumenfen heron wades/stalks/rests.
- All new runtime content is synthesized/procedural and adds 0 bytes of binary assets against the second 12 MiB sub-slice budget.

The capture PNGs total 2.1 MiB and are review-only.

## Reproduction

```bash
pnpm capture:habitats
node_modules/.bin/vitest run tests/habitatSignatures.test.ts tests/biomeAmbience.test.ts tests/wildlifeDirector.test.ts
node_modules/.bin/playwright test e2e/wildlife.spec.ts
```
