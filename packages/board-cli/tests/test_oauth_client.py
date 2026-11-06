"""The OAuth and HTTP helpers on their own: PKCE, the authorize address, one HTTP request."""
from __future__ import annotations

import base64
import hashlib
import json
import threading
import unittest
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import patch

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.auth import oauth_client
from board_cli.core import http_json

METADATA = {"authorization_endpoint": "https://auth.example/authorize"}


class PkceTest(unittest.TestCase):
    def test_the_challenge_is_the_unpadded_urlsafe_sha256_of_the_verifier(self) -> None:
        verifier, challenge = oauth_client.make_pkce()
        digest = hashlib.sha256(verifier.encode("ascii")).digest()
        self.assertEqual(challenge, base64.urlsafe_b64encode(digest).rstrip(b"=").decode())

    def test_the_verifier_is_long_enough_and_uses_only_allowed_characters(self) -> None:
        verifier, _ = oauth_client.make_pkce()
        self.assertTrue(43 <= len(verifier) <= 128)
        self.assertRegex(verifier, r"^[A-Za-z0-9_-]+$")

    def test_each_pair_is_fresh(self) -> None:
        self.assertNotEqual(oauth_client.make_pkce()[0], oauth_client.make_pkce()[0])


class AuthorizeUrlTest(unittest.TestCase):
    def test_it_carries_every_parameter_and_encodes_the_redirect(self) -> None:
        url = oauth_client.build_authorize_url(METADATA, "cid", "http://127.0.0.1:1/callback", "chal", "st")
        base, _, query = url.partition("?")
        self.assertEqual(base, "https://auth.example/authorize")
        self.assertEqual({k: v[0] for k, v in urllib.parse.parse_qs(query).items()}, {
            "response_type": "code", "client_id": "cid", "redirect_uri": "http://127.0.0.1:1/callback",
            "code_challenge": "chal", "code_challenge_method": "S256", "state": "st",
            "scope": "openid email offline_access", "resource": "https://mcp.luluboard.app/mcp",
        })
        self.assertNotIn("http://127", query)


class DescribeFailureTest(unittest.TestCase):
    def test_it_prefers_the_description_then_msg_then_error(self) -> None:
        make = lambda body: http_json.Response(400, {}, json.dumps(body))
        self.assertEqual(oauth_client.describe_failure(make({"error_description": "d", "msg": "m", "error": "e"})), "HTTP 400: d")
        self.assertEqual(oauth_client.describe_failure(make({"msg": "m", "error": "e"})), "HTTP 400: m")
        self.assertEqual(oauth_client.describe_failure(make({"error": "e"})), "HTTP 400: e")

    def test_it_gives_only_the_status_when_the_body_is_not_json(self) -> None:
        self.assertEqual(oauth_client.describe_failure(http_json.Response(502, {}, "<html>")), "HTTP 502")

    def test_a_long_reason_is_cut(self) -> None:
        reply = http_json.Response(400, {}, json.dumps({"msg": "x" * 500}))
        self.assertEqual(len(oauth_client.describe_failure(reply)), len("HTTP 400: ") + 120)


class OneServerCase(unittest.TestCase):
    """A loopback server whose answer each test sets."""

    def setUp(self) -> None:
        self.status, self.headers, self.body = 200, {}, b"{}"
        case = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format, *args) -> None:
                pass

            def do_GET(self) -> None:
                sent = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                case.seen = {"path": self.path, "agent": self.headers.get("User-Agent"), "body": sent}
                self.send_response(case.status)
                for name, value in case.headers.items():
                    self.send_header(name, value)
                self.send_header("Content-Length", str(len(case.body)))
                self.end_headers()
                self.wfile.write(case.body)

            do_POST = do_GET

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/x"
        thread = threading.Thread(target=self.server.serve_forever, args=(0.01,), daemon=True)
        thread.start()
        self.addCleanup(thread.join, 5)
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)


