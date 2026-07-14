# Turtleback Sanctuary Art Bible

This is the rendering contract for every environment and asset pass. The goal is a warm, tactile sanctuary with believable construction, readable silhouettes, and calm motion—not generic realism or noisy detail.

## Scale and construction

- One world unit is one metre. Doors are 2.25 m, counters 0.9–1.0 m, seats 0.42–0.52 m, and eye-level interactions 1.1–1.7 m.
- Exterior walls, roofs, sills, shelves, and furniture need visible thickness. No paper-thin hero geometry.
- Architecture uses small bevels on exposed edges. Large silhouettes stay simple; walking-height objects receive the most modeling attention.
- Furniture must clear walls by at least 4 cm and floors by 1 cm. Layered surfaces require at least 8 mm separation unless polygon offset is intentional.
- Doors, paths, steps, and interaction clearances remain physically navigable at the configured player capsule size.

## Materials and texture alignment

- World-scale UVs are the default. Wood grain follows the longest structural axis; planks run with travel; fabric weave and plaster remain consistent between objects.
- Large terrain and shell forms use procedural/triplanar detail. Avoid visibly stretched sphere UVs and single-image texture smearing.
- Roughness is the primary material separator: plaster 0.9+, dry wood 0.65–0.85, ceramic 0.25–0.5, brushed metal 0.3–0.55, wet hard surfaces 0.18–0.4.
- Interior ceilings use the smooth `plasterCeiling` finish. Broad normal maps are prohibited where they create moiré or shadow striping.
- Exterior and interior materials remain separate. Rain can darken exterior surfaces without wetting protected rooms.
- Glass needs a frame, recess, and reflection/transmission response; never ship an unframed transparent rectangle as a finished window.

## Light, color, and atmosphere

- The canonical [rendering color contract](docs/rendering-color-contract.md) defines scene inputs, texture roles, shader output, tone mapping, and screenshot color. Verify that contract before authoring or retuning any palette.
- Daylight stays soft and coastal: cool sky fill, warm sun, restrained contrast. Night uses moonlight plus localized amber windows and lamps.
- Emissive surfaces illuminate compositionally but do not clip to white. Bloom is an accent, never a fog layer.
- Rain deepens roughness/color variation, creates localized runoff, and increases mist near the rim. Protected interiors do not receive player-centred rain.
- Aurora, clouds, ocean, vegetation, turtle breathing, mist, and interaction animations use the comfort motion clock.

## Composition and LOD

- Every district needs a foreground story, a midground navigation anchor, and a distant silhouette.
- Hero landmarks remain recognizable at Low. Medium adds secondary structure; High adds fine silhouette and glow detail.
- Quality budgets change density and detail, not the identity or geographic coverage of a district.
- Random scatter is deterministic and clustered. Props may not occupy building pads, door approaches, paths, or traversal landings.

## Interior review

- Review every room from the doorway and centre. Check wall penetration, floating props, concealed shelf contents, unsupported lamps/shades, ceiling collisions, and reachable interactions.
- Furniture groups need a clear use story and comfortable circulation. Decorative objects support that story instead of filling empty space uniformly.
- Windows and blinds share the exact authored opening transforms.

## Benchmark and acceptance workflow

- Run `pnpm capture:graphics` for the named camera suite. In development, call `window.__turtlebackDebug.benchmark(id)` or use the existing Alt-number shortcuts.
- Required conditions are noon clear, night clear, and noon rain at High, plus a Low-quality smoke pass.
- Reject visible coplanar flicker, texture stretching, roof/ceiling intersections, floating furniture, broken transparency, shader errors, or quality switches that lag a render.
- Finish with typecheck, lint, unit tests, production build, and end-to-end tests.
