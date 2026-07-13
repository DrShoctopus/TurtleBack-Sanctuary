# Turtleback Sanctuary Graphics and Audio Overhaul Design

**Date:** 2026-07-13
**Status:** Approved for implementation planning
**Approach:** Hybrid authored-asset and procedural-system rebuild

## 1. Purpose

Transform Turtleback Sanctuary from a sparse procedural prototype into a professional, near-photorealistic fantasy sanctuary. The finished experience must feel richly authored at walking distance, alive with wildlife, densely forested where appropriate, and centred on a breathtaking mythic world-bearing turtle. The lo-fi soundtrack must remain calm while gaining enough musical form, timbral range, and content variety to support long sessions.

Firewatch is a composition and art-direction reference, not a surface-style target. Turtleback will adopt its disciplined sightlines, atmospheric layering, readable silhouettes, color storytelling, and reference-driven construction while pursuing substantially more realistic geometry, materials, lighting, foliage, and wildlife.

The approved solution combines authored hero assets with deterministic procedural composition. Authored models and textures provide the quality ceiling; procedural systems provide coverage, variation, weather response, quality scaling, and replayability.

## 2. Approved product decisions

- Target a near-photorealistic rendering style.
- Use Firewatch as a reference for composition, atmospheric depth, color, and environmental staging without copying its assets or distinctive identity.
- Add original generated assets and freely redistributable authored assets. External assets must be CC0 or otherwise explicitly licensed for redistribution and recorded in the repository.
- Preserve Low and Medium quality modes for less capable hardware; use High and Ultra to deliver the complete visual target.
- Recast the turtle as an ancient mythic world-bearer rather than a biologically ordinary or cute turtle.
- Build a gentle living wildlife ecosystem with habitat-aware ambient behavior, not a deep survival simulation.
- Organize the shell as a fantastical biome mosaic.
- Expand the soundtrack with a hybrid of improved procedural music and original or CC0 produced tracks.
- Preserve existing buildings, activities, and traversal where they serve the new composition. Districts, terrain, paths, and placements may change when the visual or exploratory benefit justifies it.

## 3. Goals

1. Make every benchmark view feel composed, inhabited, and finished at foreground, middle-distance, and horizon scales.
2. Give the world a coherent near-photorealistic material response across clear, rain, dawn, day, sunset, blue hour, and night.
3. Establish visually distinct biomes that transition naturally and never resemble uniform random scatter.
4. Make the turtle the unmistakable hero of the game through asset quality, animation, scale cues, staging, sound, and water response.
5. Add wildlife that is visible, audible, habitat-aware, nonviolent, and performant.
6. Increase lo-fi variety without sacrificing calm pacing, deterministic testability, or graceful fallback behavior.
7. Keep the project shippable as a static WebGL2 application and secure Electron desktop application.
8. Preserve accessibility, Reduced Motion, deterministic world behavior, stable collision, and current interactions.

## 4. Non-goals

- Copying Firewatch assets, maps, palettes, textures, story, or proprietary art techniques.
- Adding combat, predators hunting prey, failure states, or distressing animal behavior.
- Building a persistent life simulation with breeding, hunger, territory, or individually saved wildlife.
- Requiring WebGPU, hardware ray tracing, or fully dynamic global illumination.
- Delivering the full visual target on Low quality; Low preserves geography, identity, playability, and atmosphere at reduced fidelity.
- Replacing the existing game loop, media features, relaxation activities, or save model.
- Rebuilding every interior interaction. Interiors receive the same material, lighting, clutter, and composition standards, while behavior changes remain scoped to clear visual needs.

## 5. Current-state findings that drive the design

The existing architecture is worth preserving: React Three Fiber and Three.js render a componentized world; Rapier owns stable collision; mutable runtime state avoids per-frame React updates; analytic shell height drives terrain, paths, vegetation, and physics; and quality profiles already control major density and shadow choices.

