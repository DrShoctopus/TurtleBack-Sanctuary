# Palette and Value Keys

All hex anchors below are **sRGB authoring values**. Pass hex/CSS colors through `THREE.Color` once and interpolate the resulting linear values. Do not apply a second sRGB-to-linear conversion. See `docs/rendering-color-contract.md`.

## Core material palette

| Role | sRGB | Use |
| --- | --- | --- |
| Deep ocean shadow | `#14282E` | deepest water, night separation |
| Forest void | `#1B2B27` | canopy/trunk occlusion, never broad black |
| Moss shadow | `#30483A` | shaded vegetation and wet ground |
| Canopy mid | `#496247` | primary forest mass |
| Coastal jade | `#6B8056` | lit foliage and habitat identity |
| Lichen sage | `#8B9A72` | selective vegetation/stone lift |
| Cedar dark | `#4A352B` | deep timber and bark seams |
| Cedar mid | `#6C4B35` | timber, bark, prop structure |
| Shell umber | `#55483C` | turtle/shell material base |
| Shell mineral | `#897B61` | dry shell/stone light plane |
| Mist stone | `#78817A` | neutral rock and architecture |
| Warm ochre | `#D29A4A` | sunlit roof, lantern, eye accent |
| Coral flower | `#D8735F` | rare flower/ribbon/navigation accent |
| Living cyan | `#55BDB9` | restrained seams, inlay, rare glow |
| Foam light | `#D8E2DA` | foam, sun break, pale flower |

No single asset should use the entire palette. Each material family selects one dark anchor, one mid, one light, and at most one rare accent.

## Time and weather families

| Condition | Sky/fill | Fog/distance | Shadow family | Warm anchor | Cyan anchor |
| --- | --- | --- | --- | --- | --- |
| Noon clear | `#B8D1D8` | `#A3BBC0` | `#294044` | `#E7BD73` | `#55BDB9` |
| Sunset clear | `#D88961` | `#977F77` | `#293743` | `#E7A35D` | `#4AA6A8` |
| Blue hour/night | `#1A2C3D` | `#354C59` | `#101C25` | `#D99B55` | `#45AEB0` |
| Noon rain | `#92A6AA` | `#82989A` | `#263A3B` | `#C39261` | `#4AA5A4` |

These are anchors, not flat screen filters. Materials retain local identity while sun, sky, fog, wetness, and grading move the scene between families.

## Five-band value key

Judge values in linear-light renders and in sRGB screenshots. The numeric ranges below describe approximate screenshot luminance groups, not shader constants.

| Band | Approx. luminance | Purpose |
| --- | --- | --- |
| V0 | `0.05–0.12` | deepest forest/ocean separation; small area only |
| V1 | `0.12–0.26` | dominant shadow masses and foreground frame |
| V2 | `0.26–0.46` | local-color body of terrain, trunks, shell, buildings |
| V3 | `0.46–0.70` | navigation path, selected foliage, face/landmark planes |
| V4 | `0.70–0.88` | mist opening, foam, flowers, sun breaks, catchlight |

Broad areas above roughly `0.90` are a failure. Pure black and pure white are reserved for diagnostic/UI use, not environment materials.

## Frame value recipes

### Arrival Overlook

- V1 canopy/foreground encloses 30–45% of the frame.
- V2 forest and shell carry most local color.
- V3 bridge/path forms an unbroken navigation read.
- V4 fog and sky isolate the observatory silhouette.

### Crownwood interior

- V0/V1 trunk and canopy masses dominate the edges/top.
- V2 understory remains separated through hue and roughness.
- V3 path and selective fern edges lead toward the centre distance.
- V4 is a small mist/light opening, never a white fog wall.

### Galecrest reveal

- V1 overlook frame anchors the player scale.
- V2/V3 turtle anatomy remains legible against water/fog.
- V4 foam, waterfall, birds, and sun edges repeat scale.
- Cyan seams remain below the foam/sun value and never outline the entire creature.

### Turtle close

- Brow, eye socket, jaw hinge, and neck folds separate through large value planes.
- Barnacles and scars cluster around form changes rather than speckling the whole face.
- One small eye catchlight is the sharpest facial value.
- Wet highlights follow planes and gravity; they do not create plastic gloss.

## Color review gate

For every material/palette change:

1. run color-contract and palette tests;
2. capture matched noon, sunset, night, and rain frames;
3. inspect full color, grayscale, and thumbnail views;
4. reject clipped broad surfaces, crushed navigation, white fog, neon cyan, fluorescent wetness, or a global color cast that erases material identity.
