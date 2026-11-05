"""Shared base for the cloud-call tests: fake authorization server, fake API, a stored login.

The test runner skips this file.
"""
from __future__ import annotations

import time
from unittest.mock import patch

from board_cli_support import HomeCase, make_token
from board_cli.auth import credentials, oauth_client
from board_cli.cloud import api_client
from fake_api_server import FakeApiServer
from fake_auth_server import FUTURE, METADATA_PATH, FakeAuthServer


class CloudCase(HomeCase):
    def setUp(self) -> None:
        super().setUp()
        self.auth = FakeAuthServer().start()
        self.addCleanup(self.auth.stop)
        self.api = FakeApiServer(self.auth).start()
        self.addCleanup(self.api.stop)
        self.patch_in(oauth_client, "METADATA_URL", self.auth.base + METADATA_PATH)
        self.patch_in(api_client, "API_HOST", self.api.base)
        self.seeded = 0

    def patch_in(self, target, name: str, value) -> None:
        patcher = patch.object(target, name, value)
        patcher.start()
        self.addCleanup(patcher.stop)

    def store_login(self, exp: float = FUTURE, refresh: str | None = "refresh-seed",
                    client: str | None = "client-seed", opaque: str | None = None) -> str:
        """Leave a login in the credential file, as an earlier login would have. Return its access token.

        exp is the access token's expiry; opaque is an access token that is not a JWT.
        A refresh token or client left as None is not stored.
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
        credentials.update_credentials(fields)
        return access

    def expired(self) -> float:
        return 1

    def ends_in(self, seconds: float) -> float:
        return time.time() + seconds
