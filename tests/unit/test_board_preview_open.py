#!/usr/bin/env python3
"""preview --kind boxes prints the short url and does not write history/."""
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
from drawer_ctl import commands as _commands
from drawer_ctl import paths as _ctl_paths

SHORT = "https://luluboard.app/#p:p_" + ("a" * 64)


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

    def _preview(self, path=None, stdin=None, source_id=None) -> str:
        buf = io.StringIO()
        with (
            patch.object(dc, "open_viewer", return_value="none"),
            patch.object(sys, "stdin", stdin or _Tty()),
            patch("drawer_ctl.hash_url.create_short_url", return_value=SHORT),
            redirect_stdout(buf),
        ):
            dc.preview(path, should_open=False, open_mode="none", kind="boxes", source_id=source_id)
        return buf.getvalue().strip()

    def _history_names(self) -> list[str]:
        root = self.tmp / "history"
        if not root.is_dir():
            return []
        return sorted(p.name for p in root.iterdir() if p.suffix in {".bmd", ".mmd"})

    def test_empty_preview_opens_site_without_write(self) -> None:
        url = self._preview()
        self.assertEqual(url, "https://luluboard.app/")
        self.assertEqual(self._history_names(), [])
        self.assertFalse((_ctl_paths.STATE_DIR / "board.meta.json").is_file())

    def test_leftover_id_is_ignored(self) -> None:
        rec = dc.create_board_record('board "Mine"\n', rev=1, via="cli", label="mine")
        before = rec.read_text(encoding="utf-8")
        names = self._history_names()
        url = self._preview(source_id=dc.ensure_board_history_entry_meta(rec)["id"])
        self.assertEqual(url, "https://luluboard.app/")
        self.assertEqual(rec.read_text(encoding="utf-8"), before)
        self.assertEqual(self._history_names(), names)

    def test_source_does_not_write_history(self) -> None:
        src = self.tmp / "new.bmd"
        src.write_text('board "New"\n', encoding="utf-8")
        url = self._preview(path=str(src))
        self.assertEqual(url, SHORT)
        self.assertEqual(self._history_names(), [])
        self.assertFalse((_ctl_paths.STATE_DIR / "board.meta.json").is_file())

    def test_flowchart_preview_is_short_url_without_history(self) -> None:
        src = self.tmp / "flow.mmd"
        src.write_text('%% meta {"id":"m_51c67540","version":1}\nflowchart TD\n  A-->B\n', encoding="utf-8")
        url = self._preview(path=str(src))
        self.assertEqual(url, SHORT)
        self.assertEqual(self._history_names(), [])
        self.assertEqual(list(self.tmp.rglob("history/*.mmd")), [])

    def test_open_uses_public_short_url(self) -> None:
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
            patch("drawer_ctl.hash_url.create_short_url", return_value=SHORT),
            redirect_stdout(buf),
        ):
            dc.preview(str(src), should_open=True, open_mode="ide", kind="boxes")
        url = buf.getvalue().strip()
        self.assertEqual(url, SHORT)
        self.assertIn((url, "system"), opened)
        self.assertEqual(self._history_names(), [])


if __name__ == "__main__":
    unittest.main()
