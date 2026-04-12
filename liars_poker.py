from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import Optional, Sequence


class HandType(IntEnum):
    HIGH_CARD = 1
    PAIR = 2
    TWO_PAIR = 3
    THREE_OF_A_KIND = 4
    STRAIGHT = 5
    FLUSH = 6
    FULL_HOUSE = 7
    STRAIGHT_FLUSH = 8


SUIT_ORDER = {
    "C": 1,
    "D": 2,
    "H": 3,
    "S": 4,
}


@dataclass(frozen=True)
class Hand:
    """Represents a bid hand in a Liar's Poker-style game.

    primary_ranks are always stored in descending order.
    """

    type: HandType
    primary_ranks: tuple[int, ...]
    suit: Optional[str] = None

    def __post_init__(self) -> None:
        normalized = tuple(self.primary_ranks)
        _validate_hand(self.type, normalized, self.suit)
        sorted_desc = tuple(sorted(normalized, reverse=True))
        object.__setattr__(self, "primary_ranks", sorted_desc)


def _validate_hand(hand_type: HandType, primary_ranks: Sequence[int], suit: Optional[str]) -> None:
    if not primary_ranks:
        raise ValueError("primary_ranks must not be empty")

    for rank in primary_ranks:
        if not isinstance(rank, int):
            raise TypeError("all primary_ranks values must be integers")
        if rank < 2 or rank > 14:
            raise ValueError("ranks must be in range 2..14")

    if hand_type in (HandType.TWO_PAIR, HandType.FULL_HOUSE) and len(primary_ranks) != 2:
        raise ValueError(f"{hand_type.name} must contain exactly 2 ranks")

    if hand_type in (HandType.STRAIGHT, HandType.STRAIGHT_FLUSH) and len(primary_ranks) != 1:
        raise ValueError(f"{hand_type.name} must only store highest card (1 rank)")

    if hand_type is HandType.FLUSH and len(primary_ranks) < 1:
        raise ValueError("FLUSH must have at least one rank")

    if suit is not None:
        if not isinstance(suit, str):
            raise TypeError("suit must be a string if provided")
        normalized_suit = suit.upper()
        if normalized_suit not in SUIT_ORDER:
            raise ValueError("suit must be one of C, D, H, S")


def compare_hands(a: Hand, b: Hand, compare_suit: bool = False) -> int:
    """Compare two hands.

    Returns:
        1 if a > b
        -1 if a < b
        0 if equal
    """

    if a.type != b.type:
        return 1 if a.type > b.type else -1

    min_len = min(len(a.primary_ranks), len(b.primary_ranks))
    for i in range(min_len):
        if a.primary_ranks[i] != b.primary_ranks[i]:
            return 1 if a.primary_ranks[i] > b.primary_ranks[i] else -1

    if len(a.primary_ranks) != len(b.primary_ranks):
        return 1 if len(a.primary_ranks) > len(b.primary_ranks) else -1

    if compare_suit:
        a_suit = SUIT_ORDER.get((a.suit or "").upper(), 0)
        b_suit = SUIT_ORDER.get((b.suit or "").upper(), 0)
        if a_suit != b_suit:
            return 1 if a_suit > b_suit else -1

    return 0


def is_valid_bid(previous_hand: Hand, new_hand: Hand, compare_suit: bool = False) -> bool:
    return compare_hands(new_hand, previous_hand, compare_suit=compare_suit) > 0


def parse_hand_type(value: str) -> HandType:
    normalized = value.strip().upper()
    aliases = {
        "HC": HandType.HIGH_CARD,
        "P": HandType.PAIR,
        "TP": HandType.TWO_PAIR,
        "TOK": HandType.THREE_OF_A_KIND,
        "S": HandType.STRAIGHT,
        "F": HandType.FLUSH,
        "FH": HandType.FULL_HOUSE,
        "SF": HandType.STRAIGHT_FLUSH,
    }

    if normalized in aliases:
        return aliases[normalized]

    try:
        return HandType[normalized]
    except KeyError as exc:
        valid = ", ".join([member.name for member in HandType])
        raise ValueError(f"Invalid hand type '{value}'. Expected one of: {valid}") from exc


def parse_hand_input(raw: str) -> Hand:
    """Parse user input like:

    PAIR 13
    FULL_HOUSE 10,2
    FLUSH 13,11,9 H
    STRAIGHT_FLUSH 12 S
    """

    parts = raw.strip().split()
    if len(parts) < 2:
        raise ValueError("Input must be: <HAND_TYPE> <ranks> [suit]")

    hand_type = parse_hand_type(parts[0])

    rank_tokens = [token for token in parts[1].replace(",", " ").split() if token]
    if not rank_tokens:
        raise ValueError("At least one rank is required")

    try:
        ranks = tuple(int(token) for token in rank_tokens)
    except ValueError as exc:
        raise ValueError("Ranks must be integers") from exc

    suit = parts[2] if len(parts) >= 3 else None

    return Hand(type=hand_type, primary_ranks=ranks, suit=suit)


def format_hand(hand: Hand) -> str:
    ranks = ",".join(str(r) for r in hand.primary_ranks)
    if hand.suit:
        return f"{hand.type.name} [{ranks}] {hand.suit.upper()}"
    return f"{hand.type.name} [{ranks}]"


def run_cli() -> None:
    players = ["Player 1", "Player 2"]
    current_bid = Hand(HandType.HIGH_CARD, (2,))
    turn = 0

    print("Liar's Poker Bid Simulation")
    print("Enter bids as: <HAND_TYPE> <ranks comma-separated> [suit]")
    print("Examples: PAIR 13 | FULL_HOUSE 10,2 | FLUSH 13,11 H")
    print("Type 'liar' to call liar on the previous bid.")

    while True:
        player = players[turn % 2]
        print(f"\nCurrent bid: {format_hand(current_bid)}")
        user_input = input(f"{player}, enter a higher bid or 'liar': ").strip()

        if user_input.lower() == "liar":
            prev_player = players[(turn - 1) % 2]
            print(f"{player} calls LIAR on {prev_player}'s bid: {format_hand(current_bid)}")
            print("Round ends. (Winner resolution is out of scope.)")
            return

        try:
            new_bid = parse_hand_input(user_input)
        except Exception as exc:  # user-facing CLI
            print(f"Invalid input: {exc}")
            continue

        if not is_valid_bid(current_bid, new_bid):
            print("Bid rejected: new bid must be strictly higher than current bid.")
            continue

        current_bid = new_bid
        turn += 1


if __name__ == "__main__":
    run_cli()
