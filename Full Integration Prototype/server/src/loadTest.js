const assert = require("node:assert/strict");
const { io } = require("socket.io-client");
const {
  createGame,
  addOrReconnectPlayer,
  normalizeHand,
  isBidAchievableFromActiveHands,
} = require("./gameLogic");

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

function createTestGameWithCards(playerCards) {
  const game = createGame("rules-test-room");
  playerCards.forEach((cards, index) => {
    const player = addOrReconnectPlayer(game, {
      id: `p-${index + 1}`,
      name: `Player ${index + 1}`,
      displayName: `Player ${index + 1}`,
      cardTarget: cards.length,
    });
    player.active = true;
    player.cards = cards;
  });
  return game;
}

function runRuleRegressionChecks() {
  // Straight minimum should be 5-high.
  assert.throws(
    () => normalizeHand({ type: "STRAIGHT", primaryRanks: [4], suit: null }),
    /at least 5-high/
  );

  // Wheel straight (A-2-3-4-5) should be valid.
  const wheelBid = normalizeHand({ type: "STRAIGHT", primaryRanks: [5], suit: null });
  const wheelGame = createTestGameWithCards([
    [
      { rank: 14, suit: "SPADES" },
      { rank: 5, suit: "HEARTS" },
      { rank: 4, suit: "CLUBS" },
      { rank: 3, suit: "DIAMONDS" },
      { rank: 2, suit: "SPADES" },
    ],
  ]);
  assert.equal(isBidAchievableFromActiveHands(wheelGame, wheelBid), true);

  // Flush highs that cannot be completed by lower suited cards should be rejected.
  assert.throws(
    () => normalizeHand({ type: "FLUSH", primaryRanks: [2], suit: "HEARTS" }),
    /cannot be completed/
  );

  // Valid flush highs should still pass and be achievable when cards exist.
  const validFlushBid = normalizeHand({ type: "FLUSH", primaryRanks: [10, 8, 6], suit: "HEARTS" });
  const flushGame = createTestGameWithCards([
    [
      { rank: 10, suit: "HEARTS" },
      { rank: 8, suit: "HEARTS" },
      { rank: 6, suit: "HEARTS" },
      { rank: 5, suit: "HEARTS" },
      { rank: 2, suit: "HEARTS" },
    ],
  ]);
  assert.equal(isBidAchievableFromActiveHands(flushGame, validFlushBid), true);

  console.info("[load-test] rule regression checks passed");
}

async function run() {
  runRuleRegressionChecks();

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
