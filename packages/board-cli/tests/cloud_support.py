"""Shared base for the cloud-call tests: fake authorization and MCP servers, a stored login.

The fakes are plain http on loopback, so the scheme list admits http and MCP_URL points at
the fake MCP server (production is https only, with the address built in).

The test runner skips this file.
"""
from __future__ import annotations

import time
from unittest.mock import patch

from board_cli_support import HomeCase, make_token
from board_cli.auth import credentials, resource_discovery
from board_cli.core import mcp_address
from fake_auth_server import FUTURE, FakeAuthServer
from fake_mcp_server import FakeMcpServer

NOT_GIVEN = object()


class CloudCase(HomeCase):
    def setUp(self) -> None:
        super().setUp()
        self.auth = FakeAuthServer().start()
        self.addCleanup(self.auth.stop)
        self.mcp = FakeMcpServer(self.auth).start()
        self.addCleanup(self.mcp.stop)
        self.patch_in(mcp_address, "MCP_URL", self.mcp.url)
        self.patch_in(resource_discovery, "SCHEMES", ("http", "https"))
        self.seeded = 0

    def patch_in(self, target, name: str, value) -> None:
        patcher = patch.object(target, name, value)
        patcher.start()
        self.addCleanup(patcher.stop)

    def store_login(self, exp: float = FUTURE, refresh: str | None = "refresh-seed",
                    client: str | None = "client-seed", opaque: str | None = None,
                    endpoint: object = NOT_GIVEN) -> str:
        """Leave a login in the credential file, as an earlier login would have. Return its access token.

        exp is the access token's expiry; opaque is an access token that is not a JWT.
        A refresh token, client, or endpoint left as None is not stored. The endpoint is the fake
        authorization server's token endpoint unless one is given.
        """
        self.seeded += 1
        access = opaque or make_token({"sub": "user-1", "exp": exp, "jti": f"seed-{self.seeded}"})
        self.auth.valid_access_tokens.add(access)
        fields = {credentials.ACCESS_TOKEN: access}
        if refresh:
            fields[credentials.REFRESH_TOKEN] = refresh
            self.auth.live_refresh.add(refresh)
        if client:
            fields[credentials.CLIENT_ID] = client
            self.auth.clients[client] = []
        endpoint = self.auth.base + "/auth/v1/oauth/token" if endpoint is NOT_GIVEN else endpoint
        if endpoint:
            fields[credentials.TOKEN_ENDPOINT] = endpoint
        credentials.update_credentials(fields)
        return access

    def expired(self) -> float:
        return 1

    def ends_in(self, seconds: float) -> float:
        return time.time() + seconds
