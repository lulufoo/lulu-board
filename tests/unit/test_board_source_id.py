#!/usr/bin/env python3
"""CLI no longer owns document identity or local history writes."""
from __future__ import annotations

import io
import json
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "board" / "scripts"))

import drawer_control as dc
from drawer_ctl import hash_url
from drawer_ctl import paths as _ctl_paths


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

    def _preview(self, path=None, source_id=None) -> dict:
        buf = io.StringIO()
        with (
            patch.object(dc, "open_viewer", return_value="none"),
            patch.object(sys, "stdin", _Tty()),
            redirect_stdout(buf),
        ):
            dc.preview(path, should_open=False, open_mode="none", kind="board", source_id=source_id)
        return json.loads(buf.getvalue())

    def test_get_source_is_retired(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "retired"):
            dc.get_source(kind="board")
        with self.assertRaisesRegex(RuntimeError, "retired"):
            dc.get_source(kind="board", source_id="b_deadbeef")

    def test_set_source_is_retired(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "retired"):
            dc.set_source(None, kind="board", source_id="b_deadbeef")

    def test_preview_encodes_body_without_id(self) -> None:
        src = self.tmp / "new.bmd"
        src.write_text('board "New"\n', encoding="utf-8")
        data = self._preview(path=str(src), source_id="b_deadbeef")
        self.assertEqual(data["open"], "created")
        self.assertEqual(data["id"], "")
        self.assertEqual(data["version"], 1)
        decoded = hash_url.decode_board_hash(data["url"].split("#", 1)[1])
        self.assertEqual(decoded, {"bmd": 'board "New"\n', "version": 1})


if __name__ == "__main__":
    unittest.main()