The current quality gap is primarily content and presentation:

- The project has no authored 3D models, raster texture library, environment maps, or model/texture loading pipeline.
- Most world content remains procedural primitive geometry with small runtime canvas textures.
- The current High profile requests only 150 trees across the roughly 13.35-hectare shell, which reads as parkland rather than forest.
- Forest vocabulary is limited to three simple tree archetypes, with no spatial chunks, distance LODs, or forest streaming.
- Visible wildlife consists mainly of nine simple gulls; ambient bird and cricket audio is not spatially tied to visible animals.
- The turtle is physically huge but reads as a collection of smooth primitive forms. Its current portrait staging makes it feel cute rather than monumental.
- The rendering stack has ACES tone mapping, dynamic time/weather lighting, fog, custom ocean/sky shaders, and optional bloom, but lacks image-based lighting, deliberate contact grounding, art-directed color grading, or a scalable atmospheric-effects layer.
- Time-of-day palette colors are converted from sRGB to linear twice. That error must be corrected before palette authoring.
- The procedural music engine exposes four moods but uses one shared arrangement recipe. A phrase-indexing error makes half of some generated progressions unreachable, and vinyl crackle bypasses the seeded random source.

## 6. World art direction and composition

### 6.1 Visual language

The world uses believable natural and architectural construction, realistic material response, and dense surface detail. Large forms remain legible and graphic at a distance. Fine detail concentrates around traversal height, interaction zones, hero objects, biome thresholds, and framed vistas rather than being spread uniformly.

Each major view must contain:

1. a foreground story or framing element;
2. a clear navigation anchor;
3. layered middle-distance forms;
4. a memorable horizon or turtle-scale silhouette.

Dense corridors alternate with deliberate clearings. Forest should make the open village plaza, shell-edge decks, ocean views, and turtle vistas feel larger through contrast. Empty space is allowed only when it has an explicit compositional purpose.

### 6.2 Fantastical biome mosaic

The shell is reorganized into six connected habitat families:

1. **Crownwood:** an ancient conifer forest along the raised shell spine, using immense trunks, moss, ferns, saplings, nurse logs, root shelves, mushrooms, stone outcrops, and suspended mist.
2. **Lumenfen:** a bioluminescent wetland around ponds and drainage channels, with reeds, luminous fungi, water plants, frogs, insects, wet stone, and reflected village light.
3. **Blossomshade:** a flowering broadleaf woodland around homes and gardens, with layered understory, orchard forms, petals, hedges, pollinators, and warm domestic light.
4. **Fernfall Ravine:** shaded fern gullies and shell fissures that form intimate transition routes, with bridges, root steps, trickling water, fallen timber, and shafts of light.
5. **Galecrest:** wind-shaped edge habitat with low pines, tough grasses, salt-worn rock, exposed shell, seabirds, mist, and panoramic ocean views.
6. **Hearth Clearings:** village and civic spaces where vegetation opens into authored plazas, gardens, courtyards, terraces, and social landmarks without becoming barren.

Biome placement follows elevation, slope, moisture, exposure, district function, and shell-rim distance. Transitions use shared species, changing density, soil and shell blending, water flow, and overlapping prop families. Hard biome borders are prohibited.

### 6.3 Environmental object language

Object density comes from authored clusters plus deterministic variation. Cluster families include exposed roots, fallen logs, boulder groups, mushroom colonies, fern banks, flower drifts, driftwood, shell fragments, puddles, drainage details, path edging, wood piles, carts, benches, lanterns, signs, wind chimes, planters, tools, market goods, and small story props.

Placement masks exclude building pads, door approaches, primary paths, bridges, stairs, interaction clearances, safe spawn areas, and benchmark sightlines. Decorative abundance may never degrade navigation or collision reliability.

Every biome must have at least three recognizable navigation silhouettes, three characteristic vegetation layers, two signature prop-cluster families, one characteristic wildlife group, and a distinct ambient sound bed.

