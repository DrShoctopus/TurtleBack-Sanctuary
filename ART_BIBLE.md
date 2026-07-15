# Turtleback Sanctuary Art Bible

**Direction:** painterly monumental naturalism

**Status:** Slice 1 candidate direction, ready for owner review

This is the rendering and asset contract for every environment, creature, architecture, and effects pass. Turtleback must feel warm, ancient, richly inhabited, and breathtaking without chasing photorealism or collapsing into simple low-poly shorthand.

The canonical visual references are the [Slice 1 art-direction board](docs/art-direction/README.md), [shape-language guide](docs/art-direction/shape-language.md), and [palette/value keys](docs/art-direction/palette-and-value-keys.md). Concept frames are targets for hierarchy, composition, shape, color, and mood. They are not permission to add details that cannot survive normal gameplay distance or the WebGL2 performance contract.

## Style pillars

1. **Monumental readability:** broad silhouettes and value masses communicate place and scale before surface detail.
2. **Layered abundance:** forest, village, water, wildlife, and props form deliberate clusters at foreground, middle-distance, and horizon scales.
3. **Painterly material truth:** materials remain recognizable through color, roughness, edge treatment, and selective texture rather than photographic noise.
4. **Living calm:** wind, water, wildlife, the turtle, lights, and music move on distinct slow rhythms without turning the sanctuary busy or chaotic.
5. **One coherent world:** turtle, plants, wildlife, buildings, props, water, sky, and UI share one level of stylization.

## Explicit exclusions

- No return to near-photorealism or photo-scanned material mismatch.
- No raw sphere, cone, cylinder, or box as a finished hero silhouette.
- No universal black outline or harsh two-band toon shader.
- No large unplanned lawn, flat ground plane, or evenly random scatter in a hero view.
- No isolated lollipop trees where a forest mass is required.
- No cute, smiling, frontally symmetrical, baby-proportioned world-turtle.
- No high-frequency texture detail that turns into crawling noise at walking distance.
- No visual feature that exists only in a debug camera or only on Ultra.

## Scale and construction

- One world unit is one metre.
- Doors are 2.25 m, counters 0.9–1.0 m, seats 0.42–0.52 m, and eye-level interactions 1.1–1.7 m.
- Exterior walls, roofs, sills, shelves, rails, furniture, roots, and shell plates need visible thickness.
- Architecture uses small, readable bevels on exposed edges. Large silhouettes stay simple; walking-height objects receive the most modeling attention.
- Furniture clears walls by at least 4 cm and floors by 1 cm. Layered surfaces require at least 8 mm separation unless polygon offset is intentional.
- Doors, paths, steps, interaction clearances, spawn areas, and the configured player capsule remain physically navigable.
- Display geometry and collision geometry remain separate. The analytic shell and Rapier traversal mesh stay authoritative.

## Shape language

- Natural forms use asymmetric taper, lean, fork, erosion, growth, and age. Repetition varies silhouette first, tint second.
- Built forms use weathered timber, shell-stone plinths, curved thresholds, practical lashings, framed openings, and restrained cyan inlay.
- Environment kits favor a small set of excellent modular forms with LODs over many weak unique assets.
- Trees are authored as canopy masses plus trunk rhythm, not as trunk-plus-ball symbols.
- Rocks echo eroded shell plate structure without literally becoming small turtle shells in every cluster.
- Props communicate use: rest, gardening, trade, navigation, weather, maintenance, ritual, or wildlife care.
- Wildlife uses believable anatomy and calm behavior with restrained moss, ochre, coral, or cyan accents.
- The full dimensional guidance lives in [shape-language.md](docs/art-direction/shape-language.md).

## Turtle hero contract

- The turtle is an ancient moving island, not a mascot.
- Its head uses a heavy brow, small deep-set eye, hooked keratin beak, powerful jaw hinge, long folded neck, and asymmetric scars/growth.
- The eye remains intelligent and warm without becoming glossy, oversized, or humanlike.
- Barnacles, algae, mineral deposits, moss, wet scars, shell plates, and restrained cyan seams form organized material zones; they are not uniform surface noise.
- Nearby normal-play views crop the head beyond the frame. The player must not fit the full head and both front flippers into one close view.
- Distant silhouettes, shell-rim waterfalls, trees, buildings, birds, dolphins, wake scale, fog, and slow motion repeatedly establish size.
- Primary motion is breathing, neck drift, eye focus, blink, and broad flipper travel. Secondary motion is water, spray, foliage, hanging props, and shell resonance.
- Reduced Motion preserves slow breathing and acknowledgement while reducing camera response, spray, foliage impulse, and fast secondary events.

## Forest and environment density

Every dense forest hero view contains seven readable layers:

1. interlocking canopy;
2. trunk rhythm;
3. midstory saplings;
4. shrub and fern understory;
5. moss/grass/flower ground cover;
6. deadfall, nurse logs, roots, and branch debris;
7. boulders, shell geology, water, and local mist.

Dense corridors alternate with deliberate clearings. A clearing is valid only when it frames navigation, rest, village life, ocean, or the turtle.