class HttpJsonTest(OneServerCase):
    def test_it_sends_the_cli_user_agent(self) -> None:
        http_json.send_request("GET", self.url)
        self.assertEqual(self.seen["agent"], http_json.USER_AGENT)

    def test_a_caller_header_wins_over_the_default(self) -> None:
        http_json.send_request("GET", self.url, {"User-Agent": "mine"})
        self.assertEqual(self.seen["agent"], "mine")

    def test_the_default_headers_are_not_changed_by_a_call(self) -> None:
        given = {"X-One": "1"}
        http_json.send_request("GET", self.url, given)
        self.assertEqual(given, {"X-One": "1"})

    def test_a_redirect_is_returned_not_followed(self) -> None:
        self.status, self.headers = 302, {"Location": "http://127.0.0.1:1/never"}
        reply = http_json.send_request("GET", self.url)
        self.assertEqual((reply.status, reply.headers["location"]), (302, "http://127.0.0.1:1/never"))

    def test_an_error_status_is_returned_with_its_body(self) -> None:
        self.status, self.body = 400, b'{"msg": "no"}'
        reply = http_json.send_request("GET", self.url)
        self.assertEqual((reply.status, reply.read_json()), (400, {"msg": "no"}))

    def test_a_refused_connection_raises_one_readable_error(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        with self.assertRaisesRegex(RuntimeError, r"^cannot reach 127\.0\.0\.1:\d+: "):
            http_json.send_request("GET", self.url)

    def test_a_server_that_never_answers_raises_after_the_timeout(self) -> None:
        self.server.shutdown()  # the socket still listens, so the request is accepted and never answered
        with patch.object(http_json, "TIMEOUT_SECONDS", 0.3):
            with self.assertRaisesRegex(RuntimeError, r"^cannot reach 127\.0\.0\.1:\d+: .*timed out"):
                http_json.send_request("GET", self.url)

    def test_read_json_gives_none_for_anything_but_an_object(self) -> None:
        for text in ("", "not json", "[1]", "3", '"s"'):
            self.assertIsNone(http_json.Response(200, {}, text).read_json(), text)


class RefreshTokensTest(OneServerCase):
    def refresh(self) -> dict:
        return oauth_client.refresh_tokens(self.url, "cid", "old-refresh")

    def test_it_posts_the_refresh_grant_as_a_form(self) -> None:
        self.body = json.dumps({"access_token": "a", "refresh_token": "r"}).encode()
        self.assertEqual(self.refresh(), {"access_token": "a", "refresh_token": "r"})
        self.assertEqual(urllib.parse.parse_qs(self.seen["body"].decode()),
                         {"grant_type": ["refresh_token"], "refresh_token": ["old-refresh"], "client_id": ["cid"],
                          "resource": ["https://mcp.luluboard.app/mcp"]})
        self.assertEqual(self.seen["agent"], http_json.USER_AGENT)

    def test_a_reply_without_a_refresh_token_is_fine(self) -> None:
        self.body = b'{"access_token": "a"}'
        self.assertEqual(self.refresh()["access_token"], "a")

    def test_400_and_401_are_a_refusal_of_the_refresh_token(self) -> None:
        for status in (400, 401):
            self.status, self.body = status, b'{"error": "invalid_grant", "error_description": "Refresh Token Not Found"}'
            with self.assertRaisesRegex(oauth_client.RefreshRejected,
                                        rf"^the server refused the refresh token: HTTP {status}: Refresh Token Not Found$"):
                self.refresh()

    def test_other_failures_are_not_a_refusal(self) -> None:
        for status in (403, 429, 500, 503):
            self.status, self.body = status, b'{"msg": "later"}'
            with self.assertRaises(RuntimeError) as caught:
                self.refresh()
            self.assertNotIsInstance(caught.exception, oauth_client.RefreshRejected, status)
            self.assertEqual(str(caught.exception), f"token refresh failed: HTTP {status}: later")

    def test_a_200_that_is_not_a_json_object_fails(self) -> None:
        self.body = b"<html>"
        with self.assertRaisesRegex(RuntimeError, r"^token refresh failed: HTTP 200$"):
            self.refresh()

    def test_a_200_without_an_access_token_fails(self) -> None:
        for body in (b"{}", b'{"access_token": ""}', b'{"access_token": 7}'):
            self.body = body
            with self.assertRaisesRegex(RuntimeError, r"^token refresh gave no access token$"):
                self.refresh()


if __name__ == "__main__":
    unittest.main()
