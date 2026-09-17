#!/usr/bin/env python3
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "board" / "scripts"))

from drawer_ctl.hash_url import board_web_url, decode_board_hash, encode_board_hash


class HashUrlTest(unittest.TestCase):
    def test_round_trip(self) -> None:
        src = 'board "Hi"\nbox A 405 "Code"\n'
        token = encode_board_hash(src)
        self.assertTrue(token.startswith("z:"))
        self.assertEqual(decode_board_hash(token), src)
        self.assertEqual(decode_board_hash("#" + token), src)

    def test_web_url_uses_fragment(self) -> None:
        url = board_web_url('board "X"\n')
        self.assertTrue(url.startswith("https://luluboard.app/#z:"))
        self.assertNotIn("?", url)

    def test_rejects_plain_text(self) -> None:
        with self.assertRaises(ValueError):
            decode_board_hash("not-a-hash")


if __name__ == "__main__":
    unittest.main()
