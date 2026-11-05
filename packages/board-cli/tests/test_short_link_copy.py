"""The package keeps its own short_link.py. Its constants must match the copy
that Boxes and Mermaid use in skills/scripts, or short links break silently."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from types import ModuleType

from board_cli_support import PACKAGE_ROOT

REPO = PACKAGE_ROOT.parents[1]
SKILLS_COPY = REPO / "skills" / "scripts" / "short_link.py"
PACKAGE_COPY = PACKAGE_ROOT / "board_cli" / "source" / "short_link.py"
CONSTANTS = ("PUBLIC_WEB_ORIGIN", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "_RPC")


def load_module(name: str, path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ShortLinkCopyTest(unittest.TestCase):
    def setUp(self) -> None:
        self.skills = load_module("short_link_skills_copy", SKILLS_COPY)
        self.package = load_module("short_link_package_copy", PACKAGE_COPY)

    def test_both_copies_exist_at_the_expected_paths(self) -> None:
        self.assertTrue(SKILLS_COPY.is_file(), SKILLS_COPY)
        self.assertTrue(PACKAGE_COPY.is_file(), PACKAGE_COPY)

    def test_the_constants_match(self) -> None:
        for name in CONSTANTS:
            with self.subTest(constant=name):
                self.assertEqual(getattr(self.skills, name), getattr(self.package, name))


if __name__ == "__main__":
    unittest.main()
