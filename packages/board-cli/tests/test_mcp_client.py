"""One tools/call to the MCP server: request shape, JSON and SSE replies, 401, and every failure."""
from __future__ import annotations

import inspect
import json
import pathlib
import unittest
from unittest.mock import patch

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.cloud import mcp_client
from board_cli.cloud.mcp_client import ToolFailed, Unauthorized, call_tool
from board_cli.core import mcp_address
from board_cli.core.http_json import USER_AGENT
from login_support import find_free_port
from mcp_support import McpClientCase

DOC = {"diagram_id": "b_1", "title": "T", "bmd": "src", "version": 3}


class RequestShapeTests(McpClientCase):
    def test_the_call_is_a_json_rpc_tools_call_with_the_token(self) -> None:
        self.mcp.answer_tool("get_diagram", DOC)
        call_tool("get_diagram", {"diagram_id": "b_1"}, self.token)
        sent = self.mcp.requests[0]
        self.assertEqual(sent["message"]["method"], "tools/call")
        self.assertEqual(sent["message"]["params"], {"name": "get_diagram", "arguments": {"diagram_id": "b_1"}})
        self.assertEqual(sent["message"]["jsonrpc"], "2.0")
        self.assertEqual(sent["authorization"], f"Bearer {self.token}")

    def test_the_headers_accept_both_replies_and_name_the_cli(self) -> None:
        self.mcp.answer_tool("get_diagram", DOC)
        call_tool("get_diagram", {}, self.token)
        sent = self.mcp.requests[0]
        self.assertEqual(sent["accept"], "application/json, text/event-stream")
        self.assertEqual(sent["content_type"], "application/json")
        self.assertEqual(sent["user_agent"], USER_AGENT)

    def test_no_initialize_and_no_protocol_version_header(self) -> None:
        self.mcp.answer_tool("get_diagram", DOC)
        call_tool("get_diagram", {}, self.token)
        self.assertEqual(self.mcp.list_methods(), ["tools/call"])
        self.assertNotIn("mcp-protocol-version", self.mcp.requests[0]["headers"])
        self.assertNotIn("mcp-session-id", self.mcp.requests[0]["headers"])

    def test_a_call_without_a_token_sends_no_authorization(self) -> None:
        with self.assertRaises(Unauthorized):
            call_tool("get_diagram", {})
        self.assertEqual(self.mcp.requests[0]["authorization"], "")

    def test_non_ascii_arguments_arrive_whole(self) -> None:
        self.mcp.answer_tool("create_diagram", {"diagram_id": "b_2"})
        call_tool("create_diagram", {"source": "盒子 → 线"}, self.token)
        self.assertEqual(self.mcp.list_calls("create_diagram"), [{"source": "盒子 → 线"}])

    def test_the_address_is_built_in_and_has_no_override(self) -> None:
        for module in (mcp_address, mcp_client):  # MCP_URL itself is patched to the fake server here
            source = inspect.getsource(module)
            self.assertNotIn("os.environ", source)
            self.assertNotIn("getenv", source)
        self.assertIn('MCP_URL = "https://mcp.luluboard.app/mcp"', inspect.getsource(mcp_address))


class NoDirectApiTests(unittest.TestCase):
    def test_no_code_calls_the_api_directly(self) -> None:
        package = pathlib.Path(inspect.getfile(mcp_client)).parents[1]
        text = "\n".join(path.read_text(encoding="utf-8") for path in package.rglob("*.py"))
        for gone in ("api.luluboard.app", "API_HOST", "call_api", "api_client"):
            self.assertNotIn(gone, text)


class ReplyTests(McpClientCase):
    def test_a_json_reply_gives_the_tool_result(self) -> None:
        self.mcp.answer_tool("get_diagram", DOC)
        self.assertEqual(call_tool("get_diagram", {}, self.token), DOC)

    def test_an_sse_reply_gives_the_tool_result(self) -> None:
        self.mcp.response_format = "sse"
        self.mcp.answer_tool("get_diagram", DOC)
        self.assertEqual(call_tool("get_diagram", {}, self.token), DOC)

    def test_an_sse_reply_with_keepalive_priming_and_notification_gives_the_tool_result(self) -> None:
        self.mcp.response_format = "sse"
        self.mcp.sse_noise = True
        self.mcp.answer_tool("get_diagram", DOC)
        self.assertEqual(call_tool("get_diagram", {}, self.token), DOC)

    def test_a_list_result_comes_back_as_a_list(self) -> None:
        self.mcp.answer_tool("search_diagrams", [{"diagram_id": "b_1", "title": "T", "url": "u"}])
        self.assertEqual(call_tool("search_diagrams", {"query": "T"}, self.token)[0]["diagram_id"], "b_1")


