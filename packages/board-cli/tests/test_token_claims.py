"""token_claims.has_expired and its margin."""
from __future__ import annotations

import unittest
from unittest.mock import patch

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.token_claims import has_expired

NOW = 1_800_000_000


class HasExpiredTest(unittest.TestCase):
    def check(self, claims: dict, margin: float = 0) -> bool:
        with patch("board_cli.token_claims.time.time", return_value=NOW):
            return has_expired(claims, margin)

    def test_a_past_expiry_is_expired(self) -> None:
        self.assertTrue(self.check({"exp": NOW - 1}))

    def test_an_expiry_exactly_now_is_expired(self) -> None:
        self.assertTrue(self.check({"exp": NOW}))

    def test_a_future_expiry_is_live_without_a_margin(self) -> None:
        self.assertFalse(self.check({"exp": NOW + 1}))

    def test_an_expiry_inside_the_margin_counts_as_expired(self) -> None:
        self.assertTrue(self.check({"exp": NOW + 30}, 60))
        self.assertTrue(self.check({"exp": NOW + 60}, 60))

    def test_an_expiry_beyond_the_margin_is_live(self) -> None:
        self.assertFalse(self.check({"exp": NOW + 61}, 60))

    def test_a_float_expiry_works(self) -> None:
        self.assertTrue(self.check({"exp": NOW + 0.5}, 1))
        self.assertFalse(self.check({"exp": NOW + 1.5}, 1))

    def test_a_missing_or_unreadable_expiry_counts_as_live_even_with_a_margin(self) -> None:
        for claims in ({}, {"exp": None}, {"exp": "1"}, {"exp": True}, {"exp": [1]}):
            self.assertFalse(self.check(claims, 60), claims)


if __name__ == "__main__":
    unittest.main()