- Every district needs a foreground story, a middle-distance navigation anchor, and a distant silhouette.
- Every 20–30 m of a showcase route needs a deliberate cluster or discovery without blocking traversal.
- A designated dense benchmark rejects any unplanned empty ground patch occupying roughly more than 20% of the frame.
- Forest edges overlap with village planting, gardens, fences, stacked materials, and small trees. Hard vegetation walls or instant biome rings are prohibited.
- Random placement is deterministic, masked, clustered, and reviewed from the path rather than from a top-down scatter plot.

## Materials and textures

- Author base color as broad sRGB color fields with macro variation, then convert through the canonical [rendering color contract](docs/rendering-color-contract.md) exactly once.
- Roughness is the main material separator. Normal detail supports form; it does not manufacture form.
- World-scale UVs are the default. Wood grain follows structure; planks run with travel; bark follows growth; fabric and plaster keep consistent scale.
- Large terrain and shell forms use triplanar/projection-safe layers, vertex tint, decals, or masks. Avoid stretched sphere UVs and single-image smearing.
- Use selective edge wear, lichen, moss, runoff, scars, chips, and contact darkening to tell material history.
- Protected interiors remain dry. Exterior wetness darkens color, lowers roughness selectively, and collects in plausible channels.
- Glass requires a frame, recess, and coherent reflection/transmission response.
- Runtime targets: 256–512 px atlases for ground cover/small props, 512 px–1K packed sets for standard assets, 1K–2K for landmarks and turtle LOD1, and at most one justified 4K turtle map after an A/B proof.
- Authored runtime textures use KTX2/Basis with mipmaps. Geometry uses LODs and measured compression without breaking skinning, silhouettes, or fallback behavior.

## Color, value, lighting, and atmosphere

- Use the locked [palette and value keys](docs/art-direction/palette-and-value-keys.md). Hex anchors are sRGB authoring values.
- Warm key light and cool shadow families establish form. Ambient fill may not flatten the scene.
- The image must remain legible in grayscale and at thumbnail size.
- Broad surfaces stay below clipping. The brightest value band is reserved for sun breaks, foam, wet accents, flowers, eye catchlight, and controlled emissive detail.
- Directional colored fog separates depth planes and supports composition. It is not a white veil.
- Mist banks, clouds, rain, light cards, and water spray retain silhouette clarity.
- Bloom accents cyan seams, lamps, aurora, and rare wet highlights; it never becomes the atmosphere itself.
- Noon is coastal and clear, sunset is warm against cool distance, night is moon-blue with localized amber/cyan anchors, and rain compresses contrast without making the world gray.

## Wildlife

- Wildlife is visible often enough to make habitats feel alive, but never staged like a zoo.
- Near agents use calm, readable actions: perch, hop, forage, rest, investigate, glide, surface, regroup, and gently flee.
- Calls originate from visible animals or explicit represented distant groups.
- Animals never attack, die, block primary paths, enter building collision, or demand care.
- High showcase acceptance exposes at least four wildlife categories during a five-minute walk. Low preserves one representative category per habitat with cheaper groups or silhouettes.
- Fantasy accents remain restrained; anatomy and movement carry recognition.

## Motion and accessibility

- Aurora, clouds, ocean, vegetation, turtle, mist, wildlife, props, and interaction animation use the comfort motion clock.
- Wind acts in layers: canopy drift, branch motion, leaf/grass flutter, and hanging-prop response use different amplitudes and phases.
- Reduced Motion retains the world’s slow life while reducing fast flutter, camera response, dense particle motion, rapid wildlife reactions, and strong turtle-event response.
- Quiet Mode reduces nonessential calls and activity without deleting the represented habitat.

## Composition and LOD

- Compose from normal player eye height and traversal direction before tuning a debug camera.
- Large forms remain stable across LOD transitions. Drop interior branches, small silhouette cuts, shadows, and microdetail before changing the main outline.
- Low preserves biome walls, routes, turtle identity, large wildlife categories, and palette. Medium restores secondary layers. High delivers the target. Ultra extends density and distance only.
- Distant trees use simplified crowns or impostors that preserve painterly mass instead of dissolving into thin alpha noise.
- Quality budgets change density and refinement, never geography or district identity.

## Benchmark and approval workflow

- Use [benchmark-acceptance.md](docs/art-direction/benchmark-acceptance.md) as the Slice 2+ visual scorecard.
- Run `pnpm capture:graphics` for the named camera suite. In development, use `window.__turtlebackDebug.benchmark(id)` or the existing Alt-number shortcuts.
- Required conditions are noon clear, sunset clear, night clear, and noon rain at High, plus a Low identity smoke pass.
- Compare every implementation capture beside its canonical style frame and the pre-reset baseline.
- Reject coplanar flicker, stretched textures, floating props, broken transparency, shader errors, noisy LOD transitions, unplanned empty ground, weak silhouettes, or quality switches that lag a render.
- Finish each slice with size evidence, targeted tests, typecheck, lint, unit tests, production build, required end-to-end/visual tests, a focused commit, a push, and remote commit confirmation.

## Direction changes

No later slice may silently reinterpret the style. A material, silhouette, palette, density, turtle-anatomy, or wildlife-style change that contradicts the canonical frames requires an updated art-direction record and owner review before it spreads to additional assets.
