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
  return RANK_LABELS[Number(rank)] || String(rank);
}

export function handTypeLabel(type) {
  return TYPE_LABELS[type] || type;
}

export function requiredRankSpec(type) {
  if (type === "PAIR" || type === "THREE_OF_A_KIND" || type === "STRAIGHT" || type === "STRAIGHT_FLUSH") {
    return { mode: "fixed", count: 1 };
  }
  if (type === "TWO_PAIR" || type === "FULL_HOUSE") {
    return { mode: "fixed", count: 2 };
  }
  if (type === "FLUSH") {
    return { mode: "variable", min: 1, max: 5 };
  }
  return { mode: "fixed", count: 1 };
}

export function needsSuit(type) {
  return type === "FLUSH" || type === "STRAIGHT_FLUSH";
}

export function formatHand(hand) {
  if (!hand) {
    return "No bid yet";
  }

  const ranks = hand.primaryRanks || [];
  const suit = hand.suit ? hand.suit.toLowerCase() : "";

  if (hand.type === "PAIR") {
    return `Pair of ${rankLabel(ranks[0]).toLowerCase()}s`;
  }
  if (hand.type === "TWO_PAIR") {
    return `Two pair ${rankLabel(ranks[0])} and ${rankLabel(ranks[1])}`;
  }
  if (hand.type === "FULL_HOUSE") {
    return `Full house ${rankLabel(ranks[0])} over ${rankLabel(ranks[1])}`;
  }
  if (hand.type === "STRAIGHT") {
    return `${rankLabel(ranks[0])}-high straight`;
  }
  if (hand.type === "FLUSH") {
    const top = ranks.slice(0, 2).map(rankLabel).join("-");
    return `${top} high ${suit}`;
  }
  if (hand.type === "STRAIGHT_FLUSH") {
    return `${rankLabel(ranks[0])}-high straight flush in ${suit}`;
  }
  return `${handTypeLabel(hand.type)} ${ranks.map(rankLabel).join(",")}`;
}
