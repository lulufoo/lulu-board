"""board-cli login: every way it can fail leaves no tokens behind and says why on one stderr line."""
from __future__ import annotations

import json
import socket
import time
import unittest

from board_cli_support import run_cli
from board_cli import credentials, oauth_client
from login_support import LoginCase, find_free_port


class FailureCase(LoginCase):
    def assert_fails(self, *words: str) -> str:
        code, out, err = run_cli("login")
        self.assertEqual((code, out), (1, ""), err)
        lines = [line for line in err.splitlines() if not line.startswith("Open this link")]
        self.assertEqual(len(lines), 1, err)
        for word in words:
            self.assertIn(word, lines[0])
        return err

    def assert_no_tokens(self) -> None:
        stored = credentials.read_credentials() or {}
        self.assertNotIn("access_token", stored)
        self.assertNotIn("refresh_token", stored)


class PortBusyTest(FailureCase):
    def test_a_busy_port_fails_before_anything_is_contacted_or_registered(self) -> None:
        with socket.socket() as holder:
            holder.bind(("127.0.0.1", self.port))
            holder.listen()
            self.assert_fails(f"callback port {self.port} is in use", "run login again")
        self.assertEqual(self.auth.requests, [])
        self.assertEqual(self.auth.registrations, [])
        self.assertEqual(self.browser.opened, [])
        self.assertIsNone(credentials.read_credentials())


class NoAnswerTest(FailureCase):
    outcome = "nothing"
    wait_seconds = 1

    def test_the_wait_lasts_as_long_as_it_says(self) -> None:
        started = time.monotonic()
        self.assert_fails("no authorization within 1 seconds")
        self.assertTrue(0.9 <= time.monotonic() - started < 4)

    def test_no_approval_in_time_fails_and_stores_no_tokens(self) -> None:
        self.assert_fails("no authorization within 1 seconds", "run login again")
        self.assert_no_tokens()
        self.assertEqual(len(self.browser.opened), 1)
        self.assertEqual(self.auth.token_forms, [])

    def test_the_port_is_released_after_the_wait(self) -> None:
        self.assert_fails("no authorization")
        self.assert_port_released()


class DeniedTest(FailureCase):
    outcome = "deny"

    def test_a_refusal_in_the_browser_fails_with_the_servers_reason(self) -> None:
        self.assert_fails("authorization was refused: the user said no")
        self.assert_no_tokens()
        self.assertEqual(self.auth.token_forms, [])


class ServerRefusalTest(FailureCase):
    def test_a_refused_token_exchange_fails_and_stores_no_tokens(self) -> None:
        self.auth.refuse_token = True
        self.assert_fails("token exchange failed: HTTP 400", "code or verifier does not match")
        self.assert_no_tokens()

    def test_a_server_that_gives_no_refresh_token_fails(self) -> None:
        self.auth.omit_refresh_token = True
        self.assert_fails("token exchange gave no refresh token")
        self.assert_no_tokens()

    def test_a_refused_registration_fails_and_opens_no_browser(self) -> None:
        self.auth.refuse_registration = True
        self.assert_fails("client registration was refused: HTTP 400", "registration is closed")
        self.assertEqual(self.browser.opened, [])
        self.assertIsNone((credentials.read_credentials() or {}).get("client_id"))

    def test_a_refusal_of_a_new_client_is_a_failure_not_a_retry_loop(self) -> None:
        self.auth.force_authorize_status = 500
        self.assert_fails("authorization server refused the request: HTTP 500: boom")
        self.assertEqual(len(self.auth.registrations), 1)
        self.assertEqual(self.browser.opened, [])

    def test_a_stored_client_that_is_refused_for_another_reason_is_not_replaced(self) -> None:
        credentials.update_credentials({"client_id": "client-kept"})
        self.auth.force_authorize_status = 500
        self.assert_fails("HTTP 500")
        self.assertEqual(self.auth.registrations, [])
        self.assertEqual(credentials.read_credentials()["client_id"], "client-kept")


class UnreachableTest(FailureCase):
    def test_a_server_that_cannot_be_reached_fails_and_frees_the_port(self) -> None:
        dead = find_free_port()
        self.patch_in(oauth_client, "METADATA_URL", f"http://127.0.0.1:{dead}/meta")
        self.assert_fails(f"cannot reach 127.0.0.1:{dead}")
        self.assertEqual(self.browser.opened, [])
        self.assert_port_released()

    def test_missing_metadata_fails_with_the_status(self) -> None:
        self.patch_in(oauth_client, "METADATA_URL", self.auth.base + "/nope")
        self.assert_fails("authorization server metadata unavailable: HTTP 404")
        self.assertEqual(self.auth.registrations, [])


class SecretsStayOutTest(FailureCase):
    def test_a_failed_exchange_prints_no_code_or_verifier(self) -> None:
        self.auth.refuse_token = True
        err = self.assert_fails("token exchange failed")
        form = self.auth.token_forms[0]
        self.assertNotIn(form["code_verifier"], err)
        self.assertNotIn(form["code"], err.replace(self.browser.opened[0], ""))


if __name__ == "__main__":
    unittest.main()
