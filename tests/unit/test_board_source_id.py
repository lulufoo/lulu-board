#!/usr/bin/env python3
"""CLI no longer owns document identity or local history writes."""
from __future__ import annotations

import io
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "boxes" / "scripts"))

import drawer_control as dc
from drawer_ctl import paths as _ctl_paths

SHORT = "https://luluboard.app/#p:p_" + ("c" * 64)


class _Tty:
    def isatty(self) -> bool:
        return True

    def read(self) -> str:
        raise AssertionError("TTY stdin must not be read")


class BoardSourceIdTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.prev_state = _ctl_paths.STATE_DIR
        _ctl_paths.STATE_DIR = self.tmp

    def tearDown(self) -> None:
        _ctl_paths.STATE_DIR = self.prev_state
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _preview(self, path=None, source_id=None) -> str:
        buf = io.StringIO()
        with (
            patch.object(dc, "open_viewer", return_value="none"),
            patch.object(sys, "stdin", _Tty()),
            patch("drawer_ctl.hash_url.create_short_url", return_value=SHORT),
            redirect_stdout(buf),
        ):
            dc.preview(path, should_open=False, open_mode="none", kind="boxes", source_id=source_id)
        return buf.getvalue().strip()

    def test_get_source_is_retired(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "retired"):
            dc.get_source(kind="boxes")
        with self.assertRaisesRegex(RuntimeError, "retired"):
            dc.get_source(kind="boxes", source_id="b_deadbeef")

    def test_set_source_is_retired(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "retired"):
            dc.set_source(None, kind="boxes", source_id="b_deadbeef")

    def test_preview_prints_returned_url(self) -> None:
        src = self.tmp / "new.bmd"
        src.write_text('board "New"\n', encoding="utf-8")
        self.assertEqual(self._preview(path=str(src), source_id="b_deadbeef"), SHORT)


if __name__ == "__main__":
    unittest.main()
