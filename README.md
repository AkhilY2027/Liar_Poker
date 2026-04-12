# Liar's Poker Hand Bid Core

This project implements core backend bidding logic for a Liar's Poker-style game based on poker hand rankings.

## Files

- `liars_poker.py`: hand model, comparison logic, bid validation, and CLI simulation
- `test_liars_poker.py`: unit tests for validation, comparison, and parsing

## Run Tests

```bash
python3 -m unittest -v
```

## Run CLI

```bash
python3 liars_poker.py
```

Input format:

```text
<HAND_TYPE> <ranks comma-separated> [suit]
```

Examples:

- `PAIR 13`
- `FULL_HOUSE 10,2`
- `FLUSH 13,11,9 H`
- `STRAIGHT_FLUSH 12 S`

Type `liar` to call liar and end the round.
