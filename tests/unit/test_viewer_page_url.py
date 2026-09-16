#!/usr/bin/env python3
"""preview viewer URLs always carry mode=board."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest import TestCase, main

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "board" / "scripts"))

import drawer_control as dc


class ViewerPageUrlTest(TestCase):
    def test_board_appends_mode(self) -> None:
        self.assertEqual(
            dc.viewer_page_url("http://127.0.0.1:9/drawer.html", "board"),
            "http://127.0.0.1:9/drawer.html?mode=board",
        )


if __name__ == "__main__":
    main()
