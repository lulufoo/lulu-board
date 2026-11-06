"""board-cli whoami: the login state from the local file, with no network."""
from __future__ import annotations

import json
import socket
import subprocess
import sys
import unittest
import urllib.request
from unittest.mock import patch

from board_cli_support import PACKAGE_ROOT, HomeCase, make_token, run_cli
from board_cli.auth import credentials

FUTURE = 4102444800  # 2100-01-01
PAST = 1
IDENTITY = {"email": "me@example.com", "sub": "user-123"}


class WhoamiCase(HomeCase):
    """Every test here fails on the first network attempt."""

    def setUp(self) -> None:
        super().setUp()
        for target, name in ((socket.socket, "connect"), (urllib.request, "urlopen")):
            patcher = patch.object(target, name, side_effect=AssertionError("whoami must not touch the network"))
            patcher.start()
            self.addCleanup(patcher.stop)

    def whoami(self) -> dict:
        code, out, err = run_cli("whoami")
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(len(out.splitlines()), 1)
        return json.loads(out)

    def store(self, **fields: str) -> None:
        credentials.update_credentials(fields)


class LoggedOutTest(WhoamiCase):
    def test_no_file_is_not_logged_in(self) -> None:
        self.assertEqual(self.whoami(), {"logged_in": False})

    def test_a_file_with_only_the_client_id_is_not_logged_in(self) -> None:
        self.store(client_id="c1")
        self.assertEqual(self.whoami(), {"logged_in": False})

    def test_a_file_with_only_the_client_id_and_the_token_endpoint_is_not_logged_in(self) -> None:
        self.store(client_id="c1", token_endpoint="https://auth.example/token")
        self.assertEqual(self.whoami(), {"logged_in": False})

    def test_an_expired_access_token_without_a_refresh_token_is_not_logged_in(self) -> None:
        self.store(access_token=make_token({**IDENTITY, "exp": PAST}))
        self.assertEqual(self.whoami(), {"logged_in": False})


class LoggedInTest(WhoamiCase):
    def test_a_live_token_reports_the_account(self) -> None:
        self.store(access_token=make_token({**IDENTITY, "exp": FUTURE}), refresh_token="r", client_id="c")
        self.assertEqual(self.whoami(), {"logged_in": True, "email": "me@example.com", "user_id": "user-123"})

    def test_an_expired_access_token_with_a_refresh_token_is_still_logged_in(self) -> None:
        self.store(access_token=make_token({**IDENTITY, "exp": PAST}), refresh_token="r")
        self.assertEqual(self.whoami(), {"logged_in": True, "email": "me@example.com", "user_id": "user-123"})

    def test_a_live_access_token_alone_is_logged_in(self) -> None:
        self.store(access_token=make_token({**IDENTITY, "exp": FUTURE}))
        self.assertTrue(self.whoami()["logged_in"])

    def test_a_token_without_exp_counts_as_live(self) -> None:
        self.store(access_token=make_token(IDENTITY))
        self.assertTrue(self.whoami()["logged_in"])

    def test_a_refresh_token_alone_is_logged_in_without_an_account(self) -> None:
        self.store(refresh_token="r")
        self.assertEqual(self.whoami(), {"logged_in": True})

    def test_an_access_token_that_is_not_a_jwt_leaves_the_account_out(self) -> None:
        self.store(access_token="opaque-token", refresh_token="r")
        self.assertEqual(self.whoami(), {"logged_in": True})

    def test_a_missing_email_is_left_out_not_guessed(self) -> None:
        self.store(access_token=make_token({"sub": "user-123", "exp": FUTURE}))
        self.assertEqual(self.whoami(), {"logged_in": True, "user_id": "user-123"})

    def test_claims_of_the_wrong_type_are_left_out(self) -> None:
        self.store(access_token=make_token({"email": 5, "sub": "", "exp": FUTURE}))
        self.assertEqual(self.whoami(), {"logged_in": True})

    def test_the_output_never_holds_a_token(self) -> None:
        token = make_token({**IDENTITY, "exp": FUTURE})
        self.store(access_token=token, refresh_token="secret-refresh", client_id="c-id")
        code, out, err = run_cli("whoami")
        for secret in (token, "secret-refresh", "c-id"):
            self.assertNotIn(secret, out + err)


class FailureTest(WhoamiCase):
    def test_a_damaged_file_is_an_ordinary_error(self) -> None:
        directory = credentials.locate_config_dir()
        directory.mkdir(parents=True)
        (directory / credentials.FILE_NAME).write_text("{not json", encoding="utf-8")
        code, out, err = run_cli("whoami")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("damaged", err)
        self.assertEqual(len(err.strip().splitlines()), 1)

    def test_an_extra_argument_is_a_usage_error(self) -> None:
        code, out, _ = run_cli("whoami", "--who", "me")
        self.assertEqual((code, out), (2, ""))

    def test_help_documents_whoami_and_the_credential_file(self) -> None:
        code, out, _ = run_cli("--help")
        self.assertEqual(code, 0)
        for word in ("whoami", "logged_in", "refresh token", "~/.config/lulu-board/credentials.json", "0600"):
            self.assertIn(word, out)

    def test_help_says_whoami_is_not_a_step_before_login(self) -> None:
        _, out, _ = run_cli("--help")
        self.assertIn("it is not a step before login", " ".join(out.split()))


class ProcessTest(WhoamiCase):
    def test_a_process_reads_the_credentials_under_its_own_home(self) -> None:
        self.store(access_token=make_token({**IDENTITY, "exp": FUTURE}), refresh_token="r")
        done = subprocess.run([sys.executable, "-m", "board_cli", "whoami"], capture_output=True, text=True,
                              cwd=PACKAGE_ROOT, env=self.env_with_home())
        self.assertEqual((done.returncode, done.stderr), (0, ""))
        self.assertEqual(json.loads(done.stdout), {"logged_in": True, "email": "me@example.com", "user_id": "user-123"})

    def test_a_process_with_no_credentials_reports_logged_out(self) -> None:
        done = subprocess.run([sys.executable, "-m", "board_cli", "whoami"], capture_output=True, text=True,
                              cwd=PACKAGE_ROOT, env=self.env_with_home())
        self.assertEqual((done.returncode, json.loads(done.stdout)), (0, {"logged_in": False}))


if __name__ == "__main__":
    unittest.main()
