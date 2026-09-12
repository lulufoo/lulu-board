#!/usr/bin/env python3
"""Mermaid CLI reads and writes a stable MMD ID, not the current pointer."""
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



sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "scripts"))

import drawer_control as dc
from drawer_ctl import paths as _ctl_paths
from document_meta import join_document, split_document


class _Tty:
    def isatty(self) -> bool:
        return True

    def read(self) -> str:
        raise AssertionError("TTY stdin must not be read")


class MermaidSourceIdTest(unittest.TestCase):
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
            patch.object(dc, "mount", return_value="http://127.0.0.1:9/drawer.html"),
            patch.object(dc, "open_viewer", return_value="none"),
            patch.object(sys, "stdin", stdin or _Tty()),
            redirect_stdout(buf),
        ):
            dc.preview(path, 0, should_open=False, open_mode="none", kind="mermaid", source_id=source_id)
        return json.loads(buf.getvalue())

    def _seed(self, text: str, label: str) -> tuple[Path, str]:
        rec = dc.create_mermaid_record(text, rev=1, via="cli", label=label)
        side = dc.ensure_history_entry_meta(rec)
        meta = dc.ensure_mermaid_pointer_model()
        meta.update({
            "current": dc.rel_mermaid_current(rec),
            "via": "cli",
            "id": side["id"],
            "title": side.get("title") or label,
            "label": label,
            "kind": side.get("kind") or "flowchart",
        })
        dc.write_meta(meta)
        dc.refresh_diagram_mmd_alias(rec)
        return rec, side["id"]

    def _body(self, text: str) -> str:
        return split_document(text, "mermaid")[1]

    def test_each_record_has_unique_id(self) -> None:
        a, aid = self._seed("flowchart LR\nA-->B\n", "a")
        b, bid = self._seed("flowchart LR\nC-->D\n", "b")
        self.assertTrue(str(aid).startswith("m_"))
        self.assertTrue(str(bid).startswith("m_"))
        self.assertNotEqual(aid, bid)
        self.assertEqual(dc.find_mermaid_record_by_id(aid), a)
        self.assertEqual(dc.find_mermaid_record_by_id(bid), b)
        self.assertTrue(a.read_text(encoding="utf-8").startswith("%% meta "))

    def test_get_source_requires_id(self) -> None:
        self._seed("flowchart LR\nA-->B\n", "a")
        with self.assertRaisesRegex(RuntimeError, "requires --id"):
            dc.get_source(kind="mermaid")

    def test_get_source_reads_id_not_current(self) -> None:
        _, aid = self._seed("flowchart LR\nA-->B\n", "a")
        self._seed("flowchart LR\nC-->D\n", "b")
        self.assertEqual(self._body(dc.read_source_text()), "flowchart LR\nC-->D\n")
        buf = io.StringIO()
        with redirect_stdout(buf):
            dc.get_source(kind="mermaid", source_id=aid)
        self.assertEqual(self._body(buf.getvalue()), "flowchart LR\nA-->B\n")
        self.assertEqual(self._body(dc.read_source_text()), "flowchart LR\nC-->D\n")

    def test_get_source_unknown_id(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "unknown mermaid id"):
            dc.get_source(kind="mermaid", source_id="m_deadbeef")

    def test_preview_without_id_mints(self) -> None:
        rec, aid = self._seed("flowchart LR\nA-->B\n", "a")
        src = self.tmp / "new.mmd"
        src.write_text("flowchart LR\nN-->X\n", encoding="utf-8")
        data = self._preview(path=str(src))
        self.assertEqual(data["open"], "created")
        self.assertTrue(str(data["id"]).startswith("m_"))
        self.assertNotEqual(data["id"], aid)
        self.assertNotEqual(Path(data["current"]).name, rec.name)

    def test_preview_with_id_updates_same_file(self) -> None:
        rec, aid = self._seed("flowchart LR\nA-->B\n", "a")
        other, _ = self._seed("flowchart LR\nC-->D\n", "b")
        src = self.tmp / "upd.mmd"
        src.write_text(join_document({"id": aid, "version": 1}, "flowchart LR\nA-->Z\n"), encoding="utf-8")
        data = self._preview(path=str(src), source_id=aid)
        self.assertEqual(data["open"], "current")
        self.assertEqual(data["id"], aid)
        self.assertEqual(self._body(rec.read_text(encoding="utf-8")), "flowchart LR\nA-->Z\n")
        self.assertTrue(rec.read_text(encoding="utf-8").startswith("%% meta "))
        self.assertEqual(split_document(rec.read_text(encoding="utf-8"), "mermaid")[0]["version"], 2)
        self.assertEqual(self._body(other.read_text(encoding="utf-8")), "flowchart LR\nC-->D\n")
        self.assertEqual(dc.find_mermaid_record_by_id(aid), rec)

    def test_preview_unknown_id(self) -> None:
        src = self.tmp / "upd.mmd"
        src.write_text("flowchart LR\nX-->Y\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "unknown mermaid id"):
            self._preview(path=str(src), source_id="m_deadbeef")

    def test_set_source_returns_id(self) -> None:
        rec, aid = self._seed("flowchart LR\nA-->B\n", "a")
        buf = io.StringIO()
        with (
            patch.object(sys, "stdin", io.StringIO(join_document({"id": aid, "version": 1}, "flowchart LR\nA-->Z\n"))),
            redirect_stdout(buf),
        ):
            dc.set_source(None, kind="mermaid", source_id=aid)
        data = json.loads(buf.getvalue())
        self.assertEqual(data["id"], aid)
        self.assertEqual(data["kind"], "mermaid")
        self.assertEqual(self._body(rec.read_text(encoding="utf-8")), "flowchart LR\nA-->Z\n")


if __name__ == "__main__":
    unittest.main()
