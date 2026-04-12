export const HAND_TYPES = [
  "HIGH_CARD",
  "PAIR",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "STRAIGHT_FLUSH",
];

export const SUITS = ["CLUBS", "DIAMONDS", "HEARTS", "SPADES"];

export const HAND_STRENGTH = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  STRAIGHT_FLUSH: 8,
};

const RANK_LABELS = {
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
  11: "Jack",
  12: "Queen",
  13: "King",
  14: "Ace",
};

const TYPE_LABELS = {
  HIGH_CARD: "High Card",
  PAIR: "Pair",
  TWO_PAIR: "Two Pair",
  THREE_OF_A_KIND: "Three of a Kind",
  STRAIGHT: "Straight",
  FLUSH: "Flush",
  FULL_HOUSE: "Full House",
  STRAIGHT_FLUSH: "Straight Flush",
};

export function rankLabel(rank) {
  return RANK_LABELS[Number(rank)] || String(rank || "?");
}

export function handTypeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export function requiredRankMode(type) {
  if (type === "PAIR") {
    return { mode: "fixed", count: 1 };
  }
  if (type === "TWO_PAIR" || type === "FULL_HOUSE") {
    return { mode: "fixed", count: 2 };
  }
  if (type === "STRAIGHT" || type === "STRAIGHT_FLUSH") {
    return { mode: "fixed", count: 1 };
  }
  if (type === "THREE_OF_A_KIND") {
    return { mode: "fixed", count: 1 };
  }
  if (type === "FLUSH") {
    return { mode: "variable", min: 1, max: 5 };
  }
  return { mode: "fixed", count: 1 };
}

export function handNeedsSuit(type) {
  return type === "FLUSH" || type === "STRAIGHT_FLUSH";
}

export function normalizeHandStructure(hand) {
  const cleanRanks = (hand.primaryRanks || [])
    .map((rank) => Number(rank))
    .filter((rank) => Number.isInteger(rank) && rank >= 2 && rank <= 14)
    .sort((a, b) => b - a);

  return {
    type: hand.type,
    primaryRanks: cleanRanks,
    suit: hand.suit || null,
  };
}

export function validateHandStructure(hand) {
  if (!hand || !HAND_TYPES.includes(hand.type)) {
    return { valid: false, message: "Choose a valid hand type." };
  }

  const mode = requiredRankMode(hand.type);
  const ranks = hand.primaryRanks || [];

  if (mode.mode === "fixed" && ranks.length !== mode.count) {
    return {
      valid: false,
      message: `${handTypeLabel(hand.type)} requires exactly ${mode.count} rank input${
        mode.count > 1 ? "s" : ""
      }.`,
    };
  }

  if (mode.mode === "variable") {
    if (ranks.length < mode.min || ranks.length > mode.max) {
      return {
        valid: false,
        message: `${handTypeLabel(hand.type)} requires ${mode.min}-${mode.max} ranks.`,
      };
    }
  }

  if (ranks.some((rank) => !Number.isInteger(rank) || rank < 2 || rank > 14)) {
    return { valid: false, message: "All ranks must be integers between 2 and 14." };
  }

  if (ranks.length > 1 && new Set(ranks).size !== ranks.length) {
    return { valid: false, message: "Ranks must be unique for multi-rank bids." };
  }

  if (handNeedsSuit(hand.type) && !SUITS.includes(hand.suit)) {
    return { valid: false, message: "Select a suit for flush-based bids." };
  }

  if (!handNeedsSuit(hand.type) && hand.suit) {
    return { valid: false, message: "Suit is only allowed for flush and straight flush." };
  }

  return { valid: true, message: "Ready to submit." };
}

export function formatHandHuman(hand) {
  if (!hand) {
    return "No bid yet";
  }

  const ranks = hand.primaryRanks || [];
  const suit = (hand.suit || "").toLowerCase();

  if (hand.type === "PAIR") {
    return `Pair of ${rankLabel(ranks[0]).toLowerCase()}s`;
  }

  if (hand.type === "TWO_PAIR") {
    return `Two pair: ${rankLabel(ranks[0])} and ${rankLabel(ranks[1])}`;
  }

  if (hand.type === "FULL_HOUSE") {
    return `Full house: ${rankLabel(ranks[0])} over ${rankLabel(ranks[1])}`;
  }

  if (hand.type === "FLUSH") {
    const highs = ranks.slice(0, 2).map((rank) => rankLabel(rank)).join("-");
    return `${highs || rankLabel(ranks[0])} high ${suit}`;
  }

  if (hand.type === "STRAIGHT") {
    return `${rankLabel(ranks[0])}-high straight`;
  }

  if (hand.type === "STRAIGHT_FLUSH") {
    return `${rankLabel(ranks[0])}-high straight flush in ${suit}`;
  }

  if (hand.type === "THREE_OF_A_KIND") {
    return `Three of a kind: ${rankLabel(ranks[0])}`;
  }

  return `${rankLabel(ranks[0])}-high`;
}

export function compareHandsSimple(a, b) {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return -1;
  }
  if (!b) {
    return 1;
  }

  if (a.type !== b.type) {
    return HAND_STRENGTH[a.type] > HAND_STRENGTH[b.type] ? 1 : -1;
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

  return 0;
}
