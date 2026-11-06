"""board-cli login: every way it can fail leaves no tokens behind and says why on one stderr line."""
from __future__ import annotations

import socket
import time
import unittest

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.auth import credentials
from login_support import LoginCase, find_free_port


class FailureCase(LoginCase):
    def assert_fails(self, *words: str, address: str | None = None) -> str:
        code, out, err = self.login(address=address)
        self.assertEqual((code, out), (1, ""), err)
        lines = [line for line in err.splitlines() if not line.startswith("Open this link")]
        self.assertEqual(len(lines), 1, err)
        for word in words:
            self.assertIn(word, lines[0])
        return err

    def assert_no_tokens(self) -> None:
        stored = credentials.read_credentials() or {}
        for name in ("access_token", "refresh_token", "client_id", "token_endpoint"):
            self.assertNotIn(name, stored)


class PortBusyTest(FailureCase):
    def test_a_busy_port_fails_before_anything_is_contacted_or_registered(self) -> None:
        with socket.socket() as holder:
            holder.bind(("127.0.0.1", self.port))
            holder.listen()
            self.assert_fails(f"callback port {self.port} is in use", "run login again")
        self.assert_nothing_contacted()
        self.assertEqual(self.auth.registrations, [])
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


class AuthorizeRefusedTest(FailureCase):
    wait_seconds = 1

    def test_an_authorize_endpoint_that_refuses_never_reaches_the_callback(self) -> None:
        self.auth.force_authorize_status = 500
        self.assert_fails("no authorization within 1 seconds")
        self.assertEqual(len(self.auth.registrations), 1)
        self.assertEqual(self.auth.token_forms, [])
        self.assert_no_tokens()


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
        self.assertIsNone(credentials.read_credentials())

    def test_a_failed_login_leaves_an_earlier_login_as_it_was(self) -> None:
        credentials.update_credentials({"access_token": "a", "refresh_token": "r", "client_id": "c", "token_endpoint": "https://t"})
        self.auth.refuse_token = True
        self.assert_fails("token exchange failed")
        self.assertEqual(credentials.read_credentials(),
                         {"access_token": "a", "refresh_token": "r", "client_id": "c", "token_endpoint": "https://t"})


class UnreachableTest(FailureCase):
    def test_a_server_that_cannot_be_reached_fails_and_frees_the_port(self) -> None:
        dead = find_free_port()
        self.assert_fails(f"cannot reach 127.0.0.1:{dead}", address=f"http://127.0.0.1:{dead}/meta")
        self.assertEqual(self.browser.opened, [])
        self.assert_port_released()

    def test_missing_metadata_fails_with_the_status(self) -> None:
        self.assert_fails("the resource metadata unavailable: HTTP 404", address=self.mcp.base + "/nope")
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
