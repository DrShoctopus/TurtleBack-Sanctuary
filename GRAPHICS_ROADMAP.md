# Premium Graphics Roadmap

## North star

Turtleback Sanctuary should feel authored everywhere: serene at first glance, rewarding at walking distance, and still convincing when the player stops to inspect a window frame, plant, deck rail, pool edge, or piece of furniture. Performance work is part of the art direction; beauty that collapses on integrated graphics is not finished.

## Signature systems already started

- Night aurora: layered teal/cyan/violet curtains, slow movement, rain fade, quality scaling, and Reduced Motion support.
- Edge water: slow lapping foam bands around the shell perimeter, calmer Gerstner displacement near the turtle, and restrained aurora reflection at night.
- Night presentation: functional bloom for emissive seams, windows, stars, and aurora highlights.
- Ground dressing: shaped grass and flower silhouettes replacing opaque rectangular cards.

## Rescue progress

- 2026-07-12 — Shared architecture foundation: village box parts now use physically sized rounded geometry while collision remains simple; UVs tile in world-scale metres instead of stretching across long walls.
- 2026-07-12 — Shared PBR foundation: deterministic tileable normal and roughness detail now covers plaster, timber, decking, concrete, fabric, painted finishes, and brushed metal.
- 2026-07-12 — Visual smoke review: noon and deep-night renders completed without broken merged geometry, shader failures, or browser console errors. This is the material/geometry baseline; it does not close the terrain, foliage, hero-asset, or composition phases below.
- 2026-07-12 — Landscape foundation: shell terrain now blends multi-scale, rotated surface samples with broad habitat variation, irregular path/rock borders, subtle physical normals, and material-specific rain darkening.
- 2026-07-12 — Vegetation foundation: deterministic habitat fields form meadows, clearings, and thickets; shared grass tufts, clustered shrubs, branching broadleaf crowns, and denser pine whorls replace the most obvious isolated primitives while retaining instanced draw calls.
- 2026-07-12 — Weather polish: rain streaks use softer non-additive blending and small terrain-following deterministic ripples instead of bright metre-wide rings.
- 2026-07-12 — Aurora rebuild: ten repeated billboard curtains were replaced by one continuous direction-space spherical veil with layered flowing arcs, high/medium/low detail scaling, near-static Reduced Motion behavior, subtle sky color spill, and decisive overcast suppression.
- 2026-07-12 — Turtle hero rebuild: dedicated procedural skin albedo/normal/roughness, organic head and snout forms, a tapered neck, sculpted flippers, readable iris/pupil/catchlight eyes, correct deterministic blinking, stable head height, breathing motion, and Reduced Motion support replace the stretched-sphere prototype.
- 2026-07-12 — Shell-edge water: true shell-rim distance now drives shallow color and foam, Gerstner motion respects Reduced Motion, and a single elliptical shader veil adds three broken slow lap fronts outside the visual skirt. Day-only cube lantern placeholders were replaced with rounded night-fading lights.
- 2026-07-12 — Benchmark QA support: development builds expose deterministic bow, stern, east/west edge, and turtle-portrait camera positions so hero and shoreline art can be reviewed without pointer lock; production behavior is unchanged.
- 2026-07-12 — District composition foundation: a merged outdoor kit now supplies threshold frames, market canopies, raised garden beds, pale residential fences, and abstract sculpture plinths. Plaza, Market Lane, Greenhouse Gardens, Quiet Path, Arts, Wellness, and Observatory approaches each receive authored clusters and distinct silhouettes without increasing prop-object draw calls.
- 2026-07-12 — Garden focal repair: the solid cylinder that covered the garden pond was replaced with a low ring of merged rim stones, restoring the animated water surface and its approach sightline.
- 2026-07-12 — Exterior identity pass: projecting window sills and drip caps add real facade depth; homes, café, shops, greenhouse, gallery, bathhouse, observatory, and cottages now receive distinct entrance, canopy, sign, screen, planting, and skyline treatments. The greenhouse has a true transparent ribbed roof with no hidden opaque ceiling, the observatory dome has a grounded drum and equatorial band, and the pavilion roof now opens into two light sail-like wings.
- 2026-07-12 — Traversal architecture pass: the garden route now crosses a raised timber pond bridge; the observatory ridge has a collision-matched comfort ramp and parallel ceremonial stair; stern, bow, east, and west horizon decks receive railed engineered approaches. Full-Euler collider rotation keeps inclined visuals and physics aligned, while route splats, vegetation clearance, map lines, footsteps, drainage grates, and automated traversal coverage share the same authored span data.
- 2026-07-12 — Protected-interior PBR split: building envelopes now merge and render separately from furnishings, sharing texture memory but owning independent material state. Rain can darken and smooth plaster, timber, stone, metal, paint, fabric awnings, open-air pavilion parts, traversal structures, and outdoor props without soaking beds, books, sofas, rugs, or interior floors.
- 2026-07-12 — Live shader and quality repair: sky, clouds, and ocean now update the actual rendered shader uniforms instead of detached initialization objects. Ocean tessellation, rain count, vegetation density, cloud/ocean/reflection detail, aurora detail, lamp-light pools, landmark range, and shadows respond to the selected profile on the first switch; Low disables shadow rendering. Browser coverage verifies advancing GPU time/weather uniforms and exact Low/High geometry counts.

