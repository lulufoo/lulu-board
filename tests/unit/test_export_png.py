#!/usr/bin/env python3
"""PNG export validation and local-file persistence."""
from __future__ import annotations

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "board" / "scripts"))

from drawer_ctl import export as export_mod
from drawer_ctl import paths


class ExportPngTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.prev_state = paths.STATE_DIR
        paths.STATE_DIR = self.tmp

    def tearDown(self) -> None:
        paths.STATE_DIR = self.prev_state
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_validates_png_signature_and_minimum_size(self) -> None:
        png = export_mod.PNG_SIGNATURE + b"payload"
        self.assertTrue(export_mod.is_valid_png_export(png))
        self.assertFalse(export_mod.is_valid_png_export(b"not a png"))
        self.assertFalse(export_mod.is_valid_png_export(export_mod.PNG_SIGNATURE))

    def test_writes_png_under_export_directory(self) -> None:
        png = export_mod.PNG_SIGNATURE + b"payload"
        dest = export_mod.write_export_png(png, "Current diagram")

        self.assertEqual(dest.parent, (self.tmp / "export").resolve())
        self.assertEqual(dest.suffix, ".png")
        self.assertEqual(dest.read_bytes(), png)


if __name__ == "__main__":
    unittest.main()
