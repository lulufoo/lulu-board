"""api_client.call_api: the Bearer call, the one refresh-and-retry on 401, and the login-required end."""
from __future__ import annotations

import json
import socket
import unittest
import urllib.parse

from cloud_support import CloudCase
from board_cli.auth import credentials, token_manager
from board_cli.cloud import api_client
from board_cli.core import http_json
from board_cli.core.cli_errors import LoginRequired


class RequestShapeTest(CloudCase):
    def test_it_sends_the_bearer_token_the_user_agent_and_accept(self) -> None:
        access = self.store_login()
        reply = api_client.call_api("GET", "/graphs")
        self.assertEqual((reply.status, reply.read_json()), (200, {"ok": True}))
        sent = self.api.requests[0]
        self.assertEqual(sent["authorization"], f"Bearer {access}")
        self.assertEqual(sent["user_agent"], http_json.USER_AGENT)
        self.assertEqual(sent["accept"], "application/json")
        self.assertIsNone(sent["content_type"])

    def test_the_query_is_encoded(self) -> None:
        self.store_login()
        api_client.call_api("GET", "/graphs", query={"diagram_id": "b_0fc10001", "x": "a b&c"})
        path = self.api.requests[0]["path"]
        self.assertEqual(urllib.parse.urlparse(path).path, "/graphs")
        self.assertEqual(urllib.parse.parse_qs(urllib.parse.urlparse(path).query),
                         {"diagram_id": ["b_0fc10001"], "x": ["a b&c"]})

    def test_no_query_means_no_question_mark(self) -> None:
        self.store_login()
        api_client.call_api("GET", "/graphs", query={})
        self.assertEqual(self.api.requests[0]["path"], "/graphs")

    def test_a_body_is_sent_as_utf8_json_with_its_content_type(self) -> None:
        self.store_login()
        api_client.call_api("PATCH", "/graphs", body={"title": "图", "expected_version": 3})
        sent = self.api.requests[0]
        self.assertEqual(sent["method"], "PATCH")
        self.assertEqual(sent["content_type"], "application/json")
        self.assertEqual(json.loads(sent["body"].decode("utf-8")), {"title": "图", "expected_version": 3})

    def test_a_post_with_an_empty_object_still_sends_a_body(self) -> None:
        self.store_login()
        api_client.call_api("POST", "/groups/shells", body={})
        self.assertEqual(self.api.requests[0]["body"], b"{}")


class ReplyHandlingTest(CloudCase):
    def test_a_status_other_than_401_is_returned_for_the_command_to_read(self) -> None:
        self.store_login()
        for status in (404, 409, 500):
            self.api.status = status
            self.assertEqual(api_client.call_api("GET", "/graphs").status, status)
        self.assertEqual(self.auth.refreshes, 0)
        self.assertEqual(len(self.api.requests), 3)

    def test_an_unreachable_api_is_an_ordinary_error(self) -> None:
        self.store_login()
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            dead = probe.getsockname()[1]
        self.patch_in(api_client, "API_HOST", f"http://127.0.0.1:{dead}")
        with self.assertRaisesRegex(RuntimeError, rf"^cannot reach 127\.0\.0\.1:{dead}") as caught:
            api_client.call_api("GET", "/graphs")
        self.assertNotIsInstance(caught.exception, LoginRequired)


class RefreshBeforeCallTest(CloudCase):
    def test_an_expired_token_is_refreshed_so_the_server_sees_only_the_new_one(self) -> None:
        old = self.store_login(exp=self.expired())
        reply = api_client.call_api("GET", "/graphs")
        self.assertEqual(reply.status, 200)
        self.assertEqual(len(self.api.requests), 1)
        self.assertNotEqual(self.api.tokens_seen()[0], old)
        self.assertEqual(self.api.tokens_seen()[0], credentials.read_credentials()["access_token"])
        self.assertEqual(self.auth.refreshes, 1)


class RetryOn401Test(CloudCase):
    def test_a_rejected_token_is_refreshed_and_the_call_retried_once(self) -> None:
        old = self.store_login()
        self.auth.valid_access_tokens.discard(old)  # the server revoked it; it still looks fresh
        reply = api_client.call_api("PATCH", "/graphs", body={"expected_version": 2})
        self.assertEqual(reply.status, 200)
        tokens = self.api.tokens_seen()
        self.assertEqual(len(tokens), 2)
        self.assertEqual(tokens[0], old)
        self.assertNotEqual(tokens[1], old)
        self.assertEqual(credentials.read_credentials()["access_token"], tokens[1])
        self.assertEqual(credentials.read_credentials()["refresh_token"], "refresh-rotated-1")
        self.assertEqual(self.auth.refreshes, 1)

    def test_the_retry_sends_the_same_request(self) -> None:
        old = self.store_login()
        self.auth.valid_access_tokens.discard(old)
        api_client.call_api("PATCH", "/graphs", query={"a": "1"}, body={"title": "t"})
        first, second = self.api.requests
        for key in ("method", "path", "body", "content_type"):
            self.assertEqual(first[key], second[key], key)

    def test_a_second_401_is_login_required_after_exactly_one_retry(self) -> None:
        self.store_login()
        self.api.reject_all = True
        with self.assertRaises(LoginRequired) as caught:
            api_client.call_api("GET", "/graphs")
        self.assertEqual(str(caught.exception), token_manager.REFUSED)
        self.assertEqual(len(self.api.requests), 2)
        self.assertEqual(self.auth.refreshes, 1)

    def test_a_refused_refresh_after_a_401_is_login_required(self) -> None:
        old = self.store_login()
        self.auth.valid_access_tokens.discard(old)
        self.auth.live_refresh.clear()
        with self.assertRaises(LoginRequired):
            api_client.call_api("GET", "/graphs")
        self.assertEqual(len(self.api.requests), 1)

    def test_a_401_with_no_refresh_token_is_login_required(self) -> None:
        old = self.store_login(refresh=None, client=None)
        self.auth.valid_access_tokens.discard(old)
        with self.assertRaises(LoginRequired):
            api_client.call_api("GET", "/graphs")
        self.assertEqual(self.auth.requests, [])

    def test_a_token_another_process_stored_meanwhile_is_tried_without_a_refresh(self) -> None:
        old = self.store_login()
        self.auth.valid_access_tokens.discard(old)
        # Between our 401 and our refresh, another process stores a new token. Simulate it
        # by storing it from the API fake's first answer.
        newer = {}
        original = self.api.accepts

        def accept_and_swap(token: str) -> bool:
            if not newer:
                newer["token"] = self.store_login(refresh="refresh-other")
            return original(token)

        self.api.accepts = accept_and_swap
        reply = api_client.call_api("GET", "/graphs")
        self.assertEqual(reply.status, 200)
        self.assertEqual(self.api.tokens_seen(), [old, newer["token"]])
        self.assertEqual(self.auth.refreshes, 0)


class NoLoginTest(CloudCase):
    def test_no_login_means_login_required_and_no_request_at_all(self) -> None:
        with self.assertRaises(LoginRequired) as caught:
            api_client.call_api("GET", "/graphs")
        self.assertEqual(str(caught.exception), token_manager.NOT_LOGGED_IN)
        self.assertEqual((self.api.requests, self.auth.requests), ([], []))


if __name__ == "__main__":
    unittest.main()
