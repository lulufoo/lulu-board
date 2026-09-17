#!/usr/bin/env python3
"""preview --kind board reports open=created|current and does not write history/."""
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
from drawer_ctl import commands as _commands
from drawer_ctl import hash_url
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

    def _preview(self, path=None, stdin=None, source_id=None) -> dict:
        buf = io.StringIO()
        with (
            patch.object(dc, "open_viewer", return_value="none"),
            patch.object(sys, "stdin", stdin or _Tty()),
            redirect_stdout(buf),
        ):
            dc.preview(path, should_open=False, open_mode="none", kind="board", source_id=source_id)
        return json.loads(buf.getvalue())

    def _history_names(self) -> list[str]:
        root = self.tmp / "history"
        if not root.is_dir():
            return []
        return sorted(p.name for p in root.glob("*.bmd"))

    def test_empty_preview_opens_site_without_write(self) -> None:
        data = self._preview()
        self.assertEqual(data["open"], "current")
        self.assertEqual(data.get("url"), "https://luluboard.app/")
        self.assertEqual(data.get("url"), data.get("web_url"))
        self.assertEqual(data.get("id"), "")
        self.assertNotIn("local_url", data)
        self.assertEqual(self._history_names(), [])
        self.assertFalse((_ctl_paths.STATE_DIR / "board.meta.json").is_file())

    def test_leftover_id_is_read_not_rewritten(self) -> None:
        rec = dc.create_board_record('board "Mine"\n', rev=1, via="cli", label="mine")
        before = rec.read_text(encoding="utf-8")
        names = self._history_names()
        data = self._preview(source_id=dc.ensure_board_history_entry_meta(rec)["id"])
        self.assertEqual(data["open"], "current")
        self.assertTrue(str(data.get("url") or "").startswith("https://luluboard.app/#z:"))
        self.assertIn('board "Mine"', hash_url.decode_board_hash(data["url"].split("#", 1)[1]))
        self.assertEqual(rec.read_text(encoding="utf-8"), before)
        self.assertEqual(self._history_names(), names)

    def test_source_does_not_write_history(self) -> None:
        src = self.tmp / "new.bmd"
        src.write_text('board "New"\n', encoding="utf-8")
        data = self._preview(path=str(src))
        self.assertEqual(data["open"], "created")
        self.assertTrue(str(data.get("id") or "").startswith("b_"))
        self.assertTrue(str(data.get("url") or "").startswith("https://luluboard.app/#z:"))
        self.assertEqual(self._history_names(), [])
        self.assertFalse((_ctl_paths.STATE_DIR / "board.meta.json").is_file())

    def test_open_uses_public_hash_url(self) -> None:
        src = self.tmp / "new.bmd"
        src.write_text('board "New"\n', encoding="utf-8")
        opened = []

        def _open(url, mode="ide"):
            opened.append((url, mode))
            return "system"

        buf = io.StringIO()
        with (
            patch.object(_commands, "open_viewer", side_effect=_open),
            patch.object(sys, "stdin", _Tty()),
            redirect_stdout(buf),
        ):
            dc.preview(str(src), should_open=True, open_mode="ide", kind="board")
        data = json.loads(buf.getvalue())
        self.assertIn((data["url"], "system"), opened)
        self.assertTrue(data["url"].startswith("https://luluboard.app/#z:"))
        self.assertEqual(self._history_names(), [])


if __name__ == "__main__":
    unittest.main()
