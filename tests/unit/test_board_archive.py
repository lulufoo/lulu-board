#!/usr/bin/env python3
"""Board history: UI writes through current record; CLI preview mints a new one."""
from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "board" / "scripts"))

import drawer_control as dc
from drawer_ctl import paths as _ctl_paths
from document_meta import join_document, split_document


class BoardArchiveTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.prev_state = _ctl_paths.STATE_DIR
        _ctl_paths.STATE_DIR = self.tmp

    def tearDown(self) -> None:
        _ctl_paths.STATE_DIR = self.prev_state
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _history(self) -> list[Path]:
        return sorted(dc.board_history_dir().glob("*.bmd"))

    def test_ui_write_does_not_archive(self) -> None:
        seed, conflict = dc.commit_board_source("board Old\n", via="cli", label="shown")
        self.assertIsNone(conflict)
        board_id = seed["id"]
        n = len(self._history())
        incoming = join_document({"id": board_id, "version": seed["rev"]}, "board New\n")
        meta, conflict = dc.commit_board_source(incoming, via="ui", label="ui-write")
        self.assertIsNone(conflict)
        self.assertEqual(meta["rev"], seed["rev"] + 1)
        self.assertIn("board New", dc.read_board_source_text())
        self.assertEqual(len(self._history()), n)

    def test_cli_preview_mints_new_record(self) -> None:
        seed, _ = dc.commit_board_source('board "Shown"\nbox A "A"\n', via="cli", label="shown")
        before = {p.name for p in self._history()}
        meta, conflict = dc.commit_board_source(
            'board "Next"\nbox B "B"\n', via="cli", label="next", archive_current=True
        )
        self.assertIsNone(conflict)
        self.assertEqual(meta["rev"], 1)
        self.assertIn("Next", dc.read_board_source_text())
        self.assertTrue({p.name for p in self._history()} - before)

    def test_cli_mints_when_empty(self) -> None:
        meta, conflict = dc.commit_board_source(
            'board "Fresh"\n', via="cli", label="fresh", archive_current=True
        )
        self.assertIsNone(conflict)
        live = dc.read_board_source_text()
        self.assertIn('board "Fresh"', live)
        self.assertTrue(live.lstrip().startswith("meta "))
        self.assertTrue(self._history())

    def test_lifts_nested_history_board(self) -> None:
        nested = self.tmp / "history" / "board"
        nested.mkdir(parents=True)
        rec = nested / "20260101-000000-x.bmd"
        rec.write_text('board "X"\n', encoding="utf-8")
        (nested / "20260101-000000-x.json").write_text("{}\n", encoding="utf-8")
        dc.write_board_meta(
            {
                "rev": 1,
                "updated_at": 1,
                "via": "test",
                "kind": "board",
                "current": "history/board/20260101-000000-x.bmd",
            }
        )
        from drawer_ctl.migrate import migrate_document_envelopes

        migrate_document_envelopes()
        self.assertTrue((self.tmp / "history" / "20260101-000000-x.bmd").is_file())
        self.assertFalse((self.tmp / "history" / "board").exists())
        self.assertEqual(
            dc.read_board_meta()["current"],
            "history/20260101-000000-x.bmd",
        )

    def test_seed_lifts_nested_before_treating_empty(self) -> None:
        nested = self.tmp / "history" / "board"
        nested.mkdir(parents=True)
        rec = nested / "20260101-000000-x.bmd"
        rec.write_text('board "X"\n', encoding="utf-8")
        dc.write_board_meta(
            {
                "rev": 1,
                "updated_at": 1,
                "via": "test",
                "kind": "board",
                "current": "history/board/20260101-000000-x.bmd",
            }
        )
        self.assertIsNone(dc.seed_default_board_if_empty())
        names = [p.name for p in dc.board_history_dir().glob("*.bmd")]
        self.assertEqual(names, ["20260101-000000-x.bmd"])
        self.assertEqual(
            dc.read_board_meta()["current"],
            "history/20260101-000000-x.bmd",
        )

    def test_stale_base_rev_returns_conflict(self) -> None:
        seed, _ = dc.commit_board_source("board Live\n", via="cli", label="live")
        board_id = seed["id"]
        # pretend client is one rev behind
        incoming = join_document({"id": board_id, "version": seed["rev"]}, "board X\n")
        meta, conflict = dc.commit_board_source(
            incoming, via="ui", base_rev=seed["rev"] - 1, label="x"
        )
        self.assertIsNotNone(conflict)
        self.assertIn("board Live", conflict)


if __name__ == "__main__":
    unittest.main()
