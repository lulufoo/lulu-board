"""board-cli --version."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unittest

from board_cli_support import PACKAGE_ROOT, run_cli
from board_cli.version import VERSION


class VersionTest(unittest.TestCase):
    def test_version_prints_one_json_object_and_exits_0(self) -> None:
        code, out, err = run_cli("--version")
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(len(out.splitlines()), 1)
        self.assertEqual(json.loads(out), {"version": VERSION})

    def test_version_needs_no_command(self) -> None:
        code, _, _ = run_cli("--version")
        self.assertNotEqual(code, 2)

    def test_the_version_is_dotted_integers(self) -> None:
        self.assertRegex(VERSION, r"^\d+\.\d+\.\d+$")

    def test_help_lists_version_and_names_the_installed_program(self) -> None:
        code, out, _ = run_cli("--help")
        self.assertEqual(code, 0)
        self.assertIn("--version", out)
        self.assertIn("usage: board-cli", out)

    def test_a_process_reports_the_same_version(self) -> None:
        done = subprocess.run([sys.executable, "-m", "board_cli", "--version"],
                              capture_output=True, text=True, cwd=PACKAGE_ROOT)
        self.assertEqual(done.returncode, 0)
        self.assertEqual(json.loads(done.stdout), {"version": VERSION})

    def test_the_process_exit_code_follows_main(self) -> None:
        """python3 -m board_cli must exit with main()'s code, not always 0."""
        done = subprocess.run([sys.executable, "-m", "board_cli", "preview-diagram", "--file", "none.bmd"],
                              capture_output=True, text=True, cwd=PACKAGE_ROOT)
        self.assertEqual((done.returncode, done.stdout), (1, ""))
        self.assertTrue(done.stderr.strip())


if __name__ == "__main__":
    unittest.main()
