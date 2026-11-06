"""The fake MCP server and the fake authorization server the later CLI tests stand on."""
from __future__ import annotations

import json
import unittest

from board_cli_support import make_token
from board_cli.auth.login_callback import CallbackServer
from board_cli.core import http_json
from fake_auth_server import FUTURE, FakeAuthServer, FakeBrowser
from fake_mcp_server import FakeMcpServer
from login_support import find_free_port

BOTH_TYPES = "application/json, text/event-stream"


def rpc(name: str, arguments: dict) -> bytes:
    return json.dumps({"jsonrpc": "2.0", "id": 7, "method": "tools/call",
                       "params": {"name": name, "arguments": arguments}}).encode()


class McpCase(unittest.TestCase):
    def setUp(self) -> None:
        self.auth = FakeAuthServer().start()
        self.addCleanup(self.auth.stop)
        self.mcp = FakeMcpServer(self.auth).start()
        self.addCleanup(self.mcp.stop)
        self.token = make_token({"sub": "user-1", "exp": FUTURE})
        self.auth.valid_access_tokens.add(self.token)

    def post(self, body: bytes, token: str | None = None, accept: str = BOTH_TYPES) -> http_json.Response:
        headers = {"Content-Type": "application/json", "Accept": accept}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        return http_json.send_request("POST", self.mcp.url, headers, body)

    def call(self, name: str, arguments: dict) -> http_json.Response:
        return self.post(rpc(name, arguments), self.token)


class UnauthorizedTest(McpCase):
    def test_a_request_without_a_token_is_401_with_the_metadata_address(self) -> None:
        reply = self.post(rpc("whoami", {}))
        self.assertEqual(reply.status, 401)
        self.assertEqual(reply.headers["www-authenticate"],
                         f'Bearer realm="lulu-board", resource_metadata="{self.mcp.base}/.well-known/oauth-protected-resource"')
        self.assertEqual(reply.read_json(), {"error": "invalid_token"})

    def test_a_token_the_server_never_issued_is_401_too(self) -> None:
        reply = self.post(rpc("whoami", {}), token="made-up")
        self.assertEqual(reply.status, 401)
        self.assertIn("resource_metadata=", reply.headers["www-authenticate"])

    def test_an_expired_token_is_401(self) -> None:
        expired = make_token({"sub": "user-1", "exp": 1})
        self.auth.valid_access_tokens.add(expired)
        self.assertEqual(self.post(rpc("whoami", {}), token=expired).status, 401)

    def test_the_401_comes_before_the_body_is_read(self) -> None:
        self.assertEqual(self.post(b"not json").status, 401)


class MetadataTest(McpCase):
    def test_the_protected_resource_metadata_names_the_resource_and_its_authorization_server(self) -> None:
        for path in ("/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"):
            reply = http_json.send_request("GET", self.mcp.base + path)
            self.assertEqual(reply.status, 200, path)
            self.assertEqual(reply.read_json(), {
                "resource": self.mcp.url,
                "authorization_servers": [self.auth.base + "/auth/v1"],
                "bearer_methods_supported": ["header"],
            })

    def test_the_address_in_the_401_is_the_one_that_serves_the_metadata(self) -> None:
        challenge = self.post(rpc("whoami", {})).headers["www-authenticate"]
        address = challenge.split('resource_metadata="', 1)[1].rstrip('"')
        self.assertEqual(http_json.send_request("GET", address).status, 200)


