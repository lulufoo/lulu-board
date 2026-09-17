#!/usr/bin/env python3
"""Board CLI reads and writes a stable record id, not the current pointer."""
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
from document_meta import join_document, split_document


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

    def _preview(self, path=None, stdin=None, source_id=None) -> dict:
        buf = io.StringIO()
        with (
            patch.object(dc, "open_viewer", return_value="none"),
            patch.object(sys, "stdin", stdin or _Tty()),
            redirect_stdout(buf),
        ):
            dc.preview(path, should_open=False, open_mode="none", kind="board", source_id=source_id)
        return json.loads(buf.getvalue())

    def _seed(self, text: str, label: str) -> tuple[Path, str]:
        rec = dc.create_board_record(text, rev=1, via="cli", label=label)
        side = dc.ensure_board_history_entry_meta(rec)
        meta = dc.read_board_meta()
        meta.update({
            "current": dc.rel_board_current(rec),
            "via": "cli",
            "id": side["id"],
            "title": side.get("title") or label,
            "label": label,
        })
        dc.write_board_meta(meta)
        dc.refresh_board_dsl_alias(rec)
        return rec, side["id"]

    def _body(self, text: str) -> str:
        return split_document(text, "board")[1]

    def test_each_record_has_unique_id(self) -> None:
        a, aid = self._seed('board "A"\n', "a")
        b, bid = self._seed('board "B"\n', "b")
        self.assertTrue(str(aid).startswith("b_"))
        self.assertTrue(str(bid).startswith("b_"))
        self.assertNotEqual(aid, bid)
        self.assertEqual(dc.find_board_record_by_id(aid), a)
        self.assertEqual(dc.find_board_record_by_id(bid), b)

    def test_get_source_requires_id(self) -> None:
        self._seed('board "A"\n', "a")
        with self.assertRaisesRegex(RuntimeError, "requires --id"):
            dc.get_source(kind="board")

    def test_get_source_reads_id_not_current(self) -> None:
        _, aid = self._seed('board "A"\n', "a")
        self._seed('board "B"\n', "b")
        self.assertEqual(self._body(dc.read_board_source_text()), 'board "B"\n')
        buf = io.StringIO()
        with redirect_stdout(buf):
            dc.get_source(kind="board", source_id=aid)
        self.assertEqual(self._body(buf.getvalue()), 'board "A"\n')
        self.assertEqual(self._body(dc.read_board_source_text()), 'board "B"\n')

    def test_get_source_unknown_id(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "unknown board id"):
            dc.get_source(kind="board", source_id="b_deadbeef")

    def test_preview_without_id_mints(self) -> None:
        rec, aid = self._seed('board "A"\n', "a")
        src = self.tmp / "new.bmd"
        src.write_text('board "New"\n', encoding="utf-8")
        data = self._preview(path=str(src))
        self.assertEqual(data["open"], "created")
        self.assertTrue(str(data["id"]).startswith("b_"))
        self.assertNotEqual(data["id"], aid)
        self.assertNotEqual(Path(data["current"]).name, rec.name)

    def test_preview_with_id_updates_same_file(self) -> None:
        rec, aid = self._seed('board "A"\n', "a")
        other, _ = self._seed('board "B"\n', "b")
        src = self.tmp / "upd.bmd"
        src.write_text(join_document({"id": aid, "version": 1}, 'board "A2"\n'), encoding="utf-8")
        data = self._preview(path=str(src), source_id=aid)
        self.assertEqual(data["open"], "current")
        self.assertEqual(data["id"], aid)
        self.assertEqual(self._body(rec.read_text(encoding="utf-8")), 'board "A2"\n')
        self.assertEqual(split_document(rec.read_text(encoding="utf-8"), "board")[0]["version"], 2)
        self.assertEqual(self._body(other.read_text(encoding="utf-8")), 'board "B"\n')
        self.assertEqual(dc.find_board_record_by_id(aid), rec)

    def test_preview_with_id_rejects_bare_body(self) -> None:
        rec, aid = self._seed('board "A"\n', "a")
        src = self.tmp / "upd.bmd"
        src.write_text('board "A2"\n', encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "document meta required"):
            self._preview(path=str(src), source_id=aid)
        self.assertEqual(self._body(rec.read_text(encoding="utf-8")), 'board "A"\n')

    def test_preview_unknown_id(self) -> None:
        src = self.tmp / "upd.bmd"
        src.write_text('board "X"\n', encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "unknown board id"):
            self._preview(path=str(src), source_id="b_deadbeef")

    def test_set_source_returns_id(self) -> None:
        rec, aid = self._seed('board "A"\n', "a")
        buf = io.StringIO()
        with (
            patch.object(sys, "stdin", io.StringIO(join_document({"id": aid, "version": 1}, 'board "A2"\n'))),
            redirect_stdout(buf),
        ):
            dc.set_source(None, kind="board", source_id=aid)
        data = json.loads(buf.getvalue())
        self.assertEqual(data["id"], aid)
        self.assertEqual(data["kind"], "board")
        self.assertEqual(self._body(rec.read_text(encoding="utf-8")), 'board "A2"\n')


if __name__ == "__main__":
    unittest.main()
