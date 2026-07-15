# Slice 7 — Adaptive lo-fi score

Verified 2026-07-15 against the pure musical plan and live Web Audio integration.

## Runtime contract

- One seeded 120-minute `MusicalEventPlan` drives intro, A, B, breakdown, ambient bridge, reprise, and outro/rest forms.
- Four palettes cover electric piano, felt piano, nylon guitar, soft mallets, air flute, bass, brushed kit, hand percussion, tape pad, and field texture.
- Sixteen original motif/progression seeds vary register, voicing, rhythm, density, microtiming, and orchestration.
- Forest, village, edge, and turtle-event accents colour the active section without resetting the global bar timeline.
- Dawn, day, rain, and night retain smooth gain crossfades while sharing the same long-form arrangement clock.
- Tape noise and crackle are seeded; the renderer adds no binary runtime assets against the 6 MiB slice budget.

## Recorded deterministic trace

- Duration: 120 minutes across 350 sections.
- Unique arrangement signatures: 350.
- Forms: 7; palettes: 4; lead timbres: 4.
- Deliberate ambient/rest breathing spaces: 100.
- Maximum planned simultaneous voices: 18.
- Scheduler timers: 2; silent failure sections: 0.
- The first 30 minutes contain no repeated arrangement signature and the first 10 minutes contain at least three orchestration states plus breathing space.

## Verification

```bash
node_modules/.bin/vitest run tests/musicalEventPlan.test.ts tests/music.test.ts
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint src tests/musicalEventPlan.test.ts
```

Owner listening approval remains a subjective final-release gate; the automated proof covers structure, continuity, variation, and scheduler bounds.
