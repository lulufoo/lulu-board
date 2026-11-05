"""pyz_builder: the single-file build of board_cli, run apart from the repository."""
from __future__ import annotations

import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import unittest
import zipfile
from pathlib import Path

from board_cli_support import TempDirCase
import pyz_builder
from board_cli.core.version import VERSION

STUB = "https://luluboard.app/#p:p_" + "d" * 64
BOXES = 'boxes "T"\nbox A\n'


class BuildCase(TempDirCase):
    """Build into a temp dir, then copy the file to a second dir that holds nothing else."""

    def setUp(self) -> None:
        super().setUp()
        built = pyz_builder.build_pyz(self.dir / "dist")
        self.home = self.dir / "elsewhere"
        self.home.mkdir()
        self.pyz = self.home / pyz_builder.ARCHIVE_NAME
        shutil.copy2(built, self.pyz)
        self.built = built

    def run_pyz(self, *argv: str, direct: bool = False) -> subprocess.CompletedProcess:
        env = {key: value for key, value in os.environ.items() if key != "PYTHONPATH"}
        env["LULU_BOARD_SHORT_LINK_STUB"] = STUB
        command = [str(self.pyz), *argv] if direct else [sys.executable, str(self.pyz), *argv]
        return subprocess.run(command, capture_output=True, text=True, env=env, cwd=self.home)


class ArchiveTest(BuildCase):
    def test_the_file_starts_with_the_interpreter_line_and_is_executable(self) -> None:
        with open(self.built, "rb") as handle:
            self.assertEqual(handle.readline(), b"#!/usr/bin/env python3\n")
        self.assertTrue(os.access(self.built, os.X_OK))

    def test_the_archive_holds_the_package_sources_only(self) -> None:
        names = zipfile.ZipFile(self.built).namelist()
        self.assertIn("board_cli/board_control.py", names)
        self.assertIn("board_cli/core/version.py", names)
        for name in names:
            with self.subTest(name=name):
                self.assertTrue(name == "__main__.py" or name.startswith("board_cli/"), name)
                self.assertNotIn("__pycache__", name)
        self.assertFalse([n for n in names if "tests" in n or "pyz_builder" in n])


class RunTest(BuildCase):
    """The copy runs with no repository and no PYTHONPATH, so it must carry its own code."""

    def test_version(self) -> None:
        done = self.run_pyz("--version")
        self.assertEqual(done.returncode, 0)
        self.assertEqual(json.loads(done.stdout), {"version": VERSION})

    def test_a_direct_run_through_the_interpreter_line(self) -> None:
        done = self.run_pyz("--version", direct=True)
        self.assertEqual(done.returncode, 0)
        self.assertEqual(json.loads(done.stdout), {"version": VERSION})

    def test_preview_diagram_with_a_stubbed_short_link(self) -> None:
        source = self.home / "a.bmd"
        source.write_text(BOXES, encoding="utf-8")
        done = self.run_pyz("preview-diagram", "--file", str(source))
        self.assertEqual(done.returncode, 0)
        self.assertEqual(json.loads(done.stdout), {"url": STUB})

    def test_exit_codes_come_through(self) -> None:
        """zipapp's own main= entry drops the return value; the build must not."""
        failed = self.run_pyz("preview-diagram", "--file", str(self.home / "none.bmd"))
        self.assertEqual((failed.returncode, failed.stdout), (1, ""))
        self.assertTrue(failed.stderr.strip())
        self.assertEqual(self.run_pyz().returncode, 2)


class TagCheckTest(TempDirCase):
    def run_builder(self, *argv: str) -> tuple[int, str]:
        err = io.StringIO()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
            code = pyz_builder.main(list(argv))
        return code, err.getvalue()

    def test_the_release_tag_is_named_from_the_version(self) -> None:
        self.assertEqual(pyz_builder.name_release_tag(), "board-cli-v" + VERSION)

    def test_a_matching_tag_builds(self) -> None:
        out = self.dir / "out"
        code, _ = self.run_builder("--out", str(out), "--tag", pyz_builder.name_release_tag())
        self.assertEqual(code, 0)
        self.assertTrue((out / pyz_builder.ARCHIVE_NAME).is_file())

    def test_a_different_tag_fails_and_builds_nothing(self) -> None:
        out = self.dir / "out"
        code, err = self.run_builder("--out", str(out), "--tag", "board-cli-v9.9.9")
        self.assertEqual(code, 1)
        self.assertIn("does not match", err)
        self.assertFalse(out.exists())

    def test_a_tag_of_another_product_fails(self) -> None:
        code, _ = self.run_builder("--out", str(self.dir / "out"), "--tag", "v" + VERSION)
        self.assertEqual(code, 1)

    def test_no_tag_builds_without_a_check(self) -> None:
        out = self.dir / "out"
        self.assertEqual(self.run_builder("--out", str(out))[0], 0)
        self.assertTrue((out / pyz_builder.ARCHIVE_NAME).is_file())


if __name__ == "__main__":
    unittest.main()
