"""Shared base for the MCP-call tests: a fake authorization server, a fake MCP server, a valid token.

mcp_address.MCP_URL is pointed at the fake server (production is https only and built in). The test
runner skips this file.
"""
from __future__ import annotations

import unittest
from unittest.mock import patch

from board_cli_support import make_token
from board_cli.core import mcp_address
from fake_auth_server import FUTURE, FakeAuthServer
from fake_mcp_server import FakeMcpServer


class McpClientCase(unittest.TestCase):
    def setUp(self) -> None:
        self.auth = FakeAuthServer().start()
        self.addCleanup(self.auth.stop)
        self.mcp = FakeMcpServer(self.auth).start()
        self.addCleanup(self.mcp.stop)
        self.token = make_token({"sub": "user-1", "exp": FUTURE})
        self.auth.valid_access_tokens.add(self.token)
        patcher = patch.object(mcp_address, "MCP_URL", self.mcp.url)
        patcher.start()
        self.addCleanup(patcher.stop)
