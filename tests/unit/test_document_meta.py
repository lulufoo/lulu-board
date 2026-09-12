#!/usr/bin/env python3
"""Document envelope: hard-cut meta {id, version} as base64."""
from __future__ import annotations

import sys
from pathlib import Path

import unittest


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "scripts"))

from document_meta import (
    DocumentMetaError,
    bump_document,
    correct_envelope,
    correct_missing,
    encode_meta_payload,
    has_envelope,
    join_document,
    mint_envelope,
    rewrite_envelope,
    split_document,
)


def _token(doc_id: str, version: int) -> str:
    return encode_meta_payload({"id": doc_id, "version": version})


class DocumentMetaTest(unittest.TestCase):
    def test_split_join_roundtrip(self) -> None:
        raw = join_document({"id": "b_0fc10001", "version": 3}, 'board "A"\n')
        self.assertEqual(raw.splitlines()[0], "meta " + _token("b_0fc10001", 3))
        self.assertNotIn("{", raw.splitlines()[0])
        meta, body = split_document(raw, "board")
        self.assertEqual(meta, {"id": "b_0fc10001", "version": 3})
        self.assertEqual(body, 'board "A"\n')

    def test_split_legacy_json(self) -> None:
        raw = 'meta {"id":"b_0fc10001","version":3}\nboard "A"\n'
        meta, body = split_document(raw, "board")
        self.assertEqual(meta, {"id": "b_0fc10001", "version": 3})
        self.assertEqual(body, 'board "A"\n')

    def test_reject_missing(self) -> None:
        with self.assertRaises(DocumentMetaError):
            split_document('board "A"\n', "board")

    def test_reject_bad_id(self) -> None:
        with self.assertRaises(DocumentMetaError):
            split_document('meta {"id":"x","version":1}\nboard "A"\n', "board")

    def test_reject_bad_token(self) -> None:
        with self.assertRaises(DocumentMetaError):
            split_document("meta not-valid-base64!!!\nboard \"A\"\n", "board")

    def test_mint_injects(self) -> None:
        text, meta = mint_envelope('board "A"\n', "board", "b_0fc10001")
        self.assertEqual(meta["version"], 1)
        self.assertTrue(has_envelope(text, "board"))
        self.assertIn('board "A"', text)
        self.assertEqual(text.splitlines()[0], "meta " + _token("b_0fc10001", 1))

    def test_mint_keeps_existing(self) -> None:
        src = join_document({"id": "m_51c67540", "version": 2}, "sequenceDiagram\n")
        self.assertTrue(src.startswith("%% meta "))
        self.assertNotIn("{", src.splitlines()[0])
        text, meta = mint_envelope(src, "mermaid", "m_deadbeef")
        self.assertEqual(meta["id"], "m_51c67540")
        self.assertEqual(meta["version"], 2)
        self.assertEqual(text, src)

    def test_mermaid_join_rewrites_legacy_style(self) -> None:
        token = "eyJ0aGVtZSI6InBhc3RlbCJ9"
        out = join_document(
            {"id": "m_51c67540", "version": 1},
            f"style {token}\nsequenceDiagram\n",
            "mermaid",
        )
        self.assertTrue(out.startswith("%% meta "))
        self.assertIn(f"%% style {token}\n", out)
        self.assertIn("sequenceDiagram\n", out)
        self.assertNotIn(f"\nstyle {token}\n", out)

    def test_mermaid_split_legacy_meta(self) -> None:
        raw = 'meta {"id":"m_51c67540","version":2}\nsequenceDiagram\n'
        meta, body = split_document(raw, "mermaid")
        self.assertEqual(meta, {"id": "m_51c67540", "version": 2})
        self.assertEqual(body, "sequenceDiagram\n")
        rewritten, _ = mint_envelope(raw, "mermaid", "m_deadbeef")
        self.assertTrue(rewritten.startswith("%% meta "))
        self.assertEqual(rewritten.splitlines()[0], "%% meta " + _token("m_51c67540", 2))
        self.assertIn("sequenceDiagram", rewritten)

    def test_correct_once(self) -> None:
        out, changed = correct_missing("sequenceDiagram\nA->>B: hi\n", "mermaid", "m_51c67540")
        self.assertTrue(changed)
        self.assertTrue(out.startswith("%% meta "))
        meta, body = split_document(out, "mermaid")
        self.assertEqual(meta["version"], 1)
        self.assertTrue(body.startswith("sequenceDiagram"))
        again, changed2 = correct_missing(out, "mermaid", "m_ffffffff")
        self.assertFalse(changed2)
        self.assertEqual(again, out)

    def test_bump(self) -> None:
        src = join_document({"id": "b_0fc10001", "version": 1}, 'board "A"\n')
        out, meta = bump_document(src, "board", "b_0fc10001")
        self.assertEqual(meta["version"], 2)
        self.assertEqual(out.splitlines()[0], "meta " + _token("b_0fc10001", 2))
        self.assertEqual(split_document(out, "board")[1], 'board "A"\n')

    def test_bump_rejects_id_mismatch(self) -> None:
        src = join_document({"id": "b_0fc10001", "version": 1}, 'board "A"\n')
        with self.assertRaises(DocumentMetaError):
            bump_document(src, "board", "b_0fc10002")

    def test_rewrite_legacy_json(self) -> None:
        raw = 'meta {"id":"b_0fc10001","version":3}\nboard "A"\n'
        out, changed = rewrite_envelope(raw, "board")
        self.assertTrue(changed)
        self.assertEqual(out.splitlines()[0], "meta " + _token("b_0fc10001", 3))
        self.assertEqual(split_document(out, "board")[1], 'board "A"\n')
        again, changed2 = rewrite_envelope(out, "board")
        self.assertFalse(changed2)
        self.assertEqual(again, out)

    def test_split_keeps_higher_version(self) -> None:
        raw = (
            'meta {"id":"b_22bc0e55","version":1}\n'
            + "meta "
            + _token("b_22bc0e55", 152)
            + '\nboard "A"\n'
        )
        meta, body = split_document(raw, "board")
        self.assertEqual(meta, {"id": "b_22bc0e55", "version": 152})
        self.assertEqual(body, 'board "A"\n')
        out, changed = rewrite_envelope(raw, "board")
        self.assertTrue(changed)
        self.assertEqual(out.splitlines()[0], "meta " + _token("b_22bc0e55", 152))
        self.assertEqual(len([ln for ln in out.splitlines() if ln.startswith("meta ")]), 1)

    def test_rewrite_strips_extra_meta(self) -> None:
        raw = (
            'meta {"id":"m_771ab9f6","version":1}\n'
            '%% meta {"id":"m_e9258d66","version":4}\n'
            "stateDiagram-v2\n"
        )
        out, changed = rewrite_envelope(raw, "mermaid")
        self.assertTrue(changed)
        self.assertEqual(out.splitlines()[0], "%% meta " + _token("m_e9258d66", 4))
        self.assertTrue(split_document(out, "mermaid")[1].startswith("stateDiagram-v2"))
        self.assertNotIn("m_771ab9f6", out)

    def test_correct_invalid_id_line(self) -> None:
        raw = 'meta {"id":"b_ex_commerce","version":1}\nboard "A"\n'
        out, changed = correct_envelope(raw, "board", "b_cfb240ef")
        self.assertTrue(changed)
        self.assertEqual(split_document(out, "board")[0], {"id": "b_cfb240ef", "version": 1})
        self.assertEqual(split_document(out, "board")[1], 'board "A"\n')
        self.assertNotIn("b_ex_commerce", out)


if __name__ == "__main__":
    unittest.main()
