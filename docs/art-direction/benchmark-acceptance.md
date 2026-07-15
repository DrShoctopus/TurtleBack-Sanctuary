# Stylized Direction Benchmark Acceptance

## Purpose

This scorecard converts the Slice 1 frames into in-engine acceptance. Style frames are not accepted merely because a similar asset exists; the live normal-play capture must reproduce their hierarchy, density, scale, and mood within the performance contract.

## Canonical comparisons

| Runtime view | Target frame | Current role |
| --- | --- | --- |
| `arrival-bridge` | `style-frames/arrival-overlook.jpg` | first-impression and navigation composition |
| `forest-interior` | `style-frames/crownwood-interior.jpg` | forest density and depth |
| `galecrest-turtle-reveal` | `style-frames/galecrest-turtle-reveal.jpg` | normal-play monumental turtle reveal |
| `turtle-material-close` | `style-frames/turtle-material-close.jpg` | anatomy/material diagnostic only |
| `turtle-eye-encounter` | `style-frames/turtle-material-close.jpg` | normal-player scale and eye encounter |
| `turtle-distant-silhouette` | `style-frames/galecrest-turtle-reveal.jpg` | diagnostic complete-island silhouette |

Slice 3 replaced the frontal fixed portrait. Galecrest and the eye encounter use the normal player camera; only the distant silhouette and material close remain fixed diagnostics.

## Hard failures

Any one of these rejects the capture:

- raw or obviously procedural primitives in a hero silhouette;
- a large unplanned ground patch occupying roughly more than 20% of a designated dense frame;
- no clear foreground frame, navigation anchor, or distant silhouette;
- forest represented as isolated trees without canopy/midstory/understory;
- turtle reads as cute, small, smiling, symmetrical, or fully containable in a nearby view;
- photo texture/realism mismatch between major asset families;
- white fog, clipped bloom, neon cyan, fluorescent wetness, crushed path values, or broken transparency;
- path, door, bridge, interaction, spawn, or player-capsule obstruction;
- High/Low change removes the district, route, forest wall, turtle identity, or habitat category;
- asset/license/fallback error, shader error, unstable LOD, or missed required frame-time gate.

## 0–2 visual scorecard

Score every category `0` (fails), `1` (partial), or `2` (matches target). A hero view needs at least 14/16 with no zero.

| Category | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Composition | no hierarchy | partial framing/anchor | clear foreground, anchor, horizon |
| Silhouette | primitive/noisy | readable but generic | distinctive at thumbnail size |
| Density | empty/random | several layers missing | authored clusters and full required layers |
| Material cohesion | mismatched/plastic | coherent but flat | painterly, selective, material-readable |
| Atmosphere | white/flat | depth present | directional color depth supports subject |
| Scale | weak/ambiguous | some cues | repeated environmental cues make scale undeniable |
| Navigation | obscured/unclear | route visible | route inviting and compositionally reinforced |
| Living world | dead or distracting | limited/repetitive | calm layered motion/wildlife supports habitat |

## View-specific gates

### Arrival Overlook

- The first frame before movement has a navigable path and memorable destination.
- Foreground vegetation/props frame rather than cover the bridge.
- Village clearing is compact and enclosed by forest masses.
- Observatory or another approved landmark remains readable through colored distance fog.
- Shell curvature/geology communicates the unusual setting without exposing a barren plate field.

### Crownwood interior

- All seven forest layers from `ART_BIBLE.md` are visible on High.
- Canopy impression is continuous; sky holes are composed accents.
- Path bends toward a brighter middle-distance anchor.
- Root/log/boulder clusters are grounded and traversal-safe.
- At least one plausible wildlife discovery can occur without being guaranteed in the exact screenshot.

### Galecrest turtle reveal

- Reached from normal traversal without a cutscene.
- Near turtle head extends beyond the frame and is shown three-quarter, never frontally centered.
- Heavy brow, small eye, hooked beak, jaw, neck folds, and asymmetric material zones are readable.
- Overlook rail, waterfall, trees/structures, birds, ocean animals, wake, fog, and motion provide multiple scale repetitions.
- The turtle remains calm and ancient; no threat or mascot expression.

### Turtle material close

- Used to assess materials and anatomy, not perceived overall scale.
- Macro plates/folds remain readable before barnacles/scars/algae.
- Wetness follows planes and gravity without plastic gloss.
- Cyan seams remain thin and subordinate.
- LOD and texture tier changes preserve the brow, eye socket, beak, jaw hinge, and major scars.

## Capture matrix

Required after the relevant slice:

- High: noon clear, sunset clear, night clear, noon rain;
- Medium: noon clear and night clear;
- Low: noon clear identity smoke;
- Reduced Motion: one forest motion view and one turtle event view;
- Quiet Mode: one wildlife habitat observation;
- default/no-AO comparison only where AO is being introduced or materially changed.

## Approval sequence

1. Compare the live screenshot with the canonical frame at full size.
2. Compare both at thumbnail size and in grayscale.
3. Apply hard failures, then the 0–2 scorecard.
4. Review navigation/collision and runtime probes.
5. Record p95 frame time, draw calls, triangles, encoded/decoded asset bytes, and fallback IDs.
6. Owner visual approval is required before the proven kit expands to the rest of the shell.
