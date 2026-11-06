"""board-cli login: the whole flow against the fake MCP and authorization servers."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import stat
import unittest

from board_cli_support import make_token, run_cli
from board_cli.auth import credentials
from board_cli.core import http_json
from fake_auth_server import FUTURE
from login_support import LoginCase


def sha256_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


class FirstLoginTest(LoginCase):
    def setUp(self) -> None:
        super().setUp()
        self.code, self.out, self.err = self.login()

    def test_it_succeeds_with_the_account_on_stdout_and_nothing_secret(self) -> None:
        self.assertEqual(self.code, 0, self.err)
        self.assertEqual(json.loads(self.out), {"logged_in": True, "email": "me@example.com", "user_id": "user-123"})
        stored = credentials.read_credentials()
        for secret in (stored["access_token"], stored["refresh_token"]):
            self.assertNotIn(secret, self.out + self.err)

    def test_it_reaches_the_authorization_server_through_the_address_it_was_given(self) -> None:
        self.assertEqual([r["path"] for r in self.mcp.requests], ["/.well-known/oauth-protected-resource"])
        self.assertEqual(self.auth.requests[0][:2], ("GET", "/.well-known/oauth-authorization-server/auth/v1"))

    def test_it_registers_a_public_client_for_the_fixed_loopback_address(self) -> None:
        self.assertEqual(len(self.auth.registrations), 1)
        payload = self.auth.registrations[0]
        self.assertEqual(payload["redirect_uris"], [f"http://127.0.0.1:{self.port}/callback"])
        self.assertEqual(payload["token_endpoint_auth_method"], "none")
        self.assertEqual(payload["response_types"], ["code"])
        self.assertEqual(payload["grant_types"], ["authorization_code", "refresh_token"])
        self.assertEqual(payload["client_name"], "Lulu Board CLI")

    def test_it_keeps_the_client_id_and_the_token_endpoint_next_to_the_tokens(self) -> None:
        stored = credentials.read_credentials()
        self.assertEqual(stored["client_id"], "client-1")
        self.assertEqual(stored["token_endpoint"], self.auth.base + "/auth/v1/oauth/token")
        self.assertTrue(stored["access_token"] and stored["refresh_token"])

    def test_the_authorization_request_uses_pkce_s256_the_offline_scope_and_the_resource(self) -> None:
        sent = [q for q in self.auth.authorize_queries if q.get("client_id") == "client-1"][-1]
        self.assertEqual(sent["code_challenge_method"], "S256")
        self.assertEqual(sent["response_type"], "code")
        self.assertEqual(sent["scope"], "openid email offline_access")
        self.assertEqual(sent["resource"], self.mcp.url)
        self.assertEqual(sent["redirect_uri"], f"http://127.0.0.1:{self.port}/callback")
        self.assertTrue(sent["state"])

    def test_the_token_request_names_the_resource_and_its_verifier_matches_the_challenge(self) -> None:
        form = self.auth.token_forms[0]
        sent = self.auth.authorize_queries[-1]
        self.assertEqual(form["resource"], self.mcp.url)
        self.assertEqual(sha256_challenge(form["code_verifier"]), sent["code_challenge"])
        self.assertGreaterEqual(len(form["code_verifier"]), 43)
        self.assertEqual(form["grant_type"], "authorization_code")
        self.assertNotIn("client_secret", form)

    def test_the_link_is_printed_once_on_stderr_and_is_what_the_browser_opened(self) -> None:
        self.assertEqual(len(self.browser.opened), 1)
        printed = [line for line in self.err.splitlines() if line.startswith("Open this link")]
        self.assertEqual(len(printed), 1)
        self.assertTrue(printed[0].endswith(self.browser.opened[0]))

    def test_the_stored_tokens_are_the_ones_the_server_issued(self) -> None:
        stored = credentials.read_credentials()
        self.assertEqual(stored["access_token"], make_token(self.auth.access_claims))
        self.assertEqual(stored["refresh_token"], "refresh-1")

    def test_the_credential_directory_and_file_are_0700_and_0600(self) -> None:
        self.assertEqual(stat.S_IMODE(os.stat(credentials.locate_config_dir()).st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(os.stat(credentials.locate_credentials()).st_mode), 0o600)

    def test_whoami_reports_logged_in_afterwards(self) -> None:
        code, out, _ = run_cli("whoami")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["logged_in"], True)

    def test_every_request_carries_the_cli_user_agent_not_pythons(self) -> None:
        agents = {agent for _, _, agent in self.auth.requests} | {r["user_agent"] for r in self.mcp.requests}
        self.assertEqual(agents, {http_json.USER_AGENT})
        self.assertTrue(http_json.USER_AGENT.startswith("lulu-board-cli/"))

    def test_the_callback_port_is_free_again(self) -> None:
        self.assert_port_released()


class RepeatLoginTest(LoginCase):
    def test_every_login_registers_a_new_client_and_keeps_the_latest(self) -> None:
        self.assertEqual(self.login()[0], 0)
        self.assertEqual(self.login()[0], 0)
        self.assertEqual(len(self.auth.registrations), 2)
        self.assertEqual(credentials.read_credentials()["client_id"], "client-2")
        self.assertEqual([form["client_id"] for form in self.auth.token_forms], ["client-1", "client-2"])

    def test_a_client_id_stored_by_an_earlier_login_is_never_used_to_authorize(self) -> None:
        self.auth.clients["client-old"] = [f"http://127.0.0.1:{self.port}/callback"]
        credentials.update_credentials({"client_id": "client-old", "token_endpoint": "https://old.example/token"})
        code, _, err = self.login()
        self.assertEqual(code, 0, err)
        used = {query["client_id"] for query in self.auth.authorize_queries}
        self.assertEqual(used, {"client-1"})
        stored = credentials.read_credentials()
        self.assertEqual(stored["client_id"], "client-1")
        self.assertEqual(stored["token_endpoint"], self.auth.base + "/auth/v1/oauth/token")

    def test_each_login_uses_a_fresh_unguessable_state_and_verifier(self) -> None:
        self.assertEqual(self.login()[0], 0)
        self.assertEqual(self.login()[0], 0)
        states = {query["state"] for query in self.auth.authorize_queries}
        self.assertEqual(len(states), 2)
        self.assertTrue(all(len(state) >= 16 for state in states))
        verifiers = {form["code_verifier"] for form in self.auth.token_forms}
        self.assertEqual(len(verifiers), 2)

    def test_a_login_replaces_the_tokens_of_an_earlier_one(self) -> None:
        credentials.update_credentials({"access_token": "old-access", "refresh_token": "old-refresh"})
        self.assertEqual(self.login()[0], 0)
        stored = credentials.read_credentials()
        self.assertNotIn("old", stored["access_token"] + stored["refresh_token"])

    def test_a_damaged_credential_file_is_replaced(self) -> None:
        directory = credentials.locate_config_dir()
        directory.mkdir(parents=True)
        (directory / credentials.FILE_NAME).write_text("{not json", encoding="utf-8")
        code, _, err = self.login()
        self.assertEqual(code, 0, err)
        self.assertEqual(credentials.read_credentials()["client_id"], "client-1")


class ApprovedBeforeTest(LoginCase):
    """The server approves a client the user approved once without a click, and the consent page then
    never returns to the callback. A reused client_id hung login on exactly that. A new one does not."""

    outcome = "consent_page"
    wait_seconds = 3

    def test_a_second_login_still_reaches_the_callback(self) -> None:
        self.assertEqual(self.login()[0], 0)
        code, _, err = self.login()
        self.assertEqual(code, 0, err)
        self.assertEqual([query["client_id"] for query in self.auth.authorize_queries], ["client-1", "client-2"])
        self.assertEqual(self.auth.consented, {"client-1", "client-2"})


class AccountTest(LoginCase):
    def test_a_token_without_an_email_leaves_it_out(self) -> None:
        self.auth.access_claims = {"sub": "user-9", "exp": FUTURE}
        code, out, _ = self.login()
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out), {"logged_in": True, "user_id": "user-9"})

    def test_a_token_with_no_claims_gives_a_bare_login(self) -> None:
        self.auth.access_claims = {}
        code, out, _ = self.login()
        self.assertEqual((code, json.loads(out)), (0, {"logged_in": True}))


class StrayRequestTest(LoginCase):
    outcome = "stray_then_approve"

    def test_a_request_with_the_wrong_state_or_path_does_not_end_the_login(self) -> None:
        code, out, err = self.login()
        self.assertEqual(code, 0, err)
        self.assertEqual(json.loads(out)["logged_in"], True)
        self.assertEqual(self.auth.token_forms[0]["code"], "code-1")


class UsageTest(LoginCase):
    def test_login_needs_the_metadata_address(self) -> None:
        code, out, err = run_cli("login")
        self.assertEqual((code, out), (2, ""))
        self.assertIn("--resource-metadata-url", err)
        self.assert_nothing_contacted()

    def test_login_takes_no_other_arguments(self) -> None:
        code, out, _ = self.login("--user", "me")
        self.assertEqual((code, out), (2, ""))
        self.assert_nothing_contacted()

    def test_help_documents_login(self) -> None:
        _, out, _ = run_cli("--help")
        for word in ("login --resource-metadata-url URL", "PKCE", "48621", "300 seconds", "client_id", "resource="):
            self.assertIn(word, out)

    def test_the_real_port_and_wait_are_the_documented_ones(self) -> None:
        self.assertEqual(self.real_port, 48621)
        self.assertEqual(self.real_wait, 300)


if __name__ == "__main__":
    unittest.main()
