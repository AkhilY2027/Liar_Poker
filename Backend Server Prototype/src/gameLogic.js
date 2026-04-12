const { randomUUID } = require("crypto");

const HandType = Object.freeze({
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  STRAIGHT_FLUSH: 8,
});

const SUIT_ORDER = Object.freeze({
  CLUBS: 1,
  DIAMONDS: 2,
  HEARTS: 3,
  SPADES: 4,
});

const VALID_GAME_STATES = new Set(["waiting", "in_progress", "reveal"]);

const HAND_TYPE_NAME_TO_VALUE = Object.freeze({ ...HandType });
const HAND_TYPE_VALUE_TO_NAME = Object.freeze(
  Object.entries(HandType).reduce((acc, [name, value]) => {
    acc[value] = name;
    return acc;
  }, {})
);

function createGame(name, ownerSocketId) {
  const gameId = randomUUID();
  const ownerPlayer = {
    id: ownerSocketId,
    name: sanitizeName(name),
    active: true,
  };

  return {
    id: gameId,
    players: [ownerPlayer],
    currentTurn: null,
    currentBid: null,
    gameState: "waiting",
    reveal: null,
    ownerId: ownerPlayer.id,
  };
}

function sanitizeName(name) {
  const safeName = String(name || "Player").trim();
  return safeName.length ? safeName.slice(0, 32) : "Player";
}

function addPlayer(game, playerId, name) {
  const existing = game.players.find((player) => player.id === playerId);
  if (existing) {
    existing.active = true;
    existing.name = sanitizeName(name || existing.name);
    return existing;
  }

  const player = {
    id: playerId,
    name: sanitizeName(name),
    active: true,
  };
  game.players.push(player);
  return player;
}

function setPlayerInactive(game, playerId) {
  const player = game.players.find((item) => item.id === playerId);
  if (!player) {
    return null;
  }
  player.active = false;
  return player;
}

function getActivePlayers(game) {
  return game.players.filter((player) => player.active);
}

function startGame(game) {
  if (game.gameState !== "waiting") {
    throw new Error("Game has already started");
  }

  const activePlayers = getActivePlayers(game);
  if (activePlayers.length < 2) {
    throw new Error("At least 2 active players are required to start");
  }

  game.gameState = "in_progress";
  game.currentBid = {
    type: "HIGH_CARD",
    primaryRanks: [2],
    suit: null,
  };
  game.currentTurn = activePlayers[0].id;
  game.reveal = null;
}

function advanceTurn(game) {
  const activePlayers = getActivePlayers(game);
  if (!activePlayers.length) {
    game.currentTurn = null;
    return null;
  }

  const currentIndex = activePlayers.findIndex((player) => player.id === game.currentTurn);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % activePlayers.length;
  game.currentTurn = activePlayers[nextIndex].id;
  return game.currentTurn;
}

function getPreviousActivePlayerId(game) {
  const activePlayers = getActivePlayers(game);
  if (!activePlayers.length || !game.currentTurn) {
    return null;
  }

  const turnIndex = activePlayers.findIndex((player) => player.id === game.currentTurn);
  if (turnIndex === -1) {
    return null;
  }

  const previousIndex = (turnIndex - 1 + activePlayers.length) % activePlayers.length;
  return activePlayers[previousIndex].id;
}

function normalizeHand(inputHand) {
  if (!inputHand || typeof inputHand !== "object") {
    throw new Error("Hand payload is required");
  }

  const typeValue = normalizeHandType(inputHand.type);
  const typeName = HAND_TYPE_VALUE_TO_NAME[typeValue];
  const ranks = normalizeRanks(inputHand.primaryRanks);
  const suit = normalizeSuit(inputHand.suit);

  validateHand({ type: typeName, primaryRanks: ranks, suit });

  return {
    type: typeName,
    primaryRanks: [...ranks].sort((a, b) => b - a),
    suit,
  };
}

function normalizeHandType(type) {
  if (typeof type === "number" && HAND_TYPE_VALUE_TO_NAME[type]) {
    return type;
  }

  if (typeof type === "string") {
    const normalized = type.trim().toUpperCase();
    if (HAND_TYPE_NAME_TO_VALUE[normalized]) {
      return HAND_TYPE_NAME_TO_VALUE[normalized];
    }
  }

  throw new Error("Invalid hand type");
}

