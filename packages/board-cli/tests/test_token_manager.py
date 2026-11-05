"""token_manager: when the stored access token is used, refreshed, or replaced by a login."""
from __future__ import annotations

import threading
import time
import unittest

from cloud_support import CloudCase
from board_cli import credential_lock, credentials, token_manager
from board_cli.cli_errors import LoginRequired


class UseStoredTokenTest(CloudCase):
    def test_a_fresh_token_is_returned_without_any_network_call(self) -> None:
        access = self.store_login()
        self.assertEqual(token_manager.get_access_token(), access)
        self.assertEqual(self.auth.requests, [])

    def test_a_token_with_no_expiry_is_used_as_it_is(self) -> None:
        access = self.store_login(opaque="not-a-jwt")
        self.assertEqual(token_manager.get_access_token(), access)
        self.assertEqual(self.auth.requests, [])

    def test_a_token_with_no_refresh_token_is_used_while_it_is_fresh(self) -> None:
        access = self.store_login(refresh=None, client=None)
        self.assertEqual(token_manager.get_access_token(), access)

    def test_a_token_ending_in_two_minutes_is_not_refreshed(self) -> None:
        access = self.store_login(exp=self.ends_in(120))
        self.assertEqual(token_manager.get_access_token(), access)
        self.assertEqual(self.auth.refreshes, 0)

    def test_the_margin_is_one_minute(self) -> None:
        self.assertEqual(token_manager.REFRESH_MARGIN_SECONDS, 60)


class RefreshTest(CloudCase):
    def test_an_expired_token_is_refreshed_and_both_new_tokens_are_stored(self) -> None:
        old = self.store_login(exp=self.expired())
        new = token_manager.get_access_token()
        stored = credentials.read_credentials()
        self.assertNotEqual(new, old)
        self.assertEqual(stored["access_token"], new)
        self.assertEqual(stored["refresh_token"], "refresh-rotated-1")
        self.assertEqual(stored["client_id"], "client-seed")

    def test_the_refresh_sends_the_stored_refresh_token_and_client(self) -> None:
        self.store_login(exp=self.expired())
        token_manager.get_access_token()
        form = self.auth.token_forms[0]
        self.assertEqual((form["grant_type"], form["refresh_token"], form["client_id"]),
                         ("refresh_token", "refresh-seed", "client-seed"))
        self.assertNotIn("client_secret", form)

    def test_a_token_ending_within_the_margin_is_refreshed(self) -> None:
        self.store_login(exp=self.ends_in(30))
        token_manager.get_access_token()
        self.assertEqual(self.auth.refreshes, 1)

    def test_a_missing_access_token_is_refreshed_from_the_refresh_token(self) -> None:
        credentials.update_credentials({"refresh_token": "refresh-seed", "client_id": "client-seed"})
        self.auth.live_refresh.add("refresh-seed")
        self.auth.clients["client-seed"] = []
        token_manager.get_access_token()
        self.assertEqual(self.auth.refreshes, 1)

    def test_a_reply_without_a_new_refresh_token_keeps_the_old_one(self) -> None:
        self.auth.omit_new_refresh = True
        self.store_login(exp=self.expired())
        token_manager.get_access_token()
        self.assertEqual(credentials.read_credentials()["refresh_token"], "refresh-seed")

    def test_the_refreshed_credential_file_keeps_its_modes(self) -> None:
        import os, stat
        self.store_login(exp=self.expired())
        token_manager.get_access_token()
        self.assertEqual(stat.S_IMODE(os.stat(credentials.locate_credentials()).st_mode), 0o600)

    def test_a_refresh_uses_the_cli_user_agent(self) -> None:
        from board_cli import http_json
        self.store_login(exp=self.expired())
        token_manager.get_access_token()
        self.assertEqual({agent for _, _, agent in self.auth.requests}, {http_json.USER_AGENT})


class RejectedTokenTest(CloudCase):
    def test_a_token_the_server_rejected_is_replaced_even_though_it_looks_fresh(self) -> None:
        old = self.store_login()
        new = token_manager.get_access_token(rejected=old)
        self.assertNotEqual(new, old)
        self.assertEqual(self.auth.refreshes, 1)

    def test_a_token_another_process_stored_meanwhile_is_used_without_a_refresh(self) -> None:
        rejected = self.store_login()
        newer = self.store_login(refresh="refresh-other")
        self.assertEqual(token_manager.get_access_token(rejected=rejected), newer)
        self.assertEqual(self.auth.refreshes, 0)