## 7. Hero turtle design

### 7.1 Form and scale

The turtle remains a roughly 500-metre-class moving world so the existing shell footprint, traversal scale, and physics assumptions remain useful. Perceived scale is rebuilt through anatomy, staging, relative motion, sound, atmospheric depth, and repeated reference objects rather than by simply enlarging the physics world.

The new turtle is an authored, rigged glTF hero with:

- a strong ancient silhouette and non-cute head proportions;
- sculpted head, neck, beak, eyelids, flippers, shell skirt, and body transitions;
- layered skin displacement, wrinkles, scars, barnacles, algae, mineral deposits, wetness, and subsurface color variation;
- restrained bioluminescent seams and markings that support its mythic identity;
- close, medium, and distant LODs with stable silhouette preservation;
- separate simplified collision and traversal meshes.

The shell terrain must visually grow from the turtle rather than appear placed on top of it. Rim geology, root systems, buildings, drainage, shell plates, and living tissue transitions provide a credible connection.

### 7.2 Animation and presentation

The rig supports breathing, flipper strokes, neck drift, head turns, blinking, eye focus, jaw and nostril micro-motion, and subtle skin deformation. Rare eye contact and head turns are staged events with long cooldowns, not constant spectacle.

Scale cues recur throughout play:

- forest and village forms visibly follow shell curvature;
- edge overlooks reveal neck, body, or flippers far below;
- drainage streams and waterfalls leave the shell rim;
- birds, fish, waves, structures, and distant vessels provide relative scale;
- flipper strokes displace broad water volumes and drive wake, foam, spray, and low-frequency audio;
- breathing influences nearby foliage, hanging objects, water surfaces, and shell resonance without moving physics.

All motion uses the comfort clock. Reduced Motion reduces secondary movement, camera response, foliage response, and event intensity while retaining slow primary life signals.

## 8. Wildlife ecosystem

### 8.1 Species families

- **Forest and village:** deer-like grazers, rabbits, small tree-dwelling animals, songbirds, corvids, butterflies, moths, fireflies, beetles, and occasional ground birds.
- **Wetland:** frogs, dragonflies, luminous insects, wading birds, and small fish.
- **Shell edge and ocean:** seabirds, fish schools, rays, dolphins, and rare distant whales.

Species can receive restrained fantasy coloration or luminescent accents where it supports the biome, but their motion, scale, and material response remain believable.

### 8.2 Behavior model

The Wildlife Director uses pooled agents and deterministic habitat schedules. Near agents use bounded state machines: idle, wander, forage, rest, perch, investigate, gently flee, and regroup. Distant groups use flock, school, orbit, surface, or silhouette animation with much cheaper representations.

Wildlife reacts to player distance, time, rain, wind, habitat, Quiet Mode, and rare turtle events. It does not block critical paths, enter building collision, attack, die, or require player care. Calls originate from the same agents or pooled groups that produce the visible animal, eliminating disconnected ambient wildlife audio.

Quality scaling changes population, animation fidelity, shadowing, update frequency, and LOD distance. It does not remove an entire major animal category from a biome.

## 9. Asset and content pipeline

### 9.1 Supported content

- glTF/GLB for authored models and rigs.
- Meshopt-compressed geometry where it produces a measurable size win without compatibility regressions.
- KTX2/Basis textures for GPU-friendly compressed color, normal, roughness, AO, emissive, and mask maps.
- Authored height or displacement information only on surfaces and quality tiers that benefit visibly.
- MP3 or another verified cross-platform browser format for produced music; alternate encodings may be added only when packaging and playback tests cover them.

### 9.2 Asset registry

Every shipped authored asset is registered with:

- stable ID and kind;
- source path;
- original source URL or generation record;
- author and license;
- required attribution text;
- checksum and approximate decoded size;
- LOD and quality variants;
- preload region and fallback asset;
- wetness, wind, animation, and material capabilities where applicable.

