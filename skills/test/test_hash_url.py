#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

_skills = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_skills / "boxes" / "scripts"))
sys.path.insert(0, str(_skills / "scripts"))

from drawer_ctl.hash_url import board_web_url
from short_link import create_short_url


class ShortLinkUrlTest(unittest.TestCase):
    def test_empty_source_is_origin(self) -> None:
        self.assertEqual(board_web_url("  \n"), "https://luluboard.app/")

    def test_source_uses_returned_url(self) -> None:
        url = "https://luluboard.app/#p:p_" + ("a" * 64)
        with patch("drawer_ctl.hash_url.create_short_url", return_value=url) as create:
            self.assertEqual(board_web_url('board "X"\n'), url)
            create.assert_called_once_with('board "X"\n')

    def test_stub_env_skips_rpc(self) -> None:
        url = "https://luluboard.app/#p:p_" + ("b" * 64)
        with patch.dict(os.environ, {"LULU_BOARD_SHORT_LINK_STUB": url}):
            self.assertEqual(create_short_url("ignored"), url)

    def test_live_create_returns_short_url(self) -> None:
        url = create_short_url('boxes "LB-418"\n')
        self.assertRegex(url, r"^https://luluboard\.app/#p:p_[0-9a-f]{64}$")
        self.assertLess(len(url), 120)
        self.assertNotIn("#z:", url)


if __name__ == "__main__":
    unittest.main()