class UnauthorizedTests(McpClientCase):
    def test_no_token_raises_with_the_address_the_server_named(self) -> None:
        with self.assertRaises(Unauthorized) as caught:
            call_tool("get_diagram", {})
        self.assertEqual(caught.exception.metadata_url, self.mcp.metadata_url)

    def test_an_unknown_token_raises_with_the_address(self) -> None:
        with self.assertRaises(Unauthorized) as caught:
            call_tool("get_diagram", {}, "not-a-token")
        self.assertEqual(caught.exception.metadata_url, self.mcp.metadata_url)

    def test_a_401_without_an_address_gives_none(self) -> None:
        self.mcp.force_reply(401, "application/json", b"{}")
        with self.assertRaises(Unauthorized) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIsNone(caught.exception.metadata_url)

    def test_the_address_is_read_from_the_challenge(self) -> None:
        find = mcp_client.find_metadata_url
        self.assertEqual(find({"www-authenticate": 'Bearer realm="x", resource_metadata="https://a.example/m"'}),
                         "https://a.example/m")
        self.assertIsNone(find({"www-authenticate": 'Bearer realm="x"'}))
        self.assertIsNone(find({}))


class FailureTests(McpClientCase):
    def test_a_tool_error_is_a_tool_failed_with_its_text(self) -> None:
        self.mcp.fail_tool("get_diagram", "Cloud board not found")
        with self.assertRaises(ToolFailed) as caught:
            call_tool("get_diagram", {"diagram_id": "b_9"}, self.token)
        self.assertEqual(caught.exception.reason, "Cloud board not found")
        self.assertIsInstance(caught.exception, RuntimeError)

    def test_a_tool_error_works_in_an_sse_reply(self) -> None:
        self.mcp.response_format = "sse"
        self.mcp.fail_tool("get_diagram", "Cloud board not found")
        with self.assertRaises(ToolFailed):
            call_tool("get_diagram", {}, self.token)

    def test_a_long_tool_error_is_cut_in_the_message_but_not_in_reason(self) -> None:
        self.mcp.fail_tool("save_diagram", "x" * 500)
        with self.assertRaises(ToolFailed) as caught:
            call_tool("save_diagram", {}, self.token)
        self.assertEqual(len(caught.exception.reason), 500)
        self.assertLess(len(str(caught.exception)), 200)

    def test_a_json_rpc_error_is_a_runtime_error_with_its_message(self) -> None:
        with self.assertRaises(RuntimeError) as caught:
            call_tool("no_such_tool", {}, self.token)
        self.assertNotIsInstance(caught.exception, (Unauthorized, ToolFailed))
        self.assertIn("Tool no_such_tool not found", str(caught.exception))

    def test_a_status_other_than_2xx_names_the_status_and_the_reason(self) -> None:
        self.mcp.force_reply(403, "application/json", json.dumps({"error": "blocked here"}).encode())
        with self.assertRaises(RuntimeError) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIn("HTTP 403", str(caught.exception))
        self.assertIn("blocked here", str(caught.exception))

    def test_a_status_without_a_json_body_names_only_the_status(self) -> None:
        self.mcp.force_reply(502, "text/html", b"<html>bad gateway</html>")
        with self.assertRaises(RuntimeError) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIn("HTTP 502", str(caught.exception))
        self.assertNotIn("html", str(caught.exception))

    def test_a_redirect_is_not_followed(self) -> None:
        self.mcp.force_reply(302, "text/plain", b"", {"Location": "https://elsewhere.example/mcp"})
        with self.assertRaises(RuntimeError) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIn("HTTP 302", str(caught.exception))
        self.assertEqual(len(self.mcp.requests), 1)

    def test_an_answer_that_is_neither_json_nor_a_stream_is_refused(self) -> None:
        self.mcp.force_reply(200, "text/html", b"<html></html>")
        with self.assertRaises(RuntimeError) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIn("text/html", str(caught.exception))

    def test_a_stream_without_a_reply_to_the_call_is_refused(self) -> None:
        note = {"jsonrpc": "2.0", "method": "notifications/progress", "params": {}}
        self.mcp.force_reply(200, "text/event-stream", ("event: message\ndata: " + json.dumps(note) + "\n\n").encode())
        with self.assertRaises(RuntimeError) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIn("no reply", str(caught.exception))

    def test_a_reply_to_another_request_is_not_taken_for_ours(self) -> None:
        other = {"jsonrpc": "2.0", "id": 99, "result": {"content": [{"type": "text", "text": "{}"}]}}
        self.mcp.force_reply(200, "application/json", json.dumps(other).encode())
        with self.assertRaises(RuntimeError) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIn("no reply", str(caught.exception))

    def test_tool_text_that_is_not_json_is_refused(self) -> None:
        reply = {"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": "plain words"}]}}
        self.mcp.force_reply(200, "application/json", json.dumps(reply).encode())
        with self.assertRaises(RuntimeError) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIn("not JSON", str(caught.exception))

    def test_a_result_without_one_text_is_refused(self) -> None:
        reply = {"jsonrpc": "2.0", "id": 1, "result": {"content": []}}
        self.mcp.force_reply(200, "application/json", json.dumps(reply).encode())
        with self.assertRaises(RuntimeError) as caught:
            call_tool("get_diagram", {}, self.token)
        self.assertIn("exactly one text", str(caught.exception))

    def test_a_server_that_cannot_be_reached_is_a_runtime_error(self) -> None:
        with patch.object(mcp_address, "MCP_URL", f"http://127.0.0.1:{find_free_port()}/mcp"):
            with self.assertRaises(RuntimeError) as caught:
                call_tool("get_diagram", {}, self.token)
        self.assertIn("cannot reach", str(caught.exception))
        self.assertNotIsInstance(caught.exception, (Unauthorized, ToolFailed))


if __name__ == "__main__":
    unittest.main()
