# Turtleback Sanctuary Stylized Graphics and Audio Reset

**Date:** 2026-07-14

**Status:** Slices 1–7 complete; Slice 8 next

**Supersedes:** the near-photorealistic direction in the 2026-07-13 overhaul spec and master rollout

**Source of truth:** this plan until its art-direction decisions are promoted into `ART_BIBLE.md`

## Outcome

Rebuild Turtleback Sanctuary around a cohesive **painterly monumental naturalism** rather than near photorealism. The result should combine:

- Firewatch's controlled color, fog, silhouettes, modular forest construction, and authored discovery moments;
- Breath of the Wild's painterly clarity, readable landforms, environmental motion, and ability to make a large world understandable at a glance;
- Turtleback's own identity: a warm coastal sanctuary carried by an ancient, breathtaking world-turtle.

This is not a request to copy either game's assets, shaders, characters, maps, music, or exact palette. They are production references for clarity, composition, stylization, and scale.

The overhaul is successful only when the live game—not a concept render—looks authored, dense, calm, and distinctive from its normal first-person views.

## Why the previous direction failed

The 2026-07-13 plan aimed for near-photorealism before the project had an accepted concept-to-runtime style target. That encouraged surface detail and rendering infrastructure without first fixing form, composition, density, or the turtle's character.

The 2026-07-14 live review found:

- the arrival view is dominated by a large uninterrupted ground plane;
- the cottage/forest view contains isolated trees and grass tufts but no canopy, midstory, understory, deadfall, or forest enclosure;
- repeated procedural shapes and smooth materials make vegetation, buildings, and terrain read as a prototype kit;
- the fixed turtle portrait shows the head and both front flippers in one symmetrical frame, with large glossy eyes and a smooth rounded muzzle, making the turtle feel friendly and small rather than ancient and enormous;
- environmental objects do not form enough story clusters or foreground frames;
- the soundtrack has four moods, but all four use the same eight-bar scheduler and the same chord/pad/bass/percussion/melody recipe, so timbral and structural variation is limited;
- the shipped asset manifest currently proves the loading pipeline with only one tiny GLB and one KTX2 texture; the professional art layer has not yet been delivered.

The existing engine remains worth keeping: the analytic shell and collider, spatial cells, quality profiles, comfort-motion clock, asset registry/loaders, benchmark cameras, browser/Electron paths, and deterministic audio foundation are useful production infrastructure.

## Reference research translated into rules

### Firewatch

Campo Santo's own production material emphasizes concept-driven 3D translation, directional stylistic fog, color grading, painterly distance treatment, hand-placed light accents, spatial streaming, modular reuse, and a representative vertical slice.

Rules for Turtleback:

1. Paint the target frame first; do not let whatever the renderer produces become the art direction.
2. Treat fog and color grading as composition tools, not realism effects.
3. Build a small excellent forest kit and reuse it with scale, lean, crown, age, tint, and cluster variation.
4. Stream dense authored cells rather than keeping the whole shell thinly populated.
5. Anchor routes with memorable landmarks and fill the space between them with small discoveries.
6. Judge the world through a finished vertical slice, not greybox promises.

Sources:

