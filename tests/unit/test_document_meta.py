#!/usr/bin/env python3
"""Document envelope: hard-cut meta {id, version} as base64."""
from __future__ import annotations

import sys
from pathlib import Path

import unittest


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "board" / "scripts"))

from document_meta import (
    DocumentMetaError,
    bump_document,
    correct_envelope,
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

    def test_correct_invalid_id_line(self) -> None:
        raw = 'meta {"id":"b_ex_commerce","version":1}\nboard "A"\n'
        out, changed = correct_envelope(raw, "board", "b_cfb240ef")
        self.assertTrue(changed)
        self.assertEqual(split_document(out, "board")[0], {"id": "b_cfb240ef", "version": 1})
        self.assertEqual(split_document(out, "board")[1], 'board "A"\n')
        self.assertNotIn("b_ex_commerce", out)


if __name__ == "__main__":
    unittest.main()
