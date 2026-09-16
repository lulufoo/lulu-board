#!/usr/bin/env python3
"""preview --kind board reports open=seeded|created|current and skips set-source when empty."""
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
from drawer_ctl import paths as _ctl_paths


class _Tty:
    def isatty(self) -> bool:
        return True

    def read(self) -> str:
        raise AssertionError("TTY stdin must not be read")


class _Pipe:
    def __init__(self, text: str) -> None:
        self._text = text

    def isatty(self) -> bool:
        return False

    def read(self) -> str:
        return self._text


class ResolveBoardPreviewBodyTest(unittest.TestCase):
    def test_tty_is_no_source(self) -> None:
        self.assertIsNone(dc.resolve_board_preview_body(None, stdin=_Tty()))

    def test_blank_pipe_is_no_source(self) -> None:
        self.assertIsNone(dc.resolve_board_preview_body(None, stdin=_Pipe("  \n")))

    def test_pipe_returns_text(self) -> None:
        self.assertEqual(dc.resolve_board_preview_body(None, stdin=_Pipe('board "X"\n')), 'board "X"\n')


class BoardPreviewOpenTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.prev_state = _ctl_paths.STATE_DIR
        _ctl_paths.STATE_DIR = self.tmp

    def tearDown(self) -> None:
        _ctl_paths.STATE_DIR = self.prev_state
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _preview(self, path=None, stdin=None) -> dict:
        buf = io.StringIO()
        with (
            patch.object(dc, "mount", return_value="http://127.0.0.1:9/drawer.html"),
            patch.object(dc, "open_viewer", return_value="none"),
            patch.object(sys, "stdin", stdin or _Tty()),
            redirect_stdout(buf),
        ):
            dc.preview(path, 0, should_open=False, open_mode="none", kind="board")
        return json.loads(buf.getvalue())

    def test_empty_history_no_source_is_seeded(self) -> None:
        data = self._preview()
        self.assertEqual(data["open"], "seeded")
        self.assertIn("mode=board", data["url"])
        self.assertTrue(str(data.get("id") or "").startswith("b_"))
        self.assertIn('board "Lulu Board"', dc.read_board_source_text())
        self.assertEqual(data.get("current"), dc.read_board_meta().get("current"))

    def test_existing_history_no_source_is_current(self) -> None:
        rec = dc.create_board_record('board "Mine"\n', rev=1, via="cli", label="mine")
        meta = dc.read_board_meta()
        meta.update({"current": dc.rel_board_current(rec), "via": "cli", "title": "Mine", "label": "mine"})
        dc.write_board_meta(meta)
        dc.refresh_board_dsl_alias(rec)
        before = dc.read_board_meta().get("current")
        data = self._preview()
        self.assertEqual(data["open"], "current")
        self.assertEqual(data.get("current"), before)
        self.assertIn('board "Mine"', dc.read_board_source_text())
        self.assertTrue(dc.read_board_source_text().lstrip().startswith("meta "))

    def test_source_on_empty_history_is_created(self) -> None:
        src = self.tmp / "new.bmd"
        src.write_text('board "New"\n', encoding="utf-8")
        data = self._preview(path=str(src))
        self.assertEqual(data["open"], "created")
        self.assertIn('board "New"', dc.read_board_source_text())

    def test_with_source_is_created(self) -> None:
        rec = dc.create_board_record('board "Mine"\n', rev=1, via="cli", label="mine")
        meta = dc.read_board_meta()
        meta.update({"current": dc.rel_board_current(rec), "via": "cli", "title": "Mine"})
        dc.write_board_meta(meta)
        src = self.tmp / "new.bmd"
        src.write_text('board "New"\n', encoding="utf-8")
        data = self._preview(path=str(src))
        self.assertEqual(data["open"], "created")
        self.assertNotEqual(Path(data["current"]).name, rec.name)
        self.assertIn('board "New"', dc.read_board_source_text())


if __name__ == "__main__":
    unittest.main()
