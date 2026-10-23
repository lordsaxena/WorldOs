# WORLDOS

Urban simulation prototype with an interactive 3D-style city map.

**Live app:** [lordsaxena.github.io/WorldOs](https://lordsaxena.github.io/WorldOs/)

## Run locally

Requires Node.js 18 or newer.

```bash
cd WORLDOS
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173/`.
Do not open `WORLDOS/index.html` directly; it is the Vite app entry point.

## Test and build

Run these commands from `WORLDOS/`:

```bash
npm test
npm run build
```

## Deployment

GitHub Actions builds `WORLDOS/` and deploys it to GitHub Pages whenever
changes to the app or deployment workflow are pushed to `main`. Deployment
can also be started manually from the repository's Actions tab.
