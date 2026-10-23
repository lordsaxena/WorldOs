# WORLDOS — Urban Intelligence Prototype

A browser-based urban simulation prototype with a deterministic synthetic city model.

## Run locally

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Build and test

```bash
npm test
npm run build
npm run preview
```

## Included features

- Glassmorphism WorldOS desktop welcome screen with live system status, application launcher, assistant panel, and workspace sign-in overlay
- City overview with synthetic metrics and system health
- Interactive 2D district map with layer coloring, selection, zoom, and inspector
- Mobility, energy/climate, water/resources, and economy/housing workspaces
- Simulation Lab with policy sliders, pending/committed state, reset, and deterministic runs
- Built-in scenarios plus custom scenario save/load/delete
- Scenario comparison charts, metric table, and user-defined objective weights
- Local rule-based urban intelligence assistant; no API key required
- JSON and CSV exports
- Reports and methodology disclosure
- Local browser persistence for custom scenarios
- Responsive desktop/tablet/mobile layout

## Model notes

The simulation is an illustrative deterministic model. Identical parameters and model version produce identical outputs. The model links population, transport, energy, emissions, water, housing, economy, infrastructure pressure, and resilience through bounded formulas.

All values are synthetic and must not be interpreted as validated forecasts, live infrastructure measurements, financial estimates, or operational recommendations. District inspector values are illustrative sample data and are not calibrated to the simulation engine. There is no connection to real municipal infrastructure.

## Project structure

- `src/engine/simulate.js` — model, scenario presets, assistant rules, and metric comparisons
- `src/engine/simulate.test.js` — deterministic and basic relationship tests
- `src/App.jsx` — app shell and workspaces
- `src/style.css` — responsive dark urban-intelligence interface

## Added: interactive 3D-style city map

Open **3D City Map** from the left navigation to explore a procedural city scene. It includes rotation and zoom controls, day/night styling, selectable building blocks, and a district inspector. It uses local CSS/React geometry and does not require a map API key. The city is illustrative rather than geospatially accurate.

## Windows setup

1. Install Node.js 18 or newer from https://nodejs.org/.
2. Extract the project ZIP to a folder such as `C:\\Users\\YourName\\Downloads\\WORLDOS`.
3. Open that folder in VS Code.
4. In VS Code choose **Terminal → New Terminal** and make sure the terminal is in the folder containing `package.json`.
5. Run `npm install` (wait for it to finish).
6. Run `npm run dev` and open the localhost URL printed in the terminal, usually `http://localhost:5173`.

If PowerShell blocks `npm`, use `npm.cmd install` and `npm.cmd run dev`.

## Tests

Run `npm test` to run the included deterministic simulation engine tests. Run `npm run build` after installing dependencies to create the production build in `dist/`.
