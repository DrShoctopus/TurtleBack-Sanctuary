# Rendering Color Contract

This document is the canonical color-space contract for Turtleback Sanctuary. Apply it before authoring palettes, materials, textures, custom shaders, post-processing, or visual-reference captures.

## Working and output spaces

- Three.js performs scene lighting and color arithmetic in its linear working color space.
- CSS colors, hexadecimal strings, and other color-style inputs passed to `THREE.Color` or React Three Fiber are sRGB inputs. Three converts them to linear values once.
- Numeric RGB tuples, `Color.setRGB()` values, palette stop tuples, and custom-shader color uniforms are linear values. Do not convert them from sRGB again.
- The renderer is configured through `configureRendererColor()` with `SRGBColorSpace` output, `ACESFilmicToneMapping`, and exposure `1.05`.
- ACES tone mapping is applied exactly once. Do not add a second tone-mapping effect or manually tone map a value that will pass through Three's tone-mapping shader chunk.

## Texture roles

Assign a texture's role before its first GPU upload.

| Texture content            | Required color space                      |
| -------------------------- | ----------------------------------------- |
| Base color/albedo          | `SRGBColorSpace` via `markColorTexture()` |
| Emissive color             | `SRGBColorSpace` via `markColorTexture()` |
| Normal                     | `NoColorSpace` via `markDataTexture()`    |
| Roughness                  | `NoColorSpace` via `markDataTexture()`    |
| Metalness                  | `NoColorSpace` via `markDataTexture()`    |
| Ambient occlusion          | `NoColorSpace` via `markDataTexture()`    |
| Height/displacement        | `NoColorSpace` via `markDataTexture()`    |
| Opacity and material masks | `NoColorSpace` via `markDataTexture()`    |

HDR lighting and environment textures keep the color-space metadata supplied by their approved loader. Do not pass them through the color-texture helper unless their source encoding is explicitly sRGB.

## Palettes and shaders

- Author palette anchors as sRGB hex values through `THREE.Color`, then store and interpolate the resulting linear tuples.
- Use numeric GLSL color constants only as linear values.
- Custom fragment shaders write linear `gl_FragColor` values and finish with these chunks in this order:

```glsl
#include <tonemapping_fragment>
#include <colorspace_fragment>
```

- Custom shader materials remain tone mapped, including transparent, additive, sky, ocean, particle, mist, and weather materials. Alpha remains linear coverage and is not gamma corrected.
- Built-in Three materials use the renderer's standard tone-mapping and output-color path; do not patch a duplicate conversion into them.

## Screenshots and verification

- Browser and Electron canvases, visual-reference screenshots, and shipped PNG captures are sRGB output.
- Do not apply manual gamma correction before or after capture.
- Before changing palette values, run the color-contract and palette tests, then inspect matched noon and night captures for clipping, crushed shadows, broad exposure shifts, and shader compilation failures.
- Palette correction and artistic palette retuning are separate changes. A color-space fix must not silently compensate by changing palette anchors or renderer exposure.
