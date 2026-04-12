const { io } = require("socket.io-client");

const SERVER_URL = process.env.LOAD_SERVER_URL || "http://localhost:3000";
const LOAD_GAMES = Number(process.env.LOAD_GAMES || 3);
const LOAD_PLAYERS = Number(process.env.LOAD_PLAYERS || 3);
const LOAD_BURST = Number(process.env.LOAD_BURST || 8);

const HANDS = [
  { type: "PAIR", primaryRanks: [2], suit: null },
  { type: "PAIR", primaryRanks: [3], suit: null },
  { type: "TWO_PAIR", primaryRanks: [4, 2], suit: null },
  { type: "STRAIGHT", primaryRanks: [9], suit: null },
  { type: "FLUSH", primaryRanks: [12, 10, 8], suit: "HEARTS" },
  { type: "FULL_HOUSE", primaryRanks: [13, 5], suit: null },
  { type: "STRAIGHT_FLUSH", primaryRanks: [14], suit: "SPADES" },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.info("[load-test] starting", {
    SERVER_URL,
    LOAD_GAMES,
    LOAD_PLAYERS,
    LOAD_BURST,
  });

  const clients = [];
  let invalidMoves = 0;
  let updates = 0;

  for (let g = 0; g < LOAD_GAMES; g += 1) {
    const gameId = `load-room-${g + 1}`;

    for (let p = 0; p < LOAD_PLAYERS; p += 1) {
      const socket = io(SERVER_URL, { transports: ["websocket"] });
      clients.push(socket);

      socket.on("connect", () => {
        socket.emit("join_game", {
          name: `LoadP-${g + 1}-${p + 1}`,
          gameId,
        });
      });

      socket.on("invalid_move", () => {
        invalidMoves += 1;
      });

      socket.on("game_update", () => {
        updates += 1;
      });
    }
  }

  await wait(1000);

  for (let i = 0; i < LOAD_BURST; i += 1) {
    for (const socket of clients) {
      const hand = HANDS[i % HANDS.length];
      socket.emit("place_bid", { hand });
      if (i % 5 === 0) {
        socket.emit("call_liar");
      }
    }
  }

  await wait(1500);

  for (const socket of clients) {
    socket.disconnect();
  }

  console.info("[load-test] completed", {
    clients: clients.length,
    updates,
    invalidMoves,
  });
}

run().catch((error) => {
  console.error("[load-test] failed", error);
  process.exit(1);
});