class ToolCallTest(McpCase):
    def test_a_json_reply_carries_the_tool_result_as_one_json_text(self) -> None:
        self.mcp.answer_tool("whoami", {"email": "me@example.com", "user_id": "user-1"})
        reply = self.call("whoami", {})
        self.assertEqual(reply.status, 200)
        self.assertEqual(reply.headers["content-type"], "application/json")
        message = reply.read_json()
        self.assertEqual((message["jsonrpc"], message["id"]), ("2.0", 7))
        content = message["result"]["content"]
        self.assertEqual(len(content), 1)
        self.assertEqual(content[0]["type"], "text")
        self.assertEqual(json.loads(content[0]["text"]), {"email": "me@example.com", "user_id": "user-1"})
        self.assertNotIn("isError", message["result"])

    def test_an_sse_reply_carries_the_same_message_in_one_event(self) -> None:
        self.mcp.answer_tool("whoami", {"email": "me@example.com"})
        self.mcp.response_format = "sse"
        reply = self.call("whoami", {})
        self.assertEqual(reply.status, 200)
        self.assertEqual(reply.headers["content-type"], "text/event-stream")
        self.assertTrue(reply.text.startswith("event: message\ndata: "))
        self.assertTrue(reply.text.endswith("\n\n"))
        message = json.loads(reply.text.split("data: ", 1)[1])
        self.assertEqual(json.loads(message["result"]["content"][0]["text"]), {"email": "me@example.com"})

    def test_a_tool_error_is_a_result_with_is_error_and_plain_text(self) -> None:
        self.mcp.fail_tool("get_diagram", "Cloud board not found")
        result = self.call("get_diagram", {"diagram_id": "b_00000000"}).read_json()["result"]
        self.assertEqual(result, {"content": [{"type": "text", "text": "Cloud board not found"}], "isError": True})

    def test_an_unknown_tool_and_an_unknown_method_are_json_rpc_errors(self) -> None:
        self.assertEqual(self.call("no_such_tool", {}).read_json()["error"]["code"], -32602)
        reply = self.post(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize"}).encode(), self.token)
        self.assertEqual(reply.read_json()["error"]["code"], -32601)

    def test_a_client_that_does_not_accept_both_reply_types_is_refused_with_406(self) -> None:
        self.assertEqual(self.post(rpc("whoami", {}), self.token, accept="application/json").status, 406)
        self.assertEqual(self.post(rpc("whoami", {}), self.token, accept="text/event-stream").status, 406)

    def test_the_fake_records_what_it_was_sent(self) -> None:
        self.mcp.answer_tool("get_group", {"group_id": "g_00000000", "members": []})
        self.call("get_group", {"diagram_id": "b_00000001"})
        self.assertEqual(self.mcp.list_calls("get_group"), [{"diagram_id": "b_00000001"}])
        self.assertEqual(self.mcp.list_methods(), ["tools/call"])
        sent = self.mcp.requests[-1]
        self.assertEqual(sent["authorization"], f"Bearer {self.token}")
        self.assertEqual(sent["accept"], BOTH_TYPES)
        self.assertTrue(sent["user_agent"].startswith("lulu-board-cli/"))


class RegistrationTest(unittest.TestCase):
    def test_every_registration_returns_a_new_client_id(self) -> None:
        auth = FakeAuthServer().start()
        self.addCleanup(auth.stop)
        url = auth.base + "/auth/v1/oauth/clients/register"
        payload = json.dumps({"client_name": "x", "redirect_uris": ["http://127.0.0.1:1/callback"]}).encode()
        headers = {"Content-Type": "application/json"}
        ids = [http_json.send_request("POST", url, headers, payload).read_json()["client_id"] for _ in range(3)]
        self.assertEqual(len(set(ids)), 3)


class AutoApprovalTest(unittest.TestCase):
    """A client the user approved once is approved again without a click, and the page cannot finish."""

    def setUp(self) -> None:
        self.auth = FakeAuthServer().start()
        self.addCleanup(self.auth.stop)
        self.port = find_free_port()
        self.redirect = f"http://127.0.0.1:{self.port}/callback"
        self.auth.clients["client-1"] = [self.redirect]

    def authorize_url(self) -> str:
        return (self.auth.base + "/auth/v1/oauth/authorize?client_id=client-1&state=s1&code_challenge=c"
                + "&redirect_uri=" + self.redirect)

    def visit(self, browser: FakeBrowser, seconds: float) -> dict | None:
        """Open the link as the browser would; return the callback result, or None when it never came."""
        server = CallbackServer(self.port, "s1")
        try:
            browser(self.authorize_url())
            return server.wait_for_result(seconds)
        finally:
            server.server_close()
            browser.finish()

    def test_the_first_approval_is_pending_and_reaches_the_callback(self) -> None:
        self.assertEqual(self.auth.consent_outcome(self.authorize_url()), "pending")
        result = self.visit(FakeBrowser(self.auth, "consent_page"), 5)
        self.assertTrue(result["code"])

    def test_after_that_approval_the_same_client_is_auto_approved(self) -> None:
        self.visit(FakeBrowser(self.auth, "consent_page"), 5)
        self.assertEqual(self.auth.consent_outcome(self.authorize_url()), "auto_approved")

    def test_the_browser_never_reaches_the_callback_for_an_auto_approved_client(self) -> None:
        self.visit(FakeBrowser(self.auth, "consent_page"), 5)
        self.assertIsNone(self.visit(FakeBrowser(self.auth, "consent_page"), 1))

    def test_a_new_client_is_not_auto_approved(self) -> None:
        self.visit(FakeBrowser(self.auth, "consent_page"), 5)
        self.auth.clients["client-2"] = [self.redirect]
        url = self.authorize_url().replace("client-1", "client-2")
        self.assertEqual(self.auth.consent_outcome(url), "pending")


if __name__ == "__main__":
    unittest.main()
