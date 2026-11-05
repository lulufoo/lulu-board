"""A fake Lulu Board API: it accepts a Bearer token the fake authorization server issued.

Like the real server it rejects an expired token with 401. A test can also make it
reject every token. The test runner skips this file.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from board_cli.token_claims import has_expired, read_claims


class ApiHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        """Keep the request line off stderr."""

    def answer(self) -> None:
        fake = self.server.fake
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        authorization = self.headers.get("Authorization", "")
        fake.requests.append({
            "method": self.command, "path": self.path, "authorization": authorization,
            "user_agent": self.headers.get("User-Agent"), "accept": self.headers.get("Accept"),
            "content_type": self.headers.get("Content-Type"), "body": raw,
        })
        status, body = (200, fake.body) if fake.accepts(authorization.removeprefix("Bearer ")) else (401, {"error": "unauthorized"})
        if status == 200:
            status = fake.status
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = do_POST = do_PATCH = answer


class FakeApiServer:
    def __init__(self, auth) -> None:
        self.auth = auth
        self.requests: list[dict] = []
        self.status = 200               # the status for a request that carries an accepted token
        self.body: dict = {"ok": True}
        self.reject_all = False
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), ApiHandler)
        self.http.fake = self
        self.base = f"http://127.0.0.1:{self.http.server_address[1]}"
        self.thread = threading.Thread(target=self.http.serve_forever, args=(0.01,), daemon=True)

    def start(self) -> "FakeApiServer":
        self.thread.start()
        return self

    def stop(self) -> None:
        self.http.shutdown()
        self.http.server_close()
        self.thread.join(timeout=5)

    def accepts(self, token: str) -> bool:
        if self.reject_all or token not in self.auth.valid_access_tokens:
            return False
        return not has_expired(read_claims(token))

    def tokens_seen(self) -> list[str]:
        return [request["authorization"].removeprefix("Bearer ") for request in self.requests]