## Phase 1 — Art bible and benchmark views

- Lock a palette for dawn, noon, rain, sunset, blue hour, and deep night.
- Define texel density, bevel radius, roughness range, emissive range, and prop scale standards.
- Establish benchmark cameras at the home porch, plaza, greenhouse, bathhouse, observatory, each edge deck, turtle head view, and one interior per building class.
- Capture High/Medium/Low screenshots at every benchmark after each milestone.

## Phase 2 — Architectural kit replacement

- Replace sharp box vocabulary with bevelled wall, plinth, roof, frame, rail, stair, ramp, bridge, door, and window modules.
- Preserve simplified Rapier colliders separately from display geometry.
- Add district-specific trim families while keeping a common coastal-modern language.
- Add LODs and merge by material without merging the entire village into one unstreamable object.

## Phase 3 — PBR material system

- Generate or source licensed albedo, normal, roughness, and AO detail for plaster, pale stone, concrete, shell, brushed metal, wood, fabric, glass, and wet paths.
- Separate exterior wettable materials from protected interior materials.
- Add coherent UV scale and triplanar fallbacks for procedural terrain and large shell forms.
- Give every material a dry, rain-darkened, dawn, and night-lighting review.

## Phase 4 — World composition

- Give every district a unique silhouette, planting vocabulary, prop story, lighting rhythm, and sound bed.
- Add foreground detail at walking height, midground navigation anchors, and distant skyline shapes.
- Build real bridges, stairs, ramps, shell ridges, pools, drainage, shoreline decks, and transition spaces.
- Replace evenly random scatter with authored clusters plus deterministic procedural variation.

## Phase 5 — Hero assets and animation

- Rebuild the turtle head, neck, flippers, eyelids, shell skirt, water displacement, and breathing motion as the central hero asset.
- Replace landmark primitives with authored modular silhouettes and distance LODs.
- Add subtle interaction animation for tea, plants, blinds, doors, telescope, wind chimes, seating, and media hardware.

## Phase 6 — Lighting and atmosphere

- Tune sun/moon shadow softness, indoor daylight fill, contact shadows, window transmission, and emissive exposure.
- Add high-quality cloud layering, mist banks, rain shafts, roof drips, puddle response, and wet reflection breakup.
- Keep bloom restrained and make every comfort-affecting motion obey Reduced Motion.

## Acceptance gates

- No visible placeholder cards, razor-sharp architectural boxes, coplanar flicker, or untextured hero primitives in benchmark views.
- Every major building has an exterior, threshold, interior, lighting, and prop pass.
- Every district has three identifiable visual anchors without relying on the map.
- High targets 60 FPS at 1080p on the reference dedicated GPU; Low targets stable 30 FPS on the reference integrated GPU.
- Visual QA passes dawn, noon, sunset, night, clear, and rain at High/Medium/Low.
- Reduced Motion removes or greatly reduces aurora drift, water camera sway, vegetation motion, and transition motion without making the scene feel dead.
