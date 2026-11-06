"""call_tool_as_user: refresh before the call, one refresh and one retry on a 401, and exit 4 with the address to log in at."""
from __future__ import annotations

import unittest
from unittest.mock import patch

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.auth import credentials, resource_discovery, token_manager
from board_cli.cloud import mcp_client
from board_cli.cloud.authorized_mcp import call_tool_as_user
from board_cli.core import mcp_address
from board_cli.core.cli_errors import LoginRequired
from cloud_support import CloudCase
from login_support import find_free_port

DOC = {"diagram_id": "b_1", "title": "T", "version": 3}


class AuthorizedCase(CloudCase):
    def setUp(self) -> None:
        super().setUp()
        self.mcp.answer_tool("get_diagram", DOC)

    def call(self) -> object:
        return call_tool_as_user("get_diagram", {"diagram_id": "b_1"})

    def bearers(self) -> list:
        """The Authorization header of every request the MCP server saw, in order."""
        return [request["authorization"] for request in self.mcp.requests]

    def assert_login_required(self, reason: str) -> LoginRequired:
        with self.assertRaises(LoginRequired) as caught:
            self.call()
        self.assertEqual(caught.exception.reason, reason)
        self.assertEqual(caught.exception.payload, {"login_required": True, "resource_metadata": self.mcp.metadata_url})
        self.assertIn(self.mcp.metadata_url, str(caught.exception))
        return caught.exception


class HappyPathTest(AuthorizedCase):
    def test_a_fresh_token_makes_one_call_and_no_refresh(self) -> None:
        access = self.store_login()
        self.assertEqual(self.call(), DOC)
        self.assertEqual(self.bearers(), [f"Bearer {access}"])
        self.assertEqual(self.auth.requests, [])

    def test_a_token_ending_within_the_margin_is_refreshed_first_and_the_new_refresh_token_is_stored(self) -> None:
        old = self.store_login(exp=self.ends_in(30))
        self.assertEqual(self.call(), DOC)
        stored = credentials.read_credentials()
        self.assertNotEqual(stored["access_token"], old)
        self.assertEqual(stored["refresh_token"], "refresh-rotated-1")
        self.assertEqual(self.bearers(), [f"Bearer {stored['access_token']}"])
        self.assertEqual(self.auth.refreshes, 1)

    def test_an_expired_token_is_refreshed_through_the_stored_token_endpoint_only(self) -> None:
        self.store_login(exp=self.expired())
        self.call()
        self.assertEqual([(method, path) for method, path, _ in self.auth.requests], [("POST", "/auth/v1/oauth/token")])
        self.assertEqual(self.auth.token_forms[0]["resource"], self.mcp.url)


class UnauthorizedAfterTheCallTest(AuthorizedCase):
    def test_a_401_refreshes_once_and_retries_once(self) -> None:
        old = self.store_login()
        self.auth.valid_access_tokens.discard(old)  # the server no longer accepts what the file holds
        self.assertEqual(self.call(), DOC)
        self.assertEqual(self.auth.refreshes, 1)
        self.assertEqual(len(self.mcp.requests), 2)
        self.assertEqual(self.bearers()[0], f"Bearer {old}")
        self.assertEqual(self.bearers()[1], f"Bearer {credentials.read_credentials()['access_token']}")

    def test_a_second_401_is_exit_4_with_the_address_from_that_401_and_no_third_try(self) -> None:
        self.store_login()
        self.mcp.reject_all = True
        self.assert_login_required(token_manager.REFUSED)
        self.assertEqual(len(self.mcp.requests), 2)  # the call and its one retry; no probe, no third call
        self.assertEqual(self.auth.refreshes, 1)

    def test_a_refused_refresh_after_a_401_is_exit_4_with_the_address_from_the_401_and_no_probe(self) -> None:
        old = self.store_login()
        self.auth.valid_access_tokens.discard(old)
        self.auth.live_refresh.clear()
        self.assert_login_required(token_manager.REFUSED)
        self.assertEqual(len(self.mcp.requests), 1)
        self.assertEqual(self.mcp.list_methods(), ["tools/call"])

    def test_a_refused_refresh_keeps_the_stored_tokens(self) -> None:
        old = self.store_login()
        self.auth.valid_access_tokens.discard(old)
        self.auth.live_refresh.clear()
        self.assert_login_required(token_manager.REFUSED)
        stored = credentials.read_credentials()
        self.assertEqual((stored["access_token"], stored["refresh_token"]), (old, "refresh-seed"))

    def test_a_refresh_that_fails_for_another_reason_is_an_ordinary_error(self) -> None:
        old = self.store_login()
        self.auth.valid_access_tokens.discard(old)
        self.auth.refresh_status = 503
        with self.assertRaises(RuntimeError) as caught:
            self.call()
        self.assertNotIsInstance(caught.exception, LoginRequired)
        self.assertIn("HTTP 503", str(caught.exception))
        self.assertEqual(len(self.mcp.requests), 1)


