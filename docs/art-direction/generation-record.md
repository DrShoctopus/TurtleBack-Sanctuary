# Slice 1 Image Generation Record

**Date:** 2026-07-14

**Mode:** built-in OpenAI image generation

**Use case:** `stylized-concept`

**Runtime role:** documentation and visual-direction reference only; these images are not shipped game assets and add 0 MiB to the runtime bundle

## Provenance

All six images were generated specifically for Turtleback Sanctuary. No third-party image was supplied as an image input. The first frame used the written project brief; later frames used only earlier images from this same generation set to preserve the original project's visual language.

The selected originals remain in the default Codex generated-image folder. Project copies were converted to 1672×941 JPEG at quality 82, reducing the committed set from roughly 14.5 MiB of PNG sources to under 3 MiB without changing review dimensions.

## Common final prompt contract

Every prompt used this shared contract:

- premium painterly monumental naturalism for a professional WebGL2 game;
- believable scale/anatomy/construction simplified into strong sculpted silhouettes and hand-painted color fields;
- coastal jade, moss, cedar, shell umber, mist blue, warm ochre, rare coral and restrained cyan;
- warm light, cool shadows, colored directional mist, readable foreground/midground/background;
- no photographic texture target, anime outline, flat low-poly kit, logo, watermark, UI, readable text, or copied game asset;
- practical translation to authored meshes, atlases, instancing, LODs, particles, and stylized shaders.

## Final prompt set

### `arrival-overlook.jpg`

First-person Arrival Overlook on the colossal turtle shell: curved timber bridge and stone path, dense conifer/broadleaf framing, compact village clearing, distant observatory, visible shell curvature/plates, foreground ferns/roots/mossy rocks/flowers/signpost/story cluster, calm late-morning coastal light. Avoid empty lawn, isolated toy trees, generic castle, photorealism, and cute turtle cues.

Original: `exec-73fad34b-f000-4692-8d3a-afed91cc0402.png`

### `crownwood-interior.jpg`

First-person Crownwood interior matching the Arrival language: enclosed canopy, immense conifer trunks, midstory, dense fern/shrub understory, moss ground, nurse logs/root arches, lichen boulders, mushrooms/flowers, shallow water, perched songbird and partially hidden shell hare. S-curved path leads to a brighter mist anchor. Avoid open sky, empty ground, random scatter, horror darkness, and microdetail noise.

Original: `exec-863c3e3e-90db-4419-a1b3-0519f914b5bf.png`

### `galecrest-turtle-reveal.jpg`

Normal-play Galecrest overlook matching the forest language: weathered rail, wind-shaped pine, grasses/ribbons/mist-wet rock; colossal ancient turtle head and flipper beside/below the shell, cropped beyond frame, hooked beak, long folded neck, small deep-set eye, scars/algae/barnacles/cyan seams, waterfall, birds, dolphins, wake and miniature trees/structures. Three-quarter side angle, calm late-afternoon awe. Avoid frontal mascot portrait, smile, giant glossy eyes, dragon aggression, and a fully visible nearby creature.

Original: `exec-2914f342-0465-4569-a096-d35efeae25b8.png`

### `turtle-material-close.jpg`

Environmental three-quarter close-up preserving the Galecrest turtle: heavy brow, small eye, hooked/chipped keratin beak, jaw hinge, neck folds, scars, algae, barnacles, mineral deposits, moss and thin cyan seams. Shell-rim waterfall, tiny conifers/deck/birds provide scale. Macro anatomy precedes selective detail. Avoid centered portrait, baby proportions, smile, plastic wetness, uniform noise, teeth, and neon glow.

Original: `exec-f2230d48-0d20-4e2a-ad1c-084eff0ae4fb.png`

### `environment-shape-language.jpg`

Neutral production board matching the established language: eight modular tree silhouettes, six shell-derived boulder forms, functional sanctuary prop family, and five coastal timber/shell-stone trim modules. Separated three-quarter orthographic concepts, consistent scale cues, practical game construction. Avoid perfect cones/spheres, generic asset-pack shapes, ornament, duplicated objects, and text.

Original: `exec-2c7854f1-9b2a-4c31-b425-f14fad607201.png`

### `wildlife-turtle-shape-language.jpg`

Neutral production board preserving the established turtle and environment language: world-turtle head/neck/flipper studies; songbird perch/takeoff; shell-hare forage/rest/hop; gentle small grazer; butterfly/dragonfly/firefly groups; seabird glides; ray and dolphin. Believable calm anatomy with restrained fantasy accents. Avoid mascot proportions, large glossy eyes, predators, dragons, ornate armor, neon effects, duplicated poses, and text.

Original: `exec-ebe1b13a-200f-4504-9b20-d96786669fa6.png`

## Curation result

The six selected outputs pass the Slice 1 concept gate as a coherent candidate set:

- consistent painterly palette and material hierarchy;
- clearly layered forest density;
- non-cute monumental turtle anatomy;
- repeated environmental scale cues;
- modular environment and wildlife vocabularies that can be built within the current WebGL2 architecture.

Owner approval remains required before Slice 2 turns this direction into runtime shaders and materials.
