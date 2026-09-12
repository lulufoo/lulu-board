#!/usr/bin/env python3
"""Fixed default port + orphan sweep helpers."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skill" / "scripts"))

from drawer_ctl import paths as _ctl_paths
from drawer_ctl import util
from drawer_ctl import server


class ResolvePortTest(unittest.TestCase):
    def test_zero_uses_default_port(self) -> None:
        self.assertEqual(util.resolve_port(0), _ctl_paths.DEFAULT_PORT)
        self.assertEqual(util.resolve_port(None), _ctl_paths.DEFAULT_PORT)

    def test_explicit_kept(self) -> None:
        self.assertEqual(util.resolve_port(12345), 12345)


class StopOtherServesTest(unittest.TestCase):
    def test_keeps_requested_pid(self) -> None:
        killed: list[int] = []

        def fake_list():
            return [11, 22, 33]

        with (
            patch.object(server, "list_drawer_serve_pids", fake_list),
            patch.object(server, "_kill_pid", side_effect=lambda p: killed.append(p)),
        ):
            server.stop_other_serves(keep_pid=22)
        self.assertEqual(killed, [11, 33])


class ServePidOnPortTest(unittest.TestCase):
    def test_returns_our_listener(self) -> None:
        with (
            patch.object(server, "_pids_listening_on_port", return_value=[9, 8]),
            patch.object(server, "is_drawer_serve_pid", side_effect=lambda p: p == 8),
        ):
            self.assertEqual(server.serve_pid_on_port(49867), 8)

    def test_none_when_foreign(self) -> None:
        with (
            patch.object(server, "_pids_listening_on_port", return_value=[9]),
            patch.object(server, "is_drawer_serve_pid", return_value=False),
        ):
            self.assertIsNone(server.serve_pid_on_port(49867))
            self.assertTrue(server.port_busy_by_foreign(49867))


if __name__ == "__main__":
    unittest.main()