Build validation fails for missing files, duplicate IDs, unsupported licenses, missing attribution, invalid LOD chains, or references outside the static asset boundary. `ASSET_LICENSES.md` remains the human-readable license ledger generated or checked from this registry.

### 9.3 Loading and spatial organization

World populations are divided into approximately 50-metre spatial cells aligned to biome and district boundaries. The current cell and immediate neighbors remain loaded; farther cells retain only low-cost horizon or landmark representations where needed. Hysteresis prevents rapid load/unload churn at boundaries.

Hero assets, critical navigation landmarks, and low-detail fallbacks preload before play. High-detail region assets stream after entry and ahead of player movement. Browser and Electron builds use the same base-URL-safe asset resolution path.

## 10. Rendering design

### 10.1 Foundational corrections

1. Remove the duplicate sRGB-to-linear conversion in time palette sampling.
2. Establish one documented color contract for texture inputs, procedural colors, shader uniforms, renderer output, and screenshots.
3. Re-author dawn, day, sunset, blue-hour, night, and rain palettes only after the color contract is verified.

### 10.2 Materials

Shared PBR material families cover shell, skin, soil, stone, wood, plaster, concrete, metal, glass, fabric, bark, leaves, water, and wet surfaces. They support:

- consistent metre-based texel density;
- macro color and roughness variation;
- triplanar or projection-safe blending on terrain and large curved forms;
- vertex tint and AO for low-cost instance variation and grounding;
- decals for dirt, lichen, leaks, cracks, wear, and local storytelling;
- rain darkening, wet roughness, localized runoff, and puddle response;
- wind and comfort-motion hooks for vegetation;
- quality-scaled parallax or displacement only where it survives screen-space review.

Texture targets are 512 px to 1K on Low, 1K to 2K on Medium, 2K for most High assets, and up to 4K for the turtle and selected Ultra hero surfaces. KTX2 compression and mipmaps are mandatory for authored texture sets.

### 10.3 Lighting and atmosphere

- Retain dynamic time and weather while improving sun/moon shadow softness, stability, and contact.
- Add cached image-based lighting derived from the art-directed sky or approved environment assets so metal, glass, skin, foliage, and wet surfaces have coherent reflections.
- Use baked or vertex AO for static authored assets on all tiers; add restrained screen-space AO only on High and Ultra after artifact and performance review.
- Add height-aware colored fog, layered mist banks, rain shafts, light-ray cards, and quality-scaled volumetric approximations that remain WebGL2 compatible.
- Introduce art-directed color grading per time/weather family, blended continuously and kept subordinate to correct material values.
- Preserve restrained bloom for emissive accents. Bloom may not flatten fog or clip broad surfaces.
- Improve ocean response around the turtle with large-scale displacement, wake fields, flipper-driven foam, shell-rim water interaction, spray, and distance-appropriate reflections.

### 10.4 Forest rendering

Authored hero trees, rocks, and plants are populated through deterministic biome rules. Instances are spatially chunked so frustum culling works. Each major plant family has close, medium, and distant LODs; forest horizons may use impostors or simplified crown masses after visual review.

The system separates canopy, mid-story, understory, ground cover, deadfall, and detail layers so quality tiers can scale cost without collapsing biome identity. Shadow casting, wind animation, and wildlife collision are limited by range and importance.

## 11. Quality profiles and performance contract

### Low

- Preserve all biomes, routes, hero landmarks, and major wildlife categories.
- Use lower-resolution texture variants, aggressive LODs, reduced understory and wildlife population, no screen-space AO, simplified mist, and minimal dynamic shadows.
- Target a stable 30 FPS at 1080p-equivalent output on the recorded integrated-GPU reference system.

### Medium

- Restore moderate forest layers, wildlife populations, material detail, shadow range, mist, and reflections.
- Serve as the balanced default selected by Auto on mainstream hardware.

### High

