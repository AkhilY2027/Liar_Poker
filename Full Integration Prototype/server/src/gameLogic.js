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

const DEFAULT_GAME_SETTINGS = Object.freeze({
  turnTimeoutSeconds: 60,
  maxCardsToLose: 6,
  autoFoldBehavior: "next_highest",
});

const TIMEOUT_BEHAVIOR_VALUES = new Set(["next_highest", "kick_and_reset_round", "auto_fold"]);

function createGame(id = "main-room", settings = null) {
  const normalizedSettings = normalizeGameSettings(settings, DEFAULT_GAME_SETTINGS);
  return {
    id,
    players: [],
    currentTurn: null,
    currentBid: null,
    currentBidBy: null,
    gameState: "waiting",
    log: [],
    reveal: null,
    pausedReason: null,
    processingAction: false,
    turnDeadlineMs: null,
    roundNumber: 0,
    roundResult: null,
    settings: normalizedSettings,
  };
}

function addOrReconnectPlayer(game, player) {
  const existing = game.players.find((item) => item.id === player.id);
  if (existing) {
    existing.active = true;
    existing.name = sanitizeName(existing.name || player.name);
    if (player.displayName !== undefined) {
      existing.displayName = sanitizeDisplayName(player.displayName, existing.name);
    } else if (!existing.displayName) {
      existing.displayName = existing.name;
    }
    if (!Number.isInteger(existing.cardTarget)) {
      existing.cardTarget = 3;
    }
    if (!Array.isArray(existing.cards)) {
      existing.cards = [];
    }
    return existing;
  }

  const created = {
    id: player.id,
    name: sanitizeName(player.name),
    displayName: sanitizeDisplayName(player.displayName, player.name),
    active: true,
    cardTarget: Number.isInteger(player.cardTarget) ? player.cardTarget : 3,
    cards: [],
  };
  game.players.push(created);
  return created;
}

function updatePlayerDisplayName(game, playerId, displayName) {
  const player = game.players.find((item) => item.id === playerId);
  if (!player) {
    return null;
  }

  player.displayName = sanitizeDisplayName(displayName, player.name);
  return player;
}

function normalizeGameSettings(settings, currentSettings = DEFAULT_GAME_SETTINGS) {
  const source = settings && typeof settings === "object" ? settings : {};
  const base = currentSettings && typeof currentSettings === "object" ? currentSettings : DEFAULT_GAME_SETTINGS;

  const turnTimeoutSeconds = clampInt(source.turnTimeoutSeconds, 20, 120, Number(base.turnTimeoutSeconds || 60), 5);
  const maxCardsToLose = clampInt(source.maxCardsToLose, 6, 8, Number(base.maxCardsToLose || 6));

  const rawAutoFold = typeof source.autoFoldBehavior === "string" ? source.autoFoldBehavior.trim() : "";
  const fallbackBehavior = String(base.autoFoldBehavior || DEFAULT_GAME_SETTINGS.autoFoldBehavior || "next_highest").trim().toLowerCase();
  const normalizedFallback = TIMEOUT_BEHAVIOR_VALUES.has(fallbackBehavior) ? fallbackBehavior : "next_highest";
  const normalizedRequested = rawAutoFold.trim().toLowerCase();
  const autoFoldBehavior = TIMEOUT_BEHAVIOR_VALUES.has(normalizedRequested)
    ? normalizedRequested
    : (normalizedRequested === "none" ? "next_highest" : normalizedFallback);

  return {
    turnTimeoutSeconds,
    maxCardsToLose,
    autoFoldBehavior,
  };
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
    game.currentBidBy = null;
    game.pausedReason = null;
    return false;
  }

  if (game.gameState === "waiting" || game.gameState === "paused") {
    game.gameState = "in_progress";
    game.currentTurn = activePlayers[0].id;
    game.currentBid = null;
    game.currentBidBy = null;
    game.reveal = null;
    game.pausedReason = null;
    dealRoundCards(game);
    appendLog(game, "Game started.");
  }

  return true;
}

