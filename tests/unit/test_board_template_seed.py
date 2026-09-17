#!/usr/bin/env python3
"""Empty history/ no longer seeds packed examples from skill/board/templates/board."""
from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path
import sys



sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "board" / "scripts"))

import drawer_control as dc
from drawer_ctl import paths as _ctl_paths


class BoardTemplateSeedTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.prev_state = _ctl_paths.STATE_DIR
        _ctl_paths.STATE_DIR = self.tmp

    def tearDown(self) -> None:
        _ctl_paths.STATE_DIR = self.prev_state
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_empty_history_does_not_seed_packed_examples(self) -> None:
        dest = dc.seed_default_board_if_empty()
        self.assertIsNone(dest)
        self.assertEqual(list(dc.board_history_dir().glob("*.bmd")), [])

    def test_existing_record_not_replaced(self) -> None:
        _ctl_paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
        rec = dc.create_board_record('board "Mine"\n', rev=1, via="cli", label="mine")
        again = dc.seed_default_board_if_empty()
        self.assertIsNone(again)
        self.assertIn('board "Mine"', rec.read_text(encoding="utf-8"))
        self.assertTrue(rec.read_text(encoding="utf-8").lstrip().startswith("meta "))
        names = [p.name for p in dc.board_history_dir().glob("*.bmd")]
        self.assertEqual(len(names), 1)

    def test_live_regular_file_blocks_seed(self) -> None:
        _ctl_paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
        dc.board_source_path().write_text('board "Live"\n', encoding="utf-8")
        self.assertIsNone(dc.seed_default_board_if_empty())
        self.assertEqual(list(dc.board_history_dir().glob("*.bmd")), [])


if __name__ == "__main__":
    unittest.main()
