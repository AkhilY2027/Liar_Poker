# Backend Server Prototype

Node.js + Socket.IO backend prototype for a multiplayer Liar's Poker-style game.

## Files

- server.js: HTTP + Socket.IO server bootstrap
- src/gameLogic.js: game state model, hand validation/comparison, and turn helpers
- src/socketHandlers.js: socket event handlers and state broadcasting

## Install and Run

```bash
npm install
npm start
```

Default port is 3000. Override with PORT if needed:

```bash
PORT=3001 npm start
```

## Game State (In Memory)

Each game tracks:

- players: { id, name, active }[]
- currentTurn: player id or null
- currentBid: Hand object or null
- gameState: waiting | in_progress | reveal

## Socket Events

Client to server:

- create_game: { name }
- join_game: { gameId, name }
- start_game: { gameId }
- place_bid: { gameId, hand }
- call_liar: { gameId }

Server to client:

- game_state: full updated game snapshot
- action_error: { message }

## Hand Payload

```json
{
  "type": "PAIR",
  "primaryRanks": [11],
  "suit": null
}
```

- type uses enum names like HIGH_CARD, PAIR, FULL_HOUSE
- primaryRanks must be integers in 2..14 and are normalized descending
- suit is optional and must be CLUBS, DIAMONDS, HEARTS, or SPADES when present