- Deliver the near-photorealistic target with full biome layers, detailed materials, hero LODs, image-based lighting, contact grounding, richer atmosphere, and representative wildlife density.
- Target 60 FPS at 1080p on the recorded dedicated-GPU reference system.

### Ultra

- Extend forest density and view distance, texture resolution, shadow range, wildlife count, water detail, and atmospheric effects for stronger hardware.
- Never introduce gameplay or geographic content unavailable to other tiers.

Auto quality continues using hysteresis and may adjust density, LOD bias, shadow detail, atmospheric effects, texture variant, and internal resolution. It may not switch quality rapidly enough to become visually distracting.

Performance acceptance uses frame-time percentiles rather than average FPS alone: the High benchmark must keep its 95th-percentile frame time at or below 16.7 ms on the dedicated reference path, and Low must keep its 95th percentile at or below 33.3 ms on the integrated reference path after warm-up. A 30-minute traversal soak must reach a memory plateau with less than 10 percent growth over its final 20 minutes.

## 12. Music and environmental audio

### 12.1 Procedural engine repair

- Calculate phrase length from progression length and bars per chord so every generated chord is reachable.
- Route vinyl, tape, timing, and arrangement variation through the seeded random source.
- Extract a deterministic musical-event plan that can be tested without an AudioContext.
- Preserve clean node disposal, suspend/resume behavior, and existing audio buses.

### 12.2 Expanded generative composition

Each mood gains multiple deterministic arrangement families with A/A-prime/B/break form, alternate chord patterns and inversions, bass movement, drum patterns, melody motifs, call-and-response, fills, layer dropouts, and controlled silence. Variation changes at bar or phrase boundaries, with only a small number of dimensions changing at once.

The timbral palette expands to electric piano, soft guitar-like plucks, mallets, warm pads, subdued basses, brushed percussion, tape texture, chorus, delay, and room reverb. Swing, velocity, timing, filter movement, and stereo placement are bounded so the result remains calm and does not resemble unstructured randomness.

### 12.3 Produced soundtrack

The initial content target is twelve original generated or verified CC0 lo-fi pieces, generally two to four minutes long, normalized to a consistent quiet listening target. A typed manifest records title, source, license, duration, mood, biome, time, weather, tempo, key, loudness, loop or ending behavior, and file path.

Produced tracks use the soundtrack music bus rather than the user-media bus. The Music Director selects between produced and procedural pieces using biome, time, weather, indoor/outdoor state, recent history, and user settings. Crossfades last approximately 8 to 12 seconds unless a bar-aligned transition provides a cleaner result.

The same produced track may not repeat within the previous four selections. The same procedural arrangement fingerprint may not repeat within 45 minutes under a stable mood. If a produced track fails to decode or load, the procedural engine continues seamlessly.

### 12.4 Ambient soundscape

Each biome receives a distinct ambient bed and sparse foreground details. Wildlife calls are scheduled from visible wildlife agents or their explicit distant-group representations. Turtle breathing, shell resonance, flipper motion, wake, falling water, weather, canopy movement, village props, and interiors occupy separate controllable layers while continuing to respect the existing ambient, SFX, music, media, and master buses.

Quiet Mode reduces wildlife calls, village activity, bright musical layers, and nonessential movement without making the sanctuary silent.

## 13. Runtime architecture and data flow

### 13.1 Major modules

- **Asset Registry:** validates, resolves, preloads, caches, and disposes models, textures, LODs, music, licenses, and fallbacks.
- **Biome Registry:** immutable definitions for terrain layers, vegetation families, prop clusters, wildlife populations, sound beds, music tags, transitions, exclusions, and quality budgets.
- **Biome Compositor:** converts the seed, analytic shell fields, authored masks, and quality profile into deterministic spatial-cell populations.
- **Turtle Hero:** owns rig, animation, materials, LODs, wake emitters, scale events, and presentation hooks; it does not own traversal physics.
- **Wildlife Director:** owns pooled agents, habitat queries, behavior states, update budgets, visibility, and synchronized sound emitters.
- **Music Director:** owns procedural plans, produced-track history, manifest selection, transitions, and fallback.
- **Quality Governor:** resolves density, LOD, texture, shadow, atmosphere, water, wildlife, and update-frequency budgets from the existing quality profile and runtime measurements.

