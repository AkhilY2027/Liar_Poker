# Full Integration Prototype

Real-time multiplayer Liar's Poker prototype with a React frontend and Node.js + Socket.IO backend.

## Structure

- server/: authoritative game rules, bid validation, and websocket events
- client/: React UI, structured bid input, and socket networking

## Run Server

```bash
cd server
npm install
npm start
```

Server runs on http://localhost:3000 by default.

## Render Deployment (Single Web Service)

This prototype is configured to run on Render as a single Node web service:

- `server/src/index.js` binds to `HOST`/`PORT` (Render provides `PORT`).
- The server serves Socket.IO plus static client files from `client/dist` after build.

### Files Added For Render

From `Full Integration Prototype/`:

- `render-build.sh`:
	- installs `server` deps
	- installs `client` deps (including dev deps for Vite build)
	- builds client (`client/dist`)
- `render-start.sh`:
	- starts server (`server/src/index.js`)

### Create Render Service

1. Push this repo to GitHub.
2. In Render, create `New +` -> `Web Service`.
3. Select your repo.
4. Configure:
	 - `Root Directory`: `Full Integration Prototype`
	 - `Environment`: `Node`
	 - `Build Command`: `bash render-build.sh`
	 - `Start Command`: `bash render-start.sh`
5. Add environment variables (optional defaults shown):
	 - `NODE_ENV=production`
	 - `DISCONNECT_MODE=autofold`
	 - `TURN_TIMEOUT_MS=60000`
	 - `MAX_CARDS_TO_LOSE=6`
	 - `AUTO_FOLD_BEHAVIOR=next_highest`
6. Deploy.

### Important Notes For Render

- Do not hardcode a frontend API URL for production in this setup.
- The browser should connect back to the same origin as the served app.
- Health check endpoint is available at `/health`.
- If `NODE_ENV=production` is set on Render, `render-build.sh` still installs client dev deps so `vite build` is available.

## Start Both (Quick Dev)

From `Full Integration Prototype/`:

```bash
./start-dev.sh
```

This starts both backend and frontend together and shuts both down on `Ctrl+C`.

## Run Client

```bash
cd client
npm install
npm run dev
```

Client defaults to same-origin in hosted environments.
For local split-origin dev, override with `VITE_SERVER_URL` (for example `http://localhost:3000`).

For local dev, the Vite config proxies `/socket.io`, `/card_deck_images`, and `/health` to `http://localhost:3000` by default, so no env var is required.
If your backend runs on a different local URL, set `VITE_DEV_PROXY_TARGET` before `npm run dev`.

For local dev, if frontend and backend run on different origins and you prefer direct calls, set `VITE_SERVER_URL`.
For Render single-service deployment, leave this unset so same-origin is used.

## Required WebSocket Events

- place_bid
- call_liar
- game_update

Additional events used:

- join_game
- invalid_move

## Notes

- Server is source of truth for all rules.
- No client-side bid hierarchy enforcement is used.
- Open multiple browser windows to simulate multiple players.

## Robustness Features

- Disconnect handling modes (`DISCONNECT_MODE`):
	- `remove`: remove player from game
	- `pause`: pause game when player disconnects
	- `autofold` (default): mark player inactive and continue
- Turn processing lock to avoid concurrent state mutation races.
- Per-turn timeout (`TURN_TIMEOUT_MS`, default `60000`).
- Timeout behavior (`AUTO_FOLD_BEHAVIOR`):
	- `next_highest` (default)
	- `kick_and_reset_round`
	- `auto_fold`
- Strict server-side hand validation:
	- malformed payload rejection
	- rank range checks (`2..14`)
	- type/rank-count compatibility checks
	- suit compatibility checks

## Logging

- Server logs valid bids, liar calls, timeouts, disconnect outcomes, and invalid actions.
- Invalid actions are emitted to clients via `invalid_move` and recorded in game log.

## Load Simulation

From `server/`:

```bash
npm run load:test
```

Heavier run:

```bash
npm run load:test:heavy
```

Environment options:

- `LOAD_SERVER_URL` (default `http://localhost:3000`)
- `LOAD_GAMES` (default `3`)
- `LOAD_PLAYERS` (default `3`)
- `LOAD_BURST` (default `8`)
