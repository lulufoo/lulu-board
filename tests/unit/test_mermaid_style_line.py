#!/usr/bin/env python3
"""Mermaid title/kind skip the renderer style stash line."""
from __future__ import annotations

import base64
import json
import unittest

import sys

from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "scripts"))

import drawer_control as dc


def _src(theme: str = "kami", *, comment: bool = True) -> str:
    token = base64.b64encode(json.dumps({"theme": theme}, separators=(",", ":")).encode("utf-8")).decode("ascii")
    meta = '%% meta {"id":"m_51c67540","version":1}\n' if comment else 'meta {"id":"m_51c67540","version":1}\n'
    stash = f"%% style {token}\n" if comment else f"style {token}\n"
    return (
        meta
        + stash
        + "flowchart LR\n"
        + "  A --> B\n"
        + "  style A fill:#f9f\n"
    )


class MermaidStyleLineTest(unittest.TestCase):
    def test_kind_skips_stash(self) -> None:
        self.assertEqual(dc.derive_diagram_kind(_src()), "flowchart")

    def test_title_skips_stash(self) -> None:
        self.assertEqual(dc.derive_diagram_title(_src()), "flowchart · LR")

    def test_keeps_mermaid_node_style(self) -> None:
        text = "flowchart LR\n  style A fill:#f9f\n"
        self.assertEqual(dc.derive_diagram_kind(text), "flowchart")

    def test_legacy_stash_without_comment(self) -> None:
        self.assertEqual(dc.derive_diagram_kind(_src(comment=False)), "flowchart")
        self.assertEqual(dc.derive_diagram_title(_src(comment=False)), "flowchart · LR")


if __name__ == "__main__":
    unittest.main()