function normalizeRanks(primaryRanks) {
  if (!Array.isArray(primaryRanks) || primaryRanks.length === 0) {
    throw new Error("primaryRanks must be a non-empty array");
  }

  return primaryRanks.map((rank) => {
    if (!Number.isInteger(rank)) {
      throw new Error("All primaryRanks must be integers");
    }
    return rank;
  });
}

function normalizeSuit(suit) {
  if (suit === undefined || suit === null || suit === "") {
    return null;
  }

  if (typeof suit !== "string") {
    throw new Error("Suit must be a string");
  }

  const normalized = suit.trim().toUpperCase();
  if (!(normalized in SUIT_ORDER)) {
    throw new Error("Suit must be CLUBS, DIAMONDS, HEARTS, or SPADES");
  }

  return normalized;
}

function validateHand(hand) {
  if (!hand || typeof hand !== "object") {
    throw new Error("Hand is required");
  }

  if (!(hand.type in HAND_TYPE_NAME_TO_VALUE)) {
    throw new Error("Unknown hand type");
  }

  if (!Array.isArray(hand.primaryRanks) || hand.primaryRanks.length === 0) {
    throw new Error("primaryRanks must not be empty");
  }

  for (const rank of hand.primaryRanks) {
    if (!Number.isInteger(rank)) {
      throw new Error("All primaryRanks values must be integers");
    }
    if (rank < 2 || rank > 14) {
      throw new Error("Ranks must be in range 2..14");
    }
  }

  if (
    (hand.type === "TWO_PAIR" || hand.type === "FULL_HOUSE") &&
    hand.primaryRanks.length !== 2
  ) {
    throw new Error(`${hand.type} must contain exactly 2 ranks`);
  }

  if (
    (hand.type === "STRAIGHT" || hand.type === "STRAIGHT_FLUSH") &&
    hand.primaryRanks.length !== 1
  ) {
    throw new Error(`${hand.type} must only store highest card (1 rank)`);
  }

  if (hand.type === "FLUSH" && hand.primaryRanks.length < 1) {
    throw new Error("FLUSH must have at least one rank");
  }

  if (hand.suit !== null && hand.suit !== undefined && !(hand.suit in SUIT_ORDER)) {
    throw new Error("Suit must be CLUBS, DIAMONDS, HEARTS, or SPADES");
  }
}

function compareHands(handA, handB, compareSuit = false) {
  const a = normalizeHand(handA);
  const b = normalizeHand(handB);

  const typeA = HAND_TYPE_NAME_TO_VALUE[a.type];
  const typeB = HAND_TYPE_NAME_TO_VALUE[b.type];

  if (typeA !== typeB) {
    return typeA > typeB ? 1 : -1;
  }

  const minLen = Math.min(a.primaryRanks.length, b.primaryRanks.length);
  for (let i = 0; i < minLen; i += 1) {
    if (a.primaryRanks[i] !== b.primaryRanks[i]) {
      return a.primaryRanks[i] > b.primaryRanks[i] ? 1 : -1;
    }
  }

  if (a.primaryRanks.length !== b.primaryRanks.length) {
    return a.primaryRanks.length > b.primaryRanks.length ? 1 : -1;
  }

  if (compareSuit) {
    const suitA = SUIT_ORDER[a.suit] || 0;
    const suitB = SUIT_ORDER[b.suit] || 0;
    if (suitA !== suitB) {
      return suitA > suitB ? 1 : -1;
    }
  }

  return 0;
}

function isValidBid(previousHand, newHand, compareSuit = false) {
  return compareHands(newHand, previousHand, compareSuit) > 0;
}

function isPlayersTurn(game, playerId) {
  return game.currentTurn === playerId;
}

function ensureGameState(gameState) {
  if (!VALID_GAME_STATES.has(gameState)) {
    throw new Error("Invalid game state");
  }
  return gameState;
}

module.exports = {
  HandType,
  SUIT_ORDER,
  createGame,
  addPlayer,
  setPlayerInactive,
  getActivePlayers,
  startGame,
  advanceTurn,
  getPreviousActivePlayerId,
  normalizeHand,
  validateHand,
  compareHands,
  isValidBid,
  isPlayersTurn,
  ensureGameState,
};
