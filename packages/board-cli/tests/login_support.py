"""Shared base for the login tests: fake MCP and authorization servers, a fake browser, a free callback port.

Production accepts https addresses only and has the MCP address built in; here the
fakes are plain http on loopback, so the scheme list admits http and MCP_URL points at
the fake MCP server. The test runner skips this file.
"""
from __future__ import annotations

import socket
from unittest.mock import patch

from board_cli_support import HomeCase, run_cli
from board_cli.auth import login_commands, resource_discovery
from board_cli.core import mcp_address
from fake_auth_server import FakeAuthServer, FakeBrowser
from fake_mcp_server import FakeMcpServer


def find_free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class LoginCase(HomeCase):
    """login runs in this process against the fake servers; the browser is the fake one."""

    outcome = "approve"
    wait_seconds = 5

    def setUp(self) -> None:
        super().setUp()
        self.auth = FakeAuthServer().start()
        self.addCleanup(self.auth.stop)
        self.mcp = FakeMcpServer(self.auth).start()
        self.addCleanup(self.mcp.stop)
        self.browser = FakeBrowser(self.auth, self.outcome)
        self.addCleanup(self.browser.finish)
        self.real_port = login_commands.CALLBACK_PORT
        self.real_wait = login_commands.WAIT_SECONDS
        self.port = find_free_port()
        self.patch_in(login_commands, "CALLBACK_PORT", self.port)
        self.patch_in(login_commands, "WAIT_SECONDS", self.wait_seconds)
        self.patch_in(mcp_address, "MCP_URL", self.mcp.url)
        self.patch_in(resource_discovery, "SCHEMES", ("http", "https"))
        self.patch_in(login_commands.webbrowser, "open", self.browser)

    def login(self, *extra: str, address: str | None = None) -> tuple[int, str, str]:
        """Run login with the fake MCP server's metadata address, or with this one."""
        return run_cli("login", "--resource-metadata-url", address or self.mcp.metadata_url, *extra)

    def assert_port_released(self) -> None:
        """No listener holds the callback port. Connections left in TIME_WAIT do not count."""
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", self.port))
            except OSError as err:
                self.fail(f"callback port {self.port} is still held: {err}")

    def assert_nothing_contacted(self) -> None:
        """No request reached either server, and no browser opened."""
        self.assertEqual(self.mcp.requests, [])
        self.assertEqual(self.auth.requests, [])
        self.assertEqual(self.browser.opened, [])

    def patch_in(self, target, name: str, value) -> None:
        patcher = patch.object(target, name, value)
        patcher.start()
        self.addCleanup(patcher.stop)
