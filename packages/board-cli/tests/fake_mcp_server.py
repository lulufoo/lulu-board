"""A fake Lulu Board MCP server: the 401 that names the metadata address, that metadata, and tools/call.

It follows the real Worker (packages/board-mcp/src/index.js and meta.js). A request to
/mcp without a Bearer token the fake authorization server issued gets 401 with a
WWW-Authenticate header that carries resource_metadata, before the body is read. A tool
answers with its result as one JSON text. The reply to tools/call is JSON or an SSE
stream; a test switches between them. The SSE stream is framed as the SDK transport
frames it (event: message, a data line, a blank line) and can carry the frames the SDK
adds around it: a keepalive comment, a priming event without data, and a notification
before the reply. The test runner skips this file.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from board_cli.auth.token_claims import has_expired, read_claims

METADATA_PATHS = ("/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp")
REPLY_TYPES = ("application/json", "text/event-stream")
SSE_NOISE = (
    ": keepalive\n\n"
    "id: 0\nretry: 1000\ndata: \n\n"
    'event: message\ndata: {"jsonrpc": "2.0", "method": "notifications/progress", "params": {"progress": 1}}\n\n'
)
PARSE_ERROR = -32700
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602


class McpHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        """Keep the request line off stderr."""

    def send_body(self, status: int, content_type: str, payload: bytes, headers: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, status: int, body, headers: dict | None = None) -> None:
        self.send_body(status, "application/json", json.dumps(body).encode(), headers)

    def send_reply(self, reply: dict) -> None:
        """The JSON-RPC reply, as one JSON body or as one SSE event."""
        fake = self.server.fake
        if fake.response_format == "sse":
            event = (SSE_NOISE if fake.sse_noise else "") + "event: message\ndata: " + json.dumps(reply) + "\n\n"
            self.send_body(200, "text/event-stream", event.encode())
        else:
            self.send_json(200, reply)

    def read_bearer_token(self) -> str:
        header = self.headers.get("Authorization", "")
        return header[7:].strip() if header.lower().startswith("bearer ") else ""

    def do_GET(self) -> None:
        fake = self.server.fake
        fake.record(self, b"")
        if self.path in METADATA_PATHS:
            self.send_json(200, fake.build_metadata())
        else:
            self.send_body(404, "text/plain", b"Not found")

    def do_POST(self) -> None:
        fake = self.server.fake
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        fake.record(self, raw)
        if self.path != "/mcp":
            self.send_body(404, "text/plain", b"Not found")
        elif not fake.accepts(self.read_bearer_token()):
            self.send_json(401, {"error": "invalid_token"}, {"WWW-Authenticate": fake.build_challenge()})
        elif not fake.allows_reply_types(self.headers.get("Accept", "")):
            self.send_json(406, {"error": "Not Acceptable: Client must accept both application/json and text/event-stream"})
        elif not self.headers.get("Content-Type", "").lower().startswith("application/json"):
            self.send_json(415, {"error": "Unsupported Media Type: Content-Type must be application/json"})
        elif fake.forced is not None:
            status, content_type, payload, headers = fake.forced
            self.send_body(status, content_type, payload, headers)
        else:
            self.send_reply(fake.answer(raw))


class FakeMcpServer:
    def __init__(self, auth) -> None:
        self.auth = auth                 # the fake authorization server whose tokens this server accepts
        self.requests: list[dict] = []
        self.response_format = "json"    # "json" or "sse"
        self.sse_noise = False           # an SSE reply also carries a keepalive, a priming event, and a notification
        self.forced: tuple | None = None  # (status, content type, body, headers): answers every accepted POST
        self.tools: dict[str, tuple[bool, object]] = {}  # name -> (is_error, result data or error text)
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), McpHandler)
        self.http.fake = self
        self.base = f"http://127.0.0.1:{self.http.server_address[1]}"
        self.url = self.base + "/mcp"
        self.metadata_url = self.base + METADATA_PATHS[0]
        self.thread = threading.Thread(target=self.http.serve_forever, args=(0.01,), daemon=True)

    def start(self) -> "FakeMcpServer":
        self.thread.start()
        return self

    def stop(self) -> None:
        self.http.shutdown()
        self.http.server_close()
        self.thread.join(timeout=5)

    def answer_tool(self, name: str, data) -> None:
        """tools/call for name returns data as one JSON text."""
        self.tools[name] = (False, data)

    def fail_tool(self, name: str, message: str) -> None:
        """tools/call for name returns a tool error (isError) with this text."""
        self.tools[name] = (True, message)

    def force_reply(self, status: int, content_type: str, payload: bytes, headers: dict | None = None) -> None:
        """Answer every accepted POST with this, as a gateway in front of the server might."""
        self.forced = (status, content_type, payload, headers)

    def list_calls(self, name: str) -> list[dict]:
        """The arguments of every tools/call for name, in order."""
        found = []
        for request in self.requests:
            message = request["message"]
            if isinstance(message, dict) and message.get("method") == "tools/call" \
                    and (message.get("params") or {}).get("name") == name:
                found.append(message["params"].get("arguments"))
        return found

    def list_methods(self) -> list[str]:
        """The JSON-RPC method of every POST that carried one, in order."""
        return [request["message"]["method"] for request in self.requests
                if isinstance(request["message"], dict) and "method" in request["message"]]

    def build_metadata(self) -> dict:
        """The protected-resource metadata, as meta.js builds it."""
        return {
            "resource": self.url,
            "authorization_servers": [self.auth.base + "/auth/v1"],
            "bearer_methods_supported": ["header"],
        }

    def build_challenge(self) -> str:
        return f'Bearer realm="lulu-board", resource_metadata="{self.metadata_url}"'

    def accepts(self, token: str) -> bool:
        if not token or token not in self.auth.valid_access_tokens:
            return False
        return not has_expired(read_claims(token))

    @staticmethod
    def allows_reply_types(accept: str) -> bool:
        """Streamable HTTP wants a client that accepts both reply types."""
        return all(kind in accept for kind in REPLY_TYPES)

    def record(self, handler: BaseHTTPRequestHandler, raw: bytes) -> None:
        try:
            message = json.loads(raw) if raw else None
        except ValueError:
            message = None
        self.requests.append({
            "method": handler.command, "path": handler.path,
            "authorization": handler.headers.get("Authorization", ""),
            "user_agent": handler.headers.get("User-Agent"), "accept": handler.headers.get("Accept"),
            "content_type": handler.headers.get("Content-Type"), "body": raw, "message": message,
            "headers": {name.lower(): value for name, value in handler.headers.items()},
        })

    def answer(self, raw: bytes) -> dict:
        """The JSON-RPC reply to one POST body."""
        try:
            message = json.loads(raw)
        except ValueError:
            message = None
        if not isinstance(message, dict):
            return self.fail_rpc(None, PARSE_ERROR, "Parse error")
        ident = message.get("id")
        if message.get("method") != "tools/call":
            return self.fail_rpc(ident, METHOD_NOT_FOUND, "Method not found")
        name = (message.get("params") or {}).get("name")
        if name not in self.tools:
            return self.fail_rpc(ident, INVALID_PARAMS, f"Tool {name} not found")
        failed, data = self.tools[name]
        result = {"content": [{"type": "text", "text": data if failed else json.dumps(data)}]}
        if failed:
            result["isError"] = True
        return {"jsonrpc": "2.0", "id": ident, "result": result}

    @staticmethod
    def fail_rpc(ident, code: int, text: str) -> dict:
        return {"jsonrpc": "2.0", "id": ident, "error": {"code": code, "message": text}}