function resetRound(game) {
  const activePlayers = getActivePlayers(game);
  game.gameState = activePlayers.length >= 2 ? "in_progress" : "waiting";
  game.currentBid = null;
  game.currentBidBy = null;
  game.currentTurn = activePlayers[0]?.id || null;
  game.reveal = null;
  game.pausedReason = null;
  dealRoundCards(game);
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

  if ((hand.type === "STRAIGHT" || hand.type === "STRAIGHT_FLUSH") && hand.primaryRanks[0] < 4) {
    throw new Error(`${hand.type} must be at least 4-high`);
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

function sanitizeDisplayName(displayName, fallbackName = "Player") {
  const fallback = sanitizeName(fallbackName);
  const cleaned = String(displayName || "").trim();
  return cleaned.length ? cleaned.slice(0, 24) : fallback;
}

function clampInt(value, min, max, fallback, step = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  let next = Math.round(numeric);
  next = Math.max(min, Math.min(max, next));

  if (step > 1) {
    const offset = next - min;
    next = min + Math.round(offset / step) * step;
    next = Math.max(min, Math.min(max, next));
  }

  return next;
}

function dealRoundCards(game) {
  const activePlayers = getActivePlayers(game);
  if (!activePlayers.length) {
    return;
  }

  const deck = buildDeck();
  shuffle(deck);

  for (const player of activePlayers) {
    const count = Math.max(1, Number(player.cardTarget || 3));
    player.cards = deck.splice(0, count);
  }

  game.roundNumber = Number(game.roundNumber || 0) + 1;
}

function buildDeck() {
  const deck = [];
  const suits = Object.keys(SUIT_ORDER);
  for (let rank = 2; rank <= 14; rank += 1) {
    for (const suit of suits) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
}

function isBidAchievableFromActiveHands(game, bid) {
  const cards = getActivePlayers(game).flatMap((player) => player.cards || []);
  if (!cards.length) {
    return false;
  }

  const rankCounts = new Map();
  const suitToRanks = new Map();
  for (const card of cards) {
    rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
    if (!suitToRanks.has(card.suit)) {
      suitToRanks.set(card.suit, []);
    }
    suitToRanks.get(card.suit).push(card.rank);
  }

  const [a, b] = bid.primaryRanks;
  if (bid.type === "HIGH_CARD") {
    return (rankCounts.get(a) || 0) >= 1;
  }
  if (bid.type === "PAIR") {
    return (rankCounts.get(a) || 0) >= 2;
  }
  if (bid.type === "THREE_OF_A_KIND") {
    return (rankCounts.get(a) || 0) >= 3;
  }
  if (bid.type === "TWO_PAIR") {
    return (rankCounts.get(a) || 0) >= 2 && (rankCounts.get(b) || 0) >= 2;
  }
  if (bid.type === "FULL_HOUSE") {
    return (rankCounts.get(a) || 0) >= 3 && (rankCounts.get(b) || 0) >= 2;
  }
  if (bid.type === "STRAIGHT") {
    return hasStraight(cards.map((card) => card.rank), a);
  }
  if (bid.type === "FLUSH") {
    const suited = suitToRanks.get(bid.suit) || [];
    if (suited.length < 5) {
      return false;
    }

    return bid.primaryRanks.every((rank) => suited.includes(rank));
  }
  if (bid.type === "STRAIGHT_FLUSH") {
    const suited = suitToRanks.get(bid.suit) || [];
    return hasStraight(suited, a);
  }

  return false;
}

function findBidHighlightCards(game, bid) {
  const activePlayers = getActivePlayers(game);
  const cards = activePlayers.flatMap((player) => player.cards || []);
  if (!cards.length) {
    return [];
  }

  if (!isBidAchievableFromActiveHands(game, bid)) {
    return [];
  }

  const rankToCards = new Map();
  const suitToCards = new Map();
  for (const card of cards) {
    if (!rankToCards.has(card.rank)) {
      rankToCards.set(card.rank, []);
    }
    rankToCards.get(card.rank).push(card);

    if (!suitToCards.has(card.suit)) {
      suitToCards.set(card.suit, []);
    }
    suitToCards.get(card.suit).push(card);
  }

  const [a, b] = bid.primaryRanks;
  const selected = [];

  if (bid.type === "HIGH_CARD") {
    const bucket = rankToCards.get(a) || [];
    if (bucket.length) {
      selected.push(bucket[0]);
    }
  } else if (bid.type === "PAIR") {
    const bucket = rankToCards.get(a) || [];
    selected.push(...bucket.slice(0, 2));
  } else if (bid.type === "THREE_OF_A_KIND") {
    const bucket = rankToCards.get(a) || [];
    selected.push(...bucket.slice(0, 3));
  } else if (bid.type === "TWO_PAIR") {
    const left = rankToCards.get(a) || [];
    const right = rankToCards.get(b) || [];
    selected.push(...left.slice(0, 2), ...right.slice(0, 2));
  } else if (bid.type === "FULL_HOUSE") {
    const trips = rankToCards.get(a) || [];
    const pair = rankToCards.get(b) || [];
    selected.push(...trips.slice(0, 3), ...pair.slice(0, 2));
  } else if (bid.type === "STRAIGHT") {
    const needed = [a, a - 1, a - 2];
    for (const rank of needed) {
      const bucket = rankToCards.get(rank) || [];
      if (bucket.length) {
        selected.push(bucket[0]);
      }
    }
  } else if (bid.type === "FLUSH") {
    const suited = suitToCards.get(bid.suit) || [];
    const chosen = [];
    for (const rank of bid.primaryRanks) {
      const match = suited.find((card) => card.rank === rank && !chosen.includes(card));
      if (match) {
        chosen.push(match);
      }
    }
    selected.push(...chosen);
  } else if (bid.type === "STRAIGHT_FLUSH") {
    const suited = suitToCards.get(bid.suit) || [];
    const needed = [a, a - 1, a - 2];
    for (const rank of needed) {
      const match = suited.find((card) => card.rank === rank);
      if (match) {
        selected.push(match);
      }
    }
  }

  return selected.map(cardKey);
}

function cardKey(card) {
  if (!card) {
    return "";
  }
  return `${card.rank}-${card.suit}`;
}

function hasStraight(ranks, highRank) {
  const needed = [highRank, highRank - 1, highRank - 2];
  if (needed.some((rank) => rank < 2)) {
    return false;
  }

  const set = new Set(ranks);
  return needed.every((rank) => set.has(rank));
}

module.exports = {
  DEFAULT_GAME_SETTINGS,
  createGame,
  addOrReconnectPlayer,
  updatePlayerDisplayName,
  normalizeGameSettings,
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
  isBidAchievableFromActiveHands,
  findBidHighlightCards,
  cardKey,
};
