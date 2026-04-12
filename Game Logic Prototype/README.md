# Game Logic Prototype

Python prototype for Liar's Poker hand modeling, parsing, comparison, and bid validation.

## Files

- liars_poker.py: hand model, comparison logic, input parsing, and CLI simulation
- test_liars_poker.py: unit tests for validation, comparison, and parsing

## Run Tests

```bash
python3 test_liars_poker.py
```

## Run CLI

```bash
python3 liars_poker.py
```

## Input Format

```text
<HAND_TYPE> <ranks comma-separated> [suit]
```

Examples:

- PAIR J
- FULL_HOUSE K,10
- FLUSH A,J,9 HEARTS
- STRAIGHT_FLUSH Q SPADES

Type liar to call liar and end the round.
