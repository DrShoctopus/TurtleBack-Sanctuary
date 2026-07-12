# Deployment

The production build is a fully static bundle — no backend, database, auth, or
secret keys. It deploys to any static host.

## Build

```bash
pnpm install
pnpm build      # → dist/
```

`pnpm build` runs `tsc --noEmit` (strict type check) and then `vite build`.
Preview the result locally with `pnpm preview`.

`vite.config.ts` sets `base: './'`, so the bundle uses **relative asset paths**
and works from a domain root or any sub-path without reconfiguration.

## Netlify

- **Build command:** `pnpm build` (or `npm run build`)
- **Publish directory:** `dist`
- SPA note: there's a single entry (`index.html`); no rewrite rules are needed.
  If you add client routing later, add a `/* → /index.html` rewrite.

`netlify.toml` (optional):

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

## Vercel

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`

## Cloudflare Pages

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** set `NODE_VERSION = 20` (or newer) in the environment.

## GitHub Pages

Because `base: './'` is relative, the bundle works from a project sub-path
(`https://user.github.io/repo/`) with no changes. A minimal Actions workflow:

```yaml
name: Deploy
on:
  push: { branches: [main] }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/deploy-pages@v4
```

## Headers (optional but recommended)

The app makes no cross-origin data requests of its own, but it embeds YouTube
and plays user-supplied media. If you add a Content-Security-Policy, remember to
allow:

- `frame-src https://www.youtube-nocookie.com https://www.youtube.com` (the TV embed)
- `media-src https: blob:` (radio streams over https, local files via object URLs)
- `img-src https: data:` (YouTube thumbnails, procedural data URIs)

Do **not** set `COOP/COEP` isolation unless you need it — it can block the
YouTube embed.

## What is and isn't shipped

- **Shipped:** the app bundle, procedural everything, an example radio config
  (`public/config/radio-stations.example.json`, no real endpoints), and an empty
  `public/audio/music/` drop-in folder.
- **Not shipped:** any binary media, analytics, trackers, service worker, or
  environment secrets. There are none to configure.
