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

const HAND_STRENGTH = Object.freeze({ ...HandType });
const SUIT_ORDER = Object.freeze({
  CLUBS: 1,
  DIAMONDS: 2,
  HEARTS: 3,
  SPADES: 4,
});

function createGame(id = "main-room") {
  return {
    id,
    players: [],
    currentTurn: null,
    currentBid: null,
    gameState: "waiting",
    log: [],
    reveal: null,
    pausedReason: null,
    processingAction: false,
    turnDeadlineMs: null,
  };
}

function addOrReconnectPlayer(game, player) {
  const existing = game.players.find((item) => item.id === player.id);
  if (existing) {
    existing.active = true;
    existing.name = sanitizeName(player.name || existing.name);
    return existing;
  }

  const created = {
    id: player.id,
    name: sanitizeName(player.name),
    active: true,
  };
  game.players.push(created);
  return created;
}

function markPlayerInactive(game, playerId) {
  const player = game.players.find((item) => item.id === playerId);
  if (!player) {
    return;
  }
  player.active = false;
}

function removePlayer(game, playerId) {
  game.players = game.players.filter((player) => player.id !== playerId);
}

function getActivePlayers(game) {
  return game.players.filter((player) => player.active);
}

function startGameIfReady(game) {
  const activePlayers = getActivePlayers(game);
  if (activePlayers.length < 2) {
    game.gameState = "waiting";
    game.currentTurn = activePlayers[0]?.id || null;
    game.currentBid = null;
    game.pausedReason = null;
    return false;
  }

  if (game.gameState === "waiting" || game.gameState === "paused") {
    game.gameState = "in_progress";
    game.currentTurn = activePlayers[0].id;
    game.currentBid = null;
    game.reveal = null;
    game.pausedReason = null;
    appendLog(game, "Game started.");
  }

  return true;
}

function resetRound(game) {
  const activePlayers = getActivePlayers(game);
  game.gameState = activePlayers.length >= 2 ? "in_progress" : "waiting";
  game.currentBid = null;
  game.currentTurn = activePlayers[0]?.id || null;
  game.reveal = null;
  game.pausedReason = null;
}

function pauseGame(game, reason) {
  game.gameState = "paused";
  game.pausedReason = reason || "Paused";
}

function appendLog(game, message) {
  game.log = [{ id: `${Date.now()}-${Math.random()}`, message }, ...game.log].slice(0, 60);
}

function isPlayersTurn(game, playerId) {
  return game.currentTurn === playerId;
}

function advanceTurn(game) {
  const activePlayers = getActivePlayers(game);
  if (!activePlayers.length) {
    game.currentTurn = null;
    return;
  }

  const index = activePlayers.findIndex((player) => player.id === game.currentTurn);
  const nextIndex = index === -1 ? 0 : (index + 1) % activePlayers.length;
  game.currentTurn = activePlayers[nextIndex].id;
}

function getPreviousPlayer(game) {
  const activePlayers = getActivePlayers(game);
  if (!activePlayers.length || !game.currentTurn) {
    return null;
  }
  const index = activePlayers.findIndex((player) => player.id === game.currentTurn);
  if (index === -1) {
    return null;
  }
  return activePlayers[(index - 1 + activePlayers.length) % activePlayers.length];
}

function normalizeHand(hand) {
  if (!hand || typeof hand !== "object") {
    throw new Error("Hand payload is required");
  }

  const type = normalizeType(hand.type);
  const primaryRanks = normalizeRanks(hand.primaryRanks);
  const suit = normalizeSuit(hand.suit);

  validateHand({ type, primaryRanks, suit });

  return {
    type,
    primaryRanks: [...primaryRanks].sort((a, b) => b - a),
    suit,
  };
}

function normalizeType(type) {
  if (typeof type === "string") {
    const normalized = type.trim().toUpperCase();
    if (HAND_STRENGTH[normalized]) {
      return normalized;
    }
  }

  if (typeof type === "number") {
    const fromValue = Object.entries(HAND_STRENGTH).find(([, value]) => value === type);
    if (fromValue) {
      return fromValue[0];
    }
  }

  throw new Error("Invalid hand type");
}

function normalizeRanks(ranks) {
  if (!Array.isArray(ranks) || !ranks.length) {
    throw new Error("primaryRanks must be a non-empty array");
  }

  if (ranks.length > 5) {
    throw new Error("primaryRanks must contain at most 5 ranks");
  }

  return ranks.map((rank) => {
    const value = Number(rank);
    if (!Number.isInteger(value)) {
      throw new Error("Ranks must be integers");
    }
    return value;
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
  if (!SUIT_ORDER[normalized]) {
    throw new Error("Suit must be CLUBS, DIAMONDS, HEARTS, or SPADES");
  }
  return normalized;
}

function validateHand(hand) {
  if (!HAND_STRENGTH[hand.type]) {
    throw new Error("Invalid hand type");
  }

  for (const rank of hand.primaryRanks) {
    if (rank < 2 || rank > 14) {
      throw new Error("Ranks must be in range 2..14");
    }
  }

  if ((hand.type === "TWO_PAIR" || hand.type === "FULL_HOUSE") && hand.primaryRanks.length !== 2) {
    throw new Error(`${hand.type} requires exactly 2 ranks`);
  }

  if ((hand.type === "TWO_PAIR" || hand.type === "FULL_HOUSE") && hand.primaryRanks[0] === hand.primaryRanks[1]) {
    throw new Error(`${hand.type} requires two distinct ranks`);
  }

  if ((hand.type === "STRAIGHT" || hand.type === "STRAIGHT_FLUSH") && hand.primaryRanks.length !== 1) {
    throw new Error(`${hand.type} requires exactly 1 rank`);
  }

  if (hand.type === "PAIR" && hand.primaryRanks.length !== 1) {
    throw new Error("PAIR requires exactly 1 rank");
  }

  if ((hand.type === "FLUSH" || hand.type === "STRAIGHT_FLUSH") && !hand.suit) {
    throw new Error("Flush-based bids require a suit");
  }

  if (!(hand.type === "FLUSH" || hand.type === "STRAIGHT_FLUSH") && hand.suit) {
    throw new Error("Suit is only valid for flush-based bids");
  }
}

function compareHands(a, b, compareSuit = false) {
  const typeA = HAND_STRENGTH[a.type];
  const typeB = HAND_STRENGTH[b.type];

  if (typeA !== typeB) {
    return typeA > typeB ? 1 : -1;
  }

  const len = Math.min(a.primaryRanks.length, b.primaryRanks.length);
  for (let i = 0; i < len; i += 1) {
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

function isValidBid(previous, next, compareSuit = false) {
  if (!previous) {
    return true;
  }
  return compareHands(next, previous, compareSuit) > 0;
}

function sanitizeName(name) {
  const cleaned = String(name || "Player").trim();
  return cleaned.length ? cleaned.slice(0, 24) : "Player";
}

module.exports = {
  createGame,
  addOrReconnectPlayer,
  markPlayerInactive,
  removePlayer,
  getActivePlayers,
  startGameIfReady,
  resetRound,
  pauseGame,
  appendLog,
  isPlayersTurn,
  advanceTurn,
  getPreviousPlayer,
  normalizeHand,
  compareHands,
  isValidBid,
};
