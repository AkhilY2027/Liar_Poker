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

Client defaults to connecting to http://localhost:3000.
Override with `VITE_SERVER_URL` if needed.

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
- Per-turn timeout (`TURN_TIMEOUT_MS`, default `20000`).
- Timeout action (`TIMEOUT_ACTION`):
	- `pass` (default)
	- `liar`
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
