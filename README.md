# Liar's Poker Hand Bid Core

This project implements core backend bidding logic for a Liar's Poker-style game based on poker hand rankings.

## Files

- `Game Logic Prototype/liars_poker.py`: hand model, comparison logic, bid validation, and CLI simulation
- `Game Logic Prototype/test_liars_poker.py`: unit tests for validation, comparison, and parsing
- `Backend Server Prototype/server.js`: Socket.IO server bootstrap
- `Backend Server Prototype/src/gameLogic.js`: multiplayer game logic and hand comparison
- `Backend Server Prototype/src/socketHandlers.js`: multiplayer socket event handling

## Run Tests

```bash
python3 "Game Logic Prototype/test_liars_poker.py"
```

## Run CLI

```bash
python3 "Game Logic Prototype/liars_poker.py"
```

Input format:

```text
<HAND_TYPE> <ranks comma-separated> [suit]
```

Examples:

- `PAIR J`
- `FULL_HOUSE K,10`
- `FLUSH A,J,9 HEARTS`
- `STRAIGHT_FLUSH Q SPADES`

Type `liar` to call liar and end the round.

## Multiplayer Socket.IO Server (Node.js)

The project also includes a multiplayer backend server with in-memory game state.

### Install and Run

```bash
cd "Backend Server Prototype"
npm install
npm start
```

Server default port: `3000` (override with `PORT`).

### Architecture

- `server.js`: HTTP + Socket.IO server bootstrap
- `src/gameLogic.js`: hand model/validation/comparison and core game state transitions
- `src/socketHandlers.js`: WebSocket event handling and broadcasting

### In-Memory Game State

Each game tracks:

- `players`: `{ id, name, active }[]`
- `currentTurn`: player id or `null`
- `currentBid`: Hand object or `null`
- `gameState`: `waiting | in_progress | reveal`

### Hand Payload Shape

```json
{
	"type": "PAIR",
	"primaryRanks": [11],
	"suit": null
}
```

Notes:

- `type` supports enum names like `HIGH_CARD`, `PAIR`, `FULL_HOUSE`, etc.
- `primaryRanks` must be integers in `2..14` and are normalized descending.
- `suit` is optional and must be one of `CLUBS`, `DIAMONDS`, `HEARTS`, `SPADES` when present.

### Socket Events

Client -> Server:

- `create_game`: `{ name }`
- `join_game`: `{ gameId, name }`
- `start_game`: `{ gameId }`
- `place_bid`: `{ gameId, hand }`
- `call_liar`: `{ gameId }`

Server -> Client:

- `game_state`: full updated game snapshot after every valid action
- `action_error`: `{ message }` for invalid actions or payloads

### Validation and Turn Rules

- Bids are validated server-side with `isValidBid(previous, next)`.
- Out-of-turn actions are rejected.
- Only the game owner can trigger `start_game`.
- `call_liar` is only valid on the current player's turn during `in_progress`.

### Logging

The server logs:

- accepted bids
- turn changes
- invalid actions and reasons
