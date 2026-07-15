# Slice 3 — Monumental Turtle Runtime Evidence

These deterministic live WebGL captures prove the Slice 3 hero in the shipped camera path. They are generated with:

```bash
node_modules/.bin/playwright test -c playwright.turtle.config.ts
```

Review set:

- `distant-silhouette-high.png` — complete turtle/island silhouette and ocean scale;
- `galecrest-reveal-high.png` — normal-traversal three-quarter reveal;
- `eye-encounter-ultra.png` — near anatomy, brow, lateral eye, beak, and jaw;
- `material-close-ultra.png` — 512 px scute color field plus 256 px normal/roughness detail;
- `galecrest-reveal-low.png` — LOD2 identity retention;
- `eye-encounter-reduced-motion.png` — breathing retained with secondary response limited.

The turtle is original code-authored geometry and procedural texture work. No third-party model, texture, or audio binary was added. Encoded runtime asset delta is therefore **0 bytes**; decoded GPU detail grows by about **1.5 MiB** for the 512 px color map and two 256 px material maps. Declared hero topology is 31,680 / 13,920 / 4,880 triangles for LOD0 / LOD1 / LOD2, with identical silhouette bounds.

The six PNG review artifacts total about **1.8 MiB** and the largest is below **0.5 MiB**, well inside the slice/repository policy. The final 60-second High-tier SwiftShader diagnostic recorded p50 **316.7 ms**, p95 **325.5 ms**, 167 calls, 646,446 scene triangles, LOD0 active, and no console errors. SwiftShader is deliberately recorded as a software-renderer diagnostic rather than the dedicated-GPU acceptance result.
