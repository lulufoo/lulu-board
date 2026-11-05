"""Shared base for the login tests: a fake server, a fake browser, a free callback port.

The test runner skips this file.
"""
from __future__ import annotations

import socket
from unittest.mock import patch

from board_cli_support import HomeCase
from board_cli import login_commands, oauth_client
from fake_auth_server import METADATA_PATH, FakeAuthServer, FakeBrowser


def find_free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class LoginCase(HomeCase):
    """login runs in this process against the fake server; the browser is the fake one."""

    outcome = "approve"
    wait_seconds = 5

    def setUp(self) -> None:
        super().setUp()
        self.auth = FakeAuthServer().start()
        self.addCleanup(self.auth.stop)
        self.browser = FakeBrowser(self.auth, self.outcome)
        self.addCleanup(self.browser.finish)
        self.real_port = login_commands.CALLBACK_PORT
        self.real_wait = login_commands.WAIT_SECONDS
        self.port = find_free_port()
        self.patch_in(login_commands, "CALLBACK_PORT", self.port)
        self.patch_in(login_commands, "WAIT_SECONDS", self.wait_seconds)
        self.patch_in(oauth_client, "METADATA_URL", self.auth.base + METADATA_PATH)
        self.patch_in(login_commands.webbrowser, "open", self.browser)

    def assert_port_released(self) -> None:
        """No listener holds the callback port. Connections left in TIME_WAIT do not count."""
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", self.port))
            except OSError as err:
                self.fail(f"callback port {self.port} is still held: {err}")

    def patch_in(self, target, name: str, value) -> None:
        patcher = patch.object(target, name, value)
        patcher.start()
        self.addCleanup(patcher.stop)