class LoginRequiredTest(CloudCase):
    def assert_login_required(self, message: str, **kwargs) -> None:
        with self.assertRaises(LoginRequired) as caught:
            token_manager.get_access_token(**kwargs)
        self.assertEqual(str(caught.exception), message)

    def test_no_credential_file(self) -> None:
        self.assert_login_required(token_manager.NOT_LOGGED_IN)
        self.assertEqual(self.auth.requests, [])

    def test_a_file_with_only_the_client_id(self) -> None:
        credentials.update_credentials({"client_id": "client-seed"})
        self.assert_login_required(token_manager.NOT_LOGGED_IN)

    def test_an_expired_token_and_no_refresh_token(self) -> None:
        self.store_login(exp=self.expired(), refresh=None)
        self.assert_login_required(token_manager.INCOMPLETE)
        self.assertEqual(self.auth.requests, [])

    def test_a_refresh_token_and_no_client_id(self) -> None:
        self.store_login(exp=self.expired(), client=None)
        self.assert_login_required(token_manager.INCOMPLETE)
        self.assertEqual(self.auth.requests, [])

    def test_a_refused_refresh_token(self) -> None:
        self.store_login(exp=self.expired())
        self.auth.live_refresh.clear()
        self.assert_login_required(token_manager.REFUSED)

    def test_a_401_from_the_token_endpoint_is_a_refusal_too(self) -> None:
        self.store_login(exp=self.expired())
        self.auth.refresh_status = 401
        self.assert_login_required(token_manager.REFUSED)

    def test_a_refused_refresh_keeps_the_stored_tokens(self) -> None:
        self.store_login(exp=self.expired())
        self.auth.live_refresh.clear()
        before = credentials.read_credentials()
        with self.assertRaises(LoginRequired):
            token_manager.get_access_token()
        self.assertEqual(credentials.read_credentials(), before)

    def test_the_message_tells_the_user_to_run_login_and_holds_no_token(self) -> None:
        access = self.store_login(exp=self.expired())
        self.auth.live_refresh.clear()
        with self.assertRaises(LoginRequired) as caught:
            token_manager.get_access_token()
        self.assertIn("run login", str(caught.exception))
        self.assertNotIn(access, str(caught.exception))
        self.assertNotIn("refresh-seed", str(caught.exception))


class OrdinaryErrorTest(CloudCase):
    def test_a_server_error_during_refresh_is_not_a_login_problem(self) -> None:
        self.store_login(exp=self.expired())
        self.auth.refresh_status = 500
        before = credentials.read_credentials()
        with self.assertRaisesRegex(RuntimeError, r"^token refresh failed: HTTP 500: boom$") as caught:
            token_manager.get_access_token()
        self.assertNotIsInstance(caught.exception, LoginRequired)
        self.assertEqual(credentials.read_credentials(), before)

    def test_a_forbidden_reply_is_an_ordinary_error_too(self) -> None:
        self.store_login(exp=self.expired())
        self.auth.refresh_status = 403
        with self.assertRaises(RuntimeError) as caught:
            token_manager.get_access_token()
        self.assertNotIsInstance(caught.exception, LoginRequired)

    def test_a_damaged_credential_file_is_an_ordinary_error(self) -> None:
        directory = credentials.ensure_config_dir()
        (directory / credentials.FILE_NAME).write_text("{not json", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "credentials file is damaged") as caught:
            token_manager.get_access_token()
        self.assertNotIsInstance(caught.exception, LoginRequired)


class ConcurrencyTest(CloudCase):
    def test_processes_that_find_the_token_stale_together_refresh_once(self) -> None:
        self.store_login(exp=self.expired())
        results: list = []

        def call() -> None:
            try:
                results.append(token_manager.get_access_token())
            except Exception as err:  # reported through the assertion below
                results.append(err)

        threads = [threading.Thread(target=call) for _ in range(6)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        self.assertEqual(self.auth.refreshes, 1)
        self.assertEqual(len(results), 6)
        self.assertEqual(set(results), {credentials.read_credentials()["access_token"]})

    def test_a_process_that_waited_for_the_lock_uses_what_the_holder_stored(self) -> None:
        self.store_login(exp=self.expired())
        result: list = []
        with credential_lock.hold_lock(5):
            waiter = threading.Thread(target=lambda: result.append(token_manager.get_access_token()))
            waiter.start()
            time.sleep(0.3)  # the waiter has read the stale token and is waiting for the lock
            fresh = self.store_login(refresh="refresh-from-holder")
        waiter.join(timeout=10)
        self.assertEqual(result, [fresh])
        self.assertEqual(self.auth.refreshes, 0)

    def test_a_lock_held_too_long_is_an_ordinary_error(self) -> None:
        self.store_login(exp=self.expired())
        self.patch_in(token_manager, "LOCK_WAIT_SECONDS", 0.3)
        with credential_lock.hold_lock(5):
            started = time.monotonic()
            with self.assertRaisesRegex(RuntimeError, "another board-cli has held") as caught:
                token_manager.get_access_token()
        self.assertNotIsInstance(caught.exception, LoginRequired)
        self.assertLess(time.monotonic() - started, 5)
        self.assertEqual(self.auth.refreshes, 0)

    def test_the_lock_wait_is_longer_than_two_requests(self) -> None:
        from board_cli import http_json
        self.assertGreaterEqual(token_manager.LOCK_WAIT_SECONDS, 2 * http_json.TIMEOUT_SECONDS)


if __name__ == "__main__":
    unittest.main()
