"""Shared helpers for the board_control.py tests. The test runner skips this file."""
from __future__ import annotations

import base64
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE_ROOT))

from board_cli import board_control


def run_cli(*argv: str) -> tuple[int, str, str]:
    """Run board_control.main in this process. Return exit code, stdout, stderr."""
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            code = board_control.main(list(argv))
        except SystemExit as stop:
            code = stop.code
    return code, out.getvalue(), err.getvalue()


class TempDirCase(unittest.TestCase):
    """A test case with a temporary directory in self.dir and put() to fill it."""

    def setUp(self) -> None:
        holder = tempfile.TemporaryDirectory()
        self.addCleanup(holder.cleanup)
        self.dir = Path(holder.name).resolve()

    def put(self, name: str, text: str) -> Path:
        path = self.dir / name
        with open(path, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
        return path


class HomeCase(TempDirCase):
    """TempDirCase with HOME pointed at self.home, so ~/.config/lulu-board lands in the temp dir."""

    def setUp(self) -> None:
        super().setUp()
        self.home = self.dir / "home"
        self.home.mkdir()
        patcher = patch.dict(os.environ, {"HOME": str(self.home)})
        patcher.start()
        self.addCleanup(patcher.stop)

    def env_with_home(self) -> dict:
        """The environment for a subprocess that must see this HOME."""
        return {**os.environ, "HOME": str(self.home)}


def make_token(claims: dict) -> str:
    """A JWT-shaped string whose payload is claims. The signature is not real."""
    def encode(part: dict) -> str:
        raw = json.dumps(part).encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return ".".join((encode({"alg": "none"}), encode(claims), "sig"))
