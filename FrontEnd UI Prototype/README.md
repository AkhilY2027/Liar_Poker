# FrontEnd UI Prototype

React + Vite frontend prototype for local Liar's Poker gameplay UI.

No backend connection is used in this prototype. All state is simulated locally.

## Features

- GameTable: shows players and current turn
- CurrentBidDisplay: shows current bid in readable form
- PlayerHand: displays mock local hand data
- ActionPanel: lets user construct and submit bids with validated controls
- GameLog: records local game actions

## Install and Run

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (usually `http://127.0.0.1:5173/` or `http://localhost:5173/`).

## Build

```bash
npm run build
```

To view the production build locally:

```bash
npm run preview
```

Do not open `dist/index.html` directly in the browser with `file://`.
Vite build output expects to be served by a web server; opening the file directly can show a blank/white page.

## Local State Simulation

- Hardcoded players and turn order
- Local current bid tracking
- Submit bid updates bid, log, and turn
- Invalid lower/equal bids are blocked in UI flow

## Hand Shape

```json
{
  "type": "PAIR",
  "primaryRanks": [11],
  "suit": null
}
```

## Source Overview

- src/App.jsx: top-level local game state and layout
- src/components/: UI components
- src/handUtils.js: hand formatting, validation, and comparison helpers