### 13.2 Frame flow

The existing `FrameDriver` and mutable runtime model remain authoritative for continuous state. Each frame or scheduled low-frequency tick:

1. player position, time, weather, travel, comfort clock, and resolved quality update the active biome and spatial-cell context;
2. the Biome Compositor ensures required cells and LODs are present;
3. Turtle Hero, Wildlife Director, vegetation, atmosphere, water, and audio consume the same runtime state;
4. one-shot events travel through the existing typed event bus;
5. React state remains limited to discrete UI and settings rather than per-frame world simulation.

This shared context keeps visuals, wildlife, ambience, and music synchronized without coupling their internal implementations.

## 14. Failure handling and graceful degradation

- Asset-manifest and license errors fail the production build.
- A runtime model or texture load failure logs the stable asset ID, records diagnostics, and substitutes the registered lower-detail or procedural fallback.
- A high-detail region may become visible only when either its requested assets or its fallback are ready; traversal never waits on optional detail.
- KTX2, model-compression, or audio decode failures fall back to compatible registered variants where available.
- Produced-music failure returns control to procedural music without silence or a UI error loop.
- Wildlife agents that cannot acquire a valid habitat point despawn and return to their pool rather than entering paths or invalid geometry.
- Quality reductions occur before allocation failure by lowering pending cell detail, wildlife population, effects, and texture variants.
- Existing renderer/GPU recovery behavior remains intact. Asset caches and audio nodes must support explicit disposal during reload and shutdown.

## 15. Implementation sequence

### Phase A: Foundation

Correct color handling; add the asset/license registry, glTF and KTX2 loading, spatial cells, LOD conventions, quality budgets, benchmark extensions, and deterministic scene probes. Chunk current vegetation before increasing density.

### Phase B: Hero vertical slice

Deliver the final-quality turtle, wake and scale effects, one complete turtle vista, and one complete biome corridor. This slice must demonstrate final materials, lighting, forest layering, wildlife, ambient sound, music transition, Low-to-Ultra scaling, collision safety, and target frame times.

### Phase C: Biome and village composition

Build all six biome families, transition zones, terrain and path treatments, forest populations, environmental prop clusters, navigation anchors, and recomposed district sightlines. Apply the same material and composition standards to building exteriors and interiors.

### Phase D: Wildlife ecosystem

Add habitat-aware land, air, wetland, and ocean wildlife; pool and LOD agents; synchronize calls; integrate time, weather, Quiet Mode, Reduced Motion, and turtle events.

### Phase E: Hybrid soundtrack

Repair deterministic procedural sequencing, add arrangement families and timbral variation, implement the produced-track manifest and selection history, add twelve licensed tracks, and complete long-session audio QA.

### Phase F: Atmosphere and release polish

Finish time/weather grading, image-based lighting, mist, rain, wet response, water, interiors, wildlife polish, quality tuning, memory work, asset licensing, benchmark capture, and release verification.

Each phase ends with a playable vertical result and the complete verification gate appropriate to its scope. Later phases may not conceal unresolved performance or collision regressions from earlier phases.

## 16. Verification strategy

### 16.1 Automated logic tests

- Asset and music manifest validation, licensing, paths, IDs, fallbacks, and LOD chains.
- Deterministic biome populations, placement exclusions, transition weights, spatial-cell hysteresis, and quality budgets.
- Wildlife habitat selection, state transitions, player avoidance, pooling, and deterministic schedules.
- Music phrase length, full progression reachability, seeded event plans, anti-repetition, selection history, and fallback behavior.
- Existing time, weather, traversal, settings, save, desktop recovery, and security tests remain green.

