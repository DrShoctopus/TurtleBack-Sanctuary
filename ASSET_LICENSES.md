# Asset Licenses

## Summary

Authored media shipped with Turtleback Sanctuary is declared in the typed asset
manifest. The generated section below is checked against that manifest during
tests and production builds. Original generated content and redistribution-safe
third-party content retain their provenance, license, and attribution here.

<!-- BEGIN GENERATED ASSET LICENSES -->
| Asset ID | Kind | Author | License | Provenance | Attribution |
| --- | --- | --- | --- | --- | --- |
<!-- END GENERATED ASSET LICENSES -->

## Procedural content sources

| Asset category | How it's produced | File(s) |
| --- | --- | --- |
| Ground / architecture / fabric / wood / stone / plaster textures | Procedural `<canvas>` drawing from seeded noise | `src/game/world/textures.ts` |
| Wall / gallery / home artworks | Seeded generative `<canvas>` compositions | `src/game/village/artworks.ts` |
| Sky, ocean, clouds, stars, bioluminescence | Original GLSL shaders | `src/game/world/**` |
| Buildings, furniture, props, turtle, landmarks, vegetation | Procedural/modular Three.js geometry | `src/game/village/**`, `src/game/world/**` |
| Music (dawn / day / rain / night) | Original real-time Web Audio synthesis | `src/game/audio/proceduralMusic/**` |
| Ambient soundscape (ocean, wind, rain, birds, crickets) | Original Web Audio synthesis | `src/game/audio/ambience/**` |
| Footsteps, interaction & UI sounds | Original Web Audio synthesis | `src/game/audio/SfxEngine.ts` |
| Fonts | System UI fonts only (`ui-rounded`, `system-ui`, …); none bundled | `src/styles/global.css` |
| Favicon | Original inline SVG | `public/icons/favicon.svg` |

## User-provided content (not shipped)

- **YouTube videos** play through YouTube's official `youtube-nocookie.com`
  IFrame embed. The game never downloads, proxies, records, or restreams them.
  Videos remain subject to YouTube's terms and the uploader's embed settings.
- **Local audio files** the player chooses are read locally and never uploaded.
- **Internet-radio streams** the player adds play directly through a native
  `<audio>` element (no proxy). The player is responsible for the legality of
  streams they add. The bundled `public/config/radio-stations.example.json`
  contains **no real endpoints**.

## Third-party software (dependencies)

These libraries are used at build/runtime under their own open-source licenses
(MIT unless noted). They are dependencies, not bundled assets, and are installed
via the lockfile:

| Package | License |
| --- | --- |
| react, react-dom | MIT |
| three | MIT |
| @react-three/fiber, @react-three/drei, @react-three/rapier | MIT |
| @react-three/postprocessing, postprocessing | MIT / Zlib |
| @dimforge/rapier3d-compat | Apache-2.0 |
| three-stdlib | MIT |
| zustand | MIT |
| vite, @vitejs/plugin-react | MIT |
| typescript, typescript-eslint, eslint | MIT / Apache-2.0 |
| vitest, @playwright/test | MIT / Apache-2.0 |
| prettier | MIT |

Refer to each package's own license text in `node_modules/<pkg>/LICENSE` for the
authoritative terms.

## Policy for adding assets

Any authored asset must be original, CC0, or explicitly licensed for
redistribution. Add its path, checksum, encoded and decoded sizes, author,
source or generation record, license, attribution, quality coverage, and
fallback to `src/game/assets/manifest.json`, then regenerate this ledger with
`pnpm write:asset-licenses`.

Do not hand-edit generated ledger rows. Do not add copyrighted or unlicensed
commercial assets, and do not leave blank placeholders or debug art in shipped
builds.