- [The Art of Firewatch, GDC 2015](https://www.gdcvault.com/play/1022295/The-Art-of)
- [Making the World of Firewatch, GDC 2016](https://media.gdcvault.com/gdc2016/Presentations/Ng_Jane_MakingTheWorld.pdf)
- [Campo Santo environment-art breakdown](https://blog.camposanto.com/post/96702184522/hey-everybody-thanks-for-all-your-kind-words/amp)
- [Campo Santo artist-driven sky system](https://blog.camposanto.com/post/112703721804/this-blog-post-is-an-in-detail-explanation-of-part)

### Breath of the Wild

Nintendo's development material ties the open-air concept to exploration, scale, music, and clear visual elements. Producer Eiji Aonuma described the painterly style as a way to make important elements readable across a vast world.

Rules for Turtleback:

1. Use broad readable shapes before fine surface noise.
2. Make paths, ridges, towers, old trees, waterfalls, and the turtle's anatomy readable navigation cues.
3. Use stylization to increase clarity and longevity, not to excuse simple assets.
4. Let grass, canopy, clouds, wildlife, water, and hanging props create a living open-air rhythm.
5. Leave deliberate visual rest between dense clusters; sparse space is allowed only when it frames a reveal or supports calm.

Sources:

- [Nintendo's Breath of the Wild making-of series](https://www.nintendo.com/en-gb/News/2017/March/Go-behind-the-scenes-with-the-making-of-The-Legend-of-Zelda-Breath-of-the-Wild-1206592.html)
- [Eiji Aonuma on the painterly, readable large-world style](https://time.com/4369527/zelda-breath-wild-open-world/)

## Locked art direction

### Style name: painterly monumental naturalism

The world uses believable scale, construction, anatomy, and material categories, then simplifies and exaggerates them into readable painted forms.

- **Geometry:** strong silhouettes, soft bevels, asymmetry, visible thickness, and intentional shape rhythm. Avoid raw boxes, spheres, cones, and evenly repeated crowns in hero views.
- **Surface:** hand-painted or procedurally art-directed color fields with restrained normal detail. Professional detail comes from layered value, edge wear, lichen, bark rhythm, shell growth, and local storytelling—not photographic noise everywhere.
- **Lighting:** warm key light, cooler shadow families, clear day-part palettes, soft contact grounding, restrained bloom, and controlled shadow shapes.
- **Atmosphere:** height- and direction-aware fog, painterly distance bands, localized mist, cloud layers, light cards, and clear silhouettes.
- **Palette:** coastal jade, moss, cedar, shell umber, mist blue, warm ochre, coral accents, and rare bioluminescent cyan. Each biome gets a limited sub-palette.
- **Motion:** wind moves in layered waves. Canopy, understory, grass, hanging props, wildlife, water, and the turtle move at different amplitudes and timescales. Reduced Motion keeps slow primary life signals while suppressing fast secondary motion.
- **Detail hierarchy:** large shape first, then cluster, then surface. A screenshot must work at thumbnail size before it is accepted at full resolution.

### Explicit rejection criteria

Reject a slice if any benchmark hero view shows:

- a generic photo texture pasted onto prototype geometry;
- mismatched realism between turtle, vegetation, architecture, and wildlife;
- large unplanned empty ground areas;
- evenly random scatter with no foreground/midground/background structure;
- trees that read as isolated lollipops rather than a forest mass;
- an exposed primitive used as a finished hero object;
- a turtle head that reads as cute, toy-like, smiling, frontally symmetrical, or small;
- fine detail that collapses into noisy values at normal walking distance;
- a High/Ultra effect that destroys silhouette clarity or misses the frame-time budget.

## Professional-quality asset standard

Every authored asset family must have:

- an approved silhouette or style frame before production;
- metre scale, stable pivot/origin, named materials, and documented intended use;
- deliberate UV/vertex-color strategy and consistent texel density;
- packed, compressed runtime textures and mipmaps;
- LOD0/LOD1/LOD2 or an approved instancing/impostor strategy;
- simplified collision only where player contact requires it;
- dry/rain and day/night review where relevant;
- license or original-generation provenance in the manifest;
- an in-engine benchmark capture, not only a Blender render;
- a fallback that preserves navigation and identity.

Texture targets are guidelines, not entitlements:

- repeated ground cover and small props: 256-512 px atlases;
- standard trees, rocks, buildings, and wildlife: 512 px-1K packed sets;
- landmark clusters and turtle LOD1: 1K-2K;
- turtle face/eyes/shell transition: up to 2K, with one 4K map allowed only if an A/B capture proves a visible benefit;
- use KTX2/Basis for shipped textures and Meshopt/Draco only when measured decode/runtime behavior remains sound.

## Runtime and repository size policy

Frequent commits make review and rollback safer, but they do **not** make the final repository or shipped application smaller. Size control comes from budgets and compression.

Hard policy for every implementation slice:

- no individual normal-Git binary above 10 MiB without an explicit exception recorded in the slice notes;
- no uncompressed WAV, PSD, EXR, TIFF, or large DCC working file in normal Git history;
- retain small reproducible source files and generation/export scripts;
- use Git LFS for essential large original sources only after `git lfs` availability and repository quota are confirmed;
- otherwise store a source manifest, checksum, license, export settings, and reproducible generation instructions without committing the oversized working file;
- visual slices may add at most 12 MiB of encoded runtime assets each;
- audio slices may add at most 6 MiB each;
- target at most 80 MiB of new runtime art/audio for the complete overhaul, with no more than 35 MiB required before entering play;
- log encoded bytes, estimated decoded texture bytes, triangle counts, draw calls, and final bundle delta at each slice gate.

Before each commit, run a file-size report over added binaries and fail the slice when its budget is exceeded. Optimization happens before the binary enters history, not in a later cleanup commit.

## Showcase corridor

Do not expand the new style across the whole shell until one normal-play route is finished:

`Arrival Overlook -> Crownwood path -> village threshold -> Galecrest turtle overlook`

This corridor must prove:

- a composed arrival frame with foreground vegetation/props, a middle-distance route anchor, and a distant turtle/world landmark;
- an enclosed forest interior with canopy, trunks, midstory, understory, ground cover, deadfall, rocks, and atmospheric depth;
- a readable transition into an inhabited village edge without the forest stopping at a hard line;
- at least four visible wildlife categories across a five-minute walk;
- a breathtaking turtle reveal reached during normal traversal;
- clear/rain and noon/sunset/night art direction;
- the expanded music system changing form and instrumentation without an abrupt mood switch;
- High p95 frame time and Low identity-preservation evidence.

Only after this corridor passes owner visual review may the kit expand to the remaining shell.

## Implementation slices

Every slice ends with targeted tests, an in-engine review artifact, a size report, one focused commit, and a successful push. No work begins on the next slice until the remote commit is confirmed.

### Slice 1 — Concept and style-frame gate

**Implementation record:** completed on 2026-07-14 in `docs/art-direction/`; owner approved the direction on 2026-07-14.

**Goal:** prove the new direction cheaply before building assets.

Deliver:

- a compact reference board that identifies transferable principles without copying assets;
- original style frames for Arrival Overlook, Crownwood interior, Galecrest turtle reveal, and turtle head/material close-up;
- shape-language sheets for tree families, rocks, village props, architecture trim, wildlife, and the turtle;
- locked palette/value keys for noon, sunset, night, and rain;
- revised `ART_BIBLE.md` and benchmark acceptance notes.

Acceptance:

- all four frames clearly belong to one game;
- the turtle is ancient and monumental, with no cute frontal portrait language;
- forest density and object layering are visible in the frame, not deferred to prose;
- the style is achievable in WebGL2 with the existing engine;
- owner approval is recorded before Slice 2.

Expected runtime asset delta: 0 MiB.

Suggested commit: `docs: lock painterly sanctuary art direction`

### Slice 2 — Stylized renderer and material proof

**Implementation record:** completed on 2026-07-14. Runtime comparisons and the condition matrix are recorded in `docs/art-direction/runtime-evidence/slice-2/`.

**Goal:** reproduce the approved style frame with a tiny reusable runtime kit.

Deliver:

- warm-light/cool-shadow material response with art-directed ramps or wrapped diffuse treatment;
- directional color fog and distance bands;
- restrained grading per day/weather family;
- one bark, foliage, rock, soil/path, painted wood, and turtle-skin material family;
- wind vertex channels and a stable outline/rim-light policy only if the style frames require them;
- A/B benchmark captures against the current renderer.

Acceptance:

- color/value hierarchy matches the approved frames more closely than the old near-photoreal direction;
- no universal black outline or harsh toon banding unless specifically approved in the style frame;
- rain and night remain readable;
- Low retains palette and silhouette identity;
- no regression to color contract, browser, Electron, or asset fallback behavior.

Runtime asset budget: 4 MiB.

Suggested commit: `feat: establish painterly rendering language`

### Slice 3 — Massive turtle hero vertical slice

**Implementation record:** completed on 2026-07-14. Live High/Ultra/Low and Reduced Motion evidence is recorded in `docs/art-direction/runtime-evidence/slice-3/`.

**Goal:** make the turtle breathtaking before it is hidden beneath world expansion.

Deliver:

- approved original turtle LOD0/LOD1/LOD2 with sculpted head, deep-set eyes, beak/jaw, neck folds, flippers, scars, algae, barnacles, shell/body transition, and simplified collision;
- asymmetrical slow breathing, eye focus, blink, head drift, and rare acknowledgement event;
- wake, broad water displacement, spray, low-frequency shell resonance, and nearby foliage response;
- three scale compositions: distant full silhouette, mid-distance flipper/body reveal, and near head/eye encounter;
- replace the current frontal fixed portrait as the primary acceptance camera while keeping a diagnostic material close-up.

Acceptance:

- during the near reveal, a normal player camera cannot fit the full head and both flippers in one frame;
- no smile cue, giant glossy eye language, or smooth toy muzzle;
- birds, trees, structures, wave scale, mist, and camera height establish size without a cutscene;
- turtle materials remain painterly and consistent with the environment;
- Reduced Motion keeps breathing and slow life signals but suppresses stronger secondary response.

Runtime asset budget: 12 MiB.

Suggested commit: `feat: deliver monumental world-turtle hero`

### Slice 4 — Crownwood forest and Arrival corridor

**Implementation record:** completed on 2026-07-15. Live High/Low and Reduced Motion evidence is recorded in `docs/art-direction/runtime-evidence/slice-4/`.

**Goal:** replace sparse scatter with a professional forest system and complete the first half of the showcase route.

Deliver:

- 8-10 high-quality modular tree forms across ancient conifer, wind-shaped pine, and broadleaf families, each with LODs;
- canopy mass, trunk layer, midstory, understory, ground cover, deadfall/root, boulder, and mist layers;
- authored clusters for nurse logs, root arches, fern banks, mushrooms, lichen rocks, saplings, flowers, and fallen branches;
- forest edge, clearing, and biome-transition rules rather than one uniform density field;
- Arrival Overlook recomposed to frame the route and remove the empty-field first impression;
- cell streaming, instancing, shadow range, and impostor/horizon treatment.

Acceptance:

- the `forest-interior` view has a continuous canopy impression and all seven layers are readable;
- the Arrival view contains foreground, route anchor, middle-distance mass, and horizon landmark;
- designated dense views contain no unplanned ground patch larger than roughly 20% of the frame;
- every 20-30 m of the path contains a deliberate cluster or discovery without obstructing traversal;
- Low reduces instances and material detail but keeps forest walls, route readability, and biome identity.

Runtime asset budget: 12 MiB.

Suggested commit: `feat: build dense Crownwood arrival corridor`

### Slice 5 — Environmental object and village-life density

**Implementation record:** completed on 2026-07-15. High/Low, night, and sunset-rain evidence is recorded in `docs/art-direction/runtime-evidence/slice-5/`.

**Goal:** make inhabited spaces feel authored rather than merely populated.

Deliver:

- reusable stylized prop families: benches, signs, lanterns, planters, carts, baskets, tools, crates, drying lines, wind chimes, firewood, drainage, path edging, bridge details, and small shrine/garden objects;
- district story clusters with a clear function rather than uniform decoration;
- architectural trim/roof/window/threshold upgrades in the showcase corridor;
- decals or vertex-painted wear, moss, runoff, and contact grounding;
- collision and interaction clearances shared with placement masks.

Acceptance:

- each showcase district has three identifiable anchors and at least three story clusters;
- props improve navigation and implied life rather than becoming clutter;
- door, path, bridge, stair, spawn, and interaction clearances remain clean;
- no asset looks materially more realistic or more primitive than the surrounding kit.

Runtime asset budget: 8 MiB.

Suggested commit: `feat: add authored sanctuary story clusters`

### Slice 6 — Wildlife first wave

**Goal:** make the showcase corridor visibly and audibly alive.

Deliver first:

- canopy songbirds with perch/takeoff/flock behavior;
- shell hares or another small ground animal with forage/rest/flee behavior;
- butterflies/dragonflies/fireflies as pooled group agents;
- Galecrest seabirds and a distant ocean group such as dolphins or rays;
- visible-agent-owned calls, habitat schedules, rain/time reactions, and Quiet Mode support.

Acceptance:

- a five-minute showcase walk exposes at least four wildlife categories on High without forcing or spawning animals in front of the player;
- movement is calm, species-readable, and nonviolent;
- calls originate from visible or plausibly represented groups;
- animals do not enter critical paths, buildings, or collision hazards;
- Low retains at least one representative category per habitat through cheaper groups/silhouettes.

Runtime asset budget: 10 MiB.

Suggested commit: `feat: bring showcase habitats to life`

**Completed 2026-07-15:** a fixed-tick, quality-budgeted director now presents five categories across five habitats through 22 pooled schedule owners and grouped render representations. Crownwood songbirds perch/take off/flock, paired shell hares forage/rest/flee, pooled pollinators/dragonflies/fireflies react to day and rain, Galecrest carries seabird flocks, and distant rays surface beyond the rim. The old unowned random chirp timer and primitive gull pass were removed; synthesized calls now carry a represented emitter ID and spatial position. Unit proof runs the unforced showcase schedule for 300 seconds, browser probes verify High/Low/Quiet/rain/night behavior, and the seven-frame evidence set is recorded under `docs/art-direction/runtime-evidence/slice-6/`.

### Slice 7 — Lo-fi soundtrack variation

**Goal:** replace the repeating four-mood recipe with a spacious hybrid score.

Deliver:

- a pure deterministic `MusicalEventPlan` separated from Web Audio rendering;
- multiple form families, not only mood presets: intro, A, B, sparse breakdown, ambient bridge, reprise, and outro/rest;
- at least three distinct instrumentation palettes drawn from electric piano, felt piano, nylon guitar, soft mallets, flute/air lead, bass, brushed kit, hand percussion, tape pad, and field-texture layers;
- 12 or more progression/motif seeds with register, voicing, rhythm, density, and orchestration variation;
- musical rests and biome/turtle-event overlays without abrupt restarts;
- 6-8 original produced anchor cues or compact stems only if listening review proves the synthesized palette cannot meet the quality target;
- no copied melody, harmony sequence, sample, or soundalike production from either reference game.

Acceptance:

- no identical eight-bar arrangement repeats inside a 30-minute deterministic trace;
- a ten-minute session contains at least three clearly different orchestration states and one deliberate breathing-space transition;
- no lead timbre or form repeats immediately;
- dawn/day/rain/night and forest/village/edge context influence selection without hard cuts;
- a two-hour scheduler soak has bounded nodes/timers and no silence caused by failure;
- owner listening review approves calmness, variety, and mix balance.

Runtime asset budget: 6 MiB for this slice; a second 6 MiB audio slice requires a separate approval and commit plus equivalent savings elsewhere or an explicit total-budget revision.

Suggested commit: `feat: expand the adaptive lofi score`

**Implemented 2026-07-15:** a pure seeded 120-minute event plan now drives seven forms, four complete instrumentation palettes, sixteen motif/progression seeds, register/voicing/rhythm/density/microtiming variation, and 100 deliberate breathing spaces. The live Web Audio renderer follows one continuous global bar clock across dawn/day/rain/night crossfades, while forest/village/edge and turtle-event overlays colour sections without restarting them. The deterministic soak contains 350 unique section arrangements, two bounded scheduler timers, and no failure-silence sections; proof is recorded under `docs/audio/runtime-evidence/slice-7/`. Owner listening approval remains part of final release review.

### Slice 8 — Remaining biome expansion

**Goal:** extend the proven kit across the shell without diluting quality.

Deliver:

- Blossomshade, Lumenfen, Fernfall, Galecrest, and Hearth variants built from shared base families plus signature silhouettes;
- wetland water plants and luminous details, ravine roots/bridges/falls, flowering woodland, coastal scrub, and framed civic clearings;
- wildlife second wave selected for maximum habitat contrast rather than a large checklist;
- biome-specific ambient beds and discovery clusters;
- continuous transitions governed by exposure, moisture, slope, elevation, and district function.

Acceptance:

- each biome is identifiable in a grayscale silhouette/value check and a color check;
- transitions overlap rather than forming hard rings;
- every route alternates enclosure, threshold, and reveal;
- no biome is accepted with fewer than five environmental layers and two signature cluster families on High.

Runtime asset budget: two separately reviewed/pushed slices of at most 12 MiB each.

Suggested commits: `feat: expand sanctuary biome mosaic` and `feat: complete sanctuary habitat variety`

### Slice 9 — Time, weather, and final composition

**Goal:** make every major condition look intentionally authored.

Deliver:

- tuned noon, sunset, blue-hour/night, and rain palettes;
- cloud, mist, light-ray, wetness, puddle/runoff, window light, and ocean response consistent with the style frames;
- benchmark-by-benchmark foreground/midground/background composition pass;
- turtle glimpses and scale cues integrated into ordinary routes;
- final UI contrast/readability pass over the new palettes.

Acceptance:

- the required capture matrix passes without crushed night values, white fog, fluorescent wetness, or bloom washout;
- turtle and navigation silhouettes remain readable in every condition;
- weather adds mood and material response without hiding the world;
- no benchmark view depends on debug-only camera framing to look finished.

Runtime asset budget: 4 MiB.

Suggested commit: `feat: art direct sanctuary time and weather`

### Slice 10 — Performance, packaging, and release proof

**Goal:** close the overhaul with measured evidence and no silent asset debt.

Deliver:

- final LOD, culling, streaming, instancing, shadow, texture-memory, and audio-decode optimization;
- browser and packaged Electron asset/fallback proof;
- source/license/attribution ledger and reproducible size report;
- High, Medium, Low, Reduced Motion, Quiet Mode, clear/rain, and day/night captures;
- 30-minute traversal memory plateau and two-hour audio trace;
- release documentation that distinguishes verified hardware results from unverified targets.

Acceptance:

- High target: p95 at or below 16.7 ms at 1080p on the named reference hardware;
- Low target: p95 at or below 33.3 ms at 1080p-equivalent output on the named integrated reference hardware;
- less than 10% memory growth over the final 20 minutes of a 30-minute traversal;
- no missing manifest entry, unapproved license, oversized binary, broken fallback, or uncompressed runtime asset;
- owner approves the final normal-play showcase walk before release status is claimed.

Suggested commit: `perf: close stylized sanctuary overhaul`

## Slice verification and push gate

Run the slice-specific tests first, then the broad gate appropriate to the change:

```bash
node_modules/.bin/tsc --noEmit
pnpm lint
pnpm test
pnpm validate:assets
pnpm build
pnpm test:e2e
pnpm capture:graphics
pnpm benchmark:graphics
```

For every slice:

1. Start from a clean tracked worktree and record the current commit.
2. Implement only the slice's stated scope.
3. Produce its visual/audio evidence and record any external manual gate.
4. Run the binary size report before staging.
5. Run targeted verification, then the required broad checks.
6. Review `git diff`, file sizes, licenses, generated artifacts, and fallback behavior.
7. Commit the focused slice.
8. Push immediately.
9. Confirm the remote branch resolves to the same commit.
10. Stop and report if push fails; do not stack the next slice locally.

The push rule is a delivery gate, not permission to bypass a failed art, performance, license, or size review.

## Final visual acceptance matrix

The overhaul is not complete until these normal-play statements are true:

- Arrival Overlook looks composed and inviting before the player moves.
- Crownwood reads as a forest, not scattered trees.
- open spaces feel intentional because dense forest frames them.
- every major route contains small environmental discoveries and readable landmarks.
- wildlife is noticed regularly but does not turn the sanctuary into a busy zoo.
- the turtle feels too large to comprehend from a single nearby view.
- the turtle's anatomy, surface, movement, water response, sound, and surrounding scale cues all support the same ancient world-bearer idea.
- textures are detailed and professional at walking distance without photographic mismatch or high-frequency noise.
- the score changes form, orchestration, and space over long sessions while remaining recognizably lo-fi and calm.
- Low remains beautiful and geographically complete; High/Ultra add density and refinement rather than a different game.

## First implementation decision

Begin with Slice 1 only. Do not commission or generate the full turtle, forest, wildlife, or soundtrack asset set until the four style frames and updated art bible are approved. The next expensive decision is the turtle silhouette; the next scaling decision is the finished showcase corridor. Those two gates are deliberately early because they decide whether the overhaul is truly back on track.
