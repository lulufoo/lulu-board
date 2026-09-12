#!/usr/bin/env python3
"""Empty history/mermaid is seeded from skill/assets/templates/mermaid packed examples."""
from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "scripts"))

import drawer_control as dc
from drawer_ctl import paths as _ctl_paths
from drawer_ctl import mermaid as mermaid_mod


class MermaidTemplateSeedTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.prev_state = _ctl_paths.STATE_DIR
        _ctl_paths.STATE_DIR = self.tmp

    def tearDown(self) -> None:
        _ctl_paths.STATE_DIR = self.prev_state
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_empty_history_gets_packed_examples(self) -> None:
        dest = mermaid_mod.seed_default_mermaid_if_empty()
        self.assertIsNotNone(dest)
        self.assertTrue(dest.is_file())
        text = dest.read_text(encoding="utf-8")
        self.assertIn("stateDiagram", text)
        meta = mermaid_mod.read_meta_raw()
        self.assertEqual(meta.get("via"), "template")
        self.assertEqual(meta.get("label"), "checkout")
        names = sorted(p.name for p in _ctl_paths.history_dir().glob("*.mmd"))
        self.assertGreaterEqual(len(names), 2)

    def test_existing_record_not_replaced(self) -> None:
        _ctl_paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
        rec = mermaid_mod.create_mermaid_record("flowchart TD\n  A-->B\n", rev=1, via="cli", label="mine")
        again = mermaid_mod.seed_default_mermaid_if_empty()
        self.assertIsNone(again)
        names = list(_ctl_paths.history_dir().glob("*.mmd"))
        self.assertEqual(len(names), 1)


if __name__ == "__main__":
    unittest.main()