### 16.2 Scene and end-to-end probes

- Debug probes expose active cells, instance counts, LOD distribution, visible wildlife, loaded asset IDs, draw calls, texture estimates, and current music source.
- End-to-end tests verify quality changes update real rendered resources, not detached initialization data.
- Traversal checks cover rebuilt paths, bridges, ravines, edge decks, building thresholds, spawn points, and home return.
- Asset-loading failure injection verifies that registered fallbacks preserve play.

### 16.3 Visual review

The existing named benchmark suite expands with forest interior, biome threshold, wildlife grouping, waterfall rim, flipper-scale, and close turtle-material views. The required full capture matrix is:

- High: noon clear, noon rain, sunset clear, and night clear;
- Medium: noon clear and night clear;
- Low: noon clear smoke and one dense-forest traversal view;
- Ultra: selected turtle, forest, wetland, village, and ocean hero views.

Controlled captures may use perceptual comparison to catch large regressions, but cross-platform GPU variance means human review remains required for fine material and atmosphere approval.

### 16.4 Performance and soak review

- Fixed benchmark paths cover dense Crownwood traversal, Lumenfen water and wildlife, busy village clearings, turtle portrait and flipper event, rain, and night lighting.
- Frame-time percentiles, draw calls, triangles, visible instances, renderer memory estimates, process memory, and audio-node counts are recorded.
- A 30-minute world traversal checks memory plateau, cell churn, wildlife pooling, texture disposal, and audio cleanup.
- A two-hour music and ambience soak checks selection variety, scheduler stability, decode fallback, and node disposal.

### 16.5 Completion gate

Every phase completes typecheck, lint, unit tests, production build, relevant browser tests, visual captures, and manual inspection. Final release review additionally covers packaged Electron smoke and measurement flows.

## 17. Product acceptance criteria

The overhaul is complete only when all of the following are true:

- The turtle no longer reads as assembled primitives in any benchmark view and appears monumental from at least four normal traversal vistas.
- All six biomes are identifiable without the map and transition without visible hard borders.
- No benchmark view feels unintentionally empty; every district has foreground, navigation, middle-distance, and horizon structure.
- Forests contain canopy, mid-story, understory, ground cover, and deadfall layers on High while remaining navigable on every tier.
- Each biome presents visible or spatially credible wildlife activity during a representative 90-second observation window under suitable time and weather.
- Wildlife calls do not routinely originate from empty nearby space.
- Materials remain coherent in dry, rain, day, sunset, and night conditions, with no stretched hero textures, broken color space, ungrounded major objects, or uncontrolled specular clipping.
- Low retains every biome, route, hero landmark, and major wildlife category at stable integrated-GPU performance.
- High meets the recorded 1080p dedicated-GPU frame-time target, and the long traversal reaches the defined memory plateau.
- The soundtrack includes twelve licensed produced pieces, deterministic generative forms, seamless fallback, and the defined anti-repetition guarantees.
- All asset licenses and attribution requirements are complete and reproducible from the registry.
- Reduced Motion, Quiet Mode, graphics quality, audio buses, saving, recovery, and existing interactions remain functional.

## 18. Research references

- Campo Santo, environment-art rendering breakdown: <https://blog.camposanto.com/post/96702184522/hey-everybody-thanks-for-all-your-kind-words/amp>
- Campo Santo, distance fog, graphic silhouettes, texture-noise control, and palette discussion: <https://blog.camposanto.com/post/100680711679/i-asked-twitter-if-anyone-had-questions-about-the>
- Campo Santo, concept, greybox, paintover, in-engine iteration, and environment workflow: <https://blog.camposanto.com/post/100170868639/i-asked-twitter-if-anyone-had-questions-about-the>
- Campo Santo, tangible construction and material-detail discussion: <https://blog.camposanto.com/page/10>