class NoLoginAtHandTest(AuthorizedCase):
    """With no 401 at hand, one request without a token asks the server where to log in."""

    def assert_one_probe(self) -> None:
        self.assertEqual(self.mcp.list_methods(), ["tools/list"])
        self.assertEqual(self.bearers(), [""])

    def test_no_credentials_at_all(self) -> None:
        self.assert_login_required(token_manager.NOT_LOGGED_IN)
        self.assert_one_probe()
        self.assertEqual(self.auth.requests, [])

    def test_a_file_with_only_the_client_id_and_the_endpoint(self) -> None:
        credentials.update_credentials({"client_id": "c", "token_endpoint": self.auth.base + "/auth/v1/oauth/token"})
        self.assert_login_required(token_manager.NOT_LOGGED_IN)
        self.assert_one_probe()

    def test_an_expired_token_without_a_refresh_token(self) -> None:
        self.store_login(exp=self.expired(), refresh=None)
        self.assert_login_required(token_manager.INCOMPLETE)
        self.assert_one_probe()
        self.assertEqual(self.auth.requests, [])

    def test_an_expired_token_without_a_client_id(self) -> None:
        self.store_login(exp=self.expired(), client=None)
        self.assert_login_required(token_manager.INCOMPLETE)
        self.assert_one_probe()

    def test_an_expired_token_without_a_token_endpoint_is_what_an_old_login_looks_like(self) -> None:
        self.store_login(exp=self.expired(), endpoint=None)
        self.assert_login_required(token_manager.INCOMPLETE)
        self.assert_one_probe()
        self.assertEqual(self.auth.requests, [])

    def test_a_fresh_token_without_a_token_endpoint_still_works_until_it_must_be_refreshed(self) -> None:
        access = self.store_login(endpoint=None)
        self.assertEqual(self.call(), DOC)
        self.assertEqual(self.bearers(), [f"Bearer {access}"])

    def test_a_refresh_refused_before_any_call(self) -> None:
        self.store_login(exp=self.expired())
        self.auth.live_refresh.clear()
        self.assert_login_required(token_manager.REFUSED)
        self.assert_one_probe()

    def test_a_stored_token_endpoint_that_is_not_https_is_exit_4_and_is_never_called(self) -> None:
        self.store_login(exp=self.expired(), endpoint="http://auth.example/token")
        with patch.object(resource_discovery, "SCHEMES", ("https",)):
            self.assert_login_required(token_manager.BAD_ENDPOINT)
        self.assert_one_probe()
        self.assertEqual(self.auth.requests, [])

    def test_the_probe_is_the_only_request_and_carries_no_token_and_no_session(self) -> None:
        with self.assertRaises(LoginRequired):
            self.call()
        sent = self.mcp.requests[0]
        self.assertEqual(sent["authorization"], "")
        self.assertNotIn("mcp-session-id", sent["headers"])
        self.assertEqual(len(self.mcp.requests), 1)


class ProbeFailureTest(AuthorizedCase):
    def test_a_server_that_names_no_address_is_an_ordinary_error(self) -> None:
        self.mcp.omit_challenge_address = True
        with self.assertRaises(RuntimeError) as caught:
            self.call()
        self.assertNotIsInstance(caught.exception, LoginRequired)
        self.assertIn("did not say where to log in", str(caught.exception))

    def test_a_server_that_cannot_be_reached_is_an_ordinary_error(self) -> None:
        with patch.object(mcp_address, "MCP_URL", f"http://127.0.0.1:{find_free_port()}/mcp"):
            with self.assertRaises(RuntimeError) as caught:
                self.call()
        self.assertNotIsInstance(caught.exception, LoginRequired)
        self.assertIn("cannot reach", str(caught.exception))

    def test_find_login_address_gives_the_address_the_401_names(self) -> None:
        self.assertEqual(mcp_client.find_login_address(), self.mcp.metadata_url)

    def test_find_login_address_refuses_an_answer_that_is_not_a_401(self) -> None:
        self.mcp.accepts = lambda token: True  # a server that lets an anonymous request in
        with self.assertRaisesRegex(RuntimeError, "did not say where to log in \\(HTTP 200\\)"):
            mcp_client.find_login_address()


if __name__ == "__main__":
    unittest.main()
