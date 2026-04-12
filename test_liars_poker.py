import unittest

from liars_poker import Hand, HandType, compare_hands, is_valid_bid, parse_hand_input


class HandValidationTests(unittest.TestCase):
    def test_primary_ranks_are_sorted_descending(self):
        hand = Hand(HandType.PAIR, (7, 13, 9))
        self.assertEqual(hand.primary_ranks, (13, 9, 7))

    def test_two_pair_requires_exactly_two_ranks(self):
        with self.assertRaises(ValueError):
            Hand(HandType.TWO_PAIR, (10,))

    def test_full_house_requires_exactly_two_ranks(self):
        with self.assertRaises(ValueError):
            Hand(HandType.FULL_HOUSE, (12, 5, 2))

    def test_straight_requires_only_one_rank(self):
        with self.assertRaises(ValueError):
            Hand(HandType.STRAIGHT, (14, 13))

    def test_straight_flush_requires_only_one_rank(self):
        with self.assertRaises(ValueError):
            Hand(HandType.STRAIGHT_FLUSH, (10, 9))


class CompareHandsTests(unittest.TestCase):
    def test_higher_type_wins(self):
        a = Hand(HandType.FLUSH, (13,))
        b = Hand(HandType.STRAIGHT, (14,))
        self.assertEqual(compare_hands(a, b), 1)

    def test_lexicographic_primary_rank_compare(self):
        a = Hand(HandType.PAIR, (13,))
        b = Hand(HandType.PAIR, (12,))
        self.assertEqual(compare_hands(a, b), 1)

    def test_longer_primary_ranks_win_when_prefix_equal(self):
        a = Hand(HandType.FLUSH, (13, 11))
        b = Hand(HandType.FLUSH, (13,))
        self.assertEqual(compare_hands(a, b), 1)

    def test_optional_suit_comparison(self):
        a = Hand(HandType.FLUSH, (13,), "SPADES")
        b = Hand(HandType.FLUSH, (13,), "HEARTS")
        self.assertEqual(compare_hands(a, b, compare_suit=True), 1)

    def test_equal_hands(self):
        a = Hand(HandType.HIGH_CARD, (9,))
        b = Hand(HandType.HIGH_CARD, (9,))
        self.assertEqual(compare_hands(a, b), 0)


class BidValidationTests(unittest.TestCase):
    def test_new_bid_must_be_strictly_higher(self):
        prev = Hand(HandType.PAIR, (10,))
        same = Hand(HandType.PAIR, (10,))
        higher = Hand(HandType.PAIR, (11,))

        self.assertFalse(is_valid_bid(prev, same))
        self.assertTrue(is_valid_bid(prev, higher))

    def test_parse_hand_input(self):
        hand = parse_hand_input("FLUSH A,J,9 HEARTS")
        self.assertEqual(hand.type, HandType.FLUSH)
        self.assertEqual(hand.primary_ranks, (14, 11, 9))
        self.assertEqual(hand.suit, "HEARTS")

    def test_parse_face_card_pair(self):
        hand = parse_hand_input("PAIR J")
        self.assertEqual(hand.primary_ranks, (11,))


if __name__ == "__main__":
    unittest.main()
